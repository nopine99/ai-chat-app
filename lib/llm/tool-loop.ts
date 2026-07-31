import {
  createPartFromFunctionResponse,
  FunctionCallingConfigMode,
  type Content,
  type FunctionCall,
  type Part,
} from "@google/genai";

import {
  getGeminiClient,
  getGeminiModel,
  streamGeminiChat,
  SYSTEM_INSTRUCTION,
  toGeminiContents,
} from "@/lib/llm/gemini";
import {
  extractImagesFromToolResult,
  extractInlineImage,
  prepareToolResultForDisplay,
  prepareToolResultForModel,
} from "@/lib/chat/tool-result-media";
import {
  buildMcpToolCatalog,
  truncateForDisplay,
  type McpToolBinding,
} from "@/lib/llm/mcp-tools";
import type { ChatStreamEvent, ChatTurn } from "@/lib/llm/types";
import { toMcpError } from "@/lib/mcp/errors";
import { mcpManager } from "@/lib/mcp/manager";

/** 서버 전용 모듈. 클라이언트 컴포넌트에서 import 하지 마라. */

const MAX_TOOL_ROUNDS = 5;

interface ToolLoopOptions {
  messages: ChatTurn[];
  signal: AbortSignal;
}

/**
 * 연결된 MCP tools가 있으면 Gemini function calling 루프를 돌리고,
 * 없으면 기존 텍스트 스트리밍과 동일하게 delta만 낸다.
 */
export async function* runChatToolLoop({
  messages,
  signal,
}: ToolLoopOptions): AsyncGenerator<ChatStreamEvent> {
  const catalog = buildMcpToolCatalog();

  if (catalog.declarations.length === 0) {
    yield* streamGeminiChat({ messages, signal });
    return;
  }

  const contents: Content[] = toGeminiContents(messages);
  const ai = getGeminiClient();
  const model = getGeminiModel();
  /** 도구 이미지는 최종 텍스트 뒤에 보내 모델 라운드가 전송에 막히지 않게 한다. */
  const pendingImages: ChatStreamEvent[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (signal.aborted) return;

    const { functionCalls, modelParts } = yield* streamModelRound({
      ai,
      model,
      contents,
      signal,
      enableTools: true,
      declarations: catalog.declarations,
    });

    if (functionCalls.length === 0) {
      yield* pendingImages;
      return;
    }

    const normalizedCalls = functionCalls.map((call) => ({
      ...call,
      id: call.id ?? createCallId(),
      name: call.name ?? "unknown",
      args:
        call.args && typeof call.args === "object"
          ? call.args
          : ({} as Record<string, unknown>),
    }));

    contents.push({
      role: "model",
      // 이미지 바이너리를 다음 라운드 컨텍스트에 넣지 않아 응답이 멈추지 않게 한다.
      parts: slimPartsForHistory(
        historyPartsForCalls(modelParts, normalizedCalls)
      ),
    });

    const responseParts: Part[] = [];
    for (const call of normalizedCalls) {
      if (signal.aborted) return;

      const declarationName = call.name;
      const binding = catalog.bindings.get(declarationName);

      yield* executeOneTool({
        callId: call.id,
        declarationName,
        binding,
        args: call.args ?? {},
        responseParts,
        pendingImages,
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  if (signal.aborted) return;

  // 도구 라운드 소진 후 도구 없이 최종 답 1회
  yield* streamModelRound({
    ai,
    model,
    contents,
    signal,
    enableTools: false,
    declarations: catalog.declarations,
  });
  yield* pendingImages;
}

async function* streamModelRound(options: {
  ai: ReturnType<typeof getGeminiClient>;
  model: string;
  contents: Content[];
  signal: AbortSignal;
  enableTools: boolean;
  declarations: ReturnType<typeof buildMcpToolCatalog>["declarations"];
}): AsyncGenerator<
  ChatStreamEvent,
  { functionCalls: FunctionCall[]; modelParts: Part[] }
> {
  const { ai, model, contents, signal, enableTools, declarations } = options;

  const stream = await ai.models.generateContentStream({
    model,
    contents,
    config: {
      abortSignal: signal,
      systemInstruction: SYSTEM_INSTRUCTION,
      ...(enableTools
        ? {
            tools: [{ functionDeclarations: declarations }],
            toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.AUTO,
              },
            },
            automaticFunctionCalling: { disable: true },
          }
        : {
            toolConfig: {
              functionCallingConfig: {
                mode: FunctionCallingConfigMode.NONE,
              },
            },
            automaticFunctionCalling: { disable: true },
          }),
    },
  });

  const modelParts: Part[] = [];
  let functionCalls: FunctionCall[] = [];

  for await (const chunk of stream) {
    if (signal.aborted) {
      return { functionCalls, modelParts };
    }

    const text = chunk.text;
    if (text) {
      yield { type: "delta", text };
    }

    const parts = chunk.candidates?.[0]?.content?.parts;
    if (parts?.length) {
      for (const part of parts) {
        modelParts.push(part);
      }
    }

    if (chunk.functionCalls?.length) {
      functionCalls = chunk.functionCalls;
    }
  }

  if (functionCalls.length === 0) {
    functionCalls = modelParts
      .map((part) => part.functionCall)
      .filter((call): call is FunctionCall => Boolean(call?.name));
  }

  // 도구 호출이 더 있으면 이미지 전송을 미뤄 다음 모델 라운드가 바로 시작되게 한다.
  if (functionCalls.length === 0) {
    const seenImageKeys = new Set<string>();
    for (const part of modelParts) {
      const image = extractInlineImage(part);
      if (!image) continue;
      const key = `${image.mimeType}:${image.data.length}:${image.data.slice(0, 48)}`;
      if (seenImageKeys.has(key)) continue;
      seenImageKeys.add(key);
      yield {
        type: "image",
        id: image.id,
        mimeType: image.mimeType,
        data: image.data,
        alt: image.alt,
      };
    }
  }

  return { functionCalls, modelParts: slimPartsForHistory(modelParts) };
}

async function* executeOneTool(options: {
  callId: string;
  declarationName: string;
  binding: McpToolBinding | undefined;
  args: Record<string, unknown>;
  responseParts: Part[];
  pendingImages: ChatStreamEvent[];
}): AsyncGenerator<ChatStreamEvent> {
  const {
    callId,
    declarationName,
    binding,
    args,
    responseParts,
    pendingImages,
  } = options;

  if (!binding) {
    const error = {
      error: `알 수 없는 도구입니다: ${declarationName}`,
    };
    yield {
      type: "tool_start",
      callId,
      serverId: "unknown",
      serverName: "unknown",
      name: declarationName || "unknown",
      args: truncateForDisplay(args) as Record<string, unknown>,
    };
    yield {
      type: "tool_result",
      callId,
      ok: false,
      result: error,
    };
    responseParts.push(
      createPartFromFunctionResponse(callId, declarationName || "unknown", error)
    );
    return;
  }

  yield {
    type: "tool_start",
    callId,
    serverId: binding.serverId,
    serverName: binding.serverName,
    name: binding.toolName,
    args: truncateForDisplay(args) as Record<string, unknown>,
  };

  try {
    const raw = await mcpManager.callTool(
      binding.serverId,
      binding.toolName,
      args
    );
    const images = extractImagesFromToolResult(raw, callId);

    // 작은 tool_result만 즉시 보내고, 이미지 바이트는 최종 답변 뒤로 미룬다.
    yield {
      type: "tool_result",
      callId,
      ok: true,
      result: prepareToolResultForDisplay(raw, images),
    };

    for (const image of images) {
      pendingImages.push({
        type: "image",
        id: image.id,
        mimeType: image.mimeType,
        data: image.data,
        alt: image.alt,
        callId: image.callId,
      });
    }

    responseParts.push(
      createPartFromFunctionResponse(callId, declarationName, {
        output: prepareToolResultForModel(raw),
      })
    );
  } catch (error) {
    const mcpError = toMcpError(error);
    const failure = {
      error: mcpError.message,
      code: mcpError.code,
    };
    yield {
      type: "tool_result",
      callId,
      ok: false,
      result: failure,
    };
    responseParts.push(
      createPartFromFunctionResponse(callId, declarationName, failure)
    );
  }
}

function createCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 모델 히스토리에 functionCall id를 맞춰 넣고, parts에 없으면 보충한다. */
function historyPartsForCalls(
  modelParts: Part[],
  calls: Array<FunctionCall & { id: string; name: string }>
): Part[] {
  const parts = modelParts.map((part) => {
    if (!part.functionCall?.name) return part;
    const match = calls.find((call) => call.name === part.functionCall?.name);
    if (!match) return part;
    return {
      ...part,
      functionCall: { ...part.functionCall, id: match.id },
    };
  });

  if (parts.some((part) => part.functionCall)) {
    return parts;
  }

  return [
    ...parts,
    ...calls.map((call) => ({
      functionCall: call,
    })),
  ];
}

/** 다음 generate 호출에 이미지 바이너리가 다시 들어가지 않게 치환한다. */
function slimPartsForHistory(parts: Part[]): Part[] {
  return parts.map((part) => {
    if (!part.inlineData?.data) return part;
    return {
      text: "[생성한 이미지를 사용자 화면에 표시했습니다.]",
    };
  });
}

import type { FunctionDeclaration } from "@google/genai";

import { mcpManager } from "@/lib/mcp/manager";

/** 서버 전용 모듈. 클라이언트 컴포넌트에서 import 하지 마라. */

const MAX_DECLARATION_NAME = 64;
const EMPTY_PARAMS = { type: "object", properties: {} } as const;

export interface McpToolBinding {
  serverId: string;
  serverName: string;
  toolName: string;
}

export interface McpToolCatalog {
  declarations: FunctionDeclaration[];
  bindings: Map<string, McpToolBinding>;
}

/**
 * 현재 연결된 MCP 서버의 tools를 Gemini functionDeclarations로 변환한다.
 * 선언 이름은 `s_{serverId}_{toolName}`를 sanitize한 값이며, bindings로 역매핑한다.
 */
export function buildMcpToolCatalog(): McpToolCatalog {
  const snapshot = mcpManager.snapshot();
  const declarations: FunctionDeclaration[] = [];
  const bindings = new Map<string, McpToolBinding>();
  const usedNames = new Set<string>();

  for (const [serverId, state] of Object.entries(snapshot)) {
    if (state.status !== "connected") continue;

    const tools = state.capabilities?.tools ?? [];
    const serverName = state.serverInfo?.name?.trim() || serverId;

    for (const tool of tools) {
      const declarationName = uniqueDeclarationName(
        serverId,
        tool.name,
        usedNames
      );
      usedNames.add(declarationName);
      bindings.set(declarationName, {
        serverId,
        serverName,
        toolName: tool.name,
      });

      const description = [tool.title, tool.description]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(" — ");

      declarations.push({
        name: declarationName,
        description:
          description ||
          `${serverName} 서버의 ${tool.name} 도구`,
        parametersJsonSchema: toParametersJsonSchema(tool.inputSchema),
      });
    }
  }

  return { declarations, bindings };
}

function uniqueDeclarationName(
  serverId: string,
  toolName: string,
  used: Set<string>
): string {
  const base = sanitizeDeclarationName(`s_${serverId}_${toolName}`);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (true) {
    const suffixText = `_${suffix}`;
    const truncated = base.slice(
      0,
      Math.max(1, MAX_DECLARATION_NAME - suffixText.length)
    );
    const candidate = `${truncated}${suffixText}`;
    if (!used.has(candidate)) return candidate;
    suffix += 1;
  }
}

/** Gemini 함수명: 영문·숫자·밑줄, 최대 64자. */
function sanitizeDeclarationName(raw: string): string {
  let name = raw.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z_]/.test(name)) {
    name = `f_${name}`;
  }
  name = name.replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!name) name = "tool";
  return name.slice(0, MAX_DECLARATION_NAME);
}

function toParametersJsonSchema(inputSchema: unknown): unknown {
  if (
    typeof inputSchema === "object" &&
    inputSchema !== null &&
    !Array.isArray(inputSchema)
  ) {
    const schema = inputSchema as Record<string, unknown>;
    if (schema.type === "object" || schema.properties) {
      return {
        ...schema,
        type: schema.type ?? "object",
        properties:
          typeof schema.properties === "object" && schema.properties !== null
            ? schema.properties
            : {},
      };
    }
  }
  return EMPTY_PARAMS;
}

/** UI·SSE용 JSON truncate (약 2KB). */
export function truncateForDisplay(value: unknown, maxChars = 2048): unknown {
  if (value === undefined) return value;
  try {
    const json = JSON.stringify(value);
    if (json === undefined) return String(value).slice(0, maxChars);
    if (json.length <= maxChars) return value;
    return {
      _truncated: true,
      preview: json.slice(0, maxChars),
    };
  } catch {
    return String(value).slice(0, maxChars);
  }
}

/** LLM functionResponse용. 과도한 페이로드만 잘라낸다. */
export function truncateForModel(value: unknown, maxChars = 16_384): unknown {
  return truncateForDisplay(value, maxChars);
}

import { httpStatusFor, toMcpError } from "@/lib/mcp/errors";
import { mcpManager } from "@/lib/mcp/manager";
import { parseServerId } from "@/lib/mcp/validate";
import type { McpApiErrorBody } from "@/lib/types/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 기존 연결을 끊지 않고 Tools/Prompts/Resources 목록만 다시 조회한다. */
export async function POST(request: Request) {
  try {
    const serverId = parseServerId(await readJsonBody(request));
    const capabilities = await mcpManager.refresh(serverId);
    return Response.json({ capabilities });
  } catch (error) {
    const mcpError = toMcpError(error);
    const body: McpApiErrorBody = {
      code: mcpError.code,
      message: mcpError.message,
    };
    return Response.json(body, { status: httpStatusFor(mcpError.code) });
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

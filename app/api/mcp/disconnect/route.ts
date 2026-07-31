import { toMcpError, httpStatusFor } from "@/lib/mcp/errors";
import { mcpManager } from "@/lib/mcp/manager";
import { parseServerId } from "@/lib/mcp/validate";
import type { McpApiErrorBody } from "@/lib/types/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const serverId = parseServerId(await readJsonBody(request));
    await mcpManager.disconnect(serverId);
    return Response.json({ status: "disconnected" as const });
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

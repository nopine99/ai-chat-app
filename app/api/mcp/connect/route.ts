import { toMcpError, httpStatusFor } from "@/lib/mcp/errors";
import { mcpManager } from "@/lib/mcp/manager";
import { parseServerConfig } from "@/lib/mcp/validate";
import type { McpApiErrorBody } from "@/lib/types/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const config = parseServerConfig(await readJsonBody(request));
    const state = await mcpManager.connect(config);
    return Response.json(state);
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

import { httpStatusFor, toMcpError } from "@/lib/mcp/errors";
import { mcpManager } from "@/lib/mcp/manager";
import { parseResourceReadBody } from "@/lib/mcp/validate";
import type { McpApiErrorBody } from "@/lib/types/mcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { serverId, uri } = parseResourceReadBody(
      await readJsonBody(request)
    );
    const result = await mcpManager.readResource(serverId, uri);
    return Response.json({ result });
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

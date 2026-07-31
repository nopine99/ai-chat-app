"use client";

import { useState, type ReactNode } from "react";
import {
  BookOpen,
  FileText,
  MessageSquareText,
  Play,
  RefreshCw,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { McpRunDialog } from "@/components/mcp/mcp-run-dialog";
import { McpResourceDialog } from "@/components/mcp/mcp-resource-dialog";
import { useMcp } from "@/hooks/use-mcp";
import { cn } from "@/lib/utils";
import { extractSchemaFields, type SchemaField } from "@/lib/mcp/schema-form";
import type {
  McpPromptArgument,
  McpServerCapabilities,
} from "@/lib/types/mcp";

interface McpCapabilityPanelProps {
  serverId: string;
  capabilities: McpServerCapabilities | undefined;
}

interface RunTarget {
  kind: "tool" | "prompt";
  name: string;
  description?: string;
  fields: SchemaField[];
}

function promptArgFields(args: McpPromptArgument[] | undefined): SchemaField[] {
  return (args ?? []).map((arg) => ({
    key: arg.name,
    kind: "string",
    title: arg.name,
    description: arg.description,
    required: Boolean(arg.required),
  }));
}

export function McpCapabilityPanel({
  serverId,
  capabilities,
}: McpCapabilityPanelProps) {
  const mcp = useMcp();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runTarget, setRunTarget] = useState<RunTarget | null>(null);
  const [resourceTarget, setResourceTarget] = useState<{
    uri: string;
    name?: string;
  } | null>(null);

  const tools = capabilities?.tools ?? [];
  const prompts = capabilities?.prompts ?? [];
  const resources = capabilities?.resources ?? [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await mcp.refreshCapabilities(serverId);
    } catch {
      // 새로고침 실패는 조용히 무시한다. 사용자가 다시 시도할 수 있다.
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          서버가 제공하는 기능
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
          aria-label="목록 새로고침"
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      <Tabs defaultValue="tools">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="tools" className="gap-1.5">
            <Wrench className="size-3.5" />
            Tools ({tools.length})
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1.5">
            <MessageSquareText className="size-3.5" />
            Prompts ({prompts.length})
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5">
            <FileText className="size-3.5" />
            Resources ({resources.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tools" className="mt-3">
          {tools.length === 0 ? (
            <EmptyNotice
              icon={<Wrench className="size-4" />}
              text="등록된 tool이 없어요."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {tools.map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Wrench className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {tool.title ?? tool.name}
                      </p>
                      {tool.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() =>
                      setRunTarget({
                        kind: "tool",
                        name: tool.name,
                        description: tool.description,
                        fields: extractSchemaFields(tool.inputSchema),
                      })
                    }
                  >
                    <Play className="size-3.5" />
                    테스트
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="prompts" className="mt-3">
          {prompts.length === 0 ? (
            <EmptyNotice
              icon={<MessageSquareText className="size-4" />}
              text="등록된 prompt가 없어요."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {prompts.map((prompt) => (
                <li
                  key={prompt.name}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <MessageSquareText className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {prompt.title ?? prompt.name}
                      </p>
                      {prompt.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {prompt.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() =>
                      setRunTarget({
                        kind: "prompt",
                        name: prompt.name,
                        description: prompt.description,
                        fields: promptArgFields(prompt.arguments),
                      })
                    }
                  >
                    <Play className="size-3.5" />
                    테스트
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="resources" className="mt-3">
          {resources.length === 0 ? (
            <EmptyNotice
              icon={<FileText className="size-4" />}
              text="등록된 resource가 없어요."
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resources.map((resource) => (
                <li
                  key={resource.uri}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <FileText className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {resource.title ?? resource.name ?? resource.uri}
                      </p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {resource.uri}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() =>
                      setResourceTarget({
                        uri: resource.uri,
                        name: resource.title ?? resource.name,
                      })
                    }
                  >
                    <BookOpen className="size-3.5" />
                    읽기
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {runTarget && (
        <McpRunDialog
          open
          onOpenChange={(next) => !next && setRunTarget(null)}
          serverId={serverId}
          kind={runTarget.kind}
          name={runTarget.name}
          description={runTarget.description}
          fields={runTarget.fields}
        />
      )}

      {resourceTarget && (
        <McpResourceDialog
          open
          onOpenChange={(next) => !next && setResourceTarget(null)}
          serverId={serverId}
          uri={resourceTarget.uri}
          name={resourceTarget.name}
        />
      )}
    </div>
  );
}

function EmptyNotice({
  icon,
  text,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center">
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

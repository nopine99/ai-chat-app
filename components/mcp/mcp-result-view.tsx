function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function RawJson({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-2 text-xs">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ResourceContentView({ resource }: { resource: unknown }) {
  if (!isRecord(resource)) return <RawJson value={resource} />;

  const uri = typeof resource.uri === "string" ? resource.uri : undefined;
  const mimeType =
    typeof resource.mimeType === "string" ? resource.mimeType : undefined;

  const meta = (
    <p className="truncate text-xs text-muted-foreground">
      {uri}
      {mimeType ? ` · ${mimeType}` : ""}
    </p>
  );

  if (typeof resource.text === "string") {
    return (
      <div className="flex flex-col gap-1">
        {meta}
        <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
          {resource.text}
        </pre>
      </div>
    );
  }

  if (typeof resource.blob === "string") {
    const isImage = mimeType?.startsWith("image/");
    return (
      <div className="flex flex-col gap-1">
        {meta}
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 서버가 돌려준 base64 데이터를 그대로 렌더링한다.
          <img
            src={`data:${mimeType};base64,${resource.blob}`}
            alt={uri ?? "리소스 미리보기"}
            className="max-h-64 max-w-full rounded-lg border object-contain"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            바이너리 데이터 (base64 {resource.blob.length.toLocaleString()}자)
          </p>
        )}
      </div>
    );
  }

  return <RawJson value={resource} />;
}

function ContentBlockView({
  block,
  imageResolver,
}: {
  block: unknown;
  imageResolver?: (imageId: string) => { mimeType: string; data: string; alt?: string } | undefined;
}) {
  if (!isRecord(block)) return <RawJson value={block} />;

  switch (block.type) {
    case "text":
      return (
        <p className="whitespace-pre-wrap text-sm">{String(block.text)}</p>
      );

    case "image_ref": {
      const imageId = typeof block.imageId === "string" ? block.imageId : "";
      const resolved = imageId ? imageResolver?.(imageId) : undefined;
      if (resolved) {
        return (
          // eslint-disable-next-line @next/next/no-img-element -- 첨부 이미지를 미리보기로 보여준다.
          <img
            src={`data:${resolved.mimeType};base64,${resolved.data}`}
            alt={resolved.alt || "도구 응답 이미지"}
            className="max-h-64 max-w-full rounded-lg border object-contain"
          />
        );
      }
      return (
        <p className="text-xs text-muted-foreground">
          이미지는 위 미리보기를 확인하세요.
        </p>
      );
    }

    case "image":
      return typeof block.data === "string" && typeof block.mimeType === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서버가 돌려준 base64 데이터를 그대로 렌더링한다.
        <img
          src={`data:${block.mimeType};base64,${block.data}`}
          alt="도구 응답 이미지"
          className="max-h-64 max-w-full rounded-lg border object-contain"
        />
      ) : (
        <RawJson value={block} />
      );

    case "audio":
      return typeof block.data === "string" && typeof block.mimeType === "string" ? (
        <audio
          controls
          src={`data:${block.mimeType};base64,${block.data}`}
          className="w-full"
        />
      ) : (
        <RawJson value={block} />
      );

    case "resource":
      return <ResourceContentView resource={block.resource} />;

    case "resource_link":
      return (
        <a
          href={typeof block.uri === "string" ? block.uri : "#"}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary underline underline-offset-4"
        >
          {typeof block.title === "string" ? block.title : String(block.uri)}
        </a>
      );

    default:
      return <RawJson value={block} />;
  }
}

/** callTool/getPrompt/readResource 응답을 형태에 맞게 사람이 읽기 좋은 형태로 보여준다. 알 수 없는 형태는 원문 JSON으로 표시한다. */
export function McpResultView({
  result,
  imageResolver,
}: {
  result: unknown;
  imageResolver?: (imageId: string) =>
    | { mimeType: string; data: string; alt?: string }
    | undefined;
}) {
  if (!isRecord(result)) return <RawJson value={result} />;

  if (Array.isArray(result.content)) {
    return (
      <div className="flex flex-col gap-2">
        {Boolean(result.isError) && (
          <p className="text-sm text-destructive">
            도구가 에러 결과를 반환했어요.
          </p>
        )}
        {result.content.length === 0 ? (
          <p className="text-sm text-muted-foreground">응답 내용이 없어요.</p>
        ) : (
          result.content.map((block, index) => (
            <ContentBlockView
              key={index}
              block={block}
              imageResolver={imageResolver}
            />
          ))
        )}
      </div>
    );
  }

  if (Array.isArray(result.messages)) {
    return (
      <div className="flex flex-col gap-2">
        {typeof result.description === "string" && (
          <p className="text-sm text-muted-foreground">{result.description}</p>
        )}
        {result.messages.map((message, index) => (
          <div key={index} className="rounded-lg border p-2">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              {isRecord(message) ? String(message.role) : `#${index}`}
            </p>
            {isRecord(message) ? (
              <ContentBlockView block={message.content} />
            ) : (
              <RawJson value={message} />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(result.contents)) {
    return (
      <div className="flex flex-col gap-2">
        {result.contents.map((resource, index) => (
          <ResourceContentView key={index} resource={resource} />
        ))}
      </div>
    );
  }

  return <RawJson value={result} />;
}

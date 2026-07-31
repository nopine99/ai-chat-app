/**
 * MCP/모델 이미지 페이로드를 UI 전송용과 모델 컨텍스트용으로 나눈다.
 * 큰 base64를 말풍선 텍스트·모델 히스토리에 넣으면 파싱/토큰 비용으로 응답이 멈춘 것처럼 보인다.
 */

const MAX_TEXT_CHARS = 4_096;

export interface ExtractedImage {
  id: string;
  mimeType: string;
  data: string;
  alt?: string;
  callId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isImageMime(mimeType: unknown): mimeType is string {
  return typeof mimeType === "string" && mimeType.startsWith("image/");
}

function truncateText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function createImageId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushResourceImage(
  images: ExtractedImage[],
  resource: Record<string, unknown>,
  callId?: string
) {
  if (typeof resource.blob !== "string" || !isImageMime(resource.mimeType)) {
    return;
  }
  const data = resource.blob.replace(/\s/g, "");
  if (data.length < 32) return;
  images.push({
    id: createImageId(),
    mimeType: resource.mimeType,
    data,
    alt: typeof resource.uri === "string" ? resource.uri : undefined,
    callId,
  });
}

/** MCP callTool 원본에서 이미지를 분리한다. */
export function extractImagesFromToolResult(
  result: unknown,
  callId?: string
): ExtractedImage[] {
  if (!isRecord(result)) return [];

  const images: ExtractedImage[] = [];

  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (!isRecord(block)) continue;
      if (
        block.type === "image" &&
        typeof block.data === "string" &&
        isImageMime(block.mimeType)
      ) {
        const data = block.data.replace(/\s/g, "");
        if (data.length < 32) continue;
        images.push({
          id: createImageId(),
          mimeType: block.mimeType,
          data,
          alt: typeof block.alt === "string" ? block.alt : undefined,
          callId,
        });
      }
      if (block.type === "resource" && isRecord(block.resource)) {
        pushResourceImage(images, block.resource, callId);
      }
    }
  }

  if (Array.isArray(result.contents)) {
    for (const resource of result.contents) {
      if (isRecord(resource)) pushResourceImage(images, resource, callId);
    }
  }

  return images;
}

/**
 * SSE tool_result용. 이미지 바이너리는 빼고 ref만 남겨 프레임을 작게 유지한다.
 * 실제 바이트는 별도 `image` 이벤트로 보낸다.
 */
export function prepareToolResultForDisplay(
  value: unknown,
  images: ExtractedImage[]
): unknown {
  if (!isRecord(value)) return value;

  const queue = [...images];

  if (Array.isArray(value.content)) {
    return {
      ...value,
      content: value.content.map((block) => {
        if (!isRecord(block)) return block;
        if (block.type === "text" && typeof block.text === "string") {
          return { ...block, text: truncateText(block.text, MAX_TEXT_CHARS) };
        }
        if (block.type === "image" && typeof block.data === "string") {
          const image = queue.shift();
          return {
            type: "image_ref",
            imageId: image?.id,
            mimeType: block.mimeType,
            alt: typeof block.alt === "string" ? block.alt : undefined,
          };
        }
        if (block.type === "resource" && isRecord(block.resource)) {
          return {
            ...block,
            resource: stripResourceBlob(block.resource, queue),
          };
        }
        if (block.type === "audio" && typeof block.data === "string") {
          return {
            type: "audio",
            mimeType: block.mimeType,
            omitted: true,
            note: "오디오는 미리보기에서 생략했습니다.",
          };
        }
        return block;
      }),
    };
  }

  if (Array.isArray(value.contents)) {
    return {
      ...value,
      contents: value.contents.map((resource) => {
        if (!isRecord(resource)) return resource;
        return stripResourceBlob(resource, queue);
      }),
    };
  }

  return value;
}

function stripResourceBlob(
  resource: Record<string, unknown>,
  queue: ExtractedImage[]
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...resource };
  if (typeof next.text === "string") {
    next.text = truncateText(next.text, MAX_TEXT_CHARS);
  }
  if (typeof next.blob === "string" && isImageMime(next.mimeType)) {
    const image = queue.shift();
    delete next.blob;
    next.imageId = image?.id;
    next.omitted = true;
    next.note = "이미지는 채팅 화면에 표시됩니다.";
  }
  return next;
}

/** 모델 functionResponse용. 이미지 바이트는 절대 넣지 않는다. */
export function prepareToolResultForModel(value: unknown): unknown {
  if (!isRecord(value)) return value;

  if (Array.isArray(value.content)) {
    return {
      ...value,
      content: value.content.map((block) => {
        if (!isRecord(block)) return block;
        if (block.type === "text" && typeof block.text === "string") {
          return { ...block, text: truncateText(block.text, MAX_TEXT_CHARS) };
        }
        if (block.type === "image" || block.type === "audio") {
          return {
            type: block.type,
            mimeType: block.mimeType,
            omitted: true,
            note: "미디어는 사용자 화면에 표시되었습니다. 내용을 짧게 설명만 하세요.",
          };
        }
        if (block.type === "resource" && isRecord(block.resource)) {
          const resource = { ...block.resource };
          if (typeof resource.text === "string") {
            resource.text = truncateText(resource.text, MAX_TEXT_CHARS);
          }
          if (typeof resource.blob === "string") {
            delete resource.blob;
            resource.omitted = true;
            resource.note = "바이너리 리소스는 사용자 화면에 표시되었습니다.";
          }
          return { ...block, resource };
        }
        return block;
      }),
    };
  }

  if (Array.isArray(value.contents)) {
    return {
      ...value,
      contents: value.contents.map((resource) => {
        if (!isRecord(resource)) return resource;
        const next = { ...resource };
        if (typeof next.text === "string") {
          next.text = truncateText(next.text, MAX_TEXT_CHARS);
        }
        if (typeof next.blob === "string") {
          delete next.blob;
          next.omitted = true;
        }
        return next;
      }),
    };
  }

  return value;
}

/** Gemini Part.inlineData에서 완성된 이미지를 뽑는다. */
export function extractInlineImage(part: {
  inlineData?: { data?: string; mimeType?: string };
}): ExtractedImage | null {
  const data = part.inlineData?.data?.replace(/\s/g, "");
  const mimeType = part.inlineData?.mimeType;
  if (!data || !isImageMime(mimeType) || data.length < 32) return null;
  return {
    id: createImageId(),
    mimeType,
    data,
    alt: "생성 이미지",
  };
}

/** 이전 답변에 섞인 data URL을 다음 요청 본문에서 제거한다. */
export function stripMediaFromContent(content: string): string {
  return content
    .replace(/!\[[^\]]*]\(data:image\/[^)]+\)/gi, "[이미지]")
    .replace(
      /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/+=]+/gi,
      "[이미지]"
    );
}

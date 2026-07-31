"use client";

import { ChatImage } from "@/components/chat/chat-image";
import type { ChatImageAttachment } from "@/lib/types/chat";

interface MessageAttachmentsProps {
  attachments: ChatImageAttachment[];
}

/** 본문 마크다운과 분리된 생성 이미지 목록. */
export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {attachments.map((attachment) => (
        <ChatImage
          key={attachment.id}
          mimeType={attachment.mimeType}
          data={attachment.data}
          alt={attachment.alt || "생성 이미지"}
        />
      ))}
    </div>
  );
}

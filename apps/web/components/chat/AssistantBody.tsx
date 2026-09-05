"use client";

import { memo } from "react";
import { ChatMarkdown } from "./ChatMarkdown";
import { splitMessageSegments, type ProseSegment } from "@/lib/message-segments";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Assistant message body.
 *
 * Prose only. All file operations are hidden from the chat — a Replit/Lovable
 * style progress view. The activity panel and plan checklist convey what is
 * happening without exposing paths, and the streaming <forge-write> preview
 * that used to live here was the single biggest per-token re-render source
 * (it re-parsed and re-rendered a growing code block on every flush).
 */
function AssistantBodyInner({
  content,
  streaming = false,
  onOpenFile: _onOpenFile,
}: {
  content: string;
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useI18n();
  const segments = splitMessageSegments(content || "");
  const prose = segments.filter((s): s is ProseSegment => s.kind === "text");

  if (!prose.length) {
    return streaming ? (
      <p className="assistant-pending">
        <span className="assistant-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{t("genBuilding")}</span>
      </p>
    ) : null;
  }

  return (
    <div className="assistant-body">
      {prose.map((segment, i) => (
        <ChatMarkdown
          key={`t-${i}`}
          content={segment.content}
          streaming={streaming && i === prose.length - 1}
        />
      ))}
    </div>
  );
}

// Historical messages pass stable content and a stable onOpenFile — memo keeps
// them out of every 80ms flush.
export const AssistantBody = memo(AssistantBodyInner);

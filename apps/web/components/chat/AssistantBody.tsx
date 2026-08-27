"use client";

import { ChatMarkdown } from "./ChatMarkdown";
import { FileOpBlock } from "./FileOpBlock";
import {
  splitMessageSegments,
  type ProseSegment,
  type WriteSegment,
} from "@/lib/message-segments";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Assistant message body.
 *
 * Prose only. File operations are stripped from the body: they are already
 * listed in the activity panel and grouped under their plan task, so repeating
 * one card per <forge-write> buried the conversation under dozens of rows.
 * The single exception is the write currently streaming, shown as a one-line
 * progress indicator so the user sees work happening.
 */
export function AssistantBody({
  content,
  streaming = false,
  onOpenFile,
}: {
  content: string;
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useI18n();
  const segments = splitMessageSegments(content || "");

  if (!segments.length) {
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

  const lastIndex = segments.length - 1;
  const visible: (ProseSegment | WriteSegment)[] = [];
  segments.forEach((segment, i) => {
    if (segment.kind === "text") visible.push(segment);
    // Only the in-progress write earns a line; finished ops live in the
    // activity panel / plan checklist.
    else if (segment.kind === "write" && !segment.complete && streaming && i === lastIndex) {
      visible.push(segment);
    }
  });

  if (!visible.length && streaming) {
    return (
      <p className="assistant-pending">
        <span className="assistant-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>{t("genBuilding")}</span>
      </p>
    );
  }

  return (
    <div className="assistant-body">
      {visible.map((segment, i) => {
        if (segment.kind === "text") {
          return (
            <ChatMarkdown
              key={`t-${i}`}
              content={segment.content}
              streaming={streaming && i === visible.length - 1}
            />
          );
        }
        return (
          <FileOpBlock
            key={`w-${i}-${segment.path}`}
            path={segment.path}
            content={segment.content}
            complete={false}
            onOpenFile={onOpenFile}
          />
        );
      })}
    </div>
  );
}

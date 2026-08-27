"use client";

import { ChatMarkdown } from "./ChatMarkdown";
import { FileOpBlock } from "./FileOpBlock";
import { splitMessageSegments } from "@/lib/message-segments";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Assistant message body.
 *
 * Splits the raw answer into prose and file operations: prose is rendered as
 * markdown, each `<forge-write>` becomes a collapsed card. Without this the
 * live stream printed the raw tags and the whole file body as text.
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

  // Only the very last segment can still be growing.
  const lastIndex = segments.length - 1;

  return (
    <div className="assistant-body">
      {segments.map((segment, i) => {
        if (segment.kind === "text") {
          return (
            <ChatMarkdown
              key={`t-${i}`}
              content={segment.content}
              streaming={streaming && i === lastIndex}
            />
          );
        }
        if (segment.kind === "delete") {
          return <FileOpBlock key={`d-${i}-${segment.path}`} path={segment.path} />;
        }
        return (
          <FileOpBlock
            key={`w-${i}-${segment.path}`}
            path={segment.path}
            content={segment.content}
            complete={segment.complete}
            onOpenFile={onOpenFile}
          />
        );
      })}
    </div>
  );
}

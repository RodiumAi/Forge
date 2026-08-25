"use client";

import { FileText } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { FileTypeIcon } from "@/components/builder/file-icons";
import {
  parseUserMessageContent,
  type MessageAttachment,
} from "@/lib/prompt-attachments";

type Props = {
  content: string;
  attachments?: MessageAttachment[] | null;
  /** Live preview origin — used to resolve public/ image thumbs. */
  previewBase?: string | null;
};

function resolveThumbSrc(
  file: MessageAttachment,
  previewBase?: string | null,
): string | null {
  if (file.previewUrl) return file.previewUrl;
  if (!file.publicPath) return null;
  if (/^https?:\/\//i.test(file.publicPath) || file.publicPath.startsWith("blob:")) {
    return file.publicPath;
  }
  if (previewBase) {
    const base = previewBase.replace(/\/$/, "");
    const path = file.publicPath.startsWith("/")
      ? file.publicPath
      : `/${file.publicPath}`;
    return `${base}${path}`;
  }
  return null;
}

export function UserMessageBody({ content, attachments, previewBase }: Props) {
  const parsed = parseUserMessageContent(content);
  const files =
    attachments && attachments.length
      ? attachments
      : parsed.attachments;

  return (
    <div className="builder-msg-body builder-msg-user-body">
      {parsed.text ? <div className="builder-msg-text">{parsed.text}</div> : null}
      {files.length > 0 ? (
        <ul className="builder-msg-attachments">
          {files.map((file) => {
            const src =
              file.kind === "image" ? resolveThumbSrc(file, previewBase) : null;
            return (
              <li key={`${file.kind}-${file.name}`} className="builder-msg-attachment">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={file.name} className="builder-msg-attach-thumb" />
                ) : file.kind === "image" ? (
                  <span className="builder-msg-attach-fallback">
                    <FileTypeIcon path={file.name} size="md" />
                  </span>
                ) : (
                  <span className="builder-msg-attach-fallback">
                    <Icon icon={FileText} className="ui-icon-md" />
                  </span>
                )}
                <span className="builder-msg-attach-name">{file.name}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { FileText } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { FileTypeIcon } from "@/components/builder/file-icons";
import { assetContentUrl } from "@/lib/asset-url";
import {
  parseUserMessageContent,
  type MessageAttachment,
} from "@/lib/prompt-attachments";

type Props = {
  content: string;
  attachments?: MessageAttachment[] | null;
  /** Live preview origin — used to resolve public/ image thumbs. */
  previewBase?: string | null;
  projectId?: string | null;
};

function resolveThumbSrc(
  file: MessageAttachment,
  previewBase?: string | null,
  projectId?: string | null,
): string | null {
  if (file.objectId && projectId) {
    const durable = assetContentUrl(projectId, file.objectId);
    if (durable) return durable;
  }
  // Prefer durable HTTP URLs over ephemeral blob: after refresh blobs die.
  const url = file.publicUrl || file.publicPath;
  if (url && /^https?:\/\//i.test(url) && !url.includes("localhost:9000/forge-uploads")) {
    return url;
  }
  if (file.previewUrl && !file.previewUrl.startsWith("blob:")) {
    return file.previewUrl;
  }
  if (file.previewUrl?.startsWith("blob:")) {
    return file.previewUrl;
  }
  if (url) {
    if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) {
      // Private MinIO URL — only usable if somehow public; still try as last resort.
      return url;
    }
    if (previewBase) {
      const base = previewBase.replace(/\/$/, "");
      const path = url.startsWith("/") ? url : `/${url}`;
      return `${base}${path}`;
    }
  }
  return null;
}

export function UserMessageBody({ content, attachments, previewBase, projectId }: Props) {
  const parsed = parseUserMessageContent(content);
  // Prefer parsed (durable object ids from content) over stale blob attachments.
  const files =
    parsed.attachments.length > 0
      ? parsed.attachments.map((parsedAtt) => {
          const live = attachments?.find((a) => a.name === parsedAtt.name);
          return {
            ...parsedAtt,
            previewUrl: live?.previewUrl && !live.previewUrl.startsWith("blob:")
              ? live.previewUrl
              : parsedAtt.previewUrl,
            objectId: parsedAtt.objectId || live?.objectId || null,
            publicUrl: parsedAtt.publicUrl || live?.publicUrl || null,
          };
        })
      : attachments && attachments.length
        ? attachments
        : [];

  return (
    <div className="builder-msg-body builder-msg-user-body">
      {parsed.text ? <div className="builder-msg-text">{parsed.text}</div> : null}
      {files.length > 0 ? (
        <ul className="builder-msg-attachments">
          {files.map((file) => {
            const src =
              file.kind === "image" ? resolveThumbSrc(file, previewBase, projectId) : null;
            return (
              <li key={`${file.kind}-${file.name}-${file.objectId || ""}`} className="builder-msg-attachment">
                {src ? (
                   
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

"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { FileTypeIcon } from "@/components/builder/file-icons";
import { assetContentUrl, isPrivateUploadUrl, projectPublicUrl } from "@/lib/asset-url";
import { useMediaToken } from "@/lib/media-token";
import {
  parseUserMessageContent,
  type MessageAttachment,
} from "@/lib/prompt-attachments";

type Props = {
  content: string;
  attachments?: MessageAttachment[] | null;
  /** @deprecated Prefer projectPublicUrl — kept for callers that still pass previewUrl. */
  previewBase?: string | null;
  projectId?: string | null;
};

function resolveThumbSrc(
  file: MessageAttachment,
  projectId?: string | null,
  previewBase?: string | null,
): string | null {
  if (file.objectId && projectId) {
    const durable = assetContentUrl(projectId, file.objectId);
    if (durable) return durable;
  }
  // Prefer durable HTTP URLs over ephemeral blob: after refresh blobs die.
  const url = file.publicUrl || file.publicPath;
  if (url && /^https?:\/\//i.test(url) && !isPrivateUploadUrl(url)) {
    return url;
  }
  // Absolute (non-blob) preview URLs only — relative `/images/…` must go through
  // projectPublicUrl below, otherwise the browser hits localhost:3100 and 404s.
  if (
    file.previewUrl &&
    !file.previewUrl.startsWith("blob:") &&
    /^https?:\/\//i.test(file.previewUrl) &&
    !isPrivateUploadUrl(file.previewUrl)
  ) {
    return file.previewUrl;
  }
  if (file.previewUrl?.startsWith("blob:")) {
    return file.previewUrl;
  }

  // Relative project paths (`/images/…`, `public/images/…`) — including
  // Playwright url-capture shots — must hit the authenticated public-asset
  // route, not the preview runner origin (that 404s and shows a broken <img>).
  const relative =
    url && !/^https?:\/\//i.test(url) && !url.startsWith("blob:")
      ? url
      : file.previewUrl &&
          !/^https?:\/\//i.test(file.previewUrl) &&
          !file.previewUrl.startsWith("blob:")
        ? file.previewUrl
        : file.kind === "image" && file.name
          ? `/images/${file.name.replace(/^\/+/, "")}`
          : null;
  if (relative && projectId) {
    const viaPublic = projectPublicUrl(projectId, relative);
    if (viaPublic) return viaPublic;
  }

  if (url && previewBase && !/^https?:\/\//i.test(url) && !url.startsWith("blob:")) {
    const base = previewBase.replace(/\/$/, "");
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
  }
  if (url && (/^https?:\/\//i.test(url) || url.startsWith("blob:"))) {
    return url;
  }
  return null;
}

function ForgeAttachPlaceholder({ name }: { name: string }) {
  return (
    <span className="builder-msg-attach-fallback builder-msg-attach-placeholder" title={name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/favicon.png"
        alt=""
        className="builder-msg-attach-placeholder-icon"
        aria-hidden="true"
      />
    </span>
  );
}

function AttachmentThumb({
  src,
  name,
}: {
  src: string | null;
  name: string;
}) {
  const [broken, setBroken] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);
  // Clear a stale onError when the resolved URL changes (branch / resend).
  if (src !== lastSrc) {
    setLastSrc(src);
    if (broken) setBroken(false);
  }
  if (!src || broken) {
    return <ForgeAttachPlaceholder name={name} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className="builder-msg-attach-thumb"
      onError={() => setBroken(true)}
    />
  );
}

export function UserMessageBody({ content, attachments, previewBase, projectId }: Props) {
  // Re-render when the read-only media token arrives so public/ thumbs resolve.
  useMediaToken();
  const parsed = parseUserMessageContent(content);
  // Prefer parsed (durable object ids / public paths from content) over stale blobs.
  const files =
    parsed.attachments.length > 0
      ? parsed.attachments.map((parsedAtt) => {
          const live = attachments?.find((a) => a.name === parsedAtt.name);
          return {
            ...parsedAtt,
            previewUrl:
              live?.previewUrl && !live.previewUrl.startsWith("blob:")
                ? live.previewUrl
                : parsedAtt.previewUrl,
            objectId: parsedAtt.objectId || live?.objectId || null,
            publicUrl: parsedAtt.publicUrl || live?.publicUrl || null,
            publicPath: parsedAtt.publicPath || live?.publicPath || parsedAtt.publicUrl || null,
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
              file.kind === "image" ? resolveThumbSrc(file, projectId, previewBase) : null;
            return (
              <li
                key={`${file.kind}-${file.name}-${file.objectId || file.publicUrl || ""}`}
                className="builder-msg-attachment"
              >
                {file.kind === "image" ? (
                  <AttachmentThumb src={src} name={file.name} />
                ) : (
                  <span className="builder-msg-attach-fallback">
                    {file.kind === "pdf" || file.kind === "md" || file.kind === "txt" ? (
                      <Icon icon={FileText} className="ui-icon-md" />
                    ) : (
                      <FileTypeIcon path={file.name} size="md" />
                    )}
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

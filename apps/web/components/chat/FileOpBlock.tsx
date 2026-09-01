"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Loader2, Trash2 } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { languageForPath } from "@/lib/message-segments";

/**
 * Collapsed card for one file operation inside an assistant message.
 *
 * The file body used to be dumped inline as prose, so a single CSS rewrite
 * buried the whole conversation. Collapsed by default: path, line count and a
 * chevron; the code is revealed on demand.
 */
export function FileOpBlock({
  path,
  content,
  complete = true,
  onOpenFile,
}: {
  path: string;
  content?: string;
  complete?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const isDelete = content === undefined;
  const lines = content ? content.split("\n").length : 0;

  return (
    <div className={`file-op-block${isDelete ? " is-delete" : ""}${open ? " is-open" : ""}`}>
      <div className="file-op-block-head">
        <button
          type="button"
          className="file-op-block-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          disabled={isDelete}
        >
          {isDelete ? (
            <Icon icon={Trash2} className="ui-icon-sm" />
          ) : !complete ? (
            <Icon icon={Loader2} className="ui-icon-sm agent-spin" />
          ) : (
            <Icon icon={open ? ChevronDown : ChevronRight} className="ui-icon-sm" />
          )}
          {!isDelete && complete ? <Icon icon={FileCode2} className="ui-icon-sm" /> : null}
          <code className="file-op-block-path">{path}</code>
          <span className="file-op-block-meta">
            {isDelete
              ? t("fileOpDeleted")
              : !complete
                ? t("fileOpWriting")
                : t("fileOpLines").replace("{n}", String(lines))}
          </span>
        </button>
        {onOpenFile && !isDelete ? (
          <button
            type="button"
            className="file-op-block-open"
            onClick={() => onOpenFile(path)}
            title={t("fileOpOpen")}
          >
            {t("fileOpOpen")}
          </button>
        ) : null}
      </div>
      {open && content ? (
        <pre className="file-op-block-code">
          <code className={languageForPath(path) ? `language-${languageForPath(path)}` : undefined}>
            {content}
          </code>
        </pre>
      ) : null}
    </div>
  );
}

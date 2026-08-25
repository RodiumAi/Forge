"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  summary?: string;
  code?: string;
  fileCount?: number;
  streaming?: boolean;
};

export function GenerationCollapse({
  summary,
  code = "",
  fileCount = 0,
  streaming = false,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const hasCode = Boolean(code.trim());
  const label = streaming
    ? t("genBuilding")
    : fileCount > 0
      ? t("genFilesWritten").replace("{n}", String(fileCount))
      : t("genDetails");

  if (!summary && !hasCode && !streaming) return null;

  return (
    <div className="gen-collapse">
      {summary ? <p className="gen-collapse-summary">{summary}</p> : null}
      {(hasCode || streaming) && (
        <div className="gen-collapse-box">
          <button
            type="button"
            className="gen-collapse-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <Icon icon={open ? ChevronDown : ChevronRight} className="ui-icon-sm" />
            <span>{label}</span>
          </button>
          {open && hasCode ? <pre className="gen-collapse-code">{code}</pre> : null}
        </div>
      )}
    </div>
  );
}

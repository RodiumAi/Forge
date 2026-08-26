"use client";

import { ChatMarkdown } from "./ChatMarkdown";
import { useI18n } from "@/lib/i18n/I18nProvider";

/**
 * Assistant message body.
 *
 * Replaces GenerationCollapse, whose `code` prop was always "" — its entire
 * collapsible `<pre class="gen-collapse-code">` branch was unreachable. What
 * matters here is the prose, rendered as real markdown.
 */
export function AssistantBody({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  const { t } = useI18n();
  const text = (content || "").trim();

  if (!text) {
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

  return <ChatMarkdown content={text} streaming={streaming} />;
}

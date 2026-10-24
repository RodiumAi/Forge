"use client";

/**
 * Codelab metadata (title, summary, level, prerequisites, objectives,
 * author, repository, feedback link), declared downloads, import, exports
 * and publishing.
 */

import { useRef, useState } from "react";
import { Download, ExternalLink, FileUp, Loader2, Send, Trash2 } from "lucide-react";
import { CODELAB_LEVELS, type Codelab } from "@/lib/contracts/forge-design";
import { downloadFrom, importClaat } from "./api";
import { linesOf, removeDownload } from "./model";
import type { CodelabEditorKey, Translate } from "./strings";

const LEVEL_KEYS: Record<Codelab["level"], CodelabEditorKey> = {
  beginner: "levelBeginner",
  intermediate: "levelIntermediate",
  advanced: "levelAdvanced",
};

export type CodelabPublisher = {
  badgeRemovable: boolean;
  publish: (options: { badge: boolean }) => Promise<{ public_url: string }>;
};

export type DetailsPanelProps = {
  projectId: string;
  projectName: string;
  codelab: Codelab;
  onChange: (codelab: Codelab) => void;
  feedbackUrl: string;
  onFeedbackUrl: (url: string) => void;
  /** Called after an import replaced the steps on the server. */
  onImported: () => void;
  publisher: CodelabPublisher | null;
  readOnly?: boolean;
  t: Translate;
  onError: (message: string) => void;
};

/** Draft value kept while typing so a half-typed URL is not dropped by the schema. */
function useDraft(value: string): [string, (v: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft];
}

function httpsOrUndefined(value: string): string | undefined {
  const v = value.trim();
  return /^https:\/\/\S+$/i.test(v) ? v : undefined;
}

export function DetailsPanel(props: DetailsPanelProps) {
  const { projectId, projectName, codelab, onChange, readOnly, t, onError, publisher } = props;
  const [prereq, setPrereq] = useDraft((codelab.prerequisites ?? []).join("\n"));
  const [learn, setLearn] = useDraft((codelab.learn ?? []).join("\n"));
  const [authorUrl, setAuthorUrl] = useDraft(codelab.author?.url ?? "");
  const [repoUrl, setRepoUrl] = useDraft(codelab.repoUrl ?? "");
  const [feedback, setFeedback] = useDraft(props.feedbackUrl);
  const [busy, setBusy] = useState<string | null>(null);
  const [badge, setBadge] = useState(true);
  const [published, setPublished] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  const patch = (next: Partial<Codelab>) => onChange({ ...codelab, ...next });

  const task = async (name: string, work: () => Promise<void>) => {
    setBusy(name);
    setNotice(null);
    try {
      await work();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const base = `/projects/${projectId}/codelab/export`;
  const fileBase = (projectName || "codelab").replace(/[^\w.-]+/g, "-").slice(0, 60) || "codelab";

  return (
    <div className="cle-details">
      <label>
        {t("title")}
        <input value={codelab.title} maxLength={200} disabled={readOnly} onChange={(e) => patch({ title: e.target.value || t("untitled") })} />
      </label>
      <label>
        {t("summary")}
        <textarea
          rows={3}
          maxLength={2000}
          value={codelab.summary ?? ""}
          disabled={readOnly}
          onChange={(e) => patch({ summary: e.target.value || undefined })}
        />
      </label>
      <label>
        {t("level")}
        <select value={codelab.level} disabled={readOnly} onChange={(e) => patch({ level: e.target.value as Codelab["level"] })}>
          {CODELAB_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(LEVEL_KEYS[level])}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("prerequisites")}
        <textarea
          rows={3}
          value={prereq}
          disabled={readOnly}
          onChange={(e) => {
            setPrereq(e.target.value);
            patch({ prerequisites: linesOf(e.target.value) });
          }}
        />
      </label>
      <label>
        {t("learn")}
        <textarea
          rows={3}
          value={learn}
          disabled={readOnly}
          onChange={(e) => {
            setLearn(e.target.value);
            patch({ learn: linesOf(e.target.value) });
          }}
        />
      </label>
      <label>
        {t("authorName")}
        <input
          value={codelab.author?.name ?? ""}
          maxLength={120}
          disabled={readOnly}
          onChange={(e) => {
            const name = e.target.value;
            patch({ author: name.trim() ? { name, ...(codelab.author?.url ? { url: codelab.author.url } : {}) } : undefined });
          }}
        />
      </label>
      <label>
        {t("authorUrl")}
        <input
          value={authorUrl}
          disabled={readOnly || !codelab.author?.name}
          placeholder="https://"
          onChange={(e) => {
            setAuthorUrl(e.target.value);
            if (codelab.author?.name) patch({ author: { name: codelab.author.name, url: httpsOrUndefined(e.target.value) } });
          }}
        />
      </label>
      <label>
        {t("repoUrl")}
        <input
          value={repoUrl}
          disabled={readOnly}
          placeholder="https://"
          onChange={(e) => {
            setRepoUrl(e.target.value);
            patch({ repoUrl: httpsOrUndefined(e.target.value) });
          }}
        />
      </label>
      <label>
        {t("feedbackUrl")}
        <input
          value={feedback}
          disabled={readOnly}
          placeholder="https://"
          onChange={(e) => setFeedback(e.target.value)}
          onBlur={() => {
            const url = httpsOrUndefined(feedback) ?? "";
            if (url !== props.feedbackUrl && (url || !feedback.trim())) props.onFeedbackUrl(url);
          }}
        />
      </label>

      <h3>{t("downloads")}</h3>
      {(codelab.downloads ?? []).length === 0 ? <p className="cle-hint">{t("noFiles")}</p> : null}
      <ul className="cle-file-list">
        {(codelab.downloads ?? []).map((item) => (
          <li key={item.id}>
            <input
              aria-label={t("downloadLabel")}
              value={item.label}
              maxLength={120}
              disabled={readOnly}
              onChange={(e) =>
                patch({
                  downloads: (codelab.downloads ?? []).map((d) => (d.id === item.id ? { ...d, label: e.target.value || d.id } : d)),
                })
              }
            />
            <span className="cle-hint" title={item.path}>
              {item.zip ? `${item.path}.zip` : item.path}
            </span>
            {!readOnly ? (
              <button type="button" aria-label={t("removeDownload")} onClick={() => onChange(removeDownload(codelab, item.id))}>
                <Trash2 size={14} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <h3>{t("importExport")}</h3>
      <div className="cle-buttons">
        <button type="button" disabled={!!busy} onClick={() => void task("md", () => downloadFrom(`${base}/markdown`, `${fileBase}.md`))}>
          {busy === "md" ? <Loader2 size={14} className="cle-spin" /> : <Download size={14} />} {t("exportMarkdown")}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void task("zip", () => downloadFrom(`${base}/sources`, `${fileBase}-sources.zip`))}>
          {busy === "zip" ? <Loader2 size={14} className="cle-spin" /> : <Download size={14} />} {t("exportSources")}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void task("pdf", () => downloadFrom(`${base}/pdf`, `${fileBase}.pdf`))}>
          {busy === "pdf" ? <Loader2 size={14} className="cle-spin" /> : <Download size={14} />} {t("exportPdf")}
        </button>
        {!readOnly ? (
          <>
            <input
              ref={importRef}
              type="file"
              accept=".md,.markdown,text/markdown,text/plain"
              hidden
              data-testid="codelab-import"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !window.confirm(t("importConfirm"))) return;
                void task("import", async () => {
                  await importClaat(projectId, await file.text());
                  setNotice(t("importDone"));
                  props.onImported();
                });
              }}
            />
            <button type="button" disabled={!!busy} onClick={() => importRef.current?.click()}>
              {busy === "import" ? <Loader2 size={14} className="cle-spin" /> : <FileUp size={14} />} {t("importClaat")}
            </button>
          </>
        ) : null}
      </div>

      {publisher && !readOnly ? (
        <>
          <h3>{t("publish")}</h3>
          <label className="cle-check-row">
            <input type="checkbox" checked={badge || !publisher.badgeRemovable} disabled={!publisher.badgeRemovable} onChange={(e) => setBadge(e.target.checked)} />
            {t("publishBadge")}
          </label>
          {!publisher.badgeRemovable ? <p className="cle-hint">{t("publishBadgeLocked")}</p> : null}
          <button
            type="button"
            className="cle-primary"
            disabled={!!busy}
            onClick={() =>
              void task("publish", async () => {
                const result = await publisher.publish({ badge: badge || !publisher.badgeRemovable });
                setPublished(result.public_url);
                setNotice(t("publishDone"));
              })
            }
          >
            {busy === "publish" ? <Loader2 size={14} className="cle-spin" /> : <Send size={14} />} {busy === "publish" ? t("publishing") : t("publish")}
          </button>
          {published ? (
            <a className="cle-link" href={published} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> {t("publishOpen")}
            </a>
          ) : null}
        </>
      ) : null}
      {notice ? <p className="cle-notice" role="status">{notice}</p> : null}
    </div>
  );
}

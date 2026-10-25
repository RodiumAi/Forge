"use client";

/**
 * Forge Design codelab editor: step list (add, reorder, delete, durations),
 * Markdown editor with a toolbar and a live preview side by side, metadata,
 * files, AI chat with step targeting, and a full player preview.
 *
 * codelab.json and each step are saved with If-Match (ETag); edits are
 * debounced. AI events stream into the preview while a step is written.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Download,
  FileDiff,
  FolderTree,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageSquare,
  PanelsTopLeft,
  Plus,
  Terminal as TerminalIcon,
  Trash2,
  Files,
  ImagePlay,
  UserRound,
  Wrench,
} from "lucide-react";
import type { Codelab } from "@/lib/contracts/forge-design";
import {
  CODELAB_CSS,
  CodelabMarkdown,
  CodelabPlayer,
  RenderEnvProvider,
  codelabTokens,
  defaultEnv,
  downloadsOf,
  introPages,
  translator,
  type View,
} from "../codelab-player";
import {
  getCodelab,
  getDesign,
  getSettings,
  getStep,
  isConflict,
  putCodelab,
  putSettings,
  putStep,
  type CodelabChatClient,
} from "./api";
import type { EditorEffect } from "./ai";
import { ChatPanel } from "./ChatPanel";
import { DetailsPanel, type CodelabPublisher } from "./DetailsPanel";
import { FilesPanel } from "./FilesPanel";
import { PublishMenu } from "./PublishMenu";
import { addDownload, addStep, insertBlock, moveStep, removeStep, snippet, totalMinutes, updateStep, type SnippetKind } from "./model";
import { useCodelabStrings, type CodelabEditorKey } from "./strings";
import { WorkspaceBar } from "@/components/builder/WorkspaceBar";
import { Segmented } from "@/components/ui/Tabs";
import "./codelab-editor.css";

export type CodelabEditorProps = {
  projectId: string;
  projectName: string;
  chat: CodelabChatClient;
  assetUrl: (path: string) => string;
  publisher: CodelabPublisher | null;
  readOnly?: boolean;
  backHref: string;
  /** Prompt typed on the home page, sent to the assistant on arrival. */
  initialPrompt?: string | null;
  onInitialPromptUsed?: () => void;
  /** Deletes the project (owner only); absent hides the action. */
  onDelete?: () => Promise<void>;
  /** Public URL of the published codelab (QR code of the cover), when published. */
  publicUrl?: string;
};

type SaveState = "saved" | "pending" | "saving" | "error" | "conflict";
type Side = "details" | "files" | "ai";
/** A page before the steps, previewed live in place of the Markdown editor. */
type IntroPage = "home" | "presenter" | "setup";

const TOOLBAR: { kind: SnippetKind; key: CodelabEditorKey; icon: typeof Code2 }[] = [
  { kind: "code", key: "insertCode", icon: Code2 },
  { kind: "diff", key: "insertDiff", icon: FileDiff },
  { kind: "terminal", key: "insertTerminal", icon: TerminalIcon },
  { kind: "tabs", key: "insertTabs", icon: PanelsTopLeft },
  { kind: "callout", key: "insertCallout", icon: Info },
  { kind: "image", key: "insertImage", icon: ImageIcon },
  { kind: "download", key: "insertDownload", icon: Download },
  { kind: "tree", key: "insertTree", icon: FolderTree },
];

const CODELAB_DELAY = 500;
const STEP_DELAY = 800;

export function CodelabEditor({
  projectId,
  projectName,
  chat,
  assetUrl,
  publisher,
  readOnly,
  backHref,
  initialPrompt,
  onInitialPromptUsed,
  onDelete,
  publicUrl: initialPublicUrl,
}: CodelabEditorProps) {
  const { t, locale } = useCodelabStrings();
  const [codelab, setCodelab] = useState<Codelab | null>(null);
  const [steps, setSteps] = useState<Record<string, string>>({});
  const [streams, setStreams] = useState<Record<string, string>>({});
  const [design, setDesign] = useState("");
  const [feedbackUrl, setFeedbackUrl] = useState("");
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [page, setPage] = useState<IntroPage | null>(null);
  const [mode, setMode] = useState<"edit" | "player">("edit");
  const [side, setSide] = useState<Side>("ai");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filesKey, setFilesKey] = useState(0);
  const [view, setView] = useState<View>({ kind: "home" });
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const publicUrl = publishedUrl ?? initialPublicUrl;

  const codelabRef = useRef<Codelab | null>(null);
  const codelabEtag = useRef<string | null>(null);
  const stepEtags = useRef<Record<string, string | null>>({});
  const stepsRef = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const dirty = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Picking a step leaves the page preview.
  const setSelectedId = useCallback((next: string | null | ((current: string | null) => string | null)) => {
    setSelectedIdState(next);
    setPage(null);
  }, []);

  codelabRef.current = codelab;
  stepsRef.current = steps;

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [doc, charter, settings] = await Promise.all([
        getCodelab(projectId),
        getDesign(projectId),
        getSettings(projectId).catch(() => ({ feedbackUrl: undefined })),
      ]);
      const pairs = await Promise.all(
        doc.data.steps.map(async (step) => {
          try {
            const res = await getStep(projectId, step.id);
            return [step.id, res.data.markdown, res.etag] as const;
          } catch {
            return [step.id, "", null] as const;
          }
        }),
      );
      codelabEtag.current = doc.etag;
      stepEtags.current = Object.fromEntries(pairs.map(([id, , etag]) => [id, etag]));
      dirty.current.clear();
      setCodelab(doc.data);
      setSteps(Object.fromEntries(pairs.map(([id, md]) => [id, md])));
      setStreams({});
      setDesign(charter);
      setFeedbackUrl(settings.feedbackUrl ?? "");
      setSaveState("saved");
      setSelectedIdState((current) => (current && doc.data.steps.some((s) => s.id === current) ? current : doc.data.steps[0]?.id ?? null));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, [load]);

  const fail = useCallback((error: unknown) => {
    setSaveState(isConflict(error) ? "conflict" : "error");
    if (!isConflict(error)) setNotice(error instanceof Error ? error.message : String(error));
  }, []);

  const settle = useCallback(() => {
    if (!dirty.current.size && !Object.keys(timers.current).length) setSaveState("saved");
  }, []);

  // ── saving ──────────────────────────────────────────────────────────────

  const saveCodelabNow = useCallback(async (): Promise<boolean> => {
    const doc = codelabRef.current;
    if (!doc || readOnly) return false;
    delete timers.current.codelab;
    dirty.current.delete("codelab");
    setSaveState("saving");
    try {
      const res = await putCodelab(projectId, doc, codelabEtag.current);
      codelabEtag.current = res.etag;
      settle();
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }, [projectId, readOnly, fail, settle]);

  const changeCodelab = useCallback(
    (next: Codelab, immediate = false) => {
      if (readOnly) return;
      codelabRef.current = next;
      setCodelab(next);
      dirty.current.add("codelab");
      setSaveState("pending");
      clearTimeout(timers.current.codelab);
      if (immediate) {
        void saveCodelabNow();
        return;
      }
      timers.current.codelab = setTimeout(() => void saveCodelabNow(), CODELAB_DELAY);
    },
    [readOnly, saveCodelabNow],
  );

  const saveStepNow = useCallback(
    async (id: string) => {
      const key = `step:${id}`;
      delete timers.current[key];
      dirty.current.delete(key);
      setSaveState("saving");
      try {
        const res = await putStep(projectId, id, stepsRef.current[id] ?? "", stepEtags.current[id] ?? null);
        stepEtags.current[id] = res.etag;
        settle();
      } catch (error) {
        fail(error);
      }
    },
    [projectId, fail, settle],
  );

  const changeStep = useCallback(
    (id: string, markdown: string) => {
      if (readOnly) return;
      stepsRef.current = { ...stepsRef.current, [id]: markdown };
      setSteps(stepsRef.current);
      const key = `step:${id}`;
      dirty.current.add(key);
      setSaveState("pending");
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => void saveStepNow(id), STEP_DELAY);
    },
    [readOnly, saveStepNow],
  );

  /** Saves every pending edit now (before a publish). */
  const flush = useCallback(async () => {
    const keys = [...new Set([...Object.keys(timers.current), ...dirty.current])];
    for (const key of keys) {
      clearTimeout(timers.current[key]);
      if (key === "codelab") await saveCodelabNow();
      else if (key.startsWith("step:")) await saveStepNow(key.slice(5));
    }
  }, [saveCodelabNow, saveStepNow]);

  // ── steps list ─────────────────────────────────────────────────────────

  const onAddStep = async () => {
    const doc = codelabRef.current;
    if (!doc) return;
    const index = doc.steps.findIndex((s) => s.id === selectedId);
    const { codelab: next, step } = addStep(doc, t("newStepTitle"), index >= 0 ? index : undefined);
    codelabRef.current = next;
    setCodelab(next);
    clearTimeout(timers.current.codelab);
    if (await saveCodelabNow()) {
      try {
        const res = await getStep(projectId, step.id);
        stepEtags.current[step.id] = res.etag;
        setSteps((current) => ({ ...current, [step.id]: res.data.markdown }));
      } catch {
        setSteps((current) => ({ ...current, [step.id]: `# ${t("newStepTitle")}\n` }));
      }
    }
    setSelectedId(step.id);
  };

  const onDeleteStep = (id: string) => {
    const doc = codelabRef.current;
    if (!doc) return;
    const step = doc.steps.find((s) => s.id === id);
    if (!window.confirm(t("deleteStepConfirm", { title: step?.title || id }))) return;
    const index = doc.steps.findIndex((s) => s.id === id);
    const next = removeStep(doc, id);
    changeCodelab(next, true);
    if (selectedId === id) setSelectedId(next.steps[Math.min(index, next.steps.length - 1)]?.id ?? null);
  };

  const [dragFrom, setDragFrom] = useState<number | null>(null);

  // ── AI effects ─────────────────────────────────────────────────────────

  const onEffect = useCallback(
    (effect: EditorEffect) => {
      switch (effect.kind) {
        case "delta":
          setStreams((current) => ({ ...current, [effect.stepId]: (current[effect.stepId] ?? "") + effect.text }));
          setSelectedIdState((current) => current ?? effect.stepId);
          break;
        case "step":
          setSteps((current) => ({ ...current, [effect.step.id]: effect.markdown }));
          setStreams((current) => {
            const next = { ...current };
            delete next[effect.step.id];
            return next;
          });
          setCodelab((current) =>
            current && !current.steps.some((s) => s.id === effect.step.id)
              ? { ...current, steps: [...current.steps, effect.step] }
              : current
                ? { ...current, steps: current.steps.map((s) => (s.id === effect.step.id ? effect.step : s)) }
                : current,
          );
          break;
        case "codelab":
          setCodelab(effect.codelab);
          setSelectedIdState((current) => (current && effect.codelab.steps.some((s) => s.id === current) ? current : effect.codelab.steps[0]?.id ?? null));
          break;
        case "removed":
          setSteps((current) => {
            const next = { ...current };
            delete next[effect.stepId];
            return next;
          });
          break;
        case "files":
          setFilesKey((n) => n + 1);
          break;
        case "done":
          // Fresh ETags (and anything the stream did not carry) from the server.
          void load();
          break;
      }
    },
    [load],
  );

  // ── derived ────────────────────────────────────────────────────────────

  const theme = useMemo(() => codelabTokens(design), [design]);
  const env = useMemo(
    () => ({
      ...defaultEnv(locale),
      t: translator(locale),
      assetUrl,
      downloads: codelab ? downloadsOf(codelab) : [],
      storageKey: `forge-codelab-editor:${projectId}`,
    }),
    [locale, assetUrl, codelab, projectId],
  );

  if (loadError) {
    return (
      <div className="cle-root cle-center" role="alert">
        <p>{t("loadError")}</p>
        <p className="cle-hint">{loadError}</p>
        <button type="button" onClick={() => void load()}>
          {t("retry")}
        </button>
      </div>
    );
  }
  if (!codelab) {
    return (
      <div className="cle-root cle-center">
        <Loader2 size={18} className="cle-spin" /> {t("loading")}
      </div>
    );
  }

  const selectedIndex = codelab.steps.findIndex((s) => s.id === selectedId);
  const selected = selectedIndex >= 0 ? codelab.steps[selectedIndex] : null;
  const streaming = selected ? streams[selected.id] : undefined;
  const markdown = selected ? (streaming ?? steps[selected.id] ?? "") : "";
  const previewSteps = { ...steps, ...streams };

  const insert = (text: string) => {
    if (!selected || readOnly) return;
    const area = textareaRef.current;
    const start = area?.selectionStart ?? markdown.length;
    const end = area?.selectionEnd ?? markdown.length;
    const result = insertBlock(markdown, start, end, text);
    changeStep(selected.id, result.value);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(result.caret, result.caret);
    });
  };

  const insertSnippet = (kind: SnippetKind) => {
    const area = textareaRef.current;
    const selection = area ? markdown.slice(area.selectionStart, area.selectionEnd) : "";
    insert(snippet(kind, selection));
  };

  const offerDownload = (path: string, zip: boolean) => {
    try {
      const { codelab: next, id } = addDownload(codelab, path, zip);
      if (next !== codelab) changeCodelab(next, true);
      if (selected) insert(snippet("download", id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  };

  const pages: { id: IntroPage; key: CodelabEditorKey; icon: typeof Code2 }[] = [
    { id: "home", key: "pageCover", icon: ImagePlay },
    ...introPages(codelab).map((p) =>
      p === "presenter"
        ? { id: "presenter" as const, key: "pagePresenter" as const, icon: UserRound }
        : { id: "setup" as const, key: "pageSetup" as const, icon: Wrench },
    ),
  ];
  // A page hidden since (Infos unchecked) falls back to the cover.
  const shownPage = page && pages.some((p) => p.id === page) ? page : page ? "home" : null;

  const saveLabel: Record<SaveState, string> = {
    saved: t("saved"),
    pending: t("pending"),
    saving: t("saving"),
    error: t("saveError"),
    conflict: t("saveError"),
  };

  return (
    <div className="cle-root" data-codelab-editor="">
      <WorkspaceBar
        kind="codelab"
        name={codelab.title || projectName || t("untitled")}
        backHref={backHref}
        className="cle-top"
        saveStatus={
          <span className="cle-save" data-state={saveState} role="status">
            {readOnly ? t("readOnly") : saveLabel[saveState]}
          </span>
        }
        tools={
          <Segmented
            label={t("modeLabel")}
            value={mode === "player" ? "player" : "edit"}
            onChange={(next) => setMode(next)}
            items={[
              { id: "edit", label: t("modeEdit") },
              { id: "player", label: t("modePreview") },
            ]}
          />
        }
        actions={
          publisher && !readOnly ? (
            <PublishMenu
              publisher={publisher}
              beforePublish={flush}
              publicUrl={publicUrl || undefined}
              onPublished={setPublishedUrl}
              disabled={codelab.steps.length === 0}
              t={t}
            />
          ) : null
        }
      />

      {saveState === "conflict" ? (
        <div className="cle-banner" role="alert">
          {t("conflict")}{" "}
          <button type="button" onClick={() => void load()}>
            {t("reload")}
          </button>
        </div>
      ) : null}
      {notice ? (
        <div className="cle-banner" role="alert" onClick={() => setNotice(null)}>
          {notice}
        </div>
      ) : null}

      {mode === "player" ? (
        <div className="cle-player">
          <CodelabPlayer
            codelab={codelab}
            steps={previewSteps}
            tokens={theme.tokens}
            scheme={theme.scheme}
            assetUrl={assetUrl}
            locale={locale}
            storageKey={`forge-codelab-editor:${projectId}`}
            feedbackUrl={feedbackUrl || undefined}
            publicUrl={publicUrl || undefined}
            embedded
            view={view}
            onViewChange={setView}
          />
        </div>
      ) : (
        <div className="cle-body">
          <nav className="cle-steps" aria-label={t("steps")}>
            <div className="cle-steps-head">
              <strong>{t("steps")}</strong>
              <span className="cle-hint">{t("total", { n: totalMinutes(codelab) })}</span>
            </div>
            <ul className="cle-pages" aria-label={t("pages")}>
              {pages.map(({ id, key, icon: Icon }) => (
                <li key={id}>
                  <button type="button" className="cle-page-pick" aria-current={shownPage === id} onClick={() => setPage(id)}>
                    <span className="cle-page-icon">
                      <Icon size={13} aria-hidden />
                    </span>
                    {t(key)}
                  </button>
                </li>
              ))}
            </ul>
            {codelab.steps.length === 0 ? <p className="cle-hint">{t("noStep")}</p> : null}
            <ol>
              {codelab.steps.map((step, index) => (
                <li
                  key={step.id}
                  data-active={(!shownPage && step.id === selectedId) || undefined}
                  data-streaming={streams[step.id] !== undefined || undefined}
                  draggable={!readOnly}
                  onDragStart={() => setDragFrom(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragFrom !== null) changeCodelab(moveStep(codelab, dragFrom, index));
                    setDragFrom(null);
                  }}
                >
                  <button type="button" className="cle-step-pick" onClick={() => setSelectedId(step.id)}>
                    <span className="cle-step-n">{index + 1}</span>
                    <span className="cle-step-title">{step.title || step.id}</span>
                  </button>
                  <span className="cle-step-min">
                    {step.minutes} {t("minutes")}
                  </span>
                  {!readOnly ? (
                    <span className="cle-step-tools">
                      <button type="button" aria-label={t("moveUp")} disabled={index === 0} onClick={() => changeCodelab(moveStep(codelab, index, index - 1))}>
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("moveDown")}
                        disabled={index === codelab.steps.length - 1}
                        onClick={() => changeCodelab(moveStep(codelab, index, index + 1))}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button type="button" aria-label={t("deleteStep")} onClick={() => onDeleteStep(step.id)}>
                        <Trash2 size={13} />
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            {!readOnly ? (
              <button type="button" className="cle-add" onClick={() => void onAddStep()} disabled={codelab.steps.length >= 200}>
                <Plus size={14} /> {t("addStep")}
              </button>
            ) : null}
          </nav>

          <section className="cle-main">
            {shownPage ? (
              <div className="cle-page-preview">
                <p className="cle-hint">{t("pagePreviewHint")}</p>
                <div className="cle-page-frame">
                  <CodelabPlayer
                    codelab={codelab}
                    steps={previewSteps}
                    tokens={theme.tokens}
                    scheme={theme.scheme}
                    assetUrl={assetUrl}
                    locale={locale}
                    storageKey={`forge-codelab-editor:${projectId}`}
                    feedbackUrl={feedbackUrl || undefined}
                    publicUrl={publicUrl || undefined}
                    embedded
                    view={{ kind: shownPage }}
                    onViewChange={(next) => {
                      if (next.kind === "home" || next.kind === "presenter" || next.kind === "setup") setPage(next.kind);
                      else if (next.kind === "step") setSelectedId(codelab.steps[next.index]?.id ?? null);
                    }}
                  />
                </div>
              </div>
            ) : selected ? (
              <>
                <div className="cle-step-meta">
                  <label>
                    {t("stepTitle")}
                    <input
                      value={selected.title ?? ""}
                      maxLength={200}
                      disabled={readOnly}
                      placeholder={selected.id}
                      onChange={(e) => changeCodelab(updateStep(codelab, selected.id, { title: e.target.value }))}
                    />
                  </label>
                  <label className="cle-minutes">
                    {t("minutesLabel")}
                    <input
                      type="number"
                      min={0}
                      max={600}
                      value={selected.minutes}
                      disabled={readOnly}
                      onChange={(e) => changeCodelab(updateStep(codelab, selected.id, { minutes: Number(e.target.value) }))}
                    />
                  </label>
                </div>
                {!readOnly ? (
                  <div className="cle-toolbar" role="toolbar">
                    {TOOLBAR.map(({ kind, key, icon: Icon }) => (
                      <button key={kind} type="button" title={t(key)} onClick={() => insertSnippet(kind)} disabled={streaming !== undefined}>
                        <Icon size={14} /> <span>{t(key)}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="cle-split">
                  <textarea
                    ref={textareaRef}
                    className="cle-markdown"
                    aria-label={t("markdownLabel")}
                    spellCheck={false}
                    value={markdown}
                    readOnly={readOnly || streaming !== undefined}
                    onChange={(e) => changeStep(selected.id, e.target.value)}
                    onBlur={() => {
                      const key = `step:${selected.id}`;
                      if (timers.current[key]) {
                        clearTimeout(timers.current[key]);
                        void saveStepNow(selected.id);
                      }
                    }}
                  />
                  <div className="cle-preview" aria-label={t("preview")}>
                    <div className="fcl-root" style={theme.tokens as CSSProperties} data-scheme={theme.scheme} data-embedded="">
                      <style>{CODELAB_CSS}</style>
                      <RenderEnvProvider value={env}>
                        <div className="fcl-content">
                          <CodelabMarkdown markdown={markdown} />
                        </div>
                      </RenderEnvProvider>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="cle-hint cle-empty">{t("noStep")}</p>
            )}
          </section>

          <aside className="cle-side">
            <div className="cle-tabs" role="tablist">
              {(
                [
                  ["ai", MessageSquare, "ai"],
                  ["details", Info, "details"],
                  ["files", Files, "files"],
                ] as const
              ).map(([id, Icon, key]) => (
                <button key={id} type="button" role="tab" aria-selected={side === id} className={side === id ? "cle-active" : ""} onClick={() => {
                    setSide(id);
                    // The Infos tab edits the intro pages: show them while typing.
                    if (id === "details" && !page) setPage("home");
                  }}
                >
                  <Icon size={14} /> {t(key)}
                </button>
              ))}
            </div>
            <div className="cle-side-body" hidden={side !== "ai"}>
              <ChatPanel
                client={chat}
                selected={selected ? { id: selected.id, title: selected.title || selected.id } : null}
                onEffect={onEffect}
                onSelectStep={(id) => setSelectedId(id)}
                readOnly={readOnly}
                initialPrompt={initialPrompt}
                onInitialPromptUsed={onInitialPromptUsed}
                t={t}
              />
            </div>
            {side === "details" ? (
              <div className="cle-side-body">
                <DetailsPanel
                  projectId={projectId}
                  projectName={projectName}
                  codelab={codelab}
                  onChange={(next) => changeCodelab(next)}
                  feedbackUrl={feedbackUrl}
                  onFeedbackUrl={(url) => {
                    setFeedbackUrl(url);
                    void putSettings(projectId, { feedbackUrl: url || undefined }).catch((error) => setNotice(String(error?.message ?? error)));
                  }}
                  onImported={() => void load()}
                  readOnly={readOnly}
                  onDelete={onDelete}
                  t={t}
                  onError={setNotice}
                  assetUrl={assetUrl}
                />
              </div>
            ) : null}
            {side === "files" ? (
              <div className="cle-side-body">
                <FilesPanel
                  projectId={projectId}
                  readOnly={readOnly}
                  onInsert={selected ? insert : null}
                  onOfferDownload={offerDownload}
                  refreshKey={filesKey}
                  t={t}
                  locale={locale}
                  onError={setNotice}
                />
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}

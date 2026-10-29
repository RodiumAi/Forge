"use client";

/**
 * The AI chat beside the deck: messages, the target chip (whole deck, a
 * slide or one element), quick actions, the outline confirmation of a new
 * deck, and the stream of `deck.*` events applied to the editor as they
 * arrive (docs/contracts/deck-ai-events.md).
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, FileText, Loader2, PanelLeftClose, Plus, Presentation, Send, Square, Trash2, Wand2, X } from "lucide-react";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { Glyph } from "@/components/ui/glyph";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSpeechInput } from "@/lib/speech-input";
import { VoiceButton, VoiceStatus } from "@/components/composer/VoiceInput";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { getSessionSnapshot } from "@/lib/session-cache";
import {
  confirmPlanBody,
  messageBody,
  splitDocuments,
  splitImages,
  withDocuments,
  withImages,
  noticeFromWarning,
  parseDeckEvent,
  QUICK_ACTIONS,
  quickActionBody,
  tasksFromPlan,
  type AiTarget,
  type DeckEvent,
  type MessageBody,
  type OutlineTask,
  type QuickAction,
  type SlideNotice,
} from "./ai";
import type { AssetUrl } from "@/components/deck-player";
import type { ChatClient, ChatMessage } from "./chat-client";
import type { PickedImage } from "./images-client";
import {
  extractDocument,
  fitDocuments,
  DOCUMENT_ACCEPT,
  IMAGE_ACCEPT,
  IMPORT_ACCEPT,
  ImportError,
  importKind,
  MAX_IMPORT_BYTES,
  type DocKind,
  type ImportKind,
} from "./document-import";
import { LAYOUT_NAMES } from "./layouts";
import { LAYOUT_LABEL, type DeckLocale, type DeckStringKey, type DeckT } from "./strings";

const QA_LABEL: Record<QuickAction, DeckStringKey> = {
  shorten: "qaShorten",
  punchier: "qaPunchier",
  change_layout: "qaChangeLayout",
  add_visual: "qaAddVisual",
  translate: "qaTranslate",
};

type Outline = { runId: string; tasks: OutlineTask[]; title?: string; summary?: string; needsConfirm: boolean };

export type DeckChatProps = {
  client: ChatClient | null;
  target: AiTarget | undefined;
  targetLabel: string;
  /** Slide quick actions act on when nothing is selected. */
  actionTarget: AiTarget | undefined;
  onClearTarget: () => void;
  onEvent: (event: DeckEvent) => void;
  onNotice: (notice: SlideNotice) => void;
  beforeSend: () => Promise<void>;
  t: DeckT;
  locale: DeckLocale;
  readOnly?: boolean;
  /** Brief typed on the home composer: sent once when the deck has no history yet. */
  initialPrompt?: string | null;
  onInitialPromptUsed?: () => void;
  /** Hides the panel; the topbar sparkles button brings it back. */
  onCollapse?: () => void;
  /** Copies a picture into the project; enables image imports (PDF and PowerPoint work without it). */
  uploadImage?: (file: File) => Promise<PickedImage>;
  assetUrl?: AssetUrl;
  /**
   * Sent by the editor's right-click menu: focus the message box, run a quick
   * action on the current target, or open the layout or language form.
   * `onRequestDone` is called once it is handled.
   */
  request?: ChatRequest | null;
  onRequestDone?: () => void;
};

export type ChatRequest = { nonce: number } & ({ kind: "focus" } | { kind: "quick"; action: "shorten" | "punchier" } | { kind: "form"; action: "change_layout" | "translate" });

/**
 * A file in the composer. Images are uploaded into the project (`path`);
 * PDF and PowerPoint files are read in the browser (`text`).
 */
type Attachment = {
  key: string;
  name: string;
  kind: ImportKind;
  path?: string;
  preview?: string;
  text?: string;
  truncated?: boolean;
  slides?: number;
  failed?: boolean;
};
const MAX_ATTACHMENTS = 12;

export function DeckChat(props: DeckChatProps) {
  const { client, t, readOnly } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { locale: uiLocale } = useI18n();
  const voice = useSpeechInput({ value: input, onChange: setInput, locale: uiLocale, maxLength: 50000 });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  /** Opens the file picker limited to one kind (images or documents). */
  const pickFiles = (accept: string) => {
    const input = fileRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  };
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  // Outline slides are folded; the first one opens when an outline arrives.
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [qa, setQa] = useState<null | "change_layout" | "translate">(null);
  const [qaInput, setQaInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef("");
  const runRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const qaRef = useRef<HTMLFormElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  // Set once history and the active run are known, so the home brief is only sent to an empty deck.
  const [ready, setReady] = useState<null | { empty: boolean }>(null);
  const bootSentRef = useRef(false);

  const handle = useCallback(
    (payload: Record<string, unknown>) => {
      const type = String(payload.type ?? "");
      if (typeof payload.run_id === "string") runRef.current = payload.run_id;
      if (type.startsWith("deck.")) {
        const event = parseDeckEvent(payload);
        if (event) propsRef.current.onEvent(event);
        return;
      }
      if (type === "step") {
        const id = String(payload.id ?? "");
        const status = String(payload.status ?? "");
        if (status === "running" && typeof payload.label === "string") setActivity(payload.label);
        if (id.startsWith("task:")) {
          const taskId = id.slice(5);
          setOutline((prev) => (prev ? { ...prev, tasks: prev.tasks.map((task) => (task.id === taskId ? { ...task, status } : task)) } : prev));
        }
        return;
      }
      if (type === "plan") {
        const tasks = tasksFromPlan(payload);
        const meta = (payload.meta ?? {}) as { title?: string; summary?: string };
        setOutline({ runId: String(payload.run_id ?? runRef.current ?? ""), tasks, title: meta.title, summary: meta.summary, needsConfirm: payload.needs_confirm === true });
        setOpenTask(tasks[0]?.id ?? null);
        return;
      }
      if (type === "token" && typeof payload.content === "string") {
        streamingRef.current += payload.content;
        setStreaming(streamingRef.current);
        return;
      }
      if (type === "warning") {
        const notice = noticeFromWarning(payload);
        if (notice) propsRef.current.onNotice(notice);
        else if (typeof payload.message === "string") setWarnings((prev) => [...prev, String(payload.message)]);
        return;
      }
      if (type === "error") {
        const code = String(payload.code ?? "");
        const message = typeof payload.message === "string" ? payload.message : "";
        if (code === "kind_not_available") setError({ text: propsRef.current.t("kindNotAvailable") });
        else if (code === "INSUFFICIENT_CREDITS" || code === "INSUFFICIENT_RODI") setError({ text: propsRef.current.t("insufficientCredits"), credits: true });
        else setError({ text: message || propsRef.current.t("aiError") });
        return;
      }
      if (type === "done") {
        const summary = typeof payload.summary === "string" ? payload.summary : "";
        const text = streamingRef.current || summary;
        streamingRef.current = "";
        setStreaming("");
        if (text) setMessages((list) => [...list, { id: `local-a-${Date.now()}`, role: "assistant", content: text }]);
        setOutline((prev) => (prev && !prev.needsConfirm ? null : prev));
      }
    },
    [],
  );

  const run = useCallback(
    async (task: (signal: AbortSignal) => Promise<void>) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(true);
      setError(null);
      setWarnings([]);
      streamingRef.current = "";
      setStreaming("");
      try {
        await task(ctrl.signal);
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          const e = err as { message?: string; code?: string; status?: number };
          if (e?.code === "INSUFFICIENT_CREDITS" || e?.code === "INSUFFICIENT_RODI" || e?.status === 402) setError({ text: t("insufficientCredits"), credits: true });
          else setError({ text: e?.message || t("aiError") });
        }
      } finally {
        if (abortRef.current === ctrl) abortRef.current = null;
        setBusy(false);
        setActivity(null);
      }
    },
    [t],
  );

  // History and an outline still waiting for confirmation (or a run still going).
  useEffect(() => {
    if (!client) return;
    let alive = true;
    const history = client.messages().then((rows) => {
      if (alive) setMessages(rows);
      return rows.length;
    }).catch(() => 0);
    const activeRun = client.active().catch(() => null);
    void Promise.all([history, activeRun]).then(([count, active]) => {
      if (alive) setReady({ empty: count === 0 && !active });
    });
    void activeRun.then((active) => {
      if (!alive || !active) return;
      const tasks = tasksFromPlan({ tasks: active.plan });
      if (active.status === "awaiting_plan_confirm" && tasks.length) {
        setOpenTask(tasks[0]?.id ?? null);
        setOutline({ runId: active.id, tasks, title: active.plan_meta?.title, summary: active.plan_meta?.summary, needsConfirm: true });
      } else if (active.status === "running") {
        runRef.current = active.id;
        if (tasks.length) setOutline({ runId: active.id, tasks, title: active.plan_meta?.title, summary: active.plan_meta?.summary, needsConfirm: false });
        void run((signal) => client.subscribe(active.id, handle, signal));
      }
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [client, handle, run]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, streaming, outline, activity]);

  const send = async (body: MessageBody) => {
    if (!client || busy) return;
    const tag = body.target ? propsRef.current.targetLabel : undefined;
    setMessages((list) => [...list, { id: `local-u-${Date.now()}`, role: "user", content: body.content, tag }]);
    setOutline(null);
    await run(async (signal) => {
      await props.beforeSend();
      await client.send(body, handle, signal);
    });
  };

  useEffect(() => {
    const prompt = props.initialPrompt?.trim();
    if (!ready || bootSentRef.current || !prompt || readOnly) return;
    bootSentRef.current = true;
    propsRef.current.onInitialPromptUsed?.();
    if (ready.empty) void send(messageBody(prompt, { target: undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, props.initialPrompt, readOnly]);

  const uploading = attachments.some((a) => !a.failed && (a.kind === "image" ? !a.path : a.text === undefined));
  const ready_images = attachments.filter((a) => a.kind === "image" && a.path).map((a) => a.path as string);
  const readyDocs = attachments.filter((a) => a.kind !== "image" && a.text !== undefined && !a.failed);
  // What each document weighs once the typed text is counted (50k message limit).
  const fittedDocs = fitDocuments(
    readyDocs.map((a) => ({ key: a.key, name: a.name, kind: a.kind as DocKind, text: a.text as string, truncated: !!a.truncated })),
    input.length,
  );
  const cutDocs = fittedDocs.filter((doc) => doc.truncated);
  // An imported PowerPoint or PDF rebuilds the whole deck, whatever is selected.
  const deckWide = attachments.some((a) => a.kind !== "image");
  const target = deckWide ? undefined : props.target;
  const canImport = !!client && !readOnly;
  // Attachment previews are object URLs made here from the picked file; nothing else is shown.
  const safePreviewSrc = (src: string | undefined) => (src && src.startsWith("blob:") ? src : undefined);

  const attach = (files: File[]) => {
    if (!canImport || !files.length) return;
    const upload = props.uploadImage;
    const errors: string[] = [];
    let room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    for (const file of files) {
      const kind = importKind(file);
      if (!kind) {
        errors.push(t("attachUnsupported", { name: file.name }));
        continue;
      }
      if (kind === "image" && !upload) {
        errors.push(t("attachNoImages", { name: file.name }));
        continue;
      }
      if (file.size > MAX_IMPORT_BYTES) {
        errors.push(t("attachTooBig", { name: file.name }));
        continue;
      }
      if (room <= 0) {
        errors.push(t("attachTooMany", { n: MAX_ATTACHMENTS }));
        break;
      }
      room -= 1;
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const patch = (next: Partial<Attachment>) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, ...next } : a)));
      if (kind === "image" && upload) {
        setAttachments((list) => [...list, { key, name: file.name, kind, preview: URL.createObjectURL(file) }]);
        upload(file)
          .then((picked) => patch({ path: picked.path }))
          .catch(() => patch({ failed: true }));
      } else if (kind !== "image") {
        setAttachments((list) => [...list, { key, name: file.name, kind }]);
        extractDocument(file, kind)
          .then((doc) => patch({ text: doc.text, truncated: doc.truncated, slides: doc.slides }))
          .catch((err: unknown) => {
            setAttachments((list) => list.filter((a) => a.key !== key));
            const code = err instanceof ImportError && err.code === "empty" ? "attachNoText" : "attachUnreadable";
            setImportErrors((list) => [...list, t(code, { name: file.name })]);
          });
      }
    }
    setImportErrors(errors);
  };

  const removeAttachment = (key: string) => {
    setAttachments((list) => {
      const gone = list.find((a) => a.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return list.filter((a) => a.key !== key);
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    // While dictating, the text is still moving: send once the user is done.
    if (voice.listening) return;
    if ((!text && !ready_images.length && !fittedDocs.length) || uploading) return;
    const fallback = fittedDocs.some((doc) => doc.kind === "pptx")
      ? t("attachPptxDefault")
      : fittedDocs.length
        ? t("attachPdfDefault")
        : t("attachDefault");
    const content = withImages(withDocuments(text || fallback, fittedDocs), ready_images);
    setInput("");
    for (const a of attachments) if (a.preview) URL.revokeObjectURL(a.preview);
    setAttachments([]);
    setImportErrors([]);
    void send(messageBody(content, { target }));
  };

  const quick = (action: QuickAction, value?: string) => {
    const target = props.target ?? props.actionTarget;
    if (!target) return;
    const label = t(QA_LABEL[action]) + (value ? ` (${value})` : "");
    setQa(null);
    setQaInput("");
    void send(quickActionBody(action, label, target, value ?? null));
  };

  const confirm = async () => {
    if (!client || !outline) return;
    const body = confirmPlanBody(outline.tasks);
    setOutline({ ...outline, needsConfirm: false, tasks: body.plan });
    await run((signal) => client.confirm(outline.runId, body, handle, signal));
  };

  const stop = async () => {
    abortRef.current?.abort();
    const runId = runRef.current;
    if (client && runId) await client.cancel(runId).catch(() => undefined);
  };

  const editTask = (index: number, patch: Partial<OutlineTask>) =>
    setOutline((prev) => (prev ? { ...prev, tasks: prev.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)) } : prev));
  const moveTask = (index: number, delta: number) =>
    setOutline((prev) => {
      if (!prev) return prev;
      const tasks = [...prev.tasks];
      const to = index + delta;
      if (to < 0 || to >= tasks.length) return prev;
      [tasks[index], tasks[to]] = [tasks[to], tasks[index]];
      return { ...prev, tasks };
    });

  const canAct = !!(props.target ?? props.actionTarget) && !busy && !readOnly && !!client;

  // Requests from the right-click menu, handled once each.
  const request = props.request;
  const handledRef = useRef(0);
  useEffect(() => {
    if (!request || request.nonce === handledRef.current) return;
    handledRef.current = request.nonce;
    if (request.kind === "focus") {
      inputRef.current?.focus();
    } else if (request.kind === "quick") {
      if (canAct) quick(request.action);
    } else if (canAct) {
      setQaInput("");
      setQa(request.action);
      requestAnimationFrame(() => qaRef.current?.querySelector<HTMLElement>("select, input")?.focus());
    }
    propsRef.current.onRequestDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per request
  }, [request]);

  return (
    <section className="de-chat" aria-label={t("chatTitle")}>
      <header className="de-chat-head">
        <strong>{t("chatTitle")}</strong>
        {busy ? <Loader2 className="de-spin" size={14} aria-hidden /> : null}
        {props.onCollapse ? (
          <button type="button" className="de-icon-button de-chat-collapse" onClick={props.onCollapse} aria-label={t("chatCollapse")} title={t("chatCollapse")}>
            <PanelLeftClose size={15} aria-hidden />
          </button>
        ) : null}
      </header>
      <div className="de-chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 && !outline ? <p className="de-hint">{t("chatEmpty")}</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={`de-msg de-msg-${m.role === "user" ? "user" : "assistant"}`}>
            {m.role === "user" ? (
              <>
                {m.tag ? <span className="de-msg-tag">{m.tag}</span> : null}
                <UserMessage content={m.content} assetUrl={props.assetUrl} />
              </>
            ) : (
              <ChatMarkdown content={m.content} />
            )}
          </div>
        ))}
        {streaming ? (
          <div className="de-msg de-msg-assistant">
            <ChatMarkdown content={streaming} />
          </div>
        ) : null}
        {outline ? (
          <div className="de-outline" data-testid="deck-outline">
            <header>
              <strong>{outline.title || t("outlineTitle")}</strong>
              {outline.summary ? <p>{outline.summary}</p> : null}
              {outline.needsConfirm ? <p className="de-hint">{t("outlineHint")}</p> : null}
            </header>
            <ol>
              {outline.tasks.map((task, i) => (
                <li key={task.id} className={`de-outline-item is-${task.status ?? "pending"}${outline.needsConfirm && openTask === task.id ? " is-open" : ""}`}>
                  {outline.needsConfirm ? (
                    <>
                      <button
                        type="button"
                        className="de-outline-head"
                        aria-expanded={openTask === task.id}
                        onClick={() => setOpenTask(openTask === task.id ? null : task.id)}
                      >
                        <span className="de-outline-num">{i + 1}</span>
                        <span className="de-outline-name">{task.title.trim() || t("slideN", { n: i + 1 })}</span>
                        <span className="de-outline-meta">{t(LAYOUT_LABEL[task.layout as keyof typeof LAYOUT_LABEL] ?? "outlineIdea")}</span>
                        <ChevronDown size={14} aria-hidden className="de-outline-caret" />
                      </button>
                      {openTask === task.id ? (
                      <div className="de-outline-body">
                      <div className="de-row">
                        <input value={task.title} aria-label={`${t("title")} ${i + 1}`} maxLength={200} onChange={(e) => editTask(i, { title: e.target.value })} />
                        <select value={task.layout} aria-label={t("chooseLayout")} onChange={(e) => editTask(i, { layout: e.target.value })}>
                          {LAYOUT_NAMES.map((name) => (
                            <option key={name} value={name}>
                              {t(LAYOUT_LABEL[name])}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea value={task.detail} aria-label={`${t("outlineIdea")} ${i + 1}`} rows={2} maxLength={1000} onChange={(e) => editTask(i, { detail: e.target.value })} />
                      <div className="de-row">
                        <label className="de-toggle">
                          <input type="checkbox" checked={task.visual} onChange={(e) => editTask(i, { visual: e.target.checked })} />
                          <span>{t("outlineVisual")}</span>
                        </label>
                        <span className="de-row-gap" />
                        <button type="button" className="de-icon-button" aria-label={t("moveUp")} title={t("moveUp")} onClick={() => moveTask(i, -1)} disabled={i === 0}>
                          <ArrowUp size={14} aria-hidden />
                        </button>
                        <button type="button" className="de-icon-button" aria-label={t("moveDown")} title={t("moveDown")} onClick={() => moveTask(i, 1)} disabled={i === outline.tasks.length - 1}>
                          <ArrowDown size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="de-icon-button"
                          aria-label={t("outlineRemove")}
                          title={t("outlineRemove")}
                          onClick={() => setOutline({ ...outline, tasks: outline.tasks.filter((_, j) => j !== i) })}
                          disabled={outline.tasks.length <= 1}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                      </div>
                      ) : null}
                    </>
                  ) : (
                    <span className="de-outline-progress">
                      <span className="de-outline-num">
                        {task.status === "running" ? <Loader2 className="de-spin" size={11} aria-hidden /> : task.status === "done" ? <Check size={11} aria-hidden /> : i + 1}
                      </span>
                      <span className="de-outline-name">{task.title}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {outline.needsConfirm ? (
              <div className="de-row">
                <button
                  type="button"
                  className="de-button de-button-ghost"
                  onClick={() => {
                    const id = `new-${outline.tasks.length + 1}-${Date.now().toString(36)}`;
                    setOutline({ ...outline, tasks: [...outline.tasks, { id, title: "", detail: "", layout: "text", visual: false }] });
                    setOpenTask(id);
                  }}
                >
                  <Plus size={14} aria-hidden /> {t("outlineAdd")}
                </button>
                <button type="button" className="de-button de-button-primary" disabled={busy || readOnly || !outline.tasks.some((task) => task.title.trim())} onClick={() => void confirm()}>
                  {t("outlineConfirm")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        {activity ? (
          <p className="de-activity">
            <Loader2 className="de-spin" size={12} aria-hidden /> {activity}
          </p>
        ) : null}
        {warnings.map((w, i) => (
          <p key={i} className="de-hint">
            {w}
          </p>
        ))}
        {error ? (
          <p className="builder-pane-error" role="alert">
            {error.text}{" "}
            {error.credits ? (
              <a href={rodiumRechargeUrl(getSessionSnapshot()?.profile?.rodium_sub)} target="_blank" rel="noreferrer">
                {t("recharge")}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="de-quick" role="group" aria-label={t("quickActions")}>
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            className="de-chip"
            disabled={!canAct}
            data-action={action}
            onClick={() => (action === "change_layout" || action === "translate" ? setQa(qa === action ? null : action) : quick(action))}
            aria-expanded={action === qa ? true : undefined}
          >
            <Wand2 size={12} aria-hidden /> {t(QA_LABEL[action])}
          </button>
        ))}
      </div>
      {qa ? (
        <form
          ref={qaRef}
          className="de-qa-form"
          onSubmit={(e) => {
            e.preventDefault();
            quick(qa, qaInput.trim() || undefined);
          }}
        >
          {qa === "change_layout" ? (
            <select value={qaInput} onChange={(e) => setQaInput(e.target.value)} aria-label={t("chooseLayout")} required>
              <option value="" disabled>
                {t("chooseLayout")}
              </option>
              {LAYOUT_NAMES.map((name) => (
                <option key={name} value={name}>
                  {t(LAYOUT_LABEL[name])}
                </option>
              ))}
            </select>
          ) : (
            <input value={qaInput} onChange={(e) => setQaInput(e.target.value)} placeholder={t("qaLanguage")} aria-label={t("qaTranslateTo")} maxLength={64} />
          )}
          <button type="submit" className="de-button de-button-primary" disabled={qa === "change_layout" && !qaInput}>
            {t("apply")}
          </button>
          <button type="button" className="de-icon-button" aria-label={t("cancel")} title={t("cancel")} onClick={() => setQa(null)}>
            <X size={14} aria-hidden />
          </button>
        </form>
      ) : null}

      <form
        className={`de-composer${dragOver ? " is-drop" : ""}`}
        onSubmit={onSubmit}
        onDragOver={(e) => {
          if (!canImport || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
        }}
        onDrop={(e) => {
          if (!canImport) return;
          e.preventDefault();
          setDragOver(false);
          attach(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="de-target">
          <span className="de-target-chip" data-testid="deck-target">
            {target ? props.targetLabel : t("targetDeck")}
          </span>
          {target ? (
            <button type="button" className="de-icon-button" onClick={props.onClearTarget} aria-label={t("targetClear")} title={t("targetClear")}>
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </div>
        {attachments.length ? (
          <ul className="de-attachments" aria-label={t("attachList")}>
            {attachments.map((a) => {
              const busyItem = !a.failed && (a.kind === "image" ? !a.path : a.text === undefined);
              const cut = cutDocs.some((doc) => doc.key === a.key);
              if (a.kind !== "image") {
                const Icon = a.kind === "pptx" ? Presentation : FileText;
                return (
                  <li
                    key={a.key}
                    className={`de-attachment de-attachment-doc${cut ? " is-cut" : ""}`}
                    title={busyItem ? t("attachReading", { name: a.name }) : a.name}
                    data-kind={a.kind}
                  >
                    {busyItem ? <Loader2 size={14} className="de-spin" aria-hidden /> : <Icon size={14} aria-hidden />}
                    <span className="de-attachment-name">{a.name}</span>
                    {a.slides ? <span className="de-attachment-meta">{t("attachSlides", { n: a.slides })}</span> : null}
                    {cut ? <span className="de-attachment-meta">{t("attachCut")}</span> : null}
                    <button type="button" onClick={() => removeAttachment(a.key)} aria-label={t("attachRemove", { name: a.name })} title={t("attachRemove", { name: a.name })}>
                      <X size={11} aria-hidden />
                    </button>
                  </li>
                );
              }
              return (
                <li key={a.key} className={`de-attachment${a.failed ? " is-failed" : ""}`} title={a.failed ? t("attachFailed") : a.name}>
                  <img src={safePreviewSrc(a.preview)} alt={a.name} />
                  {busyItem ? (
                    <span className="de-attachment-busy">
                      <Loader2 size={14} className="de-spin" aria-hidden />
                    </span>
                  ) : null}
                  <button type="button" onClick={() => removeAttachment(a.key)} aria-label={t("attachRemove", { name: a.name })} title={t("attachRemove", { name: a.name })}>
                    <X size={11} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {cutDocs.map((doc) => (
          <p key={doc.key} className="de-hint de-attach-note">
            {t("attachTruncated", { name: doc.name, n: doc.text.length.toLocaleString(props.locale === "fr" ? "fr-FR" : "en-US") })}
          </p>
        ))}
        {importErrors.length ? (
          <p className="builder-pane-error de-attach-note" role="alert">
            {importErrors.join(" ")}
          </p>
        ) : null}
        <textarea
          ref={inputRef}
          value={input}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (canImport && files.length) {
              e.preventDefault();
              attach(files);
            }
          }}
          onChange={(e) => setInput(e.target.value)}
          placeholder={target ? t("chatPlaceholderTarget", { target: props.targetLabel }) : t("chatPlaceholder")}
          aria-label={t("chatPlaceholder")}
          rows={3}
          maxLength={50000}
          disabled={!client || readOnly}
          readOnly={voice.listening}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        <VoiceStatus voice={voice} compact />
        <div className="de-composer-foot">
          {client && !readOnly ? (
            <>
              <Popover
                tone="dark"
                role="menu"
                side="top"
                align="start"
                label={t("attachMenu")}
                width={260}
                trigger={
                  <button
                    type="button"
                    className="de-plus"
                    disabled={attachments.length >= MAX_ATTACHMENTS}
                    aria-label={t("attachMenu")}
                    title={t("attachMenu")}
                  >
                    <Glyph name="plus" size="sm" />
                    {attachments.length ? (
                      <span className="badge" aria-hidden>
                        {attachments.length}
                      </span>
                    ) : null}
                  </button>
                }
              >
                {(close) => (
                  <>
                    {props.uploadImage ? (
                      <MenuItem
                        icon="image"
                        hint={t("attachImagesHint")}
                        onClick={() => {
                          close();
                          pickFiles(IMAGE_ACCEPT);
                        }}
                      >
                        {t("attachImages")}
                      </MenuItem>
                    ) : null}
                    <MenuItem
                      icon="file"
                      hint={t("attachDocsHint")}
                      onClick={() => {
                        close();
                        pickFiles(DOCUMENT_ACCEPT);
                      }}
                    >
                      {t("attachDocs")}
                    </MenuItem>
                  </>
                )}
              </Popover>
              <input
                ref={fileRef}
                type="file"
                accept={props.uploadImage ? IMPORT_ACCEPT : DOCUMENT_ACCEPT}
                multiple
                hidden
                data-testid="deck-attach-input"
                onChange={(e) => {
                  attach(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </>
          ) : (
            <span />
          )}
          <span className="de-composer-send">
          {busy ? null : <VoiceButton voice={voice} disabled={!client || readOnly} className="f-mic" size="sm" />}
          {busy ? (
            <button type="button" className="de-button" onClick={() => void stop()} aria-label={t("stop")}>
              <Square size={14} aria-hidden /> {t("stop")}
            </button>
          ) : (
            <button
              type="submit"
              className="de-button de-button-primary"
              disabled={!client || readOnly || uploading || voice.listening || (!input.trim() && !ready_images.length && !fittedDocs.length)}
              aria-label={t("send")}
            >
              <Send size={14} aria-hidden /> {t("send")}
            </button>
          )}
          </span>
        </div>
      </form>
    </section>
  );
}

/** A sent message: its text, the imported documents, then the attached pictures as thumbnails. */
function UserMessage({ content, assetUrl }: { content: string; assetUrl?: AssetUrl }) {
  const { text: withoutDocs, documents } = splitDocuments(content);
  const { text, images } = splitImages(withoutDocs);
  return (
    <>
      {text ? <p>{text}</p> : null}
      {documents.length ? (
        <ul className="de-msg-docs">
          {documents.map((doc, i) => {
            const Icon = doc.kind === "pptx" ? Presentation : FileText;
            return (
              <li key={`${doc.name}-${i}`}>
                <Icon size={13} aria-hidden /> <span>{doc.name}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {images.length && assetUrl ? (
        <div className="de-msg-images">
          {images.map((path) => (
             
            <img key={path} src={assetUrl(path)} alt={path.split("/").pop() ?? ""} loading="lazy" />
          ))}
        </div>
      ) : null}
    </>
  );
}

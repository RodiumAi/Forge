"use client";

/**
 * The AI chat beside the deck: messages, the target chip (whole deck, a
 * slide or one element), quick actions, the outline confirmation of a new
 * deck, and the stream of `deck.*` events applied to the editor as they
 * arrive (docs/plans/deck-ai-events.md).
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Send, Square, Trash2, Wand2, X } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { getSessionSnapshot } from "@/lib/session-cache";
import {
  confirmPlanBody,
  messageBody,
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
import type { ChatClient, ChatMessage } from "./chat-client";
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
};

export function DeckChat(props: DeckChatProps) {
  const { client, t, readOnly } = props;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [streaming, setStreaming] = useState("");
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [qa, setQa] = useState<null | "change_layout" | "translate">(null);
  const [qaInput, setQaInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef("");
  const runRef = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

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
    void client.messages().then((rows) => alive && setMessages(rows)).catch(() => undefined);
    void client.active().then((active) => {
      if (!alive || !active) return;
      const tasks = tasksFromPlan({ tasks: active.plan });
      if (active.status === "awaiting_plan_confirm" && tasks.length) {
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
    setMessages((list) => [...list, { id: `local-u-${Date.now()}`, role: "user", content: body.content }]);
    setOutline(null);
    await run(async (signal) => {
      await props.beforeSend();
      await client.send(body, handle, signal);
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    setInput("");
    void send(messageBody(content, { target: props.target }));
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

  return (
    <section className="de-chat" aria-label={t("chatTitle")}>
      <header className="de-chat-head">
        <strong>{t("chatTitle")}</strong>
        {busy ? <Loader2 className="de-spin" size={14} aria-hidden /> : null}
      </header>
      <div className="de-chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 && !outline ? <p className="de-hint">{t("chatEmpty")}</p> : null}
        {messages.map((m) => (
          <div key={m.id} className={`de-msg de-msg-${m.role === "user" ? "user" : "assistant"}`}>
            {m.role === "user" ? <p>{m.content}</p> : <ChatMarkdown content={m.content} />}
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
                <li key={task.id} className={`de-outline-item is-${task.status ?? "pending"}`}>
                  {outline.needsConfirm ? (
                    <>
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
                    </>
                  ) : (
                    <span>
                      {task.status === "running" ? <Loader2 className="de-spin" size={12} aria-hidden /> : null} {task.title}
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
                  onClick={() =>
                    setOutline({
                      ...outline,
                      tasks: [...outline.tasks, { id: `new-${outline.tasks.length + 1}-${Date.now().toString(36)}`, title: "", detail: "", layout: "text", visual: false }],
                    })
                  }
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

      <form className="de-composer" onSubmit={onSubmit}>
        <div className="de-target">
          <span className="de-target-chip" data-testid="deck-target">
            {props.targetLabel}
          </span>
          {props.target ? (
            <button type="button" className="de-icon-button" onClick={props.onClearTarget} aria-label={t("targetClear")} title={t("targetClear")}>
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={props.target ? t("chatPlaceholderTarget", { target: props.targetLabel }) : t("chatPlaceholder")}
          aria-label={t("chatPlaceholder")}
          rows={3}
          maxLength={50000}
          disabled={!client || readOnly}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
        />
        {busy ? (
          <button type="button" className="de-button" onClick={() => void stop()} aria-label={t("stop")}>
            <Square size={14} aria-hidden /> {t("stop")}
          </button>
        ) : (
          <button type="submit" className="de-button de-button-primary" disabled={!client || readOnly || !input.trim()} aria-label={t("send")}>
            <Send size={14} aria-hidden /> {t("send")}
          </button>
        )}
      </form>
    </section>
  );
}

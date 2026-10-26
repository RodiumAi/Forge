"use client";

/**
 * Codelab AI chat: messages with an optional step target, quick actions
 * (code check, starter / solution files), the outline to confirm on a blank
 * codelab, and the code review report. Events go through `reduceEvent`; what
 * concerns the document is handed to the editor through `onEffect`.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Loader2, Send, Square, TextSelect, X } from "lucide-react";
import { ContextMenu, copyText, useContextMenu, useMenuTrigger, type ContextMenuEntry } from "@/components/ui/ContextMenu";
import type { CodelabChatClient } from "./api";
import {
  confirmBody,
  initialChat,
  line,
  messageBody,
  reduceEvent,
  type ChatState,
  type CodelabAction,
  type EditorEffect,
  type OutlineStep,
} from "./ai";
import type { Translate } from "./strings";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSpeechInput } from "@/lib/speech-input";
import { VoiceButton, VoiceStatus } from "@/components/composer/VoiceInput";

type Action =
  | { type: "event"; payload: Record<string, unknown> }
  | { type: "user"; text: string }
  | { type: "busy"; busy: boolean }
  | { type: "outline"; steps: OutlineStep[] | null }
  | { type: "history"; lines: ChatState["lines"] }
  | { type: "error"; text: string };

export type ChatPanelProps = {
  client: CodelabChatClient;
  /** Selected step (id and title) the user may target. */
  selected: { id: string; title: string } | null;
  onEffect: (effect: EditorEffect) => void;
  onSelectStep: (stepId: string) => void;
  readOnly?: boolean;
  /** Prompt typed on the home page, sent once on a codelab with no conversation yet. */
  initialPrompt?: string | null;
  onInitialPromptUsed?: () => void;
  t: Translate;
};

export function ChatPanel({ client, selected, onEffect, onSelectStep, readOnly, initialPrompt, onInitialPromptUsed, t }: ChatPanelProps) {
  const effectRef = useRef(onEffect);
  effectRef.current = onEffect;
  const pending = useRef<EditorEffect[]>([]);

  const [state, dispatch] = useReducer((current: ChatState, action: Action): ChatState => {
    switch (action.type) {
      case "event": {
        const { state: next, effects } = reduceEvent(current, action.payload);
        pending.current.push(...effects);
        return next;
      }
      case "user":
        return { ...current, busy: true, check: null, lines: [...current.lines, line("user", action.text)] };
      case "busy":
        return { ...current, busy: action.busy, writing: action.busy ? current.writing : null };
      case "outline":
        return { ...current, outline: action.steps && current.outline ? { ...current.outline, steps: action.steps } : null };
      case "history":
        return { ...current, lines: action.lines };
      case "error":
        return { ...current, busy: false, writing: null, lines: [...current.lines, line("error", action.text)] };
      default:
        return current;
    }
  }, initialChat);

  // Effects leave the reducer (which must stay pure) after each render.
  useEffect(() => {
    if (!pending.current.length) return;
    const effects = pending.current.splice(0);
    effects.forEach((effect) => effectRef.current(effect));
  });

  const [text, setText] = useState("");
  const { locale } = useI18n();
  const voice = useSpeechInput({ value: text, onChange: setText, locale });
  const [targeted, setTargeted] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  // Set once the history is read: whether the codelab already has a conversation or a run.
  const [started, setStarted] = useState<boolean | null>(null);
  const bootSentRef = useRef(false);
  const usedRef = useRef(onInitialPromptUsed);
  usedRef.current = onInitialPromptUsed;

  const onEvent = useCallback((payload: Record<string, unknown>) => dispatch({ type: "event", payload }), []);

  const run = useCallback(
    async (start: (signal: AbortSignal) => Promise<void>) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "busy", busy: true });
      try {
        await start(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) dispatch({ type: "error", text: error instanceof Error ? error.message : String(error) });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        dispatch({ type: "busy", busy: false });
      }
    },
    [],
  );

  // History, then the active run: an outline waiting for confirmation, or a
  // run still writing (its events are replayed).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await client.messages();
        if (!alive) return;
        dispatch({
          type: "history",
          lines: rows
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ id: m.id, role: m.role === "user" ? "user" : "assistant", text: m.content })),
        });
        const active = await client.active();
        if (!alive) return;
        setStarted(rows.length > 0 || !!active);
        if (!active) return;
        if (active.status === "awaiting_plan_confirm") {
          dispatch({
            type: "event",
            payload: { type: "plan", run_id: active.id, tasks: active.plan, meta: active.plan_meta ?? {}, needs_confirm: true },
          });
        } else if (active.status === "running" || active.status === "queued") {
          void run((signal) => client.subscribe(active.id, onEvent, signal));
        }
      } catch {
        // The chat stays usable without its history.
        if (alive) setStarted(true);
      }
    })();
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [client, onEvent, run]);

  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (started === null || bootSentRef.current || !prompt || readOnly) return;
    bootSentRef.current = true;
    usedRef.current?.();
    if (started) return;
    dispatch({ type: "user", text: prompt });
    void run((signal) => client.send(messageBody(prompt, { stepId: null }), onEvent, signal));
  }, [started, initialPrompt, readOnly, client, onEvent, run]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [state.lines.length, state.writing, state.check]);

  const send = (content: string, action?: CodelabAction) => {
    const value = content.trim();
    if (!value || state.busy || readOnly) return;
    // A quick action can run during dictation; it ends the dictation first.
    if (voice.listening) voice.cancel();
    const stepId = targeted && selected && !action ? selected.id : null;
    dispatch({ type: "user", text: value });
    setText("");
    void run((signal) => client.send(messageBody(value, { stepId, action }), onEvent, signal));
  };

  const confirm = () => {
    const outline = state.outline;
    if (!outline || state.busy) return;
    const body = confirmBody(outline.steps);
    dispatch({ type: "outline", steps: null });
    void run((signal) => client.confirm(outline.runId, body, onEvent, signal));
  };

  const stop = () => {
    const runId = state.runId;
    abortRef.current?.abort();
    if (runId) void client.cancel(runId).catch(() => undefined);
  };

  const editOutline = (steps: OutlineStep[]) => dispatch({ type: "outline", steps });

  const menu = useContextMenu();
  const trigger = useMenuTrigger<string>((text, at) => {
    let picked = "";
    try {
      picked = String(window.getSelection() || "").trim();
    } catch {
      picked = "";
    }
    const items: ContextMenuEntry[] = [
      ...(picked ? [{ id: "copy-sel", label: t("copySelection"), icon: <TextSelect size={16} aria-hidden />, onSelect: () => copyText(picked) }] : []),
      { id: "copy", label: t("copyMessage"), icon: <Copy size={16} aria-hidden />, onSelect: () => copyText(text) },
    ];
    menu.open(at, items, t("menuMessage"));
  });

  return (
    <div className="cle-chat">
      <div className="cle-chat-log" ref={listRef} aria-live="polite">
        {state.lines.map((entry) => (
          <div
            key={entry.id}
            className={`cle-msg cle-msg-${entry.role}`}
            {...trigger.bind(entry.text.startsWith("files:") ? t("filesWritten", { n: entry.text.slice(6) }) : entry.text)}
          >
            <span className="cle-msg-who">{entry.role === "user" ? t("you") : t("assistant")}</span>
            <p>{entry.text.startsWith("files:") ? t("filesWritten", { n: entry.text.slice(6) }) : entry.text}</p>
          </div>
        ))}

        {state.outline ? (
          <div className="cle-outline" data-testid="codelab-outline">
            <strong>{state.outline.title || t("outlineTitle")}</strong>
            {state.outline.summary ? <p className="cle-hint">{state.outline.summary}</p> : null}
            <p className="cle-hint">{t("outlineHint")}</p>
            <ol>
              {state.outline.steps.map((step, index, all) => (
                <li key={step.id}>
                  <input
                    aria-label={t("stepTitle")}
                    value={step.title}
                    disabled={state.busy}
                    onChange={(e) => editOutline(all.map((s) => (s.id === step.id ? { ...s, title: e.target.value } : s)))}
                  />
                  <input
                    aria-label={t("minutesLabel")}
                    type="number"
                    min={0}
                    max={600}
                    value={step.minutes}
                    disabled={state.busy}
                    onChange={(e) =>
                      editOutline(all.map((s) => (s.id === step.id ? { ...s, minutes: Math.max(0, Math.min(600, Number(e.target.value) || 0)) } : s)))
                    }
                  />
                  <button
                    type="button"
                    aria-label={t("moveUp")}
                    disabled={index === 0 || state.busy}
                    onClick={() => editOutline(swap(all, index, index - 1))}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("moveDown")}
                    disabled={index === all.length - 1 || state.busy}
                    onClick={() => editOutline(swap(all, index, index + 1))}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label={t("removeTask")}
                    disabled={all.length <= 1 || state.busy}
                    onClick={() => editOutline(all.filter((s) => s.id !== step.id))}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" className="cle-primary" disabled={state.busy || readOnly} onClick={confirm}>
              {t("confirmOutline")}
            </button>
          </div>
        ) : null}

        {state.check ? (
          <div className="cle-check" data-testid="codelab-check">
            <strong>{t("checkTitle")}</strong>
            {state.check.summary ? <p>{state.check.summary}</p> : null}
            {state.check.issues.length === 0 ? <p className="cle-hint">{t("checkClean")}</p> : null}
            <ul>
              {state.check.issues.map((issue, i) => (
                <li key={i} data-severity={issue.severity}>
                  {issue.stepId ? (
                    <button type="button" className="cle-link" onClick={() => onSelectStep(issue.stepId as string)}>
                      {issue.stepId}
                    </button>
                  ) : null}{" "}
                  {issue.message}
                  {issue.fix ? <em> {issue.fix}</em> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {state.writing ? (
          <p className="cle-status">
            <Loader2 size={14} className="cle-spin" /> {t("writing", { title: state.writing.title })}
          </p>
        ) : null}
      </div>

      <div className="cle-chat-actions">
        <button type="button" disabled={state.busy || readOnly} onClick={() => send(t("checkCode"), "check_code")}>
          {t("checkCode")}
        </button>
        <button type="button" disabled={state.busy || readOnly} onClick={() => send(t("makeFiles"), "make_files")}>
          {t("makeFiles")}
        </button>
      </div>

      {selected ? (
        <label className="cle-target">
          <input type="checkbox" checked={targeted} onChange={(e) => setTargeted(e.target.checked)} />
          {targeted ? `${t("targetStep")}: ${selected.title}` : t("targetAll")}
        </label>
      ) : null}

      <VoiceStatus voice={voice} compact surface />
      <form
        className="cle-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!voice.listening) send(text);
        }}
      >
        <textarea
          value={text}
          rows={3}
          disabled={readOnly}
          readOnly={voice.listening}
          placeholder={targeted && selected ? t("chatPlaceholderStep", { title: selected.title }) : t("chatPlaceholder")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!voice.listening) send(text);
            }
          }}
        />
        {state.busy ? null : <VoiceButton voice={voice} disabled={readOnly} className="f-mic" size="sm" />}
        {state.busy ? (
          <button type="button" aria-label={t("stop")} onClick={stop}>
            <Square size={16} />
          </button>
        ) : (
          <button type="submit" aria-label={t("send")} disabled={!text.trim() || readOnly || voice.listening}>
            <Send size={16} />
          </button>
        )}
      </form>
      <ContextMenu request={menu.request} onClose={menu.close} />
    </div>
  );
}

function swap<T>(items: T[], a: number, b: number): T[] {
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}


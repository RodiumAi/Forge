"use client";

import { Check, Loader2, RotateCcw, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { UserMessageBody } from "@/components/UserMessageBody";
import { readableMessage } from "@/lib/chat-errors";
import { ContextMenu, copyText, useContextMenu, useMenuTrigger, type ContextMenuEntry } from "@/components/ui/ContextMenu";
import { api, readApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { parseUserMessageContent } from "@/lib/prompt-attachments";
import { useSpeechInput } from "@/lib/speech-input";
import { VoiceButton, VoiceStatus } from "@/components/composer/VoiceInput";
import { readSseStream } from "@/lib/sse";
import { authFetch } from "./api";
import { SECTIONS, type DesignSystemDoc, type SectionId } from "./tokens";

type ChatLine = {
  id: string;
  role: "user" | "assistant" | "note" | "error";
  text: string;
  /** Stored message id of a user line, for a retry. */
  messageId?: string;
};
type Step = { id: string; label: string; status: string };
type ApiMessage = { id: string; role: string; content: string };
type ActiveRun = { id: string; status: string } | null;
/** The last request did not finish: its message, to run it again. */
type Interrupted = { messageId: string | null; content: string };
type Outcome = "done" | "failed" | "stopped";

export type DesignSystemChatHandle = { ask: (prompt: string, section?: SectionId | null) => void };

type Props = {
  projectId: string;
  section: SectionId;
  disabled?: boolean;
  /** A document written by the AI (``design_system.document``). */
  onDocument: (doc: DesignSystemDoc) => void;
  /** The prompt typed on the home page: sent once, only when the conversation is empty. */
  initialPrompt?: string | null;
  /** Called once the history is read, whether the prompt was sent or not (clear it then). */
  onInitialPromptUsed?: () => void;
  /** The first generation from `initialPrompt` ended; `ok` false when it failed. */
  onInitialPromptDone?: (ok: boolean) => void;
};

/** Long prompts (the brand intake) fold to a few lines. */
const FOLD_CHARS = 280;

function UserLine({ content, projectId }: { content: string; projectId: string }) {
  const { t } = useI18n();
  const long = parseUserMessageContent(content).text.length > FOLD_CHARS;
  const [open, setOpen] = useState(false);
  return (
    <div className={`dse-user-body${long && !open ? " is-folded" : ""}`}>
      <UserMessageBody content={content} projectId={projectId} />
      {long ? (
        <button type="button" className="dse-fold" onClick={() => setOpen(!open)}>
          {open ? t("dsChatShowLess") : t("dsChatShowMore")}
        </button>
      ) : null}
    </div>
  );
}

/** Chat with the design system AI, optionally targeting the open section. */
export const DesignSystemChat = forwardRef<DesignSystemChatHandle, Props>(function DesignSystemChat(
  { projectId, section, disabled, onDocument, initialPrompt, onInitialPromptUsed, onInitialPromptDone },
  ref,
) {
  const { t, locale } = useI18n();
  const [chatId, setChatId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [interrupted, setInterrupted] = useState<Interrupted | null>(null);
  const [input, setInput] = useState("");
  const voice = useSpeechInput({ value: input, onChange: setInput, locale });
  const [targeted, setTargeted] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Set once the history is read: whether the conversation already has messages.
  const [started, setStarted] = useState<boolean | null>(null);
  const bootSentRef = useRef(false);
  const usedRef = useRef(onInitialPromptUsed);
  usedRef.current = onInitialPromptUsed;
  const doneRef = useRef(onInitialPromptDone);
  doneRef.current = onInitialPromptDone;
  const onDocumentRef = useRef(onDocument);
  onDocumentRef.current = onDocument;
  const tRef = useRef(t);
  tRef.current = t;

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: `${Date.now()}-${prev.length}` }]);
  }, []);

  /**
   * Reads one run's events: "done", "failed" (an error the user should see) or
   * "stopped" (the run went away: reload, cancel, lost connection).
   */
  const follow = useCallback(
    async (res: Response, request: Interrupted): Promise<Outcome> => {
      let outcome: Outcome = "stopped";
      await readSseStream(res, (event) => {
        const type = String(event.type ?? "");
        if (type === "user_message" && event.id) {
          const id = String(event.id);
          request.messageId = id;
          setLines((prev) => {
            const at = prev.map((l) => l.role).lastIndexOf("user");
            if (at < 0 || prev[at].messageId) return prev;
            const next = [...prev];
            next[at] = { ...next[at], messageId: id };
            return next;
          });
        } else if (type === "step") {
          const step = {
            id: String(event.id ?? event.label ?? ""),
            label: String(event.label ?? ""),
            status: String(event.status ?? ""),
          };
          setSteps((prev) => {
            const at = prev.findIndex((s) => s.id === step.id);
            if (at < 0) return [...prev, step];
            const next = [...prev];
            next[at] = { ...next[at], ...step, label: step.label || next[at].label };
            return next;
          });
        } else if (type === "warning") push({ role: "note", text: String(event.message ?? "") });
        else if (type === "design_system.document" && event.document) onDocumentRef.current(event.document as DesignSystemDoc);
        else if (type === "error") {
          const code = String(event.code ?? "");
          if (code === "run_detached" || code === "cancelled") outcome = "stopped";
          else {
            outcome = "failed";
            push({ role: "error", text: readableMessage(String(event.message ?? ""), tRef.current("dsChatFailed")) });
          }
        } else if (type === "done") {
          outcome = "done";
          push({ role: "assistant", text: String(event.summary ?? "") });
        }
      });
      return outcome;
    },
    [push],
  );

  const settle = useCallback((outcome: Outcome, request: Interrupted) => {
    setSteps([]);
    setInterrupted(outcome === "done" ? null : request);
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const chats = await api<{ id: string }[]>(`/projects/${projectId}/chats`);
        const main = chats[0];
        if (!alive) return;
        if (!main) {
          setStarted(true);
          return;
        }
        setChatId(main.id);
        const messages = await api<ApiMessage[]>(`/projects/${projectId}/chats/${main.id}/messages`);
        if (!alive) return;
        const shown = messages.filter((m) => m.role === "user" || m.role === "assistant");
        setStarted(messages.length > 0);
        setLines(
          shown.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            text: m.content,
            ...(m.role === "user" ? { messageId: m.id } : {}),
          })),
        );
        const last = shown[shown.length - 1];
        if (!last || last.role !== "user") return;
        // The last request has no answer: it is still running, or it stopped.
        const request: Interrupted = { messageId: last.id, content: last.content };
        let run: ActiveRun = null;
        try {
          run = await api<ActiveRun>(`/projects/${projectId}/chats/${main.id}/runs/active`);
        } catch {
          run = null;
        }
        if (!alive) return;
        if (run?.status !== "running") {
          setInterrupted(request);
          return;
        }
        setBusy(true);
        try {
          const res = await authFetch(`/projects/${projectId}/chats/${main.id}/runs/${run.id}/events?after=0`, {
            signal: controller.signal,
          });
          if (!res.ok) throw await readApiError(res);
          const outcome = await follow(res, request);
          if (alive) settle(outcome, request);
        } catch {
          if (alive) settle("stopped", request);
        } finally {
          if (alive) setBusy(false);
        }
      } catch {
        /* the chat stays usable once a message is sent */
        if (alive) setStarted(true);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [projectId, follow, settle]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [lines, steps, interrupted]);

  const send = useCallback(
    async (content: string, target: SectionId | null, retryOf?: string | null): Promise<boolean> => {
      const text = content.trim();
      if (!text || busy || !chatId) return false;
      setBusy(true);
      setInterrupted(null);
      setSteps([]);
      const request: Interrupted = { messageId: retryOf ?? null, content: text };
      if (!retryOf) push({ role: "user", text });
      let outcome: Outcome = "stopped";
      try {
        // A retry replays the stored message instead of adding a copy of it.
        const path = retryOf
          ? `/projects/${projectId}/chats/${chatId}/messages/branch`
          : `/projects/${projectId}/chats/${chatId}/messages`;
        const res = await authFetch(path, {
          method: "POST",
          body: JSON.stringify({
            content: text,
            mode: "agent",
            ...(retryOf ? { from_message_id: retryOf } : {}),
            ...(target ? { target: { section: target } } : {}),
          }),
        });
        if (!res.ok) throw await readApiError(res);
        outcome = await follow(res, request);
      } catch (err) {
        outcome = "failed";
        push({ role: "error", text: readableMessage(err instanceof Error ? err.message : "", t("dsChatFailed")) });
      } finally {
        settle(outcome, request);
        setBusy(false);
      }
      return outcome === "done";
    },
    [busy, chatId, follow, projectId, push, settle, t],
  );

  // The home page prompt: wait for the history, send once, only into an empty conversation.
  useEffect(() => {
    const prompt = initialPrompt?.trim();
    if (started === null || bootSentRef.current || !prompt || disabled) return;
    if (!started && !chatId) return;
    bootSentRef.current = true;
    usedRef.current?.();
    if (started) return;
    void send(prompt, null).then((ok) => doneRef.current?.(ok));
  }, [started, chatId, initialPrompt, disabled, send]);

  useImperativeHandle(ref, () => ({ ask: (prompt, target = null) => void send(prompt, target) }), [send]);

  const menu = useContextMenu();
  const trigger = useMenuTrigger<string>((text, at) => {
    let picked = "";
    try {
      picked = String(window.getSelection() || "").trim();
    } catch {
      picked = "";
    }
    const items: ContextMenuEntry[] = [
      ...(picked ? [{ id: "copy-sel", label: t("dsMenuCopySelection"), onSelect: () => copyText(picked) }] : []),
      { id: "copy", label: t("dsMenuCopyMessage"), onSelect: () => copyText(parseUserMessageContent(text).text || text) },
    ];
    menu.open(at, items, t("dsMenuMessage"));
  });

  const sectionKey = `dsSection_${section}` as const;
  return (
    <aside className="dse-chat" aria-label={t("dsChatTitle")}>
      <header className="dse-chat-head">
        <Icon icon={Sparkles} className="ui-icon-sm" /> {t("dsChatTitle")}
        {busy ? <Loader2 className="ui-icon-sm dse-spin" aria-hidden /> : null}
      </header>
      <div className="dse-chat-list" ref={listRef} aria-live="polite">
        {!lines.length && !busy ? <p className="dse-muted">{t("dsChatEmpty")}</p> : null}
        {lines.map((line) => (
          <div key={line.id} className={`dse-msg is-${line.role}`} {...trigger.bind(line.text)}>
            {line.role === "user" ? (
              <UserLine content={line.text} projectId={projectId} />
            ) : line.role === "assistant" ? (
              <ChatMarkdown content={line.text} />
            ) : (
              <p>
                {line.role === "error" ? <Icon icon={TriangleAlert} className="ui-icon-sm" /> : null} {line.text}
              </p>
            )}
          </div>
        ))}
        {busy ? (
          <div className="dse-run" role="status">
            <p className="dse-run-title">
              <Loader2 className="ui-icon-sm dse-spin" aria-hidden /> {t("dsChatRunning")}
            </p>
            {steps.length ? (
              <ol className="dse-steps">
                {steps.map((step) => (
                  <li key={step.id} className={`is-${step.status}`}>
                    {step.status === "done" ? (
                      <Check className="ui-icon-sm" aria-hidden />
                    ) : step.status === "error" ? (
                      <X className="ui-icon-sm" aria-hidden />
                    ) : (
                      <Loader2 className="ui-icon-sm dse-spin" aria-hidden />
                    )}
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            ) : null}
            <p className="dse-muted">{t("dsChatRunningHint")}</p>
          </div>
        ) : null}
        {!busy && interrupted ? (
          <div className="dse-interrupted" role="alert">
            <p>
              <Icon icon={TriangleAlert} className="ui-icon-sm" /> {t("dsChatInterrupted")}
            </p>
            {!disabled ? (
              <button
                type="button"
                className="dse-btn"
                disabled={!chatId}
                onClick={() => void send(interrupted.content, null, interrupted.messageId)}
              >
                <Icon icon={RotateCcw} className="ui-icon-sm" /> {t("dsChatRetry")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <form
        className="dse-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (voice.listening) return;
          const value = input;
          setInput("");
          void send(value, targeted ? section : null);
        }}
      >
        {SECTIONS.includes(section) ? (
          <label className="dse-check">
            <input type="checkbox" checked={targeted} onChange={(event) => setTargeted(event.target.checked)} />
            {t("dsChatTarget")} {t(sectionKey)}
          </label>
        ) : null}
        <textarea
          rows={3}
          value={input}
          disabled={disabled || busy}
          readOnly={voice.listening}
          placeholder={t("dsChatPlaceholder")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <VoiceStatus voice={voice} compact surface />
        <div className="dse-chat-send">
          <VoiceButton voice={voice} disabled={disabled || busy} className="f-mic" size="sm" />
          <button type="submit" className="dse-btn" disabled={disabled || busy || voice.listening || !input.trim() || !chatId}>
            <Icon icon={Send} className="ui-icon-sm" /> {busy ? t("dsChatWorking") : t("dsChatSend")}
          </button>
        </div>
      </form>
      <ContextMenu request={menu.request} onClose={menu.close} />
    </aside>
  );
});

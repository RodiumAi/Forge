"use client";

import { Send, Sparkles } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { ContextMenu, copyText, useContextMenu, useMenuTrigger, type ContextMenuEntry } from "@/components/ui/ContextMenu";
import { api, readApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useSpeechInput } from "@/lib/speech-input";
import { VoiceButton, VoiceStatus } from "@/components/composer/VoiceInput";
import { readSseStream } from "@/lib/sse";
import { authFetch } from "./api";
import { SECTIONS, type DesignSystemDoc, type SectionId } from "./tokens";

type ChatLine = { id: string; role: "user" | "assistant" | "status" | "error"; text: string };
type ApiMessage = { id: string; role: string; content: string };

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

/** Chat with the design system AI, optionally targeting the open section. */
export const DesignSystemChat = forwardRef<DesignSystemChatHandle, Props>(function DesignSystemChat(
  { projectId, section, disabled, onDocument, initialPrompt, onInitialPromptUsed, onInitialPromptDone },
  ref,
) {
  const { t, locale } = useI18n();
  const [chatId, setChatId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
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

  useEffect(() => {
    let alive = true;
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
        setStarted(messages.length > 0);
        setLines(
          messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", text: m.content })),
        );
      } catch {
        /* the chat stays usable once a message is sent */
        if (alive) setStarted(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight });
  }, [lines]);

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: `${Date.now()}-${prev.length}` }]);
  }, []);

  const send = useCallback(
    async (content: string, target: SectionId | null): Promise<boolean> => {
      const text = content.trim();
      if (!text || busy || !chatId) return false;
      let ok = true;
      setBusy(true);
      push({ role: "user", text });
      try {
        const res = await authFetch(`/projects/${projectId}/chats/${chatId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: text, mode: "agent", ...(target ? { target: { section: target } } : {}) }),
        });
        if (!res.ok) throw await readApiError(res);
        await readSseStream(res, (event) => {
          const type = String(event.type ?? "");
          if (type === "step" && event.status === "running") push({ role: "status", text: String(event.label ?? "") });
          else if (type === "warning") push({ role: "status", text: String(event.message ?? "") });
          else if (type === "design_system.document" && event.document) onDocument(event.document as DesignSystemDoc);
          else if (type === "error") {
            ok = false;
            push({ role: "error", text: String(event.message ?? t("dsChatFailed")) });
          }
          else if (type === "done") push({ role: "assistant", text: String(event.summary ?? "") });
        });
      } catch (err) {
        ok = false;
        push({ role: "error", text: err instanceof Error ? err.message : t("dsChatFailed") });
      } finally {
        setBusy(false);
      }
      return ok;
    },
    [busy, chatId, onDocument, projectId, push, t],
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
      { id: "copy", label: t("dsMenuCopyMessage"), onSelect: () => copyText(text) },
    ];
    menu.open(at, items, t("dsMenuMessage"));
  });

  const sectionKey = `dsSection_${section}` as const;
  return (
    <aside className="dse-chat" aria-label={t("dsChatTitle")}>
      <header className="dse-chat-head">
        <Icon icon={Sparkles} className="ui-icon-sm" /> {t("dsChatTitle")}
      </header>
      <div className="dse-chat-list" ref={listRef} aria-live="polite">
        {!lines.length ? <p className="dse-muted">{t("dsChatEmpty")}</p> : null}
        {lines.map((line) => (
          <p key={line.id} className={`dse-chat-line is-${line.role}`} {...trigger.bind(line.text)}>
            {line.text}
          </p>
        ))}
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

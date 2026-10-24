"use client";

import { Send, Sparkles } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { api, readApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
};

/** Chat with the design system AI, optionally targeting the open section. */
export const DesignSystemChat = forwardRef<DesignSystemChatHandle, Props>(function DesignSystemChat(
  { projectId, section, disabled, onDocument },
  ref,
) {
  const { t } = useI18n();
  const [chatId, setChatId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [input, setInput] = useState("");
  const [targeted, setTargeted] = useState(false);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const chats = await api<{ id: string }[]>(`/projects/${projectId}/chats`);
        const main = chats[0];
        if (!main || !alive) return;
        setChatId(main.id);
        const messages = await api<ApiMessage[]>(`/projects/${projectId}/chats/${main.id}/messages`);
        if (!alive) return;
        setLines(
          messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", text: m.content })),
        );
      } catch {
        /* the chat stays usable once a message is sent */
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines]);

  const push = useCallback((line: Omit<ChatLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: `${Date.now()}-${prev.length}` }]);
  }, []);

  const send = useCallback(
    async (content: string, target: SectionId | null) => {
      const text = content.trim();
      if (!text || busy || !chatId) return;
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
          else if (type === "error") push({ role: "error", text: String(event.message ?? t("dsChatFailed")) });
          else if (type === "done") push({ role: "assistant", text: String(event.summary ?? "") });
        });
      } catch (err) {
        push({ role: "error", text: err instanceof Error ? err.message : t("dsChatFailed") });
      } finally {
        setBusy(false);
      }
    },
    [busy, chatId, onDocument, projectId, push, t],
  );

  useImperativeHandle(ref, () => ({ ask: (prompt, target = null) => void send(prompt, target) }), [send]);

  const sectionKey = `dsSection_${section}` as const;
  return (
    <aside className="dse-chat" aria-label={t("dsChatTitle")}>
      <header className="dse-chat-head">
        <Icon icon={Sparkles} className="ui-icon-sm" /> {t("dsChatTitle")}
      </header>
      <div className="dse-chat-list" ref={listRef} aria-live="polite">
        {!lines.length ? <p className="dse-muted">{t("dsChatEmpty")}</p> : null}
        {lines.map((line) => (
          <p key={line.id} className={`dse-chat-line is-${line.role}`}>
            {line.text}
          </p>
        ))}
      </div>
      <form
        className="dse-chat-form"
        onSubmit={(event) => {
          event.preventDefault();
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
          placeholder={t("dsChatPlaceholder")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" className="dse-btn" disabled={disabled || busy || !input.trim() || !chatId}>
          <Icon icon={Send} className="ui-icon-sm" /> {busy ? t("dsChatWorking") : t("dsChatSend")}
        </button>
      </form>
    </aside>
  );
});

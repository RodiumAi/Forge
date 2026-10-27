import { createContext, useContext, useState, type ReactNode } from "react";
import { FALLBACK_REPLY, REPLIES, THREADS, type Msg, type Thread } from "../data";

type Chats = {
  threads: Thread[];
  typing: string | null;
  thread: (id: string | undefined) => Thread | undefined;
  send: (id: string, text: string) => void;
  start: (text: string, persona?: string) => string;
  togglePin: (id: string) => void;
};

const ChatContext = createContext<Chats | null>(null);

let seq = 0;
const uid = () => `m${Date.now().toString(36)}${(seq += 1)}`;

function replyFor(text: string) {
  const t = text.toLowerCase();
  return REPLIES.find((r) => r.keys.some((k) => t.includes(k)))?.text ?? FALLBACK_REPLY;
}

/** Every conversation plus the typing state, shared by Home, Chats and the chat screen.
 *  Replies are scripted: a short "typing" pause, then a canned answer picked by keyword. */
export default function ChatProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>(THREADS);
  const [typing, setTyping] = useState<string | null>(null);

  function append(id: string, msg: Msg) {
    setThreads((all) => {
      const target = all.find((t) => t.id === id);
      if (!target) return all;
      const updated = { ...target, when: "Now", messages: [...target.messages, msg] };
      return [updated, ...all.filter((t) => t.id !== id)];
    });
  }

  function answer(id: string, text: string) {
    setTyping(id);
    window.setTimeout(() => {
      append(id, { id: uid(), role: "assistant", text: replyFor(text) });
      setTyping(null);
    }, 1400 + Math.min(text.length * 12, 900));
  }

  function send(id: string, text: string) {
    const clean = text.trim();
    if (!clean) return;
    append(id, { id: uid(), role: "user", text: clean });
    answer(id, clean);
  }

  function start(text: string, persona = "nova") {
    const id = `c${Date.now().toString(36)}`;
    const clean = text.trim();
    const title = clean ? (clean.length > 38 ? `${clean.slice(0, 38).trim()}...` : clean) : "New chat";
    const thread: Thread = { id, title, persona, pinned: false, when: "Now", messages: clean ? [{ id: uid(), role: "user", text: clean }] : [] };
    setThreads((all) => [thread, ...all]);
    if (clean) answer(id, clean);
    return id;
  }

  function togglePin(id: string) {
    setThreads((all) => all.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }

  const value: Chats = { threads, typing, thread: (id) => threads.find((t) => t.id === id), send, start, togglePin };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChats() {
  const chats = useContext(ChatContext);
  if (!chats) throw new Error("useChats must be used inside <ChatProvider>");
  return chats;
}

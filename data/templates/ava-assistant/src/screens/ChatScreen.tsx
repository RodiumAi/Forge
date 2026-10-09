import "../styles/chat.css";
import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import SparkIcon from "../components/SparkIcon";
import { CHIPS, type Msg } from "../data";

type Props = {
  messages: Msg[];
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
};

/* .chat-screen uses display: contents so the thread stays a direct flex
   child of .app-shell, like the other screens' <main>. */
export default function ChatScreen({ messages, draft, onDraft, onSend }: Props) {
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-screen">
      <div className="thread" ref={threadRef}>
        <p className="daybreak"><span>Today</span></p>
        {messages.map((m) => (
          <div className={m.role === "user" ? "msg me" : "msg"} key={m.id}>
            {m.role === "assistant" && <span className="msg-ava" aria-hidden><SparkIcon /></span>}
            <div className="bubble">{m.text}</div>
          </div>
        ))}
      </div>

      <div className="composer">
        <div className="chips">
          {CHIPS.map((c) => (
            <button className="chip" key={c} onClick={() => onSend(c)}>{c}</button>
          ))}
        </div>
        <form
          className="inputbar"
          onSubmit={(e) => { e.preventDefault(); onSend(draft); }}
        >
          <input
            className="field"
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder="Message Ava…"
            aria-label="Message Ava"
          />
          <button className="send" type="submit" aria-label="Send message">
            <Send size={20} strokeWidth={1.8} fill="currentColor" fillOpacity={0.12} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}

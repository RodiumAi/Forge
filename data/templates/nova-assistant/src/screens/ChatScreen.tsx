import "../styles/chat.css";
import { ArrowLeft, ArrowUp, AudioLines, Paperclip, Pin } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useChats } from "../components/ChatProvider";
import Message, { Typing } from "../components/Message";
import Orb from "../components/Orb";
import { SUGGESTIONS, personaById } from "../data";

/** Stack screen (no tab bar): a real conversation. Sending appends the message,
 *  shows the typing indicator, then Nova's scripted reply. */
export default function ChatScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { thread, send, typing, togglePin } = useChats();
  const chat = thread(id);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLLIElement>(null);
  const count = chat?.messages.length ?? 0;
  const busy = typing === chat?.id;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count, busy]);

  if (!chat) return <Navigate to="/chats" replace />;
  const persona = personaById(chat.persona);

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/chats", { replace: true });
  }

  function submit(text: string, e?: FormEvent) {
    e?.preventDefault();
    if (!chat || !text.trim() || busy) return;
    send(chat.id, text);
    setDraft("");
  }

  return (
    <div className="app-shell chat-screen">
      <header className="chat-bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={1.9} aria-hidden /></button>
        <div className="cb-title">
          <strong>{chat.title}</strong>
          <span><i aria-hidden /> {persona.name} &middot; {busy ? "typing..." : "online"}</span>
        </div>
        <button className={chat.pinned ? "icon-btn on" : "icon-btn"} onClick={() => togglePin(chat.id)} aria-pressed={chat.pinned} aria-label={chat.pinned ? "Unpin chat" : "Pin chat"}>
          <Pin size={17} strokeWidth={1.9} aria-hidden />
        </button>
      </header>

      <ol className="thread">
        {count === 0 && (
          <li className="empty">
            <Orb size="md" />
            <h2>Ask {persona.name} anything</h2>
            <p className="muted">{persona.desc}</p>
          </li>
        )}
        {chat.messages.map((m) => <Message key={m.id} msg={m} />)}
        {busy && <Typing />}
        <li ref={end} className="end" aria-hidden />
      </ol>

      <div className="composer">
        {!busy && (
          <div className="suggest" aria-label="Suggestions">
            {SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => submit(s)}>{s}</button>)}
          </div>
        )}
        <form className="input-bar" onSubmit={(e) => submit(draft, e)}>
          <button type="button" className="ib-btn" aria-label="Attach a file"><Paperclip size={19} strokeWidth={1.9} aria-hidden /></button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={`Message ${persona.name}`} aria-label="Message" />
          {draft.trim() ? (
            <button type="submit" className="send" disabled={busy} aria-label="Send"><ArrowUp size={19} strokeWidth={2.3} aria-hidden /></button>
          ) : (
            <Link to="/voice" className="send voice" aria-label="Voice mode"><AudioLines size={19} strokeWidth={2} aria-hidden /></Link>
          )}
        </form>
      </div>
    </div>
  );
}

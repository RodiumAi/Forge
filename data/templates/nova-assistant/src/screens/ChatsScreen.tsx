import "../styles/chats.css";
import { Pin, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useChats } from "../components/ChatProvider";
import PersonaIcon from "../components/PersonaIcon";
import { personaById, type Thread } from "../data";

function preview(t: Thread) {
  const last = t.messages[t.messages.length - 1];
  return last ? last.text.split("\n")[0].replace(/^- /, "") : "No messages yet";
}

export default function ChatsScreen() {
  const { threads, togglePin } = useChats();
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const found = threads.filter((t) => !q || `${t.title} ${t.messages.map((m) => m.text).join(" ")}`.toLowerCase().includes(q));
  const pinned = found.filter((t) => t.pinned);
  const rest = found.filter((t) => !t.pinned);

  return (
    <main className="app-main chats-screen">
      <label className="search">
        <Search size={18} strokeWidth={1.9} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your chats" aria-label="Search chats" />
        {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} strokeWidth={2} aria-hidden /></button>}
      </label>

      {pinned.length > 0 && (
        <section>
          <div className="section-head"><h2>Pinned</h2><span className="muted">{pinned.length}</span></div>
          <div className="pinned">
            {pinned.map((t) => (
              <Link key={t.id} to={`/chat/${t.id}`} className="pin-card">
                <span className="pc-top">
                  <PersonaIcon id={t.persona} size="sm" />
                  <button onClick={(e) => { e.preventDefault(); togglePin(t.id); }} aria-label="Unpin" className="pin-btn on"><Pin size={15} strokeWidth={2} aria-hidden /></button>
                </span>
                <strong>{t.title}</strong>
                <span>{preview(t)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="section-head"><h2>Recent</h2><span className="muted">{rest.length} chats</span></div>
        {found.length === 0 ? (
          <p className="empty">Nothing matches &ldquo;{query}&rdquo;. Try a word from the answer.</p>
        ) : (
          <ul className="list">
            {rest.map((t) => (
              <li key={t.id}>
                <Link to={`/chat/${t.id}`} className="row">
                  <PersonaIcon id={t.persona} />
                  <span className="row-text">
                    <span className="row-top"><strong>{t.title}</strong><small>{t.when}</small></span>
                    <span className="snip"><em>{personaById(t.persona).name}</em> {preview(t)}</span>
                  </span>
                </Link>
                <button onClick={() => togglePin(t.id)} className="pin-btn" aria-label="Pin chat"><Pin size={15} strokeWidth={2} aria-hidden /></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

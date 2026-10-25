import "../styles/home.css";
import { ArrowUp, AudioLines, ChevronRight } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useChats } from "../components/ChatProvider";
import Orb from "../components/Orb";
import PersonaIcon from "../components/PersonaIcon";
import { ME, PROMPTS } from "../data";

export default function HomeScreen() {
  const navigate = useNavigate();
  const { threads, start } = useChats();
  const [draft, setDraft] = useState("");

  function ask(text: string, e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    navigate(`/chat/${start(text)}`);
  }

  return (
    <main className="app-main home-screen">
      <section className="hero">
        <Link to="/voice" className="orb-stage" aria-label="Talk to Nova">
          <span className="ring r1" aria-hidden />
          <span className="ring r2" aria-hidden />
          <Orb size="lg" />
        </Link>
        <p className="hello">Good evening, {ME.first}</p>
        <h1>What can I take off your plate?</h1>
      </section>

      <form className="ask" onSubmit={(e) => ask(draft, e)}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask Nova anything" aria-label="Ask Nova" />
        {draft.trim() ? (
          <button type="submit" className="send" aria-label="Send"><ArrowUp size={20} strokeWidth={2.2} aria-hidden /></button>
        ) : (
          <Link to="/voice" className="send voice" aria-label="Voice mode"><AudioLines size={20} strokeWidth={2} aria-hidden /></Link>
        )}
      </form>

      <section className="prompts" aria-label="Quick prompts">
        {PROMPTS.map(({ id, title, sub, icon: Icon, text }) => (
          <button key={id} className="prompt" onClick={() => ask(text)}>
            <span className="pr-icon"><Icon size={19} strokeWidth={1.9} aria-hidden /></span>
            <strong>{title}</strong>
            <span>{sub}</span>
          </button>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Pick up where you left off</h2>
          <Link to="/chats" className="link">All chats</Link>
        </div>
        <ul className="recent">
          {threads.slice(0, 3).map((t) => (
            <li key={t.id}>
              <Link to={`/chat/${t.id}`}>
                <PersonaIcon id={t.persona} size="sm" />
                <span className="r-text"><strong>{t.title}</strong><span>{t.when}</span></span>
                <ChevronRight size={18} strokeWidth={1.9} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

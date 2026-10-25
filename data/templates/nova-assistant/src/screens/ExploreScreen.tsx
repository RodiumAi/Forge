import "../styles/explore.css";
import { ArrowUpRight, AudioLines, Check } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useChats } from "../components/ChatProvider";
import PersonaIcon from "../components/PersonaIcon";
import { GROUPS, PERSONAS } from "../data";

export default function ExploreScreen() {
  const navigate = useNavigate();
  const { start } = useChats();
  const [group, setGroup] = useState("All");
  const [added, setAdded] = useState<string[]>(["writer", "tutor"]);
  const list = PERSONAS.filter((p) => p.id !== "nova" && (group === "All" || p.group === group));

  function toggle(id: string) {
    setAdded((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]));
  }

  return (
    <main className="app-main explore-screen">
      <Link to="/voice" className="feature">
        <span className="f-glow" aria-hidden />
        <span className="kicker">New in Nova</span>
        <strong>Talk it through, hands free</strong>
        <span className="f-sub">Voice mode now answers in 12 languages, with captions.</span>
        <span className="f-cta"><AudioLines size={16} strokeWidth={2} aria-hidden /> Try voice mode</span>
        <span className="bars" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} />)}</span>
      </Link>

      <div className="groups" role="tablist" aria-label="Category">
        {GROUPS.map((g) => (
          <button key={g} role="tab" aria-selected={group === g} className={group === g ? "chip on" : "chip"} onClick={() => setGroup(g)}>{g}</button>
        ))}
      </div>

      <section className="personas">
        {list.map((p) => {
          const on = added.includes(p.id);
          return (
            <article key={p.id} className={`persona tone-card-${p.tone}`}>
              <div className="pe-top">
                <PersonaIcon id={p.id} size="lg" />
                <button className={on ? "add on" : "add"} onClick={() => toggle(p.id)} aria-pressed={on} aria-label={on ? `Remove ${p.name} from shortcuts` : `Add ${p.name} to shortcuts`}>
                  {on ? <Check size={15} strokeWidth={2.4} aria-hidden /> : "Add"}
                </button>
              </div>
              <h3>{p.name}</h3>
              <p className="role">{p.role}</p>
              <p className="desc">{p.desc}</p>
              <div className="pe-foot">
                <span>{p.chats}</span>
                <button className="go" onClick={() => navigate(`/chat/${start("", p.id)}`)} aria-label={`Chat with ${p.name}`}>
                  Chat <ArrowUpRight size={15} strokeWidth={2.2} aria-hidden />
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

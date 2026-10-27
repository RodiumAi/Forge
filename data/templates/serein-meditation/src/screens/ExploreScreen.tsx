import "../styles/explore.css";
import { Search, X } from "lucide-react";
import { useState } from "react";
import SessionCard from "../components/SessionCard";
import { CATEGORIES, SESSIONS, type Category } from "../data";

export default function ExploreScreen() {
  const [cat, setCat] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const list = SESSIONS.filter((s) => (!cat || s.category === cat) && (!q || s.title.toLowerCase().includes(q) || s.guide.toLowerCase().includes(q)));

  return (
    <main className="app-main explore-screen">
      <label className="search">
        <Search size={18} strokeWidth={2} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sessions, guides, moods" aria-label="Search sessions" />
        {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} strokeWidth={2.2} aria-hidden /></button>}
      </label>

      <section className="cats" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button key={c.name} className={cat === c.name ? "cat on" : "cat"} onClick={() => setCat(cat === c.name ? null : c.name)} aria-pressed={cat === c.name}>
            <img src={c.photo} alt="" />
            <span className="cat-shade" aria-hidden />
            <strong>{c.name}</strong>
            <small>{c.count} sessions</small>
          </button>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>{cat ? <>For <em>{cat.toLowerCase()}</em></> : "All sessions"}</h2>
          {cat ? <button className="link" onClick={() => setCat(null)}>Show all</button> : <span className="muted">{list.length} to try</span>}
        </div>
        {list.length ? (
          <div className="stack">{list.map((s) => <SessionCard key={s.id} s={s} />)}</div>
        ) : (
          <p className="empty">Nothing matches "{query}". Try a guide's name or a mood.</p>
        )}
      </section>
    </main>
  );
}

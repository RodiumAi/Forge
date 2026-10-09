import "../styles/explore.css";
import { Leaf, Search, Sun } from "lucide-react";
import ListRow from "../components/ListRow";
import { GUIDES } from "../data";

type Props = { query: string; onQuery: (value: string) => void };

export default function ExploreScreen({ query, onQuery }: Props) {
  const filtered = GUIDES.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <main className="app-main explore-screen">
      <div className="search">
        <Search size={18} strokeWidth={1.8} aria-hidden />
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search plant guides" aria-label="Search plant guides" />
      </div>
      <section className="card">
        {filtered.length === 0 && <p className="muted" style={{ padding: ".4rem 0" }}>No guides match “{query}”.</p>}
        {filtered.map((g) => (
          <ListRow key={g.name} icon={Leaf} title={g.name} sub={<><Sun size={16} strokeWidth={1.7} aria-hidden /> {g.light}</>}>
            <span className={`chip-diff ${g.diff === "Easy" || g.diff === "Very easy" ? "ok" : "warn"}`}>{g.diff}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

import "../styles/search.css";
import { Clock3, Search, X } from "lucide-react";
import { useState } from "react";
import TrackRow from "../components/TrackRow";
import { albumById, artistOf, GENRES, RECENT_SEARCHES, TRACKS } from "../data";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(RECENT_SEARCHES);
  const q = query.trim().toLowerCase();
  const results = q ? TRACKS.filter((t) => `${t.title} ${artistOf(t)} ${albumById(t.albumId)?.genre}`.toLowerCase().includes(q)) : [];

  return (
    <main className="app-main search-screen">
      <label className="search-field">
        <Search size={20} strokeWidth={2.2} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Artists, songs or podcasts" aria-label="Search music" />
        {query && <button className="clear" onClick={() => setQuery("")} aria-label="Clear search"><X size={16} strokeWidth={2.4} aria-hidden /></button>}
      </label>

      {q ? (
        <section>
          <div className="section-head"><h2>Songs</h2><span className="muted">{results.length} found</span></div>
          {results.length ? (
            <ul className="tracks">
              {results.map((t) => <TrackRow key={t.id} track={t} queue={results.map((r) => r.id)} />)}
            </ul>
          ) : (
            <p className="muted none">Nothing for "{query}" yet. Try an artist or a genre.</p>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 && (
            <section>
              <div className="section-head"><h2>Recent</h2><button className="link" onClick={() => setRecent([])}>Clear all</button></div>
              <div className="recent">
                {recent.map((r) => (
                  <button key={r} className="recent-chip" onClick={() => setQuery(r)}><Clock3 size={14} strokeWidth={2.2} aria-hidden /> {r}</button>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="section-head"><h2>Browse all</h2></div>
            <div className="genres">
              {GENRES.map((g) => (
                <button key={g.name} className="genre" style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }} onClick={() => setQuery(g.name)}>
                  <span>{g.name}</span>
                  <img src={g.cover} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

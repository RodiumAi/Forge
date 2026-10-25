import "../styles/discover.css";
import { Bookmark, BookmarkCheck, Headphones, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import BookCover from "../components/BookCover";
import { useShelf } from "../components/ShelfProvider";
import Stars from "../components/Stars";
import { GENRES, PICKS, TOP_CHARTS, bookById, type Book } from "../data";

const AUDIO_BANNER = "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=900&q=70";

export default function DiscoverScreen() {
  const { entries, toggleWant } = useShelf();
  const [genre, setGenre] = useState("All");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const charts = TOP_CHARTS.map((id) => bookById(id)).filter((b): b is Book => !!b)
    .filter((b) => genre === "All" || b.genre === genre)
    .filter((b) => !q || `${b.title} ${b.author}`.toLowerCase().includes(q));
  const browsing = !q && genre === "All";

  return (
    <main className="app-main discover-screen">
      <label className="search">
        <Search size={18} strokeWidth={1.9} aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titles, authors, narrators" aria-label="Search the catalog" />
        {query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={16} strokeWidth={2} aria-hidden /></button>}
      </label>

      <div className="genres" role="tablist" aria-label="Genre">
        {GENRES.map((g) => (
          <button key={g} role="tab" aria-selected={genre === g} className={genre === g ? "chip on" : "chip"} onClick={() => setGenre(g)}>{g}</button>
        ))}
      </div>

      {browsing && (
        <section className="picks">
          <div className="section-head">
            <h2>Editors' picks</h2>
            <span className="muted">Autumn 2026</span>
          </div>
          <div className="shelf-scroll ledge">
            {PICKS.map(({ id, note }) => {
              const book = bookById(id);
              if (!book) return null;
              return (
                <Link key={id} to={`/book/${id}`} className="pick">
                  <BookCover book={book} size="md" />
                  <em>{note}</em>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {browsing && (
        <Link to="/book/night-ferry" className="audio-banner" style={{ backgroundImage: `linear-gradient(100deg, rgba(35, 28, 22, .9) 30%, rgba(35, 28, 22, .15)), url(${AUDIO_BANNER})` }}>
          <span className="ab-icon"><Headphones size={18} strokeWidth={2} aria-hidden /></span>
          <span className="kicker">Audiobook of the week</span>
          <strong>Night Ferry to Lomé</strong>
          <span>Read by Abena Owusu &middot; free until Sunday</span>
        </Link>
      )}

      <section>
        <div className="section-head">
          <h2>Top charts</h2>
          <span className="muted">{charts.length} titles</span>
        </div>
        {charts.length === 0 ? (
          <p className="empty">No book matches this search yet.</p>
        ) : (
          <ol className="charts">
            {charts.map((b, i) => {
              const saved = !!entries[b.id];
              return (
                <li key={b.id}>
                  <span className="rank">{i + 1}</span>
                  <Link to={`/book/${b.id}`} className="ch-book">
                    <BookCover book={b} size="sm" />
                    <span className="ch-meta">
                      <strong>{b.title}</strong>
                      <span>{b.author}</span>
                      <span className="ch-rate"><Stars value={b.rating} size={12} /> {b.rating.toFixed(1)}</span>
                    </span>
                  </Link>
                  <button className={saved ? "save on" : "save"} onClick={() => toggleWant(b.id)} aria-pressed={saved} disabled={saved && entries[b.id].status !== "want"} aria-label={saved ? "On your shelf" : "Want to read"}>
                    {saved ? <BookmarkCheck size={19} strokeWidth={1.9} aria-hidden /> : <Bookmark size={19} strokeWidth={1.9} aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

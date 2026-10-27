import "../styles/library.css";
import { ChevronRight, CircleCheck, Headphones, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import BookCover from "../components/BookCover";
import { useShelf } from "../components/ShelfProvider";
import { BOOKS, COLLECTIONS, bookById, type Book, type Status } from "../data";

const SEGMENTS: { id: Status; label: string }[] = [
  { id: "reading", label: "Reading" },
  { id: "want", label: "Want to read" },
  { id: "finished", label: "Finished" },
];

export default function LibraryScreen() {
  const { entries } = useShelf();
  const [segment, setSegment] = useState<Status>("reading");
  const count = (s: Status) => BOOKS.filter((b) => entries[b.id]?.status === s).length;
  const books = BOOKS.filter((b) => entries[b.id]?.status === segment);

  return (
    <main className="app-main library-screen">
      <div className="segmented" role="tablist" aria-label="Shelf">
        {SEGMENTS.map(({ id, label }) => (
          <button key={id} role="tab" aria-selected={segment === id} className={segment === id ? "on" : ""} onClick={() => setSegment(id)}>
            {label} <small>{count(id)}</small>
          </button>
        ))}
      </div>

      <p className="summary">
        {segment === "reading" && <>You are <em>{count("reading")} books</em> deep, about two hours from the next ending.</>}
        {segment === "want" && <>A short pile, <em>{count("want")} waiting</em>. Tap one to read the first pages free.</>}
        {segment === "finished" && <><em>{count("finished")} finished</em> this year, all of them worth a reread.</>}
      </p>

      <ul className="grid">
        {books.map((b) => {
          const progress = Math.round((entries[b.id]?.progress ?? 0) * 100);
          return (
            <li key={b.id}>
              <Link to={`/book/${b.id}`} className="tile">
                <span className="tile-cover">
                  <BookCover book={b} size="md" />
                  {segment === "finished" && <span className="done"><CircleCheck size={16} strokeWidth={2.2} aria-hidden /></span>}
                </span>
                <strong>{b.title}</strong>
                {segment === "reading" && (
                  <span className="tile-progress">
                    <span className="progress"><i style={{ width: `${progress}%` }} /></span>
                    <small>{progress}%</small>
                  </span>
                )}
                {segment === "want" && <small className="meta"><Headphones size={12} strokeWidth={2} aria-hidden /> {b.audio}</small>}
                {segment === "finished" && <small className="meta">{b.author}</small>}
              </Link>
            </li>
          );
        })}
        <li>
          <Link to="/discover" className="tile add">
            <span className="add-slot"><Plus size={22} strokeWidth={1.8} aria-hidden /><span>Find a book</span></span>
          </Link>
        </li>
      </ul>

      <section>
        <div className="section-head"><h2>Collections</h2><span className="muted">{COLLECTIONS.length} shelves</span></div>
        <ul className="collections">
          {COLLECTIONS.map((c) => (
            <li key={c.name}>
              <span className="stack" aria-hidden>
                {c.books.map((id) => bookById(id)).filter((b): b is Book => !!b).map((b) => <BookCover key={b.id} book={b} size="xs" />)}
              </span>
              <span className="c-text"><strong>{c.name}</strong><span>{c.count} books</span></span>
              <ChevronRight size={18} strokeWidth={1.9} aria-hidden />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

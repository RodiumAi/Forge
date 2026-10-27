import "../styles/book.css";
import { ArrowLeft, Bookmark, BookmarkCheck, BookOpen, Check, Headphones, Pause, Play, Share2, SkipForward } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import BookCover from "../components/BookCover";
import { useShelf } from "../components/ShelfProvider";
import Stars from "../components/Stars";
import { bookById } from "../data";

/** Stack screen (no tab bar): one book, its synopsis, chapters, Read and Listen. */
export default function BookScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const book = bookById(id);
  const { entries, toggleWant } = useShelf();
  const [more, setMore] = useState(false);
  const [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState(false);

  if (!book) return <Navigate to="/" replace />;
  const entry = entries[book.id];
  const doneChapters = Math.floor((entry?.progress ?? 0) * book.chapters.length);
  const backdrop = book.cover.kind === "photo"
    ? { backgroundImage: `url(${book.cover.src})` }
    : { background: book.cover.bg };

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/discover", { replace: true });
  }

  function listen() {
    setListening(true);
    setPlaying(true);
  }

  return (
    <div className={listening ? "app-shell book-screen with-player" : "app-shell book-screen"}>
      <div className="backdrop" style={backdrop} aria-hidden />

      <header className="book-bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={1.9} aria-hidden /></button>
        <div className="bar-actions">
          <button className="icon-btn" aria-label="Share"><Share2 size={18} strokeWidth={1.9} aria-hidden /></button>
          <button
            className={entry ? "icon-btn on" : "icon-btn"}
            onClick={() => toggleWant(book.id)}
            disabled={!!entry && entry.status !== "want"}
            aria-pressed={!!entry}
            aria-label={entry ? "On your shelf" : "Want to read"}
          >
            {entry ? <BookmarkCheck size={18} strokeWidth={1.9} aria-hidden /> : <Bookmark size={18} strokeWidth={1.9} aria-hidden />}
          </button>
        </div>
      </header>

      <section className="hero">
        <BookCover book={book} size="xl" />
        <p className="kicker">{book.genre} &middot; {book.year}</p>
        <h1>{book.title}</h1>
        <p className="author">by {book.author}</p>
        <p className="rating"><Stars value={book.rating} size={15} /> <strong>{book.rating.toFixed(1)}</strong> <span>({book.reviews} ratings)</span></p>
      </section>

      <dl className="facts">
        <div><dt>Pages</dt><dd>{book.pages}</dd></div>
        <div><dt>Audiobook</dt><dd>{book.audio}</dd></div>
        <div><dt>Progress</dt><dd>{Math.round((entry?.progress ?? 0) * 100)}%</dd></div>
      </dl>

      <div className="cta">
        <Link to={`/reader/${book.id}`} className="btn-primary"><BookOpen size={18} strokeWidth={2} aria-hidden /> {entry?.status === "reading" ? "Continue" : "Read"}</Link>
        <button className="btn-ghost" onClick={listen}><Headphones size={18} strokeWidth={2} aria-hidden /> Listen</button>
      </div>

      <section className="about">
        <h2>About this book</h2>
        <p className={more ? "synopsis open" : "synopsis"}>{book.synopsis}</p>
        <button className="link" onClick={() => setMore((v) => !v)}>{more ? "Show less" : "Read more"}</button>
      </section>

      <section className="chapters">
        <div className="section-head"><h2>Chapters</h2><span className="muted">{book.chapters.length} chapters</span></div>
        <ol>
          {book.chapters.map((c, i) => (
            <li key={c.title}>
              <Link to={`/reader/${book.id}`} className={i < doneChapters ? "done" : i === doneChapters ? "current" : ""}>
                <span className="num">{i < doneChapters ? <Check size={15} strokeWidth={2.4} aria-hidden /> : i + 1}</span>
                <span className="c-title">{c.title}</span>
                <span className="c-min">{c.minutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {listening && (
        <div className={playing ? "player playing" : "player"} role="region" aria-label="Audiobook player">
          <BookCover book={book} size="xs" />
          <div className="p-meta">
            <strong>{book.chapters[Math.min(doneChapters, book.chapters.length - 1)].title}</strong>
            <span>Narrated by Abena Owusu</span>
            <span className="p-line" aria-hidden><i /></span>
          </div>
          <button className="p-btn main" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={20} strokeWidth={2} aria-hidden /> : <Play size={20} strokeWidth={2} aria-hidden />}
          </button>
          <button className="p-btn" aria-label="Skip 30 seconds"><SkipForward size={18} strokeWidth={2} aria-hidden /></button>
        </div>
      )}
    </div>
  );
}

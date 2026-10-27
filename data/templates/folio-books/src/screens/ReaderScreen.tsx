import "../styles/reader.css";
import { ALargeSmall, ArrowLeft, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useShelf } from "../components/ShelfProvider";
import { READER_PAGES, READING, bookById } from "../data";

const SIZES = [16, 18, 20, 23, 26];
const THEMES = [
  { id: "paper", label: "Paper" },
  { id: "sepia", label: "Sepia" },
  { id: "night", label: "Night" },
] as const;
type Theme = (typeof THEMES)[number]["id"];

/** Stack screen (no tab bar): the reading view, with font size and theme controls. */
export default function ReaderScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const book = bookById(id);
  const { setProgress } = useShelf();
  const [size, setSize] = useState(1);
  const [theme, setTheme] = useState<Theme>("sepia");
  const [panel, setPanel] = useState(false);
  const [index, setIndex] = useState(0);

  if (!book) return <Navigate to="/" replace />;
  const full = book.id === READING.id;
  const pages = full ? READER_PAGES : [book.opening.split(" / ")];
  const startPage = full ? READING.page : 1;
  const pageNo = startPage + index;
  const chapterNo = full ? READING.chapter : 1;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate(`/book/${book?.id ?? ""}`, { replace: true });
  }

  function turn(step: number) {
    const next = Math.min(Math.max(index + step, 0), pages.length - 1);
    if (next === index || !book) return;
    setIndex(next);
    if (full) setProgress(book.id, (startPage + next) / book.pages);
  }

  return (
    <div className={`app-shell reader-screen theme-${theme}`} style={{ "--reader-size": `${SIZES[size]}px` } as CSSProperties}>
      <header className="reader-bar">
        <button className="r-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={1.9} aria-hidden /></button>
        <div className="r-title">
          <strong>{book.title}</strong>
          <span>Chapter {chapterNo} &middot; {book.chapters[chapterNo - 1].title}</span>
        </div>
        <button className="r-btn" onClick={() => setTheme(theme === "night" ? "sepia" : "night")} aria-label={theme === "night" ? "Light theme" : "Night theme"}>
          {theme === "night" ? <Sun size={19} strokeWidth={1.9} aria-hidden /> : <Moon size={19} strokeWidth={1.9} aria-hidden />}
        </button>
        <button className={panel ? "r-btn on" : "r-btn"} onClick={() => setPanel((v) => !v)} aria-expanded={panel} aria-label="Text settings">
          <ALargeSmall size={21} strokeWidth={1.9} aria-hidden />
        </button>
      </header>

      {panel && (
        <div className="panel" role="dialog" aria-label="Text settings">
          <div className="sizer">
            <button onClick={() => setSize((s) => Math.max(0, s - 1))} disabled={size === 0} aria-label="Smaller text" className="small-a">A</button>
            <div className="steps" aria-hidden>
              {SIZES.map((_, i) => <i key={i} className={i <= size ? "on" : ""} />)}
            </div>
            <button onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))} disabled={size === SIZES.length - 1} aria-label="Larger text" className="big-a">A</button>
          </div>
          <div className="themes" role="radiogroup" aria-label="Page theme">
            {THEMES.map((t) => (
              <button key={t.id} role="radio" aria-checked={theme === t.id} className={`swatch sw-${t.id}${theme === t.id ? " on" : ""}`} onClick={() => setTheme(t.id)}>
                <span>Aa</span>{t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <article className="page" onClick={() => setPanel(false)}>
        {index === 0 && <p className="chapter-mark">Chapter {chapterNo}</p>}
        {pages[index].map((para, i) => <p key={i}>{para}</p>)}
        {!full && (
          <div className="sample-end">
            <p>End of the free sample</p>
            <Link to={`/book/${book.id}`} className="btn-primary">See the book</Link>
          </div>
        )}
        <button className="zone prev" onClick={(e) => { e.stopPropagation(); turn(-1); }} aria-label="Previous page" disabled={index === 0} />
        <button className="zone next" onClick={(e) => { e.stopPropagation(); turn(1); }} aria-label="Next page" disabled={index === pages.length - 1} />
      </article>

      <footer className="reader-foot">
        <button className="r-btn" onClick={() => turn(-1)} disabled={index === 0} aria-label="Previous page"><ChevronLeft size={20} strokeWidth={1.9} aria-hidden /></button>
        <div className="foot-mid">
          <div className="r-progress" aria-hidden><i style={{ width: `${(pageNo / book.pages) * 100}%` }} /></div>
          <span>Page {pageNo} of {book.pages} &middot; {Math.max(2, 14 - index * 4)} min left in chapter</span>
        </div>
        <button className="r-btn" onClick={() => turn(1)} disabled={index === pages.length - 1} aria-label="Next page"><ChevronRight size={20} strokeWidth={1.9} aria-hidden /></button>
      </footer>
    </div>
  );
}

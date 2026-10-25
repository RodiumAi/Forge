import "../styles/home.css";
import { BookOpen, Flame, Headphones, Quote } from "lucide-react";
import { Link } from "react-router-dom";
import BookCover from "../components/BookCover";
import { useShelf } from "../components/ShelfProvider";
import { BOOKS, FRIENDS, QUOTE, READING, bookById } from "../data";

const WEEK = [
  { d: "M", min: 34 }, { d: "T", min: 22 }, { d: "W", min: 41 }, { d: "T", min: 18 },
  { d: "F", min: 27 }, { d: "S", min: 12 }, { d: "S", min: 0 },
];

export default function HomeScreen() {
  const { entries } = useShelf();
  const current = bookById(READING.id) ?? BOOKS[0];
  const progress = entries[current.id]?.progress ?? 0;
  const pct = Math.round(progress * 100);
  const nightstand = BOOKS.filter((b) => entries[b.id]?.status === "reading" && b.id !== current.id);

  return (
    <main className="app-main home-screen">
      <section className="continue">
        <Link to={`/book/${current.id}`} className="continue-cover" aria-label={`About ${current.title}`}>
          <BookCover book={current} size="lg" />
        </Link>
        <div className="continue-body">
          <p className="kicker">Continue reading</p>
          <h2>{current.title}</h2>
          <p className="by">{current.author}</p>
          <p className="chapter">Chapter {READING.chapter} &middot; {current.chapters[READING.chapter - 1].title}</p>
          <div className="progress" aria-label={`${pct}% read`}><i style={{ width: `${pct}%` }} /></div>
          <p className="left"><strong>{pct}%</strong> &middot; 5 h 20 min left</p>
        </div>
        <div className="continue-actions">
          <Link to={`/reader/${current.id}`} className="btn-primary"><BookOpen size={18} strokeWidth={2} aria-hidden /> Resume</Link>
          <Link to={`/book/${current.id}`} className="btn-ghost listen" aria-label="Listen to the audiobook"><Headphones size={18} strokeWidth={2} aria-hidden /> Listen</Link>
        </div>
      </section>

      <section className="quote" aria-label="Quote of the day">
        <Quote size={30} strokeWidth={1.4} className="q-mark" aria-hidden />
        <p className="kicker">Quote of the day</p>
        <blockquote>{QUOTE.text}</blockquote>
        <p className="q-by">{QUOTE.author}, <em>{QUOTE.source}</em></p>
      </section>

      <section className="card streak">
        <div className="streak-top">
          <span className="flame"><Flame size={18} strokeWidth={2} aria-hidden /></span>
          <div><strong>23 day streak</strong><span>154 minutes this week</span></div>
        </div>
        <ol className="days">
          {WEEK.map((w, i) => (
            <li key={i} className={w.min === 0 ? "rest" : w.min >= 30 ? "full" : ""}>
              <span style={{ height: `${Math.max(w.min, 4) * 2}%` }} />
              <small>{w.d}</small>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="section-head">
          <h2>On your nightstand</h2>
          <Link to="/library" className="link">Library</Link>
        </div>
        <div className="shelf-scroll">
          {nightstand.map((b) => (
            <Link key={b.id} to={`/book/${b.id}`} className="stand-book">
              <BookCover book={b} size="md" />
              <div className="progress"><i style={{ width: `${Math.round((entries[b.id]?.progress ?? 0) * 100)}%` }} /></div>
              <span>{Math.round((entries[b.id]?.progress ?? 0) * 100)}% read</span>
            </Link>
          ))}
          {BOOKS.filter((b) => entries[b.id]?.status === "want").slice(0, 2).map((b) => (
            <Link key={b.id} to={`/book/${b.id}`} className="stand-book">
              <BookCover book={b} size="md" />
              <span className="new">Up next</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Friends are reading</h2></div>
        <ul className="friends">
          {FRIENDS.map((f) => {
            const book = bookById(f.book);
            if (!book) return null;
            return (
              <li key={f.name}>
                <Link to={`/book/${book.id}`}>
                  <img src={f.avatar} alt="" />
                  <span className="f-text"><strong>{f.name}</strong> is reading <em>{book.title}</em></span>
                  <BookCover book={book} size="xs" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

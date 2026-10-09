import "../styles/saved.css";
import { Clock } from "lucide-react";
import { SAVED } from "../data";

export default function SavedScreen() {
  return (
    <main className="app-main saved-screen">
      <div className="section-head"><h2>Saved recipes</h2><span className="pill soft">{SAVED.length} dishes</span></div>
      <div className="saved-grid">
        {SAVED.map((r) => (
          <article className="saved-card" key={r.name}>
            <span className="saved-img" aria-hidden><img src={r.img} alt="" /></span>
            <span className="cook-again floating">Cook again · {r.times}×</span>
            <div className="saved-body">
              <strong>{r.name}</strong>
              <span className="sub">{r.meta}</span>
              <span className="stat"><Clock size={16} strokeWidth={1.8} aria-hidden /> {r.min} min</span>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

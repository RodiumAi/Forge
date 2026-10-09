import { useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { episodes } from "../data";

function PlayButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button className={active ? "play playing" : "play"} onClick={onClick} aria-label="Play episode">
      {active ? (
        <Pause size={13} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Play size={13} fill="currentColor" aria-hidden="true" />
      )}
    </button>
  );
}

export default function Episodes() {
  const [playing, setPlaying] = useState<number | null>(null);

  return (
    <section className="episodes" id="episodes">
      <div className="section-head">
        <h2>Latest episodes</h2>
        <a href="#episodes" className="more">
          Browse all <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
        </a>
      </div>
      <ol className="ep-list">
        {episodes.map((ep) => (
          <li key={ep.n} className="ep">
            <span className="ep-num">{String(ep.n).padStart(2, "0")}</span>
            <div className="ep-cover" style={{ background: ep.g }}>
              {ep.img ? <img src={ep.img} alt={ep.alt} loading="lazy" /> : null}
            </div>
            <div className="ep-info">
              <h3>{ep.title}</h3>
              <span className="dur">{ep.dur}</span>
            </div>
            <PlayButton active={playing === ep.n} onClick={() => setPlaying(playing === ep.n ? null : ep.n)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

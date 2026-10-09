import { Play } from "lucide-react";
import { TRACKS } from "../data";

export default function Tracklist() {
  return (
    <section className="tracklist" id="tracks">
      <div className="tracklist-inner">
        <div className="tracklist-head">
          <h2 className="section-title-left">MIDNIGHT ARCADE — TRACKLIST</h2>
          <p>Streaming everywhere. Vinyl and cassette in the shop.</p>
        </div>
        <ol className="tracks">
          {TRACKS.map((t) => (
            <li key={t.n} className="track">
              <span className="track-n">{t.n}</span>
              <span className="track-play">
                <Play size={10} fill="currentColor" aria-hidden="true" />
              </span>
              <span className="track-title">{t.title}</span>
              <span className="track-eq" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              <span className="track-plays">{t.plays}</span>
              <span className="track-time">{t.time}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

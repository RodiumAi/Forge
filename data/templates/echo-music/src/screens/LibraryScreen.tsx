import "../styles/library.css";
import { Pin } from "lucide-react";
import { PlayIcon } from "../components/MediaIcons";
import { LIBRARY, cover, type Track } from "../data";

type Props = { onPlay: (t: Track) => void };

export default function LibraryScreen({ onPlay }: Props) {
  return (
    <main className="app-main library-screen">
      <section className="card lib">
        {LIBRARY.map((l) => (
          <button className="tx" key={l.title} onClick={() => onPlay({ title: l.title, artist: l.sub.split(" · ")[0], g1: l.g1, g2: l.g2 })}>
            <span className={l.round ? "ava round" : "ava"} style={{ backgroundImage: cover(l.g1, l.g2) }} aria-hidden />
            <span className="meta">
              <strong>{l.pinned && <Pin className="pin" size={14} strokeWidth={2} fill="currentColor" aria-label="Pinned" />}{l.title}</strong>
              <span>{l.sub}</span>
            </span>
            <span className="play-mini" aria-hidden><PlayIcon size={16} /></span>
          </button>
        ))}
      </section>
    </main>
  );
}

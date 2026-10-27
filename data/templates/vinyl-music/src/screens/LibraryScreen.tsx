import "../styles/library.css";
import { ArrowDownUp, Heart, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../components/Player";
import { ALBUMS, ARTISTS, PLAYLISTS } from "../data";

const VIEWS = ["Playlists", "Albums", "Artists"] as const;
type View = (typeof VIEWS)[number];

export default function LibraryScreen() {
  const [view, setView] = useState<View>("Playlists");
  const { liked } = usePlayer();

  return (
    <main className="app-main library-screen">
      <div className="segmented" role="tablist" aria-label="Library">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      <div className="tools">
        <span className="muted"><ArrowDownUp size={14} strokeWidth={2.2} aria-hidden /> Recently played</span>
        <button className="new"><Plus size={16} strokeWidth={2.4} aria-hidden /> New playlist</button>
      </div>

      {view === "Playlists" && (
        <ul className="items">
          <li>
            <Link to="/album/harmattan" className="item">
              <span className="liked-art"><Heart size={22} strokeWidth={2.4} fill="currentColor" aria-hidden /></span>
              <span className="item-text"><strong>Liked songs</strong><span>Playlist · {liked.length} songs</span></span>
            </Link>
          </li>
          {PLAYLISTS.map((p) => (
            <li key={p.id}>
              <Link to={`/album/${p.albumId}`} className="item">
                <img src={p.cover} alt="" />
                <span className="item-text"><strong>{p.name}</strong><span>{p.meta}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {view === "Albums" && (
        <div className="album-grid">
          {ALBUMS.map((a) => (
            <Link key={a.id} to={`/album/${a.id}`} className="album">
              <img src={a.cover} alt="" loading="lazy" />
              <strong>{a.title}</strong>
              <span>{a.artist} · {a.year}</span>
            </Link>
          ))}
        </div>
      )}

      {view === "Artists" && (
        <ul className="items">
          {ARTISTS.map((a) => (
            <li key={a.id} className="item">
              <img className="round" src={a.photo} alt="" />
              <span className="item-text"><strong>{a.name}</strong><span>{a.listeners} listeners</span></span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

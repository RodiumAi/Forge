import "../styles/profile.css";
import { AudioLines, ChevronRight, Download, Headphones, LogOut, Shuffle } from "lucide-react";
import { useState } from "react";
import { usePlayer } from "../components/Player";
import { ME } from "../data";

const TOP_GENRES = [
  { name: "Afrobeats", share: 42 },
  { name: "Alt R&B", share: 24 },
  { name: "Electronic", share: 18 },
  { name: "Highlife", share: 16 },
];

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const { liked } = usePlayer();
  const [crossfade, setCrossfade] = useState(true);
  const [hifi, setHifi] = useState(false);

  return (
    <main className="app-main profile-screen">
      <section className="me">
        <span className="ring"><img src={ME.avatar} alt="" /></span>
        <h2>{ME.name}</h2>
        <p className="muted">{ME.handle} · Vinyl Premium</p>
        <div className="stats">
          <div><strong>{ME.followers.toLocaleString("en-US")}</strong><span>Followers</span></div>
          <div><strong>{ME.following}</strong><span>Following</span></div>
          <div><strong>{liked.length}</strong><span>Liked</span></div>
        </div>
      </section>

      <section className="wrapped">
        <p className="w-kicker">October so far</p>
        <p className="w-num">{ME.minutes.toLocaleString("en-US")}<small>minutes</small></p>
        <ul className="w-bars">
          {TOP_GENRES.map((g) => (
            <li key={g.name}>
              <span>{g.name}</span>
              <i style={{ width: `${g.share * 2}%` }} />
              <em>{g.share}%</em>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings">
        <div className="row">
          <span className="r-icon"><Shuffle size={18} strokeWidth={2} aria-hidden /></span>
          <span className="r-text"><strong>Crossfade</strong><span>6 seconds between songs</span></span>
          <button className={crossfade ? "toggle on" : "toggle"} onClick={() => setCrossfade((v) => !v)} aria-pressed={crossfade} aria-label="Crossfade" />
        </div>
        <div className="row">
          <span className="r-icon"><AudioLines size={18} strokeWidth={2} aria-hidden /></span>
          <span className="r-text"><strong>Lossless audio</strong><span>Up to 24-bit, uses more data</span></span>
          <button className={hifi ? "toggle on" : "toggle"} onClick={() => setHifi((v) => !v)} aria-pressed={hifi} aria-label="Lossless audio" />
        </div>
        <button className="row">
          <span className="r-icon"><Download size={18} strokeWidth={2} aria-hidden /></span>
          <span className="r-text"><strong>Downloads</strong><span>3 playlists, 1.2 GB</span></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
        <button className="row">
          <span className="r-icon"><Headphones size={18} strokeWidth={2} aria-hidden /></span>
          <span className="r-text"><strong>Devices</strong><span>AirPods Pro, Living room speaker</span></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </section>

      <button className="btn-ghost sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2} aria-hidden /> Sign out</button>
    </main>
  );
}

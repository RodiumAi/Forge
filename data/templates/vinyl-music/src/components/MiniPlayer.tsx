import { Pause, Play, SkipForward } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { artistOf, coverOf } from "../data";
import { usePlayer } from "./Player";

/** Persistent strip above the tab bar: cover, title, play/pause, progress line. Opens Now Playing. */
export default function MiniPlayer() {
  const navigate = useNavigate();
  const { track, playing, progress, toggle, next } = usePlayer();
  const pct = (progress / track.duration) * 100;

  return (
    <div className="mini-player">
      <button className="mini-open" onClick={() => navigate("/now-playing")} aria-label={`Open ${track.title}`}>
        <img className={playing ? "spin" : ""} src={coverOf(track)} alt="" />
        <span className="mini-text"><strong>{track.title}</strong><span>{artistOf(track)}</span></span>
      </button>
      <button className="mini-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing ? <Pause size={20} strokeWidth={2.4} fill="currentColor" aria-hidden /> : <Play size={20} strokeWidth={2.4} fill="currentColor" aria-hidden />}
      </button>
      <button className="mini-btn ghost" onClick={next} aria-label="Next track"><SkipForward size={20} strokeWidth={2.2} fill="currentColor" aria-hidden /></button>
      <span className="mini-progress" aria-hidden><i style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

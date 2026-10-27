import "../styles/now-playing.css";
import { ChevronDown, Heart, ListMusic, Pause, Play, Repeat, Share2, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "../components/Player";
import { albumById, artistOf, clock, coverOf, LYRICS, trackById } from "../data";

/** Stack screen (no tab bar): spinning vinyl, scrubber, controls, lyrics peek, up next. */
export default function NowPlayingScreen() {
  const navigate = useNavigate();
  const { track, playing, progress, queue, liked, toggle, next, prev, seek, toggleLike } = usePlayer();
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(true);
  const album = albumById(track.albumId);
  const cover = coverOf(track);
  const isLiked = liked.includes(track.id);
  const upNext = trackById(queue[(queue.indexOf(track.id) + 1) % queue.length]);
  const line = Math.floor(progress / 9) % LYRICS.length;
  const pct = (progress / track.duration) * 100;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  return (
    <div className="app-shell now-playing-screen" style={{ "--tint": album?.tint ?? "#ff3d7f" } as CSSProperties}>
      <img className="np-bg" src={cover} alt="" aria-hidden />

      <header className="np-bar">
        <button className="icon-btn" onClick={back} aria-label="Close player"><ChevronDown size={22} strokeWidth={2.2} aria-hidden /></button>
        <div className="np-from"><span>Playing from album</span><strong>{album?.title}</strong></div>
        <button className="icon-btn" aria-label="Share"><Share2 size={18} strokeWidth={2.2} aria-hidden /></button>
      </header>

      <div className={playing ? "stage playing" : "stage"} aria-hidden>
        <div className="disc">
          <img src={cover} alt="" />
          <span className="spindle" />
        </div>
        <span className="arm"><i /></span>
      </div>

      <div className="np-title">
        <div>
          <h1>{track.title}</h1>
          <p>{artistOf(track)}</p>
        </div>
        <button className={isLiked ? "like on" : "like"} onClick={() => toggleLike(track.id)} aria-pressed={isLiked} aria-label={isLiked ? "Unlike" : "Like"}>
          <Heart size={24} strokeWidth={2.2} fill={isLiked ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>

      <div className="scrub">
        <input
          type="range" min={0} max={track.duration} value={progress} aria-label="Seek"
          style={{ "--p": `${pct}%` } as CSSProperties}
          onChange={(e) => seek(Number(e.target.value))}
        />
        <div className="times"><span>{clock(progress)}</span><span>-{clock(track.duration - progress)}</span></div>
      </div>

      <div className="controls">
        <button className={shuffle ? "ctl on" : "ctl"} onClick={() => setShuffle((v) => !v)} aria-pressed={shuffle} aria-label="Shuffle"><Shuffle size={20} strokeWidth={2.2} aria-hidden /></button>
        <button className="ctl" onClick={prev} aria-label="Previous"><SkipBack size={26} strokeWidth={2} fill="currentColor" aria-hidden /></button>
        <button className="play-big main" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={30} strokeWidth={2.4} fill="currentColor" aria-hidden /> : <Play size={30} strokeWidth={2.4} fill="currentColor" aria-hidden />}
        </button>
        <button className="ctl" onClick={next} aria-label="Next"><SkipForward size={26} strokeWidth={2} fill="currentColor" aria-hidden /></button>
        <button className={repeat ? "ctl on" : "ctl"} onClick={() => setRepeat((v) => !v)} aria-pressed={repeat} aria-label="Repeat"><Repeat size={20} strokeWidth={2.2} aria-hidden /></button>
      </div>

      <section className="lyrics">
        <h2>Lyrics</h2>
        {LYRICS.map((l, i) => <p key={l} className={i === line ? "now" : i < line ? "past" : ""}>{l}</p>)}
      </section>

      {upNext && (
        <section className="up-next">
          <ListMusic size={18} strokeWidth={2.2} aria-hidden />
          <span>Up next</span>
          <img src={coverOf(upNext)} alt="" />
          <strong>{upNext.title}</strong>
        </section>
      )}
    </div>
  );
}

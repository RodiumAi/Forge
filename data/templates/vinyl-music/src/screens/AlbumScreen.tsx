import "../styles/album.css";
import { ArrowLeft, Download, Heart, Pause, Play, Shuffle } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "../components/Player";
import TrackRow from "../components/TrackRow";
import { albumById, clock, tracksOf } from "../data";

/** Stack screen (no tab bar): blurred cover header, play all, track list. */
export default function AlbumScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const album = albumById(id);
  const { track, playing, play, toggle } = usePlayer();
  const [saved, setSaved] = useState(false);
  if (!album) return <Navigate to="/" replace />;

  const tracks = tracksOf(album.id);
  const ids = tracks.map((t) => t.id);
  const total = tracks.reduce((s, t) => s + t.duration, 0);
  const isThis = track.albumId === album.id;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/library", { replace: true });
  }

  return (
    <div className="app-shell album-screen">
      <header className="album-head">
        <img className="album-bg" src={album.cover} alt="" aria-hidden />
        <div className="album-bar">
          <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.2} aria-hidden /></button>
        </div>
        <img className="album-cover" src={album.cover} alt="" />
        <h1>{album.title}</h1>
        <p className="album-artist">{album.artist}</p>
        <p className="album-meta">{album.genre} · {album.year} · {tracks.length} songs, {clock(total)}</p>
      </header>

      <div className="album-actions">
        <button className={saved ? "round on" : "round"} onClick={() => setSaved((v) => !v)} aria-pressed={saved} aria-label={saved ? "Remove from library" : "Add to library"}>
          <Heart size={20} strokeWidth={2.2} fill={saved ? "currentColor" : "none"} aria-hidden />
        </button>
        <button className="round" aria-label="Download"><Download size={20} strokeWidth={2.2} aria-hidden /></button>
        <button className="round push" onClick={() => play(ids[Math.floor(Math.random() * ids.length)], ids)} aria-label="Shuffle play"><Shuffle size={20} strokeWidth={2.2} aria-hidden /></button>
        <button className="play-big" onClick={() => (isThis ? toggle() : play(ids[0], ids))} aria-label={isThis && playing ? "Pause" : "Play all"}>
          {isThis && playing ? <Pause size={26} strokeWidth={2.4} fill="currentColor" aria-hidden /> : <Play size={26} strokeWidth={2.4} fill="currentColor" aria-hidden />}
        </button>
      </div>

      <ol className="tracks album-tracks">
        {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} queue={ids} />)}
      </ol>

      <p className="muted credits">Released October 3, {album.year} · Vinyl Originals</p>
    </div>
  );
}

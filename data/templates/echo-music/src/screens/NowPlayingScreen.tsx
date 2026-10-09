import "../styles/now-playing.css";
import { Download, Heart, Repeat, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { PauseIcon, PlayIcon } from "../components/MediaIcons";
import { cover, type Track } from "../data";

type Props = {
  current: Track;
  playing: boolean;
  liked: boolean;
  onTogglePlay: () => void;
  onToggleLike: () => void;
};

export default function NowPlayingScreen({ current, playing, liked, onTogglePlay, onToggleLike }: Props) {
  return (
    <main className="app-main now-playing-screen">
      <div className="np">
        <div className="np-art" style={{ backgroundImage: cover(current.g1, current.g2) }} aria-hidden />
        <div className="np-head">
          <div className="np-title">
            <h2>{current.title}</h2>
            <p className="muted">{current.artist}</p>
          </div>
          <button className={liked ? "heart on" : "heart"} aria-pressed={liked} aria-label="Like" onClick={onToggleLike}>
            <Heart size={20} strokeWidth={1.7} fill={liked ? "currentColor" : "none"} aria-hidden />
          </button>
        </div>
        <div className="progress">
          <span className="track"><span className="fill" style={{ width: "36%" }} /></span>
          <div className="times"><span>1:24</span><span>3:52</span></div>
        </div>
        <div className="controls">
          <button className="ctl" aria-label="Shuffle"><Shuffle size={20} strokeWidth={1.9} aria-hidden /></button>
          <button className="ctl big" aria-label="Previous"><SkipBack size={20} strokeWidth={2} fill="currentColor" aria-hidden /></button>
          <button className="ctl play" aria-label={playing ? "Pause" : "Play"} onClick={onTogglePlay}>
            {playing ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
          </button>
          <button className="ctl big" aria-label="Next"><SkipForward size={20} strokeWidth={2} fill="currentColor" aria-hidden /></button>
          <button className="ctl" aria-label="Repeat"><Repeat size={20} strokeWidth={1.9} aria-hidden /></button>
        </div>
        <button className="np-download"><Download size={18} strokeWidth={1.9} aria-hidden /> Download for offline · lossless</button>
      </div>
    </main>
  );
}

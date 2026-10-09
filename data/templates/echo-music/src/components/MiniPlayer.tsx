import { cover, type Track } from "../data";
import { PauseIcon, PlayIcon } from "./MediaIcons";

type Props = { current: Track; playing: boolean; onOpen: () => void; onToggle: () => void };

/** Persistent now-playing bar above the tab bar (hidden on the Now screen). */
export default function MiniPlayer({ current, playing, onOpen, onToggle }: Props) {
  return (
    <button className="miniplayer" onClick={onOpen} aria-label="Open now playing">
      <span className="mp-art" style={{ backgroundImage: cover(current.g1, current.g2) }} aria-hidden />
      <span className="mp-meta"><strong>{current.title}</strong><span>{current.artist}</span></span>
      <span className="mp-play" role="button" aria-label={playing ? "Pause" : "Play"}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        {playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}
      </span>
    </button>
  );
}

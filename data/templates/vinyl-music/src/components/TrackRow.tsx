import { Heart } from "lucide-react";
import { artistOf, clock, coverOf, type Track } from "../data";
import { usePlayer } from "./Player";

type Props = { track: Track; index?: number; queue: string[] };

/** One song: number or cover, title and artist, equalizer when playing, like, duration. */
export default function TrackRow({ track, index, queue }: Props) {
  const { track: current, playing, play, liked, toggleLike } = usePlayer();
  const isCurrent = current.id === track.id;
  const isLiked = liked.includes(track.id);

  return (
    <li className={isCurrent ? "track current" : "track"}>
      <button className="track-main" onClick={() => play(track.id, queue)}>
        {index === undefined ? <img src={coverOf(track)} alt="" /> : (
          <span className="track-num">
            {isCurrent ? <span className={playing ? "eq on" : "eq"} aria-hidden><i /><i /><i /></span> : index + 1}
          </span>
        )}
        <span className="track-text"><strong>{track.title}</strong><span>{artistOf(track)} · {track.plays} plays</span></span>
      </button>
      <button className={isLiked ? "track-like on" : "track-like"} onClick={() => toggleLike(track.id)} aria-pressed={isLiked} aria-label={isLiked ? "Unlike" : "Like"}>
        <Heart size={17} strokeWidth={2.2} fill={isLiked ? "currentColor" : "none"} aria-hidden />
      </button>
      <span className="track-time">{clock(track.duration)}</span>
    </li>
  );
}

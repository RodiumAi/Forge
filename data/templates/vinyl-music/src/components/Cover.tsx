import { Play } from "lucide-react";
import { Link } from "react-router-dom";
import type { Album } from "../data";

type Props = { album: Album; size?: "lg" | "md" };

/** Album tile: square cover with a pink play badge, title and artist. Opens the album. */
export default function Cover({ album, size = "md" }: Props) {
  return (
    <Link to={`/album/${album.id}`} className={`cover-tile ${size}`}>
      <span className="cover-art">
        <img src={album.cover} alt="" loading="lazy" />
        <span className="cover-play" aria-hidden><Play size={16} strokeWidth={2.4} fill="currentColor" /></span>
      </span>
      <strong>{album.title}</strong>
      <span>{album.artist}</span>
    </Link>
  );
}

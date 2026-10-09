import "../styles/home.css";
import { PlayIcon } from "../components/MediaIcons";
import SectionHead from "../components/SectionHead";
import { ALBUMS, PLAYLISTS, cover, type Track } from "../data";

type Props = { onPlay: (t: Track) => void; onSeeAll: () => void };

export default function HomeScreen({ onPlay, onSeeAll }: Props) {
  return (
    <main className="app-main home-screen">
      <SectionHead title="Recently played" action="See all" onAction={onSeeAll} />
      <div className="rail" role="list">
        {ALBUMS.map((a) => (
          <button className="tile" role="listitem" key={a.title} onClick={() => onPlay(a)}>
            <span className="art" style={{ backgroundImage: cover(a.g1, a.g2) }} aria-hidden />
            <strong>{a.title}</strong>
            <span>{a.artist}</span>
          </button>
        ))}
      </div>

      <SectionHead title="Made for you" />
      <div className="plist">
        {PLAYLISTS.map((p) => (
          <button className="pcard" key={p.title} onClick={() => onPlay({ title: p.title, artist: "Echo Mix", g1: p.g1, g2: p.g2 })}>
            <span className="art" style={{ backgroundImage: cover(p.g1, p.g2) }} aria-hidden><span className="play-dot"><PlayIcon size={16} /></span></span>
            <span className="meta"><strong>{p.title}</strong><span>{p.sub}</span></span>
          </button>
        ))}
      </div>
    </main>
  );
}

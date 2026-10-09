import "../styles/search.css";
import { Search } from "lucide-react";
import SectionHead from "../components/SectionHead";
import { GENRES, cover, type Track } from "../data";

type Props = { onPlay: (t: Track) => void };

export default function SearchScreen({ onPlay }: Props) {
  return (
    <main className="app-main search-screen">
      <label className="searchbar">
        <Search size={22} strokeWidth={1.8} aria-hidden />
        <input type="text" placeholder="Artists, songs, or podcasts" aria-label="Search" />
      </label>
      <SectionHead title="Browse all" />
      <div className="genres">
        {GENRES.map((g) => (
          <button className="genre" key={g.name} style={{ backgroundImage: cover(g.g1, g.g2) }} onClick={() => onPlay({ title: g.name, artist: "Genre radio", g1: g.g1, g2: g.g2 })}>
            {g.name}
          </button>
        ))}
      </div>
    </main>
  );
}

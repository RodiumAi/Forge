import "../styles/home.css";
import { Pause, Play } from "lucide-react";
import { Link } from "react-router-dom";
import Cover from "../components/Cover";
import { usePlayer } from "../components/Player";
import TrackRow from "../components/TrackRow";
import { albumById, ALBUMS, ARTISTS, ME, PLAYLISTS, TRACKS, tracksOf } from "../data";

const FEATURED = albumById("harmattan")!;
const CHART = ["t6", "t1", "t11", "t9", "t2"];

export default function HomeScreen() {
  const { track, playing, play, toggle } = usePlayer();
  const featuredIds = tracksOf(FEATURED.id).map((t) => t.id);
  const onFeatured = track.albumId === FEATURED.id;

  return (
    <main className="app-main home-screen">
      <section className="feature">
        <img className="feature-bg" src={FEATURED.cover} alt="" aria-hidden />
        <Link to={`/album/${FEATURED.id}`} className="feature-cover"><img src={FEATURED.cover} alt="" /></Link>
        <div className="feature-text">
          <span className="feature-kicker">New album</span>
          <h2>{FEATURED.title}</h2>
          <p>{FEATURED.artist} · {featuredIds.length} songs</p>
        </div>
        <button
          className="play-big"
          onClick={() => (onFeatured ? toggle() : play(featuredIds[0], featuredIds))}
          aria-label={onFeatured && playing ? "Pause" : "Play album"}
        >
          {onFeatured && playing ? <Pause size={24} strokeWidth={2.4} fill="currentColor" aria-hidden /> : <Play size={24} strokeWidth={2.4} fill="currentColor" aria-hidden />}
        </button>
      </section>

      <section className="jump" aria-label="Jump back in">
        {PLAYLISTS.slice(0, 4).map((p) => (
          <Link key={p.id} to={`/album/${p.albumId}`} className="jump-tile">
            <img src={p.cover} alt="" />
            <span>{p.name}</span>
          </Link>
        ))}
      </section>

      <section>
        <div className="section-head"><h2>Made for {ME.first}</h2><Link to="/library" className="link">Library</Link></div>
        <div className="rail">
          {ALBUMS.slice(1).map((a) => <Cover key={a.id} album={a} size="lg" />)}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Top 5 this week</h2><Link to="/search" className="link">Charts</Link></div>
        <ol className="tracks">
          {CHART.map((id, i) => {
            const t = TRACKS.find((x) => x.id === id)!;
            return <TrackRow key={id} track={t} index={i} queue={CHART} />;
          })}
        </ol>
      </section>

      <section>
        <div className="section-head"><h2>Artists you love</h2></div>
        <div className="rail artists">
          {ARTISTS.map((a) => (
            <div key={a.id} className="artist">
              <img src={a.photo} alt="" />
              <strong>{a.name}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

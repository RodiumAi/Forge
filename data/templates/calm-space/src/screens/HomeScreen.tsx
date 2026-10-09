import "../styles/home.css";
import CategoryChips from "../components/CategoryChips";
import DailyHero from "../components/DailyHero";
import ListRow from "../components/ListRow";
import PlayIcon from "../components/PlayIcon";
import { SHORT_SESSIONS } from "../data";

type Props = { breathing: boolean; onToggleBreathing: () => void; onExplore: () => void };

export default function HomeScreen({ breathing, onToggleBreathing, onExplore }: Props) {
  return (
    <main className="app-main home-screen">
      <DailyHero label="Daily calm" title="Settle into stillness" meta="Guided · 10 min" playLabel="Play daily session" />

      <section className="card breathe-card">
        <button
          className={breathing ? "breathe breathing" : "breathe"}
          aria-pressed={breathing}
          onClick={onToggleBreathing}
        >
          <span className="breathe-ring" aria-hidden />
          <span className="breathe-core" aria-hidden />
          <span className="breathe-label">Breathe</span>
        </button>
        <p className="muted" style={{ textAlign: "center", fontSize: ".82rem" }}>
          {breathing ? "Inhale as it grows, exhale as it falls" : "Tap the circle to begin"}
        </p>
      </section>

      <CategoryChips onPick={onExplore} />

      <div className="section-head"><h2>Short & sweet</h2><a href="#" onClick={(e) => { e.preventDefault(); onExplore(); }}>See all</a></div>
      <section className="card">
        {SHORT_SESSIONS.map((t) => (
          <ListRow key={t.name} icon={t.icon} title={t.name} sub={t.meta}>
            <span className="play-mini" aria-hidden><PlayIcon /></span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

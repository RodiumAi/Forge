import "../styles/sleep.css";
import DailyHero from "../components/DailyHero";
import ListRow from "../components/ListRow";
import PlayIcon from "../components/PlayIcon";
import { SOUNDS } from "../data";

type Props = { reminder: boolean; onToggleReminder: () => void };

export default function SleepScreen({ reminder, onToggleReminder }: Props) {
  return (
    <main className="app-main sleep-screen">
      <DailyHero className="sleep-hero" label="Sleep story" title="The quiet harbour" meta="Narrated · 32 min" playLabel="Play sleep story" />

      <div className="section-head"><h2>Sounds & stories</h2></div>
      <section className="card">
        {SOUNDS.map((t) => (
          <ListRow key={t.name} icon={t.icon} title={t.name} sub={t.meta}>
            <span className="play-mini" aria-hidden><PlayIcon /></span>
          </ListRow>
        ))}
      </section>

      <section className="card">
        <div className="row">
          <div><strong style={{ fontSize: ".95rem" }}>Bedtime reminder</strong><p className="muted" style={{ fontSize: ".8rem" }}>Every night at 10:30 PM</p></div>
          <button className={reminder ? "toggle on" : "toggle"} aria-pressed={reminder} onClick={onToggleReminder} />
        </div>
      </section>
    </main>
  );
}

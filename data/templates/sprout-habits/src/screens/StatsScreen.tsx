import "../styles/stats.css";
import { ChevronLeft, ChevronRight, Flame, Sparkles, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { useHabits } from "../components/HabitsState";
import { ICONS, OCTOBER, PALETTE, SEPTEMBER } from "../data";

/** Month heatmaps: completion level per day, leading blanks so weeks start on Monday. */
const MONTHS = [
  { name: "September 2026", days: 30, lead: 1, levels: SEPTEMBER },
  { name: "October 2026", days: 31, lead: 3, levels: OCTOBER },
];

export default function StatsScreen() {
  const { habits } = useHabits();
  const [m, setM] = useState(1);
  const month = MONTHS[m];
  const logged = month.levels.length;
  const perfect = month.levels.filter((v) => v === 4).length;
  const rate = Math.round((month.levels.reduce((a, b) => a + b, 0) / (logged * 4)) * 100);
  const best = [...habits].sort((a, b) => b.best - a.best).slice(0, 4);
  const top = best[0]?.best ?? 1;

  return (
    <main className="app-main stats-screen">
      <section className="kpis">
        <div className="kpi big"><Target size={20} strokeWidth={2.2} aria-hidden /><strong>{rate}%</strong><span>Completion this month</span></div>
        <div className="kpi"><Sparkles size={18} strokeWidth={2.2} aria-hidden /><strong>{perfect}</strong><span>Perfect days</span></div>
        <div className="kpi"><Trophy size={18} strokeWidth={2.2} aria-hidden /><strong>{top}</strong><span>Best streak</span></div>
      </section>

      <section className="card heat">
        <div className="heat-head">
          <button className="icon-btn" onClick={() => setM(0)} disabled={m === 0} aria-label="Previous month"><ChevronLeft size={18} strokeWidth={2.2} aria-hidden /></button>
          <h2>{month.name}</h2>
          <button className="icon-btn" onClick={() => setM(1)} disabled={m === 1} aria-label="Next month"><ChevronRight size={18} strokeWidth={2.2} aria-hidden /></button>
        </div>
        <div className="grid" role="grid" aria-label={`Completion per day, ${month.name}`}>
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="dow">{d}</span>)}
          {Array.from({ length: month.lead }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: month.days }, (_, i) => {
            const level = month.levels[i];
            const cls = level === undefined ? "day future" : `day l${level}${m === 1 && i === logged - 1 ? " today" : ""}`;
            return <span key={i} className={cls}>{i + 1}</span>;
          })}
        </div>
        <div className="scale" aria-hidden><span>Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`day l${l}`} />)}<span>More</span></div>
      </section>

      <section>
        <div className="section-head"><h2>Best streaks</h2><span className="muted">All time</span></div>
        <div className="card streaks">
          {best.map((h) => {
            const Icon = ICONS[h.icon];
            const tint = PALETTE[h.tint];
            return (
              <div key={h.id} className="streak">
                <span className="s-icon" style={{ background: tint.bg, color: tint.ink }}><Icon size={18} strokeWidth={2.1} aria-hidden /></span>
                <div className="s-body">
                  <div className="s-row"><strong>{h.name}</strong><span><Flame size={14} strokeWidth={2.4} aria-hidden /> {h.best} days</span></div>
                  <div className="s-bar" aria-hidden><i style={{ width: `${(h.best / top) * 100}%`, background: tint.ink }} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

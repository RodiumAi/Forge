import "../styles/home.css";
import { Play, Zap } from "lucide-react";
import { RINGS } from "../data";
import ActivityRing from "../components/ActivityRing";
import RouteThumb from "../components/RouteThumb";
import WeekBars from "../components/WeekBars";

export default function HomeScreen({ onAllRuns }: { onAllRuns: () => void }) {
  return (
    <main className="app-main home-screen">
      <section className="rings-card">
        <div className="row" style={{ marginBottom: ".9rem" }}>
          <h2>Today's activity</h2>
          <span className="pill"><Zap size={18} strokeWidth={1.7} aria-hidden /> On track</span>
        </div>
        <div className="rings">
          {RINGS.map((r) => (
            <div className="ring" key={r.label}>
              <ActivityRing pct={r.pct} value={r.value} unit={r.unit} />
              <span className="ring-lbl">{r.label}</span>
              <span className="ring-note">{r.note}</span>
            </div>
          ))}
        </div>
      </section>

      <button className="start-run">
        <span className="ic"><Play size={24} strokeWidth={1.5} fill="currentColor" aria-hidden /></span>
        <span className="txt"><strong>Start run</strong><span>GPS ready · Auto-splits on</span></span>
        <span className="go">GO</span>
      </button>

      <div className="section-head"><h2>Last run</h2><a href="#" onClick={(e) => { e.preventDefault(); onAllRuns(); }}>All runs</a></div>
      <section className="card last-run">
        <div className="lr-top">
          <RouteThumb seed={0} />
          <div className="lr-meta">
            <strong>Riverside Loop</strong>
            <span className="muted">Today · 6:42 AM</span>
          </div>
        </div>
        <div className="lr-stats">
          <div><span className="k">Distance</span><span className="v">8.4 km</span></div>
          <div><span className="k">Time</span><span className="v">43:41</span></div>
          <div><span className="k">Pace</span><span className="v">5:12 /km</span></div>
        </div>
      </section>

      <section className="card">
        <div className="row"><h3>This week</h3><span className="pill">32.1 km</span></div>
        <WeekBars />
      </section>
    </main>
  );
}

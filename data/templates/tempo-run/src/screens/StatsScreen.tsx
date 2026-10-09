import "../styles/stats.css";
import { Trophy, Zap } from "lucide-react";
import { BESTS } from "../data";
import ListRow from "../components/ListRow";
import WeekBars from "../components/WeekBars";

export default function StatsScreen() {
  return (
    <main className="app-main stats-screen">
      <div className="stat-tiles">
        <div className="tile">
          <span className="k">This week</span>
          <span className="v">32.1 <small>km</small></span>
          <span className="pill up"><Zap size={18} strokeWidth={1.7} aria-hidden /> +12%</span>
        </div>
        <div className="tile">
          <span className="k">This month</span>
          <span className="v">148 <small>km</small></span>
          <span className="pill">18 runs</span>
        </div>
      </div>

      <section className="card">
        <div className="row"><h3>Weekly distance</h3><span className="muted" style={{ fontSize: ".78rem" }}>km / day</span></div>
        <WeekBars tall />
      </section>

      <div className="section-head"><h2>Personal bests</h2><span className="link"><Trophy size={20} strokeWidth={1.7} aria-hidden /></span></div>
      <section className="card">
        {BESTS.map(({ badge: Badge, title, sub, amount, best }) => (
          <ListRow key={title} badge={typeof Badge === "string" ? Badge : <Badge size={16} strokeWidth={2.4} />} title={title} sub={sub}>
            <span className={best ? "amount in" : "amount"}>{amount}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

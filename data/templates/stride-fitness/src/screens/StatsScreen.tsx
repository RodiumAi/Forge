import "../styles/stats.css";
import { Medal, TrendingUp, Trophy } from "lucide-react";
import { useState } from "react";
import { CLUB, PERIODS, RECORDS, type Period } from "../data";

const KEYS = Object.keys(PERIODS) as Period[];

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>("Week");
  const data = PERIODS[period];
  const peak = Math.max(...data.bars.map((b) => b.km));
  const leader = Math.max(...CLUB.map((c) => c.km));

  return (
    <main className="app-main stats-screen">
      <div className="segmented" role="tablist" aria-label="Period">
        {KEYS.map((k) => (
          <button key={k} role="tab" aria-selected={period === k} className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>{k}</button>
        ))}
      </div>

      <section className="total">
        <p className="kicker">Distance this {period.toLowerCase()}</p>
        <p className="num total-km">{data.km}<small>km</small></p>
        <span className="delta"><TrendingUp size={14} strokeWidth={2.4} aria-hidden /> {data.delta}</span>
      </section>

      <section className="card chart" aria-label={`Kilometres per ${period === "Week" ? "day" : period === "Month" ? "week" : "month"}`}>
        <div className="bars">
          {data.bars.map((b, i) => (
            <div key={i} className={b.km === peak ? "col peak" : "col"}>
              <em>{b.km ? (b.km >= 100 ? Math.round(b.km) : b.km.toFixed(1)) : ""}</em>
              <span style={{ height: `${Math.max((b.km / peak) * 100, 3)}%` }} />
              <small>{b.d}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="summary">
        {data.summary.map((s) => (
          <div key={s.label} className="card"><span className="kicker">{s.label}</span><p className="num">{s.value}</p></div>
        ))}
      </section>

      <section>
        <div className="section-head"><h2>Personal records</h2><Trophy size={20} strokeWidth={2} className="trophy" aria-hidden /></div>
        <ul className="records">
          {RECORDS.map((r) => (
            <li key={r.label}>
              <span className="pr-label">{r.label}</span>
              <span className="pr-when">{r.when}</span>
              <span className="num pr-value">{r.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card club">
        <div className="section-head"><h2>Club this week</h2><span className="muted">Lagos Night Runners</span></div>
        <ol>
          {CLUB.map((c, i) => (
            <li key={c.name} className={c.name === "You" ? "me" : ""}>
              <span className="rank">{i === 0 ? <Medal size={16} strokeWidth={2.2} aria-hidden /> : i + 1}</span>
              <img src={c.avatar} alt="" />
              <span className="club-name">{c.name}</span>
              <span className="club-bar" aria-hidden><i style={{ width: `${(c.km / leader) * 100}%` }} /></span>
              <span className="num club-km">{c.km}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

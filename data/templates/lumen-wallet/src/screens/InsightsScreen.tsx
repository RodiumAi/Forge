import "../styles/insights.css";
import { TrendingDown } from "lucide-react";
import { useState } from "react";
import { CATEGORIES, CURRENCY, WEEK } from "../data";

const PERIODS = ["Week", "Month", "Year"] as const;

export default function InsightsScreen() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Month");
  const peak = Math.max(...WEEK.map((w) => w.v));

  return (
    <main className="app-main insights-screen">
      <div className="periods" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      <section className="spent">
        <p className="muted">Spent in October</p>
        <p className="spent-amt">219 350 <small>{CURRENCY}</small></p>
        <span className="pill"><TrendingDown size={14} strokeWidth={2.4} aria-hidden /> 12% less than September</span>
      </section>

      <section className="card chart" aria-label="Spending per day">
        <div className="bars">
          {WEEK.map((w, i) => (
            <div key={i} className={w.v === peak ? "col peak" : "col"}>
              <span style={{ height: `${w.v}%` }} />
              <small>{w.d}</small>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Categories</h2><span className="muted">5 active</span></div>
        <ul className="cats">
          {CATEGORIES.map(({ name, amount, share, icon: Icon, tint }) => (
            <li key={name} className="cat">
              <span className="cat-icon" style={{ color: tint, background: `color-mix(in srgb, ${tint} 14%, transparent)` }}>
                <Icon size={18} strokeWidth={2} aria-hidden />
              </span>
              <div className="cat-body">
                <div className="cat-row"><strong>{name}</strong><span>{amount}</span></div>
                <div className="cat-bar" aria-hidden><i style={{ width: `${share}%`, background: tint }} /></div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

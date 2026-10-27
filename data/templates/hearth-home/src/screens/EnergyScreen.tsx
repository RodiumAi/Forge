import "../styles/energy.css";
import { PiggyBank, PlugZap, Sun, TrendingDown } from "lucide-react";
import { useState } from "react";
import { CONSUMERS, CURRENCY, ENERGY_WEEK } from "../data";

const PERIODS = ["Day", "Week", "Month"] as const;
const TOTALS = { Day: "6.4", Week: "50.0", Month: "212" } as const;

export default function EnergyScreen() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>("Week");
  const [picked, setPicked] = useState(ENERGY_WEEK.length - 1);
  const peak = Math.max(...ENERGY_WEEK.map((d) => d.kwh));
  const day = ENERGY_WEEK[picked];
  const solarKwh = (day.kwh * day.solar) / 100;

  return (
    <main className="app-main energy-screen">
      <div className="periods" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p} role="tab" aria-selected={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{p}</button>
        ))}
      </div>

      <section className="usage">
        <p className="kicker">Used this {period.toLowerCase()}</p>
        <p className="usage-amt">{TOTALS[period]}<small>kWh</small></p>
        <span className="trend"><TrendingDown size={14} strokeWidth={2.4} aria-hidden /> 12% below your average</span>
      </section>

      <section className="card chart" aria-label="Daily usage, solar and grid">
        <div className="legend"><span><i className="sol" /> Solar</span><span><i className="grd" /> Grid</span></div>
        <div className="bars">
          {ENERGY_WEEK.map((d, i) => (
            <button key={d.d} className={i === picked ? "col on" : "col"} onClick={() => setPicked(i)} aria-label={`${d.d}, ${d.kwh} kWh`}>
              <span className="stack" style={{ height: `${(d.kwh / peak) * 100}%` }}>
                <i className="grd" style={{ height: `${100 - d.solar}%` }} />
                <i className="sol" style={{ height: `${d.solar}%` }} />
              </span>
              <small>{d.d.slice(0, 1)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="split card">
        <p className="kicker">{day.d}, {day.kwh} kWh</p>
        <div className="split-bar" aria-hidden>
          <i className="sol" style={{ width: `${day.solar}%` }} />
          <i className="grd" style={{ width: `${100 - day.solar}%` }} />
        </div>
        <div className="split-legend">
          <div><span className="si sol"><Sun size={16} strokeWidth={2} aria-hidden /></span><strong>{solarKwh.toFixed(1)} kWh</strong><span>Solar, {day.solar}%</span></div>
          <div><span className="si grd"><PlugZap size={16} strokeWidth={2} aria-hidden /></span><strong>{(day.kwh - solarKwh).toFixed(1)} kWh</strong><span>Grid, {100 - day.solar}%</span></div>
        </div>
      </section>

      <section className="savings">
        <span className="sv-icon"><PiggyBank size={22} strokeWidth={1.9} aria-hidden /></span>
        <div>
          <strong>8 450 {CURRENCY} saved</strong>
          <span>Solar covered 61% of October. Forecast bill: 14 900 {CURRENCY}.</span>
        </div>
      </section>

      <section>
        <div className="section-head"><h2>Top consumers</h2><span className="muted">Today</span></div>
        <div className="card consumers">
          {CONSUMERS.map(({ name, room, kwh, share, icon: Icon }) => (
            <div key={name} className="row">
              <span className="row-icon"><Icon size={18} strokeWidth={2} aria-hidden /></span>
              <span className="row-text">
                <strong>{name}</strong>
                <span className="c-bar" aria-hidden><i style={{ width: `${share * 2}%` }} /></span>
                <span>{room}</span>
              </span>
              <span className="kwh">{kwh} kWh</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

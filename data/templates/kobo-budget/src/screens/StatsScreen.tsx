import "../styles/stats.css";
import { CATS, MONTHS, SPENT } from "../data";
import CategoryRow from "../components/CategoryRow";

export default function StatsScreen() {
  return (
    <main className="app-main stats-screen">
      <section className="card">
        <div className="row"><h3>Monthly spend</h3><span className="pill">Avg 1,410</span></div>
        <div className="bars" aria-hidden>
          {MONTHS.map((b, i) => (
            <div className="col" key={i}>
              <div className="bar" style={{ height: `${b.h}%` }} />
              <span className="bl">{b.d}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="io">
        <div className="io-card in">
          <span className="io-lbl">Income</span>
          <span className="io-amt">845,000</span>
        </div>
        <div className="io-card out">
          <span className="io-lbl">Expenses</span>
          <span className="io-amt">-612,300</span>
        </div>
      </div>

      <div className="section-head"><h2>Top categories</h2></div>
      <section className="card cats">
        {CATS.slice(0, 4).map((c) => (
          <CategoryRow key={c.name} cat={c} amount={`${Math.round((c.spent / SPENT) * 100)}%`} />
        ))}
      </section>
    </main>
  );
}

import "../styles/activity.css";
import TxRow from "../components/TxRow";
import { SPEND, TX } from "../data";

export default function ActivityScreen() {
  return (
    <main className="app-main activity-screen">
      <section className="card">
        <div className="row"><h3>Spent this week</h3><span className="pill">-63,180 CFA</span></div>
        <div className="bars" aria-hidden>
          {SPEND.map((b, i) => (
            <div className="col" key={i}>
              <div className="bar" style={{ height: `${b.h}%` }} />
              <span className="bl">{b.d}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        {TX.map((t) => <TxRow tx={t} key={t.name} />)}
      </section>
    </main>
  );
}

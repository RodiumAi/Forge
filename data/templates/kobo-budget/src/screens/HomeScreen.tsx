import "../styles/home.css";
import { BUDGET, CATS, LEFT, PCT, RECENT, SPENT } from "../data";
import CategoryRow from "../components/CategoryRow";
import ListRow from "../components/ListRow";
import ProgressRing from "../components/ProgressRing";

type Props = { onStats: () => void };

export default function HomeScreen({ onStats }: Props) {
  return (
    <main className="app-main home-screen">
      <div className="hero">
        <div className="ring-wrap">
          <ProgressRing pct={PCT} />
          <div className="ring-center">
            <span className="rc-lbl">Left this month</span>
            <span className="rc-amt">{LEFT.toLocaleString()}</span>
            <span className="rc-sub">of {BUDGET.toLocaleString()} CFA</span>
          </div>
        </div>
        <div className="hero-legend">
          <span><i className="d spent" />Spent {SPENT.toLocaleString()}</span>
          <span><i className="d left" />{PCT}% used · 11 days left</span>
        </div>
      </div>

      <div className="section-head"><h2>Categories</h2><a href="#" onClick={(e) => { e.preventDefault(); onStats(); }}>Stats</a></div>
      <section className="card cats">
        {CATS.map((c) => (
          <CategoryRow key={c.name} cat={c} amount={`${c.spent} / ${c.limit}`} over={c.spent >= c.limit} />
        ))}
      </section>

      <div className="section-head"><h2>Recent expenses</h2></div>
      <section className="card">
        {RECENT.slice(0, 3).map((t) => (
          <ListRow key={t.name} Icon={t.Icon} title={t.name} sub={t.cat}>
            <span className={t.in ? "amount in" : "amount"}>{t.amt}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

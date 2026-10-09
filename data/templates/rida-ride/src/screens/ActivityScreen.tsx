import "../styles/activity.css";
import { CarFront } from "lucide-react";
import BoltIcon from "../components/BoltIcon";
import ListRow from "../components/ListRow";
import { PLACES, RECEIPTS, type Tab } from "../data";

type Props = { onGo: (tab: Tab) => void };

export default function ActivityScreen({ onGo }: Props) {
  return (
    <main className="app-main activity-screen">
      <div className="balance">
        <span className="card-chip" aria-hidden />
        <p className="lbl">Spent this month</p>
        <p className="amt">64,300 <small>CFA</small></p>
        <span className="delta"><BoltIcon /> 18 rides · 214 km</span>
      </div>

      <div className="section-head"><h2>Favorite places</h2><a href="#" onClick={(e) => { e.preventDefault(); onGo("account"); }}>Edit</a></div>
      <div className="places">
        {PLACES.map((p) => (
          <div className="place" key={p.label}>
            <span className="place-ic" aria-hidden><p.icon size={18} strokeWidth={1.8} aria-hidden /></span>
            <div><strong>{p.label}</strong><span className="muted">{p.addr}</span></div>
          </div>
        ))}
      </div>

      <div className="section-head"><h2>Receipts</h2><a href="#" onClick={(e) => { e.preventDefault(); onGo("trips"); }}>See all</a></div>
      <section className="card">
        {RECEIPTS.map((t) => (
          <ListRow key={t.name + t.cat} icon={<CarFront size={24} strokeWidth={1.7} aria-hidden />} title={t.name} sub={t.cat}>
            <span className="amount">-{t.amt}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

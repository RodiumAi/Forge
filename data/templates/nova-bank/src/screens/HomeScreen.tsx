import "../styles/home.css";
import { ArrowUp, Plus, ScanLine, Split } from "lucide-react";
import TxRow from "../components/TxRow";
import { TX } from "../data";

const ACTIONS = [
  { label: "Send", icon: ArrowUp },
  { label: "Add", icon: Plus },
  { label: "Pay", icon: ScanLine },
  { label: "Split", icon: Split },
];

type Props = { onSeeAll: () => void };

export default function HomeScreen({ onSeeAll }: Props) {
  return (
    <main className="app-main home-screen">
      <div className="balance">
        <span className="card-chip" aria-hidden />
        <p className="lbl">Total balance</p>
        <p className="amt">2,318,540 <small>CFA</small></p>
        <span className="delta"><ArrowUp size={20} strokeWidth={1.9} aria-hidden /> +42,900 this week</span>
      </div>

      <div className="actions">
        {ACTIONS.map(({ label, icon: Icon }) => (
          <button className="action" key={label}><span className="ic"><Icon size={20} strokeWidth={1.9} aria-hidden /></span>{label}</button>
        ))}
      </div>

      <div className="section-head"><h2>Recent activity</h2><a href="#" onClick={(e) => { e.preventDefault(); onSeeAll(); }}>See all</a></div>
      <section className="card">
        {TX.slice(0, 4).map((t) => <TxRow tx={t} key={t.name} />)}
      </section>
    </main>
  );
}

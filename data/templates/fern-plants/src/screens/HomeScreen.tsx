import "../styles/home.css";
import { Check, Droplet, Leaf, Sun } from "lucide-react";
import ListRow from "../components/ListRow";
import { DUE, PLANTS } from "../data";

type Props = {
  watered: Record<string, boolean>;
  onToggleWatered: (id: string) => void;
  onGuides: () => void;
};

export default function HomeScreen({ watered, onToggleWatered, onGuides }: Props) {
  const dueLeft = DUE.filter((p) => !watered[p.id]).length;

  return (
    <main className="app-main home-screen">
      <div className="hero">
        <span className="hero-leaf" aria-hidden><Leaf size={22} strokeWidth={1.8} aria-hidden /></span>
        <p className="lbl">Water today</p>
        <p className="amt">{dueLeft || 0} <small>{dueLeft === 1 ? "plant thirsty" : "plants thirsty"}</small></p>
        <span className="delta"><Droplet size={18} strokeWidth={1.8} aria-hidden /> {dueLeft ? "Give them a drink" : "All caught up — nice"}</span>
      </div>

      <section className="card">
        <div className="row" style={{ marginBottom: ".6rem" }}>
          <h3>Water today</h3>
          <span className="pill">{dueLeft} due</span>
        </div>
        {DUE.map((p) => (
          <ListRow
            key={p.id}
            icon={p.icon}
            title={p.name}
            titleStyle={watered[p.id] ? { textDecoration: "line-through", opacity: .6 } : undefined}
            sub={p.room}
          >
            <button
              className={watered[p.id] ? "waterbtn done" : "waterbtn"}
              aria-pressed={!!watered[p.id]}
              onClick={() => onToggleWatered(p.id)}
            >
              {watered[p.id]
                ? <><Check size={18} strokeWidth={2.2} aria-hidden /> Done</>
                : <><Droplet size={18} strokeWidth={1.8} aria-hidden /> Water</>}
            </button>
          </ListRow>
        ))}
      </section>

      <div className="section-head"><h2>My plants</h2><a href="#" onClick={(e) => { e.preventDefault(); onGuides(); }}>Guides</a></div>
      <div className="plant-grid">
        {PLANTS.map((p) => (
          <div className={`plant-card g${p.grad}`} key={p.name}>
            <span className="plant-glyph" aria-hidden><p.icon size={32} strokeWidth={1.6} aria-hidden /></span>
            <strong>{p.name}</strong>
            <span className="next"><Droplet size={18} strokeWidth={1.8} aria-hidden /> {p.next}</span>
            <span className="light"><Sun size={16} strokeWidth={1.7} aria-hidden /> {p.light}</span>
          </div>
        ))}
      </div>

      <div className="tip">
        <span className="tip-ic" aria-hidden><Droplet size={20} strokeWidth={1.8} aria-hidden /></span>
        <p><strong>Care tip.</strong> Let the top 3cm of soil dry before watering — most houseplants prefer a little thirst to soggy roots.</p>
      </div>
    </main>
  );
}

import "../styles/cards.css";
import { Gauge, Nfc, Plus } from "lucide-react";
import ListRow from "../components/ListRow";

type Props = { frozen: boolean; onToggleFrozen: () => void };

export default function CardsScreen({ frozen, onToggleFrozen }: Props) {
  return (
    <main className="app-main cards-screen">
      <div className="paycard accent">
        <div className="row"><span className="brand">NOVA</span><span className="chip" aria-hidden /></div>
        <p className="num">4921 •••• •••• 8830</p>
        <div className="foot"><span>AMINE KADA</span><span>08 / 28</span></div>
      </div>
      <section className="card">
        <div className="row" style={{ marginBottom: ".7rem" }}>
          <div><strong style={{ fontSize: ".95rem" }}>Freeze card</strong><p className="muted" style={{ fontSize: ".8rem" }}>Instantly block payments</p></div>
          <button className={frozen ? "toggle on" : "toggle"} aria-pressed={frozen} onClick={onToggleFrozen} />
        </div>
        <ListRow icon={Gauge} title="Card limits" sub="Daily · 500,000 CFA"><span className="link">Edit</span></ListRow>
        <ListRow icon={Nfc} title="Contactless" sub="Enabled"><span className="link">Manage</span></ListRow>
        <ListRow icon={Plus} title="Virtual card" sub="Create a single-use number"><span className="link">New</span></ListRow>
      </section>
    </main>
  );
}

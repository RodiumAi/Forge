import "../styles/account.css";
import { Speech } from "lucide-react";
import ListRow from "../components/ListRow";
import SparkIcon from "../components/SparkIcon";

export default function AccountScreen() {
  return (
    <main className="app-main account-screen">
      <section className="card">
        <div className="row" style={{ marginBottom: ".2rem" }}>
          <div><strong style={{ fontSize: ".95rem" }}>Model</strong><p className="muted" style={{ fontSize: ".8rem" }}>Balances speed and depth</p></div>
          <span className="pill">Ava Pro 2</span>
        </div>
        <ListRow icon={<SparkIcon />} title="Personality" sub="Friendly · concise"><span className="link">Edit</span></ListRow>
        <ListRow icon={<Speech size={18} strokeWidth={1.7} aria-hidden />} title="Voice" sub="Soft · on for replies"><span className="link">Change</span></ListRow>
      </section>

      <section className="card">
        <div className="row"><h3>Usage this month</h3><span className="pill">68%</span></div>
        <div className="usage"><span style={{ width: "68%" }} /></div>
        <p className="muted" style={{ fontSize: ".8rem", marginTop: ".55rem" }}>1,360 of 2,000 messages used · resets Oct 1</p>
      </section>

      <div className="upsell">
        <span className="upsell-ic" aria-hidden><SparkIcon /></span>
        <div>
          <strong>Upgrade to Pro</strong>
          <p className="muted" style={{ fontSize: ".82rem" }}>Unlimited messages, faster model, priority.</p>
        </div>
        <button className="btn-primary" style={{ width: "auto", padding: ".6rem 1rem", minHeight: "auto" }}>Go Pro</button>
      </div>
    </main>
  );
}

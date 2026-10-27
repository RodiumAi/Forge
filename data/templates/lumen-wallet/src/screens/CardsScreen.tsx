import "../styles/cards.css";
import { ChevronRight, Globe, KeyRound, Snowflake, Wifi } from "lucide-react";
import { useState } from "react";
import { CURRENCY, ME } from "../data";

const CARDS = {
  physical: { label: "Lumen Black", number: "4821", expiry: "09/29", tone: "dark" },
  virtual: { label: "Online only", number: "7730", expiry: "02/27", tone: "lime" },
} as const;

type Kind = keyof typeof CARDS;

export default function CardsScreen() {
  const [kind, setKind] = useState<Kind>("physical");
  const [frozen, setFrozen] = useState(false);
  const [online, setOnline] = useState(true);
  const card = CARDS[kind];

  return (
    <main className="app-main cards-screen">
      <div className="segmented" role="tablist" aria-label="Card type">
        {(Object.keys(CARDS) as Kind[]).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>
            {k === "physical" ? "Physical" : "Virtual"}
          </button>
        ))}
      </div>

      <div className={`pay-card ${card.tone}${frozen ? " frozen" : ""}`}>
        <div className="pc-top"><span className="pc-brand">Lumen</span><Wifi size={20} strokeWidth={2} aria-hidden /></div>
        <span className="pc-chip" aria-hidden />
        <p className="pc-number">•••• •••• •••• {card.number}</p>
        <div className="pc-bottom">
          <div><small>Card holder</small><span>{ME.name}</span></div>
          <div><small>Expires</small><span>{card.expiry}</span></div>
          <span className="pc-net" aria-hidden><i /><i /></span>
        </div>
        {frozen && <span className="pc-frozen"><Snowflake size={16} strokeWidth={2.2} aria-hidden /> Frozen</span>}
      </div>

      <section className="card limit">
        <div className="limit-row"><span>Monthly limit</span><strong>214 300 / 500 000 {CURRENCY}</strong></div>
        <div className="bar" aria-hidden><i style={{ width: "43%" }} /></div>
        <p className="muted">Resets on November 1</p>
      </section>

      <section className="card settings">
        <div className="setting">
          <span className="s-icon"><Snowflake size={18} strokeWidth={2} aria-hidden /></span>
          <span className="s-text"><strong>Freeze card</strong><span>Block all payments instantly</span></span>
          <button className={frozen ? "toggle on" : "toggle"} onClick={() => setFrozen((v) => !v)} aria-pressed={frozen} aria-label="Freeze card" />
        </div>
        <div className="setting">
          <span className="s-icon"><Globe size={18} strokeWidth={2} aria-hidden /></span>
          <span className="s-text"><strong>Online payments</strong><span>Shops and subscriptions</span></span>
          <button className={online ? "toggle on" : "toggle"} onClick={() => setOnline((v) => !v)} aria-pressed={online} aria-label="Online payments" />
        </div>
        <button className="setting link-row">
          <span className="s-icon"><KeyRound size={18} strokeWidth={2} aria-hidden /></span>
          <span className="s-text"><strong>Show PIN</strong><span>Face ID required</span></span>
          <ChevronRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </section>
    </main>
  );
}

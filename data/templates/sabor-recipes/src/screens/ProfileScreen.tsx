import "../styles/profile.css";
import { Check, Flame, ShoppingCart } from "lucide-react";
import { ALLERGIES, CHEFS, SHOPPING, WEEK } from "../data";

export default function ProfileScreen() {
  return (
    <main className="app-main profile-screen">
      <section className="card streak">
        <div>
          <p className="lbl">Cooking streak</p>
          <p className="streak-n">12 <small>days</small></p>
          <span className="pill soft"><Flame size={16} strokeWidth={1.7} aria-hidden /> On a roll</span>
        </div>
        <div className="streak-week" aria-hidden>
          {WEEK.map((d, i) => (
            <span key={i} className={i < 5 ? "day on" : "day"}>{d}</span>
          ))}
        </div>
      </section>

      <div className="section-head"><h2>Shopping list</h2><span className="link">Clear</span></div>
      <section className="card list">
        {SHOPPING.map((s) => (
          <div className="shop" key={s.item}>
            <span className={s.done ? "check on" : "check"} aria-hidden>{s.done && <Check size={13} strokeWidth={3} />}</span>
            <span className="meta"><strong className={s.done ? "struck" : ""}>{s.item}</strong></span>
            <span className="qty">{s.qty}</span>
          </div>
        ))}
        <button className="add-shop"><ShoppingCart size={20} strokeWidth={1.8} aria-hidden /> Add ingredients</button>
      </section>

      <div className="section-head"><h2>Preferences</h2></div>
      <section className="card">
        <p className="lbl">Allergies & diet</p>
        <div className="chips wrap">
          {ALLERGIES.map((a) => <span key={a} className="chip on static">{a}</span>)}
        </div>
      </section>

      <div className="section-head"><h2>Following chefs</h2></div>
      <section className="card list">
        {CHEFS.map((c) => (
          <div className="chef" key={c.name}>
            <span className="ava" aria-hidden><c.Icon size={20} strokeWidth={1.8} /></span>
            <span className="meta"><strong>{c.name}</strong><span className="sub">{c.note}</span></span>
            <span className="link">Following</span>
          </div>
        ))}
      </section>
    </main>
  );
}

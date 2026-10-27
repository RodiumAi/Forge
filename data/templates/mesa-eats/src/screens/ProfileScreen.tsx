import "../styles/profile.css";
import { Bell, Briefcase, ChevronRight, CreditCard, Gift, House, LogOut, MapPin, Percent, Smartphone, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ADDRESS, CURRENCY, fcfa, ME, RESTAURANTS } from "../data";

type Props = { onSignOut: () => void };

const PAYMENTS = [
  { id: "wave", label: "Wave", sub: "Default", icon: Smartphone },
  { id: "om", label: "Orange Money", sub: "07 48 ** ** 33", icon: Wallet },
  { id: "card", label: "Visa", sub: "Ending 4821", icon: CreditCard },
];

/** Profile tab: member card, favourites, addresses, payment, notifications, sign out. */
export default function ProfileScreen({ onSignOut }: Props) {
  const [pay, setPay] = useState("wave");
  const [updates, setUpdates] = useState(true);
  const [offers, setOffers] = useState(false);
  const favs = RESTAURANTS.filter((r) => ["maquis-baobab", "sora-ramen", "sweet-spot"].includes(r.id));

  return (
    <main className="app-main profile-screen">
      <section className="member">
        <img src={ME.avatar} alt="" />
        <div className="m-meta">
          <h2>{ME.name}</h2>
          <small>{ME.phone}</small>
          <span className="plus"><Sparkles size={13} strokeWidth={2.4} aria-hidden /> Mesa+ member</span>
        </div>
        <div className="m-stats">
          <div><b>42</b><span>orders</span></div>
          <div><b>{fcfa(18500)}</b><span>{CURRENCY} saved</span></div>
          <div><b>3</b><span>free deliveries</span></div>
        </div>
      </section>

      <Link to="/search" className="invite">
        <span className="inv-ico"><Gift size={20} strokeWidth={2.2} aria-hidden /></span>
        <span><strong>Give 2 000, get 2 000 FCFA</strong><small>Invite a friend to Mesa</small></span>
        <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
      </Link>

      <section>
        <div className="section-head"><h2>Favourites</h2></div>
        <div className="favs">
          {favs.map((r) => (
            <Link key={r.id} to={`/restaurant/${r.id}`} className="fav">
              <img src={r.photo} alt="" loading="lazy" />
              <span>{r.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card list">
        <h3>Addresses</h3>
        <div className="row"><span className="r-ico"><House size={18} strokeWidth={2.2} aria-hidden /></span><span className="row-meta"><strong>{ADDRESS.label}</strong><span>{ADDRESS.line}</span></span><ChevronRight size={18} aria-hidden /></div>
        <div className="row"><span className="r-ico"><Briefcase size={18} strokeWidth={2.2} aria-hidden /></span><span className="row-meta"><strong>Work</strong><span>Immeuble Alpha 2000, Plateau</span></span><ChevronRight size={18} aria-hidden /></div>
        <button className="row add"><span className="r-ico"><MapPin size={18} strokeWidth={2.2} aria-hidden /></span><span className="row-meta"><strong>Add an address</strong></span></button>
      </section>

      <section className="card list" aria-label="Payment">
        <h3>Payment</h3>
        {PAYMENTS.map(({ id, label, sub, icon: Icon }) => (
          <button key={id} className="row pay" onClick={() => setPay(id)} aria-pressed={pay === id}>
            <span className="r-ico"><Icon size={18} strokeWidth={2.2} aria-hidden /></span>
            <span className="row-meta"><strong>{label}</strong><span>{sub}</span></span>
            <span className={pay === id ? "radio on" : "radio"} aria-hidden />
          </button>
        ))}
      </section>

      <section className="card list">
        <h3>Notifications</h3>
        <div className="row">
          <span className="r-ico"><Bell size={18} strokeWidth={2.2} aria-hidden /></span>
          <span className="row-meta"><strong>Order updates</strong><span>Courier and arrival time</span></span>
          <button className={updates ? "toggle on" : "toggle"} onClick={() => setUpdates((v) => !v)} aria-pressed={updates} aria-label="Order updates" />
        </div>
        <div className="row">
          <span className="r-ico"><Percent size={18} strokeWidth={2.2} aria-hidden /></span>
          <span className="row-meta"><strong>Offers near me</strong><span>At most one a day</span></span>
          <button className={offers ? "toggle on" : "toggle"} onClick={() => setOffers((v) => !v)} aria-pressed={offers} aria-label="Offers near me" />
        </div>
      </section>

      <button className="btn-soft sign-out" onClick={onSignOut}><LogOut size={18} strokeWidth={2.2} aria-hidden /> Sign out</button>
    </main>
  );
}

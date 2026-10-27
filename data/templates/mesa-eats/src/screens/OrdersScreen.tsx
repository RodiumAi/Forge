import "../styles/orders.css";
import { Bike, ChefHat, CircleCheck, House, MessageCircle, Phone, RotateCcw, ShoppingBag, Star } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../components/Cart";
import { COURIER, CURRENCY, findRestaurant, fcfa, PAST_ORDERS } from "../data";

const STEPS = [
  { label: "Confirmed", icon: CircleCheck },
  { label: "Cooking", icon: ChefHat },
  { label: "On the way", icon: Bike },
  { label: "Delivered", icon: House },
];

const HEADLINES = ["Order confirmed", "The kitchen is on it", "Moussa is on the way", "Enjoy your meal"];

/** Orders tab: the active order with a live delivery tracker, then past orders to reorder. */
export default function OrdersScreen() {
  const { order } = useCart();
  const r = order ? findRestaurant(order.restaurantId) : undefined;

  return (
    <main className="app-main orders-screen">
      {order && r ? (
        <section className={order.step === 3 ? "active-order done" : "active-order"} aria-label="Current order">
          <div className="ao-head">
            <img src={r.photo} alt="" />
            <span className="ao-shade" />
            <div className="ao-title">
              <small>{r.name} · #{order.id.slice(2)}</small>
              <h2>{HEADLINES[order.step]}</h2>
            </div>
            <div className="ao-eta">
              <small>{order.step === 3 ? "Delivered" : "Arriving"}</small>
              <b>{order.eta}</b>
            </div>
          </div>

          <ol className="tracker" style={{ "--done": order.step / (STEPS.length - 1) } as CSSProperties}>
            {STEPS.map(({ label, icon: Icon }, i) => (
              <li key={label} className={i < order.step ? "past" : i === order.step ? "now" : ""}>
                <span className="t-dot"><Icon size={17} strokeWidth={2.2} aria-hidden /></span>
                <span className="t-label">{label}</span>
              </li>
            ))}
          </ol>

          {order.step < 3 ? (
            <div className="courier">
              <img src={COURIER.avatar} alt="" />
              <span className="c-meta">
                <strong>{COURIER.name}</strong>
                <small><Star size={12} strokeWidth={0} fill="currentColor" aria-hidden /> {COURIER.rating} · {COURIER.vehicle}</small>
              </span>
              <button className="icon-btn" aria-label={`Message ${COURIER.name}`}><MessageCircle size={18} strokeWidth={2.2} aria-hidden /></button>
              <button className="icon-btn call" aria-label={`Call ${COURIER.name}`}><Phone size={18} strokeWidth={2.2} aria-hidden /></button>
            </div>
          ) : (
            <div className="rate">
              <span>How was it?</span>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`}><Star size={22} strokeWidth={1.8} aria-hidden /></button>
                ))}
              </div>
            </div>
          )}

          <div className="ao-sum">
            <span><ShoppingBag size={15} strokeWidth={2.2} aria-hidden /> {order.count} items · {order.summary}</span>
            <span className="price">{fcfa(order.total)}<small>{CURRENCY}</small></span>
          </div>
        </section>
      ) : (
        <div className="no-order">
          <span><ShoppingBag size={26} strokeWidth={2} aria-hidden /></span>
          <h2>No order on its way</h2>
          <p className="muted">Your next meal is a few taps away.</p>
          <Link to="/" className="btn-primary">Find something to eat</Link>
        </div>
      )}

      <section>
        <div className="section-head"><h2>Past orders</h2></div>
        <div className="past">
          {PAST_ORDERS.map((o) => {
            const pr = findRestaurant(o.restaurantId);
            if (!pr) return null;
            return (
              <article key={o.id} className="past-row">
                <img src={pr.photo} alt="" loading="lazy" />
                <div className="p-meta">
                  <strong>{pr.name}</strong>
                  <small>{o.date} · {fcfa(o.total)} {CURRENCY}</small>
                  <span>{o.items}</span>
                </div>
                <Link to={`/restaurant/${pr.id}`} className="reorder" aria-label={`Reorder from ${pr.name}`}>
                  <RotateCcw size={16} strokeWidth={2.4} aria-hidden /> Reorder
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

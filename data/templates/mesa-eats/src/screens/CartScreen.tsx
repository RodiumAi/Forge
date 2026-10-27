import "../styles/cart.css";
import { ArrowLeft, Bike, Check, ChevronRight, HandCoins, MapPin, Plus, ShoppingBag, Smartphone } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, type ActiveOrder } from "../components/Cart";
import Stepper from "../components/Stepper";
import { ADDRESS, COURIER, CURRENCY, fcfa, findRestaurant, TIPS } from "../data";

function Money({ n }: { n: number }) {
  return <span className="price">{fcfa(n)}<small>{CURRENCY}</small></span>;
}

/** Stack screen (no tab bar): items with quantities, address, tip selector, totals in FCFA, Place order, then a success state. */
export default function CartScreen() {
  const navigate = useNavigate();
  const cart = useCart();
  const [placed, setPlaced] = useState<ActiveOrder | null>(null);
  const r = findRestaurant(cart.restaurantId ?? undefined);

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  if (placed) {
    const pr = findRestaurant(placed.restaurantId);
    return (
      <div className="app-shell cart-screen placed">
        <div className="done-mark"><Check size={42} strokeWidth={3} aria-hidden /></div>
        <p className="kicker">Order #{placed.id.slice(2)} placed</p>
        <h1>On the stove at {pr?.name}</h1>
        <p className="muted">{placed.count} items, {fcfa(placed.total)} {CURRENCY}. We will tell you the moment it leaves the kitchen.</p>
        <div className="eta-card">
          <img src={COURIER.avatar} alt="" />
          <span><small>Estimated arrival</small><b>{placed.eta}</b></span>
          <span className="eta-bike"><Bike size={18} strokeWidth={2.4} aria-hidden /></span>
        </div>
        <div className="done-actions">
          <button className="btn-primary" onClick={() => navigate("/orders", { replace: true })}>Track my order</button>
          <button className="btn-ghost" onClick={() => navigate("/", { replace: true })}>Back to home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell cart-screen">
      <header className="cart-bar-top">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.4} aria-hidden /></button>
        <div>
          <h1>Your cart</h1>
          {r && cart.count > 0 && <small>{r.name}</small>}
        </div>
        <span className="bar-space" aria-hidden />
      </header>

      {cart.count === 0 ? (
        <div className="empty">
          <span><ShoppingBag size={28} strokeWidth={2} aria-hidden /></span>
          <h2>Your cart is empty</h2>
          <p className="muted">Add a few dishes from a restaurant you like.</p>
          <Link to="/" className="btn-primary">Browse restaurants</Link>
        </div>
      ) : (
        <>
          <div className="cart-body">
            <section className="lines">
              {cart.lines.map(({ dish, qty }) => (
                <article key={dish.id} className="line">
                  <img src={dish.photo} alt="" />
                  <div className="l-meta">
                    <strong>{dish.name}</strong>
                    <Money n={dish.price * qty} />
                  </div>
                  <Stepper qty={qty} label={dish.name} small onChange={(n) => cart.setQty(dish.id, n)} />
                </article>
              ))}
              {r && <Link to={`/restaurant/${r.id}`} className="add-more"><Plus size={17} strokeWidth={2.6} aria-hidden /> Add more from {r.name}</Link>}
            </section>

            <section className="card deliver-to">
              <span className="dt-ico"><MapPin size={18} strokeWidth={2.2} aria-hidden /></span>
              <span><small>Deliver to {ADDRESS.label}</small><strong>{ADDRESS.line}</strong></span>
              <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
            </section>

            <section className="tips" aria-label="Tip for the courier">
              <div className="section-head"><h2><HandCoins size={19} strokeWidth={2.2} aria-hidden /> Tip your courier</h2><span className="muted">100% goes to them</span></div>
              <div className="tip-row" role="radiogroup">
                {TIPS.map((t) => (
                  <button key={t} role="radio" aria-checked={cart.tip === t} className={cart.tip === t ? "tip on" : "tip"} onClick={() => cart.setTip(t)}>
                    {t ? <>{fcfa(t)}<small>{CURRENCY}</small></> : "No tip"}
                  </button>
                ))}
              </div>
            </section>

            <section className="card pay-row">
              <span className="dt-ico wave"><Smartphone size={18} strokeWidth={2.2} aria-hidden /></span>
              <span><small>Pay with</small><strong>Wave</strong></span>
              <Link to="/profile" className="link">Change</Link>
            </section>

            <section className="card totals" aria-label="Order total">
              <div><span>Subtotal</span><Money n={cart.subtotal} /></div>
              <div><span>Delivery</span>{cart.fee ? <Money n={cart.fee} /> : <span className="free">Free</span>}</div>
              <div><span>Service</span><Money n={cart.service} /></div>
              <div><span>Tip</span><Money n={cart.tip} /></div>
              <div className="grand"><span>Total</span><Money n={cart.total} /></div>
            </section>
          </div>

          <div className="place-dock">
            <button className="btn-primary" onClick={() => setPlaced(cart.placeOrder())}>
              Place order <span className="place-total">{fcfa(cart.total)} {CURRENCY}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

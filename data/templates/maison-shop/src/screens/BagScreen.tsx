import "../styles/bag.css";
import { Check, Minus, Plus, ShoppingBag, Truck, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "../components/Shop";
import { euro, FREE_SHIPPING, ME, productById, SHIPPING } from "../data";

export default function BagScreen() {
  const { bag, subtotal, setQty, remove, clear } = useShop();
  const [placed, setPlaced] = useState<{ ref: string; total: number } | null>(null);

  const shipping = subtotal >= FREE_SHIPPING || subtotal === 0 ? 0 : SHIPPING;
  const total = subtotal + shipping;
  const toFree = Math.max(0, FREE_SHIPPING - subtotal);

  function checkout() {
    setPlaced({ ref: `MS-${20419 + bag.length}`, total });
    clear();
  }

  if (placed) {
    return (
      <main className="app-main bag-screen">
        <section className="done">
          <span className="done-mark"><Check size={26} strokeWidth={1.4} aria-hidden /></span>
          <p className="label rust">Order {placed.ref}</p>
          <h2>Thank you, {ME.first}</h2>
          <p className="muted">{euro(placed.total)} paid. Your pieces are wrapped by hand in Paris and arrive in two to four days. We sent the receipt to {ME.email}.</p>
          <Link to="/shop" className="btn-primary" onClick={() => setPlaced(null)}>Continue shopping</Link>
        </section>
      </main>
    );
  }

  if (!bag.length) {
    return (
      <main className="app-main bag-screen">
        <section className="done">
          <span className="done-mark"><ShoppingBag size={24} strokeWidth={1.4} aria-hidden /></span>
          <h2>Your bag is empty</h2>
          <p className="muted">Pieces you add will wait here for thirty days.</p>
          <Link to="/shop" className="btn-primary">Discover the shop</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="app-main bag-screen">
      <div className="ship-note">
        <Truck size={16} strokeWidth={1.5} aria-hidden />
        {toFree > 0 ? <span>Add {euro(toFree)} for free delivery</span> : <span>Free delivery unlocked</span>}
        <i style={{ width: `${Math.min(100, (subtotal / FREE_SHIPPING) * 100)}%` }} aria-hidden />
      </div>

      <ul className="lines">
        {bag.map((l) => {
          const p = productById(l.productId);
          if (!p) return null;
          return (
            <li key={l.key}>
              <Link to={`/product/${p.id}`} className="line-photo"><img src={p.images[0]} alt="" /></Link>
              <div className="line-info">
                <div className="line-top">
                  <strong>{p.name}</strong>
                  <button className="line-remove" onClick={() => remove(l.key)} aria-label={`Remove ${p.name}`}><X size={16} strokeWidth={1.5} aria-hidden /></button>
                </div>
                <p className="label">{l.color} · Size {l.size}</p>
                <div className="line-bottom">
                  <div className="stepper">
                    <button onClick={() => setQty(l.key, l.qty - 1)} aria-label="One less"><Minus size={14} strokeWidth={1.6} aria-hidden /></button>
                    <output aria-live="polite">{l.qty}</output>
                    <button onClick={() => setQty(l.key, l.qty + 1)} aria-label="One more"><Plus size={14} strokeWidth={1.6} aria-hidden /></button>
                  </div>
                  <span className="line-price">{euro(p.price * l.qty)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <section className="totals">
        <div><span>Subtotal</span><span>{euro(subtotal)}</span></div>
        <div><span>Delivery</span><span>{shipping ? euro(shipping) : "Free"}</span></div>
        <div><span>Duties</span><span>Included</span></div>
        <hr className="hair" />
        <div className="grand"><span>Total</span><span>{euro(total)}</span></div>
      </section>

      <button className="btn-primary btn-block" onClick={checkout}>Checkout · {euro(total)}</button>
      <p className="muted fine">Pay with card, Apple Pay or Mobile Money. Free returns within thirty days.</p>
    </main>
  );
}

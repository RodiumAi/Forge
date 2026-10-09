import "../styles/cart.css";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { PRODUCTS, money, type Cart } from "../data";
import RowItem from "../components/RowItem";

type Props = { cart: Cart; onBump: (id: string, delta: number) => void; onShop: () => void };

export default function CartScreen({ cart, onBump, onShop }: Props) {
  const cartLines = PRODUCTS.filter((p) => cart[p.id]);
  const subtotal = cartLines.reduce((sum, p) => sum + p.price * cart[p.id], 0);
  const total = subtotal >= 75 ? subtotal : subtotal + 6;

  if (cartLines.length === 0) {
    return (
      <main className="app-main cart-screen">
        <section className="card empty">
          <span className="empty-orb" aria-hidden><ShoppingBag size={22} strokeWidth={1.8} /></span>
          <strong>Your cart is empty</strong>
          <p className="muted">Browse the edit and tap + to add your first find.</p>
          <button className="btn-primary" onClick={onShop}>Start shopping</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-main cart-screen">
      <section className="card">
        {cartLines.map((p) => (
          <RowItem key={p.id} product={p} title={p.name} sub={<span className="price sm">{money(p.price)}</span>}>
            <span className="stepper">
              <button aria-label={`Remove one ${p.name}`} onClick={() => onBump(p.id, -1)}><Minus size={18} strokeWidth={2.1} aria-hidden /></button>
              <b>{cart[p.id]}</b>
              <button aria-label={`Add one ${p.name}`} onClick={() => onBump(p.id, 1)}><Plus size={18} strokeWidth={2.1} aria-hidden /></button>
            </span>
          </RowItem>
        ))}
      </section>

      <section className="card summary">
        <div className="row"><span className="muted">Subtotal</span><span className="price">{money(subtotal)}</span></div>
        <div className="row"><span className="muted">Shipping</span><span className="price free">{subtotal >= 75 ? "Free" : money(6)}</span></div>
        <div className="row total"><span>Total</span><span className="price">{money(total)}</span></div>
      </section>

      <button className="btn-primary checkout">Checkout · {money(total)}</button>
    </main>
  );
}

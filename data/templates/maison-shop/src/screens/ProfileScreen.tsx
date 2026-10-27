import "../styles/profile.css";
import { ChevronRight, Gift, Heart, LogOut, MapPin, Package, Ruler } from "lucide-react";
import { Link } from "react-router-dom";
import { useShop } from "../components/Shop";
import { euro, ME, ORDERS, productById, type Product } from "../data";

type Props = { onSignOut: () => void };

export default function ProfileScreen({ onSignOut }: Props) {
  const { wishlist } = useShop();
  const wished = wishlist.map((id) => productById(id)).filter((p): p is Product => Boolean(p));

  return (
    <main className="app-main profile-screen">
      <section className="who">
        <img src={ME.avatar} alt="" />
        <div>
          <h2>{ME.name}</h2>
          <p className="label rust">{ME.tier} · {ME.points.toLocaleString("en-US")} points</p>
        </div>
      </section>

      <section className="stats">
        <div><strong>{ORDERS.length}</strong><span className="label">Orders</span></div>
        <div><strong>{wishlist.length}</strong><span className="label">Wishlist</span></div>
        <div><strong>{euro(60)}</strong><span className="label">Credit</span></div>
      </section>

      <section>
        <div className="section-head"><h2>Wishlist</h2><Link to="/shop" className="text-link">Shop</Link></div>
        {wished.length ? (
          <div className="rail wish">
            {wished.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="wish-item">
                <img src={p.images[0]} alt="" />
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="muted"><Heart size={14} strokeWidth={1.5} aria-hidden /> Tap the heart on any piece to keep it here.</p>
        )}
      </section>

      <section>
        <div className="section-head"><h2>Orders</h2></div>
        <ul className="orders">
          {ORDERS.map((o) => (
            <li key={o.id}>
              <Package size={18} strokeWidth={1.4} aria-hidden />
              <div>
                <strong>{o.id}</strong>
                <span className="label">{o.date} · {o.items} {o.items === 1 ? "piece" : "pieces"} · {euro(o.total)}</span>
              </div>
              <span className={o.status === "Delivered" ? "status" : "status live"}>{o.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <ul className="settings">
        <li><button><Ruler size={18} strokeWidth={1.4} aria-hidden /><span>My sizes</span><small>S · 38</small><ChevronRight size={16} strokeWidth={1.4} aria-hidden /></button></li>
        <li><button><MapPin size={18} strokeWidth={1.4} aria-hidden /><span>Addresses</span><small>Accra, Paris</small><ChevronRight size={16} strokeWidth={1.4} aria-hidden /></button></li>
        <li><button><Gift size={18} strokeWidth={1.4} aria-hidden /><span>Invite a friend</span><small>€30 each</small><ChevronRight size={16} strokeWidth={1.4} aria-hidden /></button></li>
        <li><button className="out" onClick={onSignOut}><LogOut size={18} strokeWidth={1.4} aria-hidden /><span>Sign out</span></button></li>
      </ul>
    </main>
  );
}

import "../styles/restaurant.css";
import { ArrowLeft, Bike, Clock, Flame, Heart, Share2, Star } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useCart } from "../components/Cart";
import CartBar from "../components/CartBar";
import Stepper from "../components/Stepper";
import { CURRENCY, fcfa, findRestaurant } from "../data";

/** Stack screen (no tab bar): hero photo, rating, menu sections with quantity steppers, docked cart bar. */
export default function RestaurantScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const r = findRestaurant(id);
  const { qtyOf, add, setQty, count } = useCart();
  const [fav, setFav] = useState(false);
  const [section, setSection] = useState(0);

  if (!r) return <Navigate to="/" replace />;

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  function jump(i: number) {
    setSection(i);
    document.getElementById(`menu-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={count ? "app-shell restaurant-screen has-cart" : "app-shell restaurant-screen"}>
      <header className="hero">
        <img src={r.photo} alt="" />
        <span className="hero-shade" />
        <div className="hero-bar">
          <button className="glass-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2.4} aria-hidden /></button>
          <div className="hero-actions">
            <button className="glass-btn" aria-label={`Share ${r.name}`}><Share2 size={18} strokeWidth={2.2} aria-hidden /></button>
            <button className={fav ? "glass-btn on" : "glass-btn"} onClick={() => setFav((f) => !f)} aria-pressed={fav} aria-label={fav ? "Remove from favourites" : "Save to favourites"}>
              <Heart size={18} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <section className="info">
        <p className="cuisine">{r.cuisine}</p>
        <h1>{r.name}</h1>
        <p className="muted">{r.tagline}</p>
        <div className="facts">
          <span className="fact rate"><Star size={15} strokeWidth={0} fill="currentColor" aria-hidden /><b>{r.rating}</b><small>{r.reviews}</small></span>
          <span className="fact"><Clock size={15} strokeWidth={2.2} aria-hidden /><b>{r.eta}</b></span>
          <span className="fact"><Bike size={15} strokeWidth={2.2} aria-hidden /><b>{r.fee ? `${fcfa(r.fee)} ${CURRENCY}` : "Free"}</b></span>
        </div>
      </section>

      {r.sections.length > 1 && (
        <nav className="menu-tabs" aria-label="Menu sections">
          {r.sections.map((s, i) => (
            <button key={s.title} className={section === i ? "chip on" : "chip"} onClick={() => jump(i)}>{s.title}</button>
          ))}
        </nav>
      )}

      <div className="menu">
        {r.sections.map((s, i) => (
          <section key={s.title} id={`menu-${i}`} className="menu-section">
            <h2>{s.title}</h2>
            {s.dishes.map((d) => {
              const q = qtyOf(d.id);
              return (
                <article key={d.id} className={q ? "dish in" : "dish"}>
                  <div className="d-text">
                    {d.popular && <span className="popular"><Flame size={12} strokeWidth={2.6} aria-hidden /> Popular</span>}
                    <h3>{d.name}</h3>
                    <p>{d.desc}</p>
                    <span className="price">{fcfa(d.price)}<small>{CURRENCY}</small></span>
                  </div>
                  <div className="d-photo">
                    <img src={d.photo} alt="" loading="lazy" />
                    <Stepper qty={q} label={d.name} onChange={(n) => (q === 0 && n > 0 ? add(r.id, d) : setQty(d.id, n))} />
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>

      <CartBar docked />
    </div>
  );
}

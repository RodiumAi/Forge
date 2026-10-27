import "../styles/home.css";
import { ArrowRight, BadgePercent, Bike, ChevronRight, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../components/Cart";
import RestaurantCard from "../components/RestaurantCard";
import { CATEGORIES, COURIER, findRestaurant, ME, PROMO, RESTAURANTS, type Cuisine } from "../data";

const STEPS = ["Confirmed", "Cooking", "On the way", "Delivered"];

/** Home tab: search entry, live order strip, promo, category chips, popular rail and the restaurant list. */
export default function HomeScreen() {
  const [cat, setCat] = useState<Cuisine | "All">("All");
  const { order } = useCart();
  const list = cat === "All" ? RESTAURANTS : RESTAURANTS.filter((r) => r.cuisine === cat);
  const popular = [...RESTAURANTS].sort((a, b) => b.rating - a.rating).slice(0, 4);
  const live = order && order.step < 3 ? order : null;

  return (
    <main className="app-main home-screen">
      <section className="hello">
        <h1>Hungry, <span>{ME.first}</span>?</h1>
        <Link to="/search" className="search-entry">
          <Search size={19} strokeWidth={2.2} aria-hidden />
          <span>Dishes, restaurants, cuisines</span>
        </Link>
      </section>

      {live && (
        <Link to="/orders" className="live-order">
          <span className="live-ico"><Bike size={20} strokeWidth={2.2} aria-hidden /></span>
          <span className="live-text">
            <small>{findRestaurant(live.restaurantId)?.name}</small>
            <strong>{STEPS[live.step]}, arriving {live.eta}</strong>
          </span>
          <img src={COURIER.avatar} alt="" />
          <ChevronRight size={18} strokeWidth={2.2} aria-hidden />
        </Link>
      )}

      <Link to={`/restaurant/${PROMO.restaurantId}`} className="promo">
        <span className="promo-text">
          <span className="promo-tag"><BadgePercent size={14} strokeWidth={2.4} aria-hidden /> Today only</span>
          <strong>{PROMO.title}</strong>
          <small>{PROMO.body}</small>
          <span className="promo-cta">Order now <ArrowRight size={15} strokeWidth={2.4} aria-hidden /></span>
        </span>
        <img src={PROMO.photo} alt="" />
      </Link>

      <section aria-label="Categories">
        <div className="rail chips">
          {CATEGORIES.map(({ id, icon: Icon }) => (
            <button key={id} className={cat === id ? "chip on" : "chip"} onClick={() => setCat(id)} aria-pressed={cat === id}>
              <span className="chip-ico"><Icon size={17} strokeWidth={2.2} aria-hidden /></span>{id}
            </button>
          ))}
        </div>
      </section>

      {cat === "All" && (
        <section>
          <div className="section-head"><h2>Popular near you</h2><Link to="/search" className="link">See all</Link></div>
          <div className="rail">
            {popular.map((r) => <RestaurantCard key={r.id} r={r} compact />)}
          </div>
        </section>
      )}

      <section>
        <div className="section-head"><h2>{cat === "All" ? "All restaurants" : cat}</h2><span className="count">{list.length} open</span></div>
        <div className="r-list">
          {list.map((r) => <RestaurantCard key={r.id} r={r} />)}
        </div>
      </section>
    </main>
  );
}

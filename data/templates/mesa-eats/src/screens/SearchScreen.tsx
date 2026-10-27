import "../styles/search.css";
import { History, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import RestaurantCard from "../components/RestaurantCard";
import { ALL_DISHES, CUISINE_TILES, findRestaurant, fcfa, RECENT_SEARCHES, RESTAURANTS } from "../data";

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Search tab: field, recent searches, cuisine grid; typing shows matching restaurants and dishes. */
export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [recent, setRecent] = useState(RECENT_SEARCHES);
  const term = norm(q.trim());

  const places = term ? RESTAURANTS.filter((r) => norm(`${r.name} ${r.cuisine} ${r.tagline}`).includes(term)) : [];
  const dishes = term ? ALL_DISHES.filter((d) => norm(`${d.name} ${d.desc}`).includes(term)).slice(0, 6) : [];

  return (
    <main className="app-main search-screen">
      <label className="field">
        <Search size={20} strokeWidth={2.2} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pizza, ramen, Smash Club..." aria-label="Search dishes and restaurants" />
        {q && <button className="clear" onClick={() => setQ("")} aria-label="Clear search"><X size={16} strokeWidth={2.6} aria-hidden /></button>}
      </label>

      {!term && (
        <>
          {recent.length > 0 && (
            <section>
              <div className="section-head"><h2>Recent searches</h2><button className="link" onClick={() => setRecent([])}>Clear</button></div>
              <div className="recent">
                {recent.map((r) => (
                  <button key={r} className="recent-chip" onClick={() => setQ(r)}>
                    <History size={15} strokeWidth={2.2} aria-hidden />{r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <div className="section-head"><h2>Cuisines</h2></div>
            <div className="cuisines">
              {CUISINE_TILES.map((c) => (
                <button key={c.name} className="cuisine" onClick={() => setQ(c.name)}>
                  <img src={c.photo} alt="" loading="lazy" />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {term && (
        <>
          {dishes.length > 0 && (
            <section>
              <div className="section-head"><h2>Dishes</h2><span className="hits">{dishes.length}</span></div>
              <div className="dish-hits">
                {dishes.map((d) => (
                  <Link key={d.id} to={`/restaurant/${d.restaurantId}`} className="dish-hit">
                    <img src={d.photo} alt="" loading="lazy" />
                    <span>
                      <strong>{d.name}</strong>
                      <small>{findRestaurant(d.restaurantId)?.name}</small>
                    </span>
                    <span className="price">{fcfa(d.price)}<small>FCFA</small></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {places.length > 0 && (
            <section>
              <div className="section-head"><h2>Restaurants</h2><span className="hits">{places.length}</span></div>
              <div className="r-list">{places.map((r) => <RestaurantCard key={r.id} r={r} />)}</div>
            </section>
          )}
          {!places.length && !dishes.length && (
            <div className="empty">
              <span><Search size={26} strokeWidth={2} aria-hidden /></span>
              <h2>Nothing for "{q.trim()}"</h2>
              <p className="muted">Try a dish, a cuisine or a restaurant name.</p>
            </div>
          )}
        </>
      )}
    </main>
  );
}

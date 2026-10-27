import "../styles/home.css";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import DestinationCard from "../components/DestinationCard";
import { byId, CATEGORIES, DESTINATIONS, ESCAPES, euro, ME, type Category } from "../data";

export default function HomeScreen() {
  const [cat, setCat] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const trending = DESTINATIONS.filter(
    (d) => (cat === "All" || d.category === cat) && (!q || `${d.name} ${d.country}`.toLowerCase().includes(q)),
  );

  return (
    <main className="app-main home-screen">
      <section className="hello">
        <h2>Where to <em>next</em>, {ME.first}?</h2>
        <div className="search">
          <label className="search-field">
            <Search size={19} strokeWidth={2.2} aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places, islands, cities" aria-label="Search destinations" />
          </label>
          <button className="filter-btn" aria-label="Filters"><SlidersHorizontal size={19} strokeWidth={2.2} aria-hidden /></button>
        </div>
      </section>

      <div className="chips" role="tablist" aria-label="Category">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <section>
        <div className="section-head">
          <h2>Trending</h2>
          <span className="count">{trending.length} places</span>
        </div>
        {trending.length ? (
          <div className="rail">
            {trending.map((d) => <DestinationCard key={d.id} d={d} />)}
          </div>
        ) : (
          <p className="muted empty">Nothing matches "{query}" yet. Try another island or city.</p>
        )}
      </section>

      <Link to="/destination/maldives" className="promo">
        <div>
          <p className="kicker">Last minute</p>
          <h3>Maldives villas, <em>30% off</em> in November</h3>
          <span className="promo-cta">See the deal <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden /></span>
        </div>
        <img src={byId("maldives")?.thumb} alt="" />
      </Link>

      <section>
        <div className="section-head">
          <h2>Weekend escapes</h2>
          <Link to="/saved" className="link">Saved</Link>
        </div>
        <div className="card escapes">
          {ESCAPES.map((id) => byId(id)).map((d) => d && (
            <Link key={d.id} to={`/destination/${d.id}`} className="row">
              <img src={d.thumb} alt="" />
              <span className="row-body"><strong>{d.name}</strong><span>{d.country} · {d.flight} flight</span></span>
              <span className="row-end"><strong>{euro(d.price)}</strong><span>per night</span></span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

import "../styles/search.css";
import { Search, TrendingUp } from "lucide-react";
import { PRODUCTS, TRENDING, money } from "../data";
import RowItem from "../components/RowItem";

export default function SearchScreen() {
  return (
    <main className="app-main search-screen">
      <div className="searchbar live">
        <Search size={18} strokeWidth={1.9} aria-hidden /><input placeholder="Search makers, goods, gifts" aria-label="Search" />
      </div>

      <div className="section-head"><h2>Trending now</h2></div>
      <div className="chips wrap">
        {TRENDING.map((t) => (
          <button key={t} className="chip"><TrendingUp size={16} strokeWidth={1.9} aria-hidden /> {t}</button>
        ))}
      </div>

      <div className="section-head"><h2>Popular picks</h2></div>
      <section className="card">
        {PRODUCTS.map((p) => (
          <RowItem key={p.id} product={p} title={p.name} sub={<span>{p.label}</span>}>
            <span className="price">{money(p.price)}</span>
          </RowItem>
        ))}
      </section>
    </main>
  );
}

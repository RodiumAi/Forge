import "../styles/home.css";
import { ArrowRight, Search } from "lucide-react";
import { CHIPS, PRODUCTS } from "../data";
import ProductCard from "../components/ProductCard";

type Props = {
  chip: string;
  onChip: (chip: string) => void;
  onSearch: () => void;
  onAdd: (id: string) => void;
};

export default function HomeScreen({ chip, onChip, onSearch, onAdd }: Props) {
  return (
    <main className="app-main home-screen">
      <button className="searchbar" onClick={onSearch}>
        <Search size={18} strokeWidth={1.9} aria-hidden /><span>Search makers, goods, gifts</span>
      </button>

      <div className="chips" role="tablist">
        {CHIPS.map((c) => (
          <button key={c} className={c === chip ? "chip on" : "chip"} onClick={() => onChip(c)}>{c}</button>
        ))}
      </div>

      <div className="promo">
        <div className="promo-copy">
          <span className="promo-tag">Autumn edit</span>
          <h2>Up to 30% off<br />makers we love</h2>
          <span className="promo-cta">Shop the edit <ArrowRight size={14} strokeWidth={2.4} aria-hidden /></span>
        </div>
        <span className="promo-orb" aria-hidden />
      </div>

      <div className="section-head"><h2>Fresh finds</h2><a href="#" onClick={(e) => { e.preventDefault(); onChip("New"); }}>See all</a></div>
      <div className="grid">
        {PRODUCTS.map((p) => <ProductCard key={p.id} product={p} onAdd={() => onAdd(p.id)} />)}
      </div>
    </main>
  );
}

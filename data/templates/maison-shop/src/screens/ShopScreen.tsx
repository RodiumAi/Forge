import "../styles/shop.css";
import { useState } from "react";
import ProductCard from "../components/ProductCard";
import { CATEGORIES, PRODUCTS, type Category } from "../data";

type Sort = "Featured" | "Price up" | "Price down";
const SORTS: Sort[] = ["Featured", "Price up", "Price down"];

export default function ShopScreen() {
  const [cat, setCat] = useState<Category>("All");
  const [sort, setSort] = useState<Sort>("Featured");

  const list = PRODUCTS.filter((p) => cat === "All" || p.category === cat).slice();
  if (sort === "Price up") list.sort((a, b) => a.price - b.price);
  if (sort === "Price down") list.sort((a, b) => b.price - a.price);

  return (
    <main className="app-main shop-screen">
      <div className="shop-head">
        <h2>{cat === "All" ? "Everything" : cat}</h2>
        <p className="label">{list.length} {list.length === 1 ? "piece" : "pieces"}</p>
      </div>

      <div className="chips" role="tablist" aria-label="Categories">
        {CATEGORIES.map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? "chip on" : "chip"} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>

      <div className="sortbar">
        <span className="label">Sort</span>
        <div className="sorts">
          {SORTS.map((s) => (
            <button key={s} className={s === sort ? "sort on" : "sort"} onClick={() => setSort(s)} aria-pressed={s === sort}>{s}</button>
          ))}
        </div>
      </div>

      {list.length ? (
        <div className="grid">
          {list.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      ) : (
        <p className="muted empty">Nothing in {cat} this week. New pieces land every Thursday.</p>
      )}
    </main>
  );
}

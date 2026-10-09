import { Plus } from "lucide-react";
import { money, type Product } from "../data";

/* Product tile of the Home grid with a quick add-to-cart button. */
export default function ProductCard({ product: p, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <article className="product">
      <div className="thumb" style={{ backgroundImage: p.grad }}>
        <img src={p.img} alt="" loading="lazy" />
      </div>
      <div className="pmeta">
        <strong>{p.name}</strong>
        <span>{p.label}</span>
      </div>
      <div className="prow">
        <span className="price">{money(p.price)}</span>
        <button className="add" aria-label={`Add ${p.name} to cart`} onClick={onAdd}><Plus size={18} strokeWidth={2.1} aria-hidden /></button>
      </div>
    </article>
  );
}

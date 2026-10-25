import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { euro, type Product } from "../data";
import { useShop } from "./Shop";

type Props = { p: Product; wide?: boolean };

/** Portrait product photo with a heart, serif name, rust price. */
export default function ProductCard({ p, wide = false }: Props) {
  const { isWished, toggleWish } = useShop();
  const on = isWished(p.id);
  return (
    <div className={wide ? "product-card wide" : "product-card"}>
      <Link to={`/product/${p.id}`} className="pc-link">
        <span className="pc-photo">
          <img src={p.images[0]} alt="" loading="lazy" />
          {p.badge && <span className="pc-badge">{p.badge}</span>}
        </span>
        <span className="pc-cat">{p.category}</span>
        <strong className="pc-name">{p.name}</strong>
        <span className="pc-price">{euro(p.price)}{p.was && <s>{euro(p.was)}</s>}</span>
      </Link>
      <button className={on ? "pc-heart on" : "pc-heart"} onClick={() => toggleWish(p.id)} aria-pressed={on} aria-label={on ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}>
        <Heart size={17} strokeWidth={1.8} fill={on ? "currentColor" : "none"} aria-hidden />
      </button>
    </div>
  );
}

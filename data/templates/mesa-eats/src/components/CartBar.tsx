import { ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import { CURRENCY, findRestaurant, fcfa } from "../data";
import { useCart } from "./Cart";

type Props = { docked?: boolean };

/** "View cart" bar, only while the cart has something in it. Floats above the tab bar, or docks at the bottom on stack screens. */
export default function CartBar({ docked = false }: Props) {
  const { count, subtotal, restaurantId } = useCart();
  if (!count) return null;
  const r = findRestaurant(restaurantId ?? undefined);
  return (
    <div className={docked ? "cart-bar docked" : "cart-bar"}>
      <Link to="/cart" className="cart-bar-btn">
        <span className="cart-bag"><ShoppingBag size={19} strokeWidth={2.2} aria-hidden /><b>{count}</b></span>
        <span className="cart-bar-text">
          <strong>View cart</strong>
          {r && <small>{r.name}</small>}
        </span>
        <span className="cart-bar-total">{fcfa(subtotal)} {CURRENCY}</span>
      </Link>
    </div>
  );
}

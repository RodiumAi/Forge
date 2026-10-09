import { ShoppingBag } from "lucide-react";
import { AVATAR, type Tab } from "../data";
import CartBadge from "./CartBadge";

const TITLES: Record<Tab, string> = { home: "Trove", search: "Search", cart: "Your cart", account: "Account" };

type Props = { tab: Tab; cartCount: number; onCart: () => void };

export default function AppNavbar({ tab, cartCount, onCart }: Props) {
  const subs: Record<Tab, string> = {
    home: "Curated for Léa",
    search: "Find something good",
    cart: `${cartCount} item${cartCount === 1 ? "" : "s"}`,
    account: "Léa Moreau",
  };
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp"><img src={AVATAR} alt="" /></span>
        <div>
          <h1>{TITLES[tab]}</h1>
          <p className="sub">{subs[tab]}</p>
        </div>
      </div>
      <button className="nav-action" aria-label={`Cart, ${cartCount} items`} onClick={onCart}>
        <ShoppingBag size={22} strokeWidth={1.8} aria-hidden />
        <CartBadge count={cartCount} />
      </button>
    </header>
  );
}

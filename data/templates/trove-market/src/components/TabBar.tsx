import { House, Search, ShoppingBag, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tab } from "../data";
import CartBadge from "./CartBadge";

const TABS: { id: Tab; label: string; Icon: LucideIcon; fillOpacity: number }[] = [
  { id: "home", label: "Home", Icon: House, fillOpacity: 0.16 },
  { id: "search", label: "Search", Icon: Search, fillOpacity: 0.14 },
  { id: "cart", label: "Cart", Icon: ShoppingBag, fillOpacity: 0.14 },
  { id: "account", label: "Account", Icon: User, fillOpacity: 0.16 },
];

type Props = { tab: Tab; cartCount: number; onChange: (tab: Tab) => void };

export default function TabBar({ tab, cartCount, onChange }: Props) {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, Icon, fillOpacity }) => {
        const active = tab === id;
        const icon = (
          <Icon
            size={22}
            strokeWidth={1.8}
            fill={active ? "currentColor" : "none"}
            fillOpacity={active ? fillOpacity : 0}
            aria-hidden
          />
        );
        return (
          <button
            key={id}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            {id === "cart" ? (
              <span className="tab-ic">
                {icon}
                <CartBadge count={cartCount} />
              </span>
            ) : icon}
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

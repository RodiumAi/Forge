import { NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";
import { useShop } from "./Shop";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Discover" },
  { id: "shop", label: "Shop" },
  { id: "bag", label: "Bag" },
  { id: "profile", label: "Profile" },
];

/** Minimal ecru bar: hairline top border, tiny uppercase labels, an underline on the active tab. */
export default function TabBar() {
  const { count } = useShop();
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label }) => (
        <NavLink key={id} to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          {label}
          {id === "bag" && count > 0 && <span className="tab-count" aria-label={`${count} items`}>{count}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

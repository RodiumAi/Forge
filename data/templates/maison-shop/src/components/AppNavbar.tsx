import { Bell, Search } from "lucide-react";
import { TITLES, type Tab } from "../data";

type Props = { tab: Tab };

/** Centered serif masthead on Discover, left-aligned title elsewhere. */
export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className={home ? "app-navbar masthead" : "app-navbar"}>
      <button className="nav-action" aria-label="Search"><Search size={19} strokeWidth={1.6} aria-hidden /></button>
      <h1 className={home ? "wordmark" : "screen-title"}>{home ? "Maison" : TITLES[tab]}</h1>
      <button className="nav-action" aria-label="Notifications">
        <Bell size={19} strokeWidth={1.6} aria-hidden />
        <span className="nav-dot" aria-hidden />
      </button>
    </header>
  );
}

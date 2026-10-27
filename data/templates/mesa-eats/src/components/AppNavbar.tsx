import { Bell, ChevronDown, MapPin } from "lucide-react";
import { ADDRESS, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

/** Home shows the delivery address; other tabs show their title. */
export default function AppNavbar({ tab }: Props) {
  if (tab !== "home") {
    return (
      <header className="app-navbar">
        <h1 className="screen-title">{TITLES[tab]}</h1>
      </header>
    );
  }
  return (
    <header className="app-navbar">
      <button className="deliver" aria-label={`Deliver to ${ADDRESS.line}, change address`}>
        <span className="deliver-pin"><MapPin size={18} strokeWidth={2.2} aria-hidden /></span>
        <span className="deliver-text">
          <small>Deliver to {ADDRESS.label}</small>
          <strong>{ADDRESS.line}<ChevronDown size={16} strokeWidth={2.4} aria-hidden /></strong>
        </span>
      </button>
      <button className="nav-action" aria-label="Notifications">
        <Bell size={20} strokeWidth={2} aria-hidden />
        <span className="nav-dot" aria-hidden />
      </button>
    </header>
  );
}

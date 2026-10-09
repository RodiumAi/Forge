import { Calendar, ChevronLeft } from "lucide-react";
import { SUBS, TITLES, type Tab } from "../data";

type Props = { tab: Tab; onBack: () => void };

export default function AppNavbar({ tab, onBack }: Props) {
  return (
    <header className="app-navbar">
      <div className="who">
        {tab === "add"
          ? <button className="nav-action ghost" aria-label="Back" onClick={onBack}><ChevronLeft size={20} strokeWidth={1.9} aria-hidden /></button>
          : <span className="mark" aria-hidden>k</span>}
        <div>
          <h1>{TITLES[tab]}</h1>
          <p className="sub">{SUBS[tab]}</p>
        </div>
      </div>
      {tab !== "add" && (
        <button className="nav-action" aria-label="Change month"><Calendar size={20} strokeWidth={1.8} aria-hidden /></button>
      )}
    </header>
  );
}

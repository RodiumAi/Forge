import { Compass, House, SquarePlus, User } from "lucide-react";
import type { Tab } from "../data";

/* fill = tint of the active icon. */
const TABS = [
  { id: "home" as Tab, label: "Home", icon: House, fill: 0.16 },
  { id: "explore" as Tab, label: "Explore", icon: Compass, fill: 0.14 },
  { id: "add" as Tab, label: "Add", icon: SquarePlus, fill: 0.14 },
  { id: "profile" as Tab, label: "Profile", icon: User, fill: 0.16 },
];

type Props = { tab: Tab; onChange: (tab: Tab) => void };

export default function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon, fill }) => {
        const active = tab === id;
        return (
          <button key={id} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined} onClick={() => onChange(id)}>
            <Icon size={22} strokeWidth={1.8} fill={active ? "currentColor" : "none"} fillOpacity={active ? fill : 0} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

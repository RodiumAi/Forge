import { Activity, CreditCard, House, User } from "lucide-react";
import type { Tab } from "../data";

/* fill = tint of the active icon; idle = opacity of the idle icon. */
const TABS = [
  { id: "home" as Tab, label: "Home", icon: House, fill: 0.16, idle: 1 },
  { id: "cards" as Tab, label: "Cards", icon: CreditCard, fill: 0.14, idle: 1 },
  { id: "activity" as Tab, label: "Activity", icon: Activity, fill: 0, idle: 0.9 },
  { id: "account" as Tab, label: "Account", icon: User, fill: 0.16, idle: 1 },
];

type Props = { tab: Tab; onChange: (tab: Tab) => void };

export default function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon, fill, idle }) => {
        const active = tab === id;
        return (
          <button key={id} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined} onClick={() => onChange(id)}>
            <Icon
              size={22}
              strokeWidth={1.8}
              fill={active && fill ? "currentColor" : "none"}
              fillOpacity={active ? fill : 0}
              opacity={active ? 1 : idle}
              aria-hidden
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

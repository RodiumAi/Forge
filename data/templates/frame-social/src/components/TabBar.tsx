import { Compass, House, SquarePlus, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Tab } from "../data";

const TABS: { id: Tab; label: string; Icon: LucideIcon; fillOpacity: number }[] = [
  { id: "feed", label: "Feed", Icon: House, fillOpacity: 0.14 },
  { id: "explore", label: "Explore", Icon: Compass, fillOpacity: 0.12 },
  { id: "create", label: "Create", Icon: SquarePlus, fillOpacity: 0.12 },
  { id: "profile", label: "Profile", Icon: User, fillOpacity: 0.14 },
];

type Props = { tab: Tab; onChange: (tab: Tab) => void };

export default function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, Icon, fillOpacity }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            className={active ? "tab active" : "tab"}
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            <Icon
              size={22}
              strokeWidth={1.8}
              fill={active ? "currentColor" : "none"}
              fillOpacity={active ? fillOpacity : 0}
              aria-hidden
            />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

import { History, MessageSquare, Sparkle, User } from "lucide-react";
import type { Tab } from "../data";

/* fill = tint of the active icon. */
const TABS = [
  { id: "chat" as Tab, label: "Chat", icon: MessageSquare, fill: 0.16 },
  { id: "prompts" as Tab, label: "Prompts", icon: Sparkle, fill: 0.16 },
  { id: "history" as Tab, label: "History", icon: History, fill: 0 },
  { id: "account" as Tab, label: "Account", icon: User, fill: 0.16 },
];

type Props = { tab: Tab; onChange: (tab: Tab) => void };

export default function TabBar({ tab, onChange }: Props) {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.map(({ id, label, icon: Icon, fill }) => {
        const active = tab === id;
        return (
          <button key={id} className={active ? "tab active" : "tab"} aria-current={active ? "page" : undefined} onClick={() => onChange(id)}>
            <Icon size={22} strokeWidth={1.8} fill={active && fill ? "currentColor" : "none"} fillOpacity={active ? fill : 0} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

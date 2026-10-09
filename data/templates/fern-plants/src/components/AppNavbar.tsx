import { Bell, Sprout } from "lucide-react";

type Props = { title: string; sub: string };

export default function AppNavbar({ title, sub }: Props) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp" aria-hidden><Sprout size={18} strokeWidth={1.8} aria-hidden /></span>
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="Notifications"><Bell size={20} strokeWidth={1.8} aria-hidden /></button>
    </header>
  );
}

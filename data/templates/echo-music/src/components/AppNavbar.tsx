import { Settings } from "lucide-react";

type Props = { title: string; sub: string };

export default function AppNavbar({ title, sub }: Props) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp">M</span>
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="Settings"><Settings size={20} strokeWidth={1.7} aria-hidden /></button>
    </header>
  );
}

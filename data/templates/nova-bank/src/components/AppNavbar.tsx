import { Bell } from "lucide-react";
import { AVATAR_URL } from "../data";

type Props = { title: string; sub: string };

export default function AppNavbar({ title, sub }: Props) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp"><img src={AVATAR_URL} alt="" /></span>
        <div>
          <h1>{title}</h1>
          <p className="sub">{sub}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="Notifications"><Bell size={20} strokeWidth={1.8} aria-hidden /></button>
    </header>
  );
}

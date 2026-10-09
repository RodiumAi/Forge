import { Plus } from "lucide-react";
import SparkIcon from "./SparkIcon";

type Props = { title: string; sub: string; live: boolean; onNewChat: () => void };

export default function AppNavbar({ title, sub, live, onNewChat }: Props) {
  return (
    <header className="app-navbar">
      <div className="who">
        <span className="pfp accent" aria-hidden><SparkIcon /></span>
        <div>
          <h1>{title}</h1>
          <p className="sub">{live ? <><i className="live" />{sub}</> : sub}</p>
        </div>
      </div>
      <button className="nav-action" aria-label="New chat" onClick={onNewChat}><Plus size={20} strokeWidth={1.9} aria-hidden /></button>
    </header>
  );
}

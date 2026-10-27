import { SquarePen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ME, TITLES, type Tab } from "../data";
import { useChats } from "./ChatProvider";
import Orb from "./Orb";

type Props = { tab: Tab };

export default function AppNavbar({ tab }: Props) {
  const navigate = useNavigate();
  const { start } = useChats();
  const home = tab === "home";

  return (
    <header className="app-navbar">
      {home ? (
        <span className="wordmark"><Orb size="xs" /> Nova</span>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        <button className="nav-action" onClick={() => navigate(`/chat/${start("")}`)} aria-label="New chat">
          <SquarePen size={18} strokeWidth={1.9} aria-hidden />
        </button>
        {home && <img className="pfp" src={ME.avatar} alt="" />}
      </div>
    </header>
  );
}

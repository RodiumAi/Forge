import { Bell, Mic } from "lucide-react";
import { HOME, ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

/** Top bar. On Home it turns transparent so the warm room photo shows through. */
export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className={home ? "app-navbar on-photo" : "app-navbar"}>
      {home ? (
        <div className="who">
          <span className="pfp"><img src={ME.avatar} alt="" /></span>
          <div>
            <p className="hello">{HOME.name}, {HOME.city}</p>
            <h1>Good evening, {ME.first}</h1>
          </div>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        {home && (
          <button className="nav-action" aria-label="Voice control"><Mic size={19} strokeWidth={1.9} aria-hidden /></button>
        )}
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.9} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}

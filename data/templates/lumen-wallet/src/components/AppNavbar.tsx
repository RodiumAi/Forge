import { Bell, ScanLine } from "lucide-react";
import { ME, TITLES, type Tab } from "../data";

type Props = { tab: Tab };

export default function AppNavbar({ tab }: Props) {
  const home = tab === "home";
  return (
    <header className="app-navbar">
      {home ? (
        <div className="who">
          <span className="pfp"><img src={ME.avatar} alt="" /></span>
          <div>
            <p className="hello">Good evening</p>
            <h1>{ME.first}</h1>
          </div>
        </div>
      ) : (
        <h1 className="screen-title">{TITLES[tab]}</h1>
      )}
      <div className="nav-actions">
        {home && (
          <button className="nav-action" aria-label="Scan to pay"><ScanLine size={19} strokeWidth={1.9} aria-hidden /></button>
        )}
        <button className="nav-action" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.9} aria-hidden />
          <span className="nav-dot" aria-hidden />
        </button>
      </div>
    </header>
  );
}

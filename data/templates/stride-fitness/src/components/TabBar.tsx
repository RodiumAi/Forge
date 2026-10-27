import { ChartColumn, Dumbbell, Footprints, House, UserRound } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { PATHS, type Tab } from "../data";

const TABS: { id: Tab; label: string; icon: typeof House }[] = [
  { id: "home", label: "Today", icon: House },
  { id: "workouts", label: "Workouts", icon: Dumbbell },
  { id: "stats", label: "Stats", icon: ChartColumn },
  { id: "profile", label: "Profile", icon: UserRound },
];

function TabLink({ id, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <NavLink to={PATHS[id]} end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
      <Icon size={21} strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}

/** Dark bar with a raised orange center button that starts a live run. */
export default function TabBar() {
  return (
    <nav className="app-tabbar" aria-label="Primary">
      {TABS.slice(0, 2).map((t) => <TabLink key={t.id} {...t} />)}
      <Link to="/run" className="run-btn" aria-label="Start a run">
        <Footprints size={26} strokeWidth={2.2} aria-hidden />
      </Link>
      {TABS.slice(2).map((t) => <TabLink key={t.id} {...t} />)}
    </nav>
  );
}

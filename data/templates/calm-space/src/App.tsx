import { useEffect, useState } from "react";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, SUBS, TITLES, type Tab } from "./data";
import ExploreScreen from "./screens/ExploreScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SleepScreen from "./screens/SleepScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [reminder, setReminder] = useState(true);
  const [breathing, setBreathing] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen breathing={breathing} onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar title={TITLES[tab]} sub={SUBS[tab]} />
      {tab === "home" && (
        <HomeScreen breathing={breathing} onToggleBreathing={() => setBreathing((v) => !v)} onExplore={() => setTab("explore")} />
      )}
      {tab === "explore" && <ExploreScreen />}
      {tab === "sleep" && <SleepScreen reminder={reminder} onToggleReminder={() => setReminder((v) => !v)} />}
      {tab === "profile" && <ProfileScreen />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

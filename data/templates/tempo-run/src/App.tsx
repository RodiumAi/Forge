import { useEffect, useState } from "react";
import { ONBOARD_KEY, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import RunsScreen from "./screens/RunsScreen";
import StatsScreen from "./screens/StatsScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [autoPause, setAutoPause] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar tab={tab} />

      {tab === "home" && <HomeScreen onAllRuns={() => setTab("runs")} />}
      {tab === "runs" && <RunsScreen />}
      {tab === "stats" && <StatsScreen />}
      {tab === "profile" && <ProfileScreen autoPause={autoPause} onAutoPause={() => setAutoPause((v) => !v)} />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

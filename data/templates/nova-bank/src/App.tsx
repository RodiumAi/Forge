import { useEffect, useState } from "react";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, SUBS, TITLES, type Tab } from "./data";
import AccountScreen from "./screens/AccountScreen";
import ActivityScreen from "./screens/ActivityScreen";
import CardsScreen from "./screens/CardsScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [frozen, setFrozen] = useState(false);

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
      <AppNavbar title={TITLES[tab]} sub={SUBS[tab]} />
      {tab === "home" && <HomeScreen onSeeAll={() => setTab("activity")} />}
      {tab === "cards" && <CardsScreen frozen={frozen} onToggleFrozen={() => setFrozen((v) => !v)} />}
      {tab === "activity" && <ActivityScreen />}
      {tab === "account" && <AccountScreen />}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

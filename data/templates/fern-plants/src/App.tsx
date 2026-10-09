import { useEffect, useState } from "react";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import { EMPTY_FORM, ONBOARD_KEY, SUBS, TITLES, type PlantForm, type Tab } from "./data";
import AddScreen from "./screens/AddScreen";
import ExploreScreen from "./screens/ExploreScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [watered, setWatered] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState(true);
  const [notify, setNotify] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<PlantForm>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

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
      {tab === "home" && (
        <HomeScreen
          watered={watered}
          onToggleWatered={(id) => setWatered((w) => ({ ...w, [id]: !w[id] }))}
          onGuides={() => setTab("explore")}
        />
      )}
      {tab === "explore" && <ExploreScreen query={query} onQuery={setQuery} />}
      {tab === "add" && <AddScreen form={form} saved={saved} onForm={setForm} onSaved={setSaved} />}
      {tab === "profile" && (
        <ProfileScreen
          reminders={reminders}
          notify={notify}
          onToggleReminders={() => setReminders((v) => !v)}
          onToggleNotify={() => setNotify((v) => !v)}
        />
      )}
      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

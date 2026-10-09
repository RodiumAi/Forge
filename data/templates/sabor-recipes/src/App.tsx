import { useEffect, useState } from "react";
import { ONBOARD_KEY, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import SavedScreen from "./screens/SavedScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [cat, setCat] = useState("Breakfast");
  const [cuisine, setCuisine] = useState("All");
  const [query, setQuery] = useState("");

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

      {tab === "home" && <HomeScreen cat={cat} onCat={setCat} onSeeAll={() => setTab("search")} />}
      {tab === "search" && <SearchScreen query={query} cuisine={cuisine} onQuery={setQuery} onCuisine={setCuisine} />}
      {tab === "saved" && <SavedScreen />}
      {tab === "profile" && <ProfileScreen />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

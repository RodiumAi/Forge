import { useEffect, useState } from "react";
import { ONBOARD_KEY, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import AddScreen from "./screens/AddScreen";
import StatsScreen from "./screens/StatsScreen";
import AccountScreen from "./screens/AccountScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [amount, setAmount] = useState("12.50");
  const [chip, setChip] = useState("Groceries");
  const [note, setNote] = useState("");

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function press(k: string) {
    setAmount((v) => {
      if (k === "del") return v.length > 1 ? v.slice(0, -1) : "0";
      if (k === "." && v.includes(".")) return v;
      if (v === "0" && k !== ".") return k;
      return v.length >= 8 ? v : v + k;
    });
  }

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar tab={tab} onBack={() => setTab("home")} />

      {tab === "home" && <HomeScreen onStats={() => setTab("stats")} />}
      {tab === "add" && (
        <AddScreen
          amount={amount}
          chip={chip}
          note={note}
          onKey={press}
          onChip={setChip}
          onNote={setNote}
          onSave={() => setTab("home")}
        />
      )}
      {tab === "stats" && <StatsScreen />}
      {tab === "account" && <AccountScreen />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

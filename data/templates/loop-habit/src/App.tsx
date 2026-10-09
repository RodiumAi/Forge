import { useEffect, useState } from "react";
import { INITIAL_HABITS, ONBOARD_KEY, type Habit, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import TodayScreen from "./screens/TodayScreen";
import HabitsScreen from "./screens/HabitsScreen";
import StatsScreen from "./screens/StatsScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function toggle(id: string) {
    setHabits((list) =>
      list.map((h) =>
        h.id === id
          ? { ...h, done: !h.done, streak: h.done ? h.streak - 1 : h.streak + 1 }
          : h
      )
    );
  }

  const totalDays = habits.reduce((n, h) => n + h.streak, 0);

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar tab={tab} />

      {tab === "today" && <TodayScreen habits={habits} onToggle={toggle} onManage={() => setTab("habits")} />}
      {tab === "habits" && <HabitsScreen habits={habits} />}
      {tab === "stats" && <StatsScreen />}
      {tab === "profile" && (
        <ProfileScreen totalDays={totalDays} reminders={reminders} onReminders={() => setReminders((v) => !v)} />
      )}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

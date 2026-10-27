import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavbar from "./components/AppNavbar";
import AppShell from "./components/AppShell";
import { HabitsProvider } from "./components/HabitsState";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, tabFromPath } from "./data";
import HabitScreen from "./screens/HabitScreen";
import HabitsScreen from "./screens/HabitsScreen";
import HomeScreen from "./screens/HomeScreen";
import NewHabitScreen from "./screens/NewHabitScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import StatsScreen from "./screens/StatsScreen";

function readOnboarded() {
  try { return localStorage.getItem(ONBOARD_KEY) === "1"; } catch { return false; }
}

export default function App() {
  const navigate = useNavigate();
  const tab = tabFromPath(useLocation().pathname);
  const [onboarded, setOnboarded] = useState(readOnboarded);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch { /* private mode */ }
    setOnboarded(true);
    navigate("/", { replace: true });
  }

  function signOut() {
    try { localStorage.removeItem(ONBOARD_KEY); } catch { /* private mode */ }
    setOnboarded(false);
    navigate("/onboarding", { replace: true });
  }

  const gate = (el: ReactElement) => (onboarded ? el : <Navigate to="/onboarding" replace />);

  return (
    <HabitsProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen onFinish={finish} />} />
        <Route path="/habit/:id" element={gate(<HabitScreen />)} />
        <Route path="/new-habit" element={gate(<NewHabitScreen />)} />
        <Route element={<AppShell onboarded={onboarded} top={<AppNavbar tab={tab} />} bottom={<TabBar />} />}>
          <Route index element={<HomeScreen />} />
          <Route path="/habits" element={<HabitsScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/profile" element={<ProfileScreen onSignOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HabitsProvider>
  );
}

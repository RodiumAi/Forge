import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavbar from "./components/AppNavbar";
import AppShell from "./components/AppShell";
import ShelfProvider from "./components/ShelfProvider";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, tabFromPath } from "./data";
import BookScreen from "./screens/BookScreen";
import DiscoverScreen from "./screens/DiscoverScreen";
import HomeScreen from "./screens/HomeScreen";
import LibraryScreen from "./screens/LibraryScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ReaderScreen from "./screens/ReaderScreen";

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

  const gate = (screen: ReactElement) => (onboarded ? screen : <Navigate to="/onboarding" replace />);

  return (
    <ShelfProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen onFinish={finish} />} />
        <Route path="/book/:id" element={gate(<BookScreen />)} />
        <Route path="/reader/:id" element={gate(<ReaderScreen />)} />
        <Route element={<AppShell onboarded={onboarded} top={<AppNavbar tab={tab} />} bottom={<TabBar />} />}>
          <Route index element={<HomeScreen />} />
          <Route path="/discover" element={<DiscoverScreen />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/profile" element={<ProfileScreen onSignOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShelfProvider>
  );
}

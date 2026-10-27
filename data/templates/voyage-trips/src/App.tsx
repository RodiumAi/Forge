import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavbar from "./components/AppNavbar";
import AppShell from "./components/AppShell";
import { FavoritesProvider } from "./components/Favorites";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, tabFromPath } from "./data";
import BookingScreen from "./screens/BookingScreen";
import DestinationScreen from "./screens/DestinationScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SavedScreen from "./screens/SavedScreen";
import TripsScreen from "./screens/TripsScreen";

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
    <FavoritesProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen onFinish={finish} />} />
        <Route path="/destination/:id" element={gate(<DestinationScreen />)} />
        <Route path="/booking/:id" element={gate(<BookingScreen />)} />
        <Route element={<AppShell onboarded={onboarded} top={<AppNavbar tab={tab} />} bottom={<TabBar />} />}>
          <Route index element={<HomeScreen />} />
          <Route path="/saved" element={<SavedScreen />} />
          <Route path="/trips" element={<TripsScreen />} />
          <Route path="/profile" element={<ProfileScreen onSignOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FavoritesProvider>
  );
}

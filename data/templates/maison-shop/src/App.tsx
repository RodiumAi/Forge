import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavbar from "./components/AppNavbar";
import AppShell from "./components/AppShell";
import { ShopProvider } from "./components/Shop";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, tabFromPath } from "./data";
import BagScreen from "./screens/BagScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import ProductScreen from "./screens/ProductScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ShopScreen from "./screens/ShopScreen";

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
    <ShopProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen onFinish={finish} />} />
        <Route path="/product/:id" element={gate(<ProductScreen />)} />
        <Route element={<AppShell onboarded={onboarded} top={<AppNavbar tab={tab} />} bottom={<TabBar />} />}>
          <Route index element={<HomeScreen />} />
          <Route path="/shop" element={<ShopScreen />} />
          <Route path="/bag" element={<BagScreen />} />
          <Route path="/profile" element={<ProfileScreen onSignOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ShopProvider>
  );
}

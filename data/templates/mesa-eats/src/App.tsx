import { useState, type ReactElement } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AppNavbar from "./components/AppNavbar";
import AppShell from "./components/AppShell";
import { CartProvider } from "./components/Cart";
import CartBar from "./components/CartBar";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, tabFromPath } from "./data";
import CartScreen from "./screens/CartScreen";
import HomeScreen from "./screens/HomeScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import OrdersScreen from "./screens/OrdersScreen";
import ProfileScreen from "./screens/ProfileScreen";
import RestaurantScreen from "./screens/RestaurantScreen";
import SearchScreen from "./screens/SearchScreen";

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
  const showCartBar = tab === "home" || tab === "search";

  return (
    <CartProvider>
      <Routes>
        <Route path="/onboarding" element={<OnboardingScreen onFinish={finish} />} />
        <Route path="/restaurant/:id" element={gate(<RestaurantScreen />)} />
        <Route path="/cart" element={gate(<CartScreen />)} />
        <Route
          element={
            <AppShell
              onboarded={onboarded}
              top={<AppNavbar tab={tab} />}
              bottom={<>{showCartBar && <CartBar />}<TabBar /></>}
            />
          }
        >
          <Route index element={<HomeScreen />} />
          <Route path="/search" element={<SearchScreen />} />
          <Route path="/orders" element={<OrdersScreen />} />
          <Route path="/profile" element={<ProfileScreen onSignOut={signOut} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CartProvider>
  );
}

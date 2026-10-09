import { useEffect, useState } from "react";
import { ONBOARD_KEY, type Cart, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import CartScreen from "./screens/CartScreen";
import AccountScreen from "./screens/AccountScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [chip, setChip] = useState("New");
  const [cart, setCart] = useState<Cart>({ watch: 1, tee: 2 });

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }
  function bump(id: string, delta: number) {
    setCart((c) => {
      const next = (c[id] || 0) + delta;
      const copy = { ...c };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar tab={tab} cartCount={cartCount} onCart={() => setTab("cart")} />

      {tab === "home" && <HomeScreen chip={chip} onChip={setChip} onSearch={() => setTab("search")} onAdd={add} />}
      {tab === "search" && <SearchScreen />}
      {tab === "cart" && <CartScreen cart={cart} onBump={bump} onShop={() => setTab("home")} />}
      {tab === "account" && <AccountScreen />}

      <TabBar tab={tab} cartCount={cartCount} onChange={setTab} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { ONBOARD_KEY, TITLES, type Tab } from "./data";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import OnboardingScreen from "./screens/OnboardingScreen";
import FeedScreen from "./screens/FeedScreen";
import ExploreScreen from "./screens/ExploreScreen";
import CreateScreen from "./screens/CreateScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("feed");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [caption, setCaption] = useState("");

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
      <AppNavbar title={TITLES[tab]} wordmark={tab === "feed"} />

      {tab === "feed" && (
        <FeedScreen
          liked={liked}
          saved={saved}
          onLike={(user) => setLiked((m) => ({ ...m, [user]: !m[user] }))}
          onSave={(user) => setSaved((m) => ({ ...m, [user]: !m[user] }))}
        />
      )}
      {tab === "explore" && <ExploreScreen />}
      {tab === "create" && <CreateScreen caption={caption} onCaption={setCaption} />}
      {tab === "profile" && <ProfileScreen />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

import { useEffect, useState } from "react";
import AppNavbar from "./components/AppNavbar";
import MiniPlayer from "./components/MiniPlayer";
import TabBar from "./components/TabBar";
import { ALBUMS, ONBOARD_KEY, SUBS, TITLES, type Tab, type Track } from "./data";
import HomeScreen from "./screens/HomeScreen";
import LibraryScreen from "./screens/LibraryScreen";
import NowPlayingScreen from "./screens/NowPlayingScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import SearchScreen from "./screens/SearchScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [playing, setPlaying] = useState(true);
  const [current, setCurrent] = useState<Track>(ALBUMS[0]);
  const [liked, setLiked] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function playTrack(t: Track) {
    setCurrent(t);
    setPlaying(true);
  }

  const togglePlay = () => setPlaying((v) => !v);

  if (!ready) return <div className="app-shell" />;
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar title={TITLES[tab]} sub={SUBS[tab]} />

      {tab === "home" && <HomeScreen onPlay={playTrack} onSeeAll={() => setTab("library")} />}
      {tab === "search" && <SearchScreen onPlay={playTrack} />}
      {tab === "library" && <LibraryScreen onPlay={playTrack} />}
      {tab === "now" && (
        <NowPlayingScreen current={current} playing={playing} liked={liked} onTogglePlay={togglePlay} onToggleLike={() => setLiked((v) => !v)} />
      )}

      {tab !== "now" && <MiniPlayer current={current} playing={playing} onOpen={() => setTab("now")} onToggle={togglePlay} />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

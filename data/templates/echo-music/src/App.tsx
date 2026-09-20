import { useEffect, useState } from "react";

/* ---- Inline icons (kit runs React-only: no icon packs) ---- */
function IconHome({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
    </svg>
  );
}
function IconSearch({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
function IconLibrary({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="6" height="16" rx="1.4" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M14 5.4 18.6 4.2a1 1 0 0 1 1.24.72l3 11.3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" opacity={active ? 1 : 0.9} />
    </svg>
  );
}
function IconWave({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" opacity={active ? 1 : 0.92}>
      <path d="M4 12v0M8 8v8M12 5v14M16 9v6M20 12v0" />
    </svg>
  );
}
function IconPlay({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5Z" fill="currentColor" /></svg>;
}
function IconPause({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></svg>;
}
function IconPrev() {
  return <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M7 6v12M18 6.7v10.6a1 1 0 0 1-1.52.85l-8.5-5.3a1 1 0 0 1 0-1.7l8.5-5.3A1 1 0 0 1 18 6.7Z" fill="currentColor" /><rect x="6" y="6" width="2" height="12" rx="1" fill="currentColor" /></svg>;
}
function IconNext() {
  return <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden><path d="M6 6.7v10.6a1 1 0 0 0 1.52.85l8.5-5.3a1 1 0 0 0 0-1.7l-8.5-5.3A1 1 0 0 0 6 6.7Z" fill="currentColor" /><rect x="16" y="6" width="2" height="12" rx="1" fill="currentColor" /></svg>;
}
function IconShuffle() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 4h4v4M21 4l-6.5 6.5M3 20l6-6M17 20h4v-4M14 14l4.5 4.5M3 4l5.5 5.5" /></svg>;
}
function IconRepeat() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l3 3-3 3M20 6H8a4 4 0 0 0-4 4v1M7 21l-3-3 3-3M4 18h12a4 4 0 0 0 4-4v-1" /></svg>;
}
function IconHeart({ filled }: { filled?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden><path d="M12 20s-7-4.4-9.3-8.6C1 8.1 2.6 5 5.8 5c2 0 3.2 1.1 4.2 2.4C11 6.1 12.2 5 14.2 5c3.2 0 4.8 3.1 3.1 6.4C19 15.6 12 20 12 20Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
function IconGear() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.3 7.3l2 1.2M17.7 15.5l2 1.2M4.3 16.7l2-1.2M17.7 8.5l2-1.2" /></svg>;
}
function IconDownload() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v10M8 10l4 4 4-4M5 19h14" /></svg>;
}

const ONBOARD_KEY = "echo_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "Your sound, uninterrupted", body: "Millions of tracks, zero clutter. Echo learns what you love and keeps it one tap away." },
  { kicker: "Offline", title: "Take your mixes offline", body: "Download playlists for the flight, the tunnel, the dead zone. The music never stops." },
  { kicker: "Lossless", title: "Hear every last detail", body: "Studio-grade lossless audio so the hi-hats shimmer and the bass actually lands." },
];

type Tab = "home" | "search" | "library" | "now";
type Track = { title: string; artist: string; g1: string; g2: string };

const ALBUMS: Track[] = [
  { title: "Neon Tide", artist: "Nadi Vaal", g1: "#ec4899", g2: "#6d28d9" },
  { title: "Slow Static", artist: "Kite Season", g1: "#3b82f6", g2: "#0e7490" },
  { title: "Midnight Bloom", artist: "Nadi Vaal", g1: "#f97316", g2: "#be123c" },
  { title: "Paper Moons", artist: "Solene", g1: "#22d3ee", g2: "#4338ca" },
  { title: "Dust & Gold", artist: "Kite Season", g1: "#eab308", g2: "#7c2d12" },
];

const PLAYLISTS = [
  { title: "Daily Mix 1", sub: "Nadi Vaal · Solene · Kite Season", g1: "#ec4899", g2: "#831843" },
  { title: "Late Night Drive", sub: "Synthwave · 42 tracks", g1: "#6366f1", g2: "#0c0a2e" },
  { title: "Focus Flow", sub: "Instrumental · 3 hr", g1: "#14b8a6", g2: "#134e4a" },
];

const GENRES = [
  { name: "Pop", g1: "#ec4899", g2: "#7c3aed" },
  { name: "Hip-Hop", g1: "#f59e0b", g2: "#b91c1c" },
  { name: "Chill", g1: "#22d3ee", g2: "#1e3a8a" },
  { name: "Electronic", g1: "#a855f7", g2: "#1e1b4b" },
  { name: "Jazz", g1: "#f97316", g2: "#78350f" },
  { name: "Indie", g1: "#34d399", g2: "#065f46" },
  { name: "R&B", g1: "#fb7185", g2: "#4c1d95" },
  { name: "Workout", g1: "#38bdf8", g2: "#0f766e" },
];

const LIBRARY = [
  { title: "Liked Songs", sub: "Playlist · 128 songs", g1: "#ec4899", g2: "#4c1d95", pinned: true },
  { title: "Nadi Vaal", sub: "Artist", g1: "#f97316", g2: "#be123c", round: true },
  { title: "Neon Tide", sub: "Album · Nadi Vaal", g1: "#ec4899", g2: "#6d28d9" },
  { title: "Late Night Drive", sub: "Playlist · 42 tracks", g1: "#6366f1", g2: "#0c0a2e" },
  { title: "Kite Season", sub: "Artist", g1: "#3b82f6", g2: "#0e7490", round: true },
  { title: "Paper Moons", sub: "Album · Solene", g1: "#22d3ee", g2: "#4338ca" },
];

function cover(g1: string, g2: string): string {
  return `radial-gradient(120% 120% at 20% 12%, ${g1}, transparent 60%), linear-gradient(150deg, ${g2}, #17121f 82%)`;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
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

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <span className="orb orb-a" />
          <span className="orb orb-b" />
          <div className="eq">
            {[38, 72, 52, 90, 44, 66, 30].map((h, i) => (
              <i key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        </div>
        <div className="onboard-body">
          <p className="onboard-kicker">{s.kicker}</p>
          <h2>{s.title}</h2>
          <p className="muted">{s.body}</p>
        </div>
        <div className="onboard-actions">
          <div className="dots" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
          </div>
          <button className="btn-primary" onClick={() => (last ? finish() : setSlide((n) => n + 1))}>
            {last ? "Start listening" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Echo", search: "Search", library: "Your Library", now: "Now Playing" };
  const subs: Record<Tab, string> = { home: "Good evening, Maya", search: "Find your next favourite", library: "Recently added", now: "From Neon Tide" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp">M</span>
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{subs[tab]}</p>
          </div>
        </div>
        <button className="nav-action" aria-label="Settings"><IconGear /></button>
      </header>

      <main className="app-main">
        {tab === "home" && (
          <>
            <div className="section-head"><h2>Recently played</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("library"); }}>See all</a></div>
            <div className="rail" role="list">
              {ALBUMS.map((a) => (
                <button className="tile" role="listitem" key={a.title} onClick={() => playTrack(a)}>
                  <span className="art" style={{ backgroundImage: cover(a.g1, a.g2) }} aria-hidden />
                  <strong>{a.title}</strong>
                  <span>{a.artist}</span>
                </button>
              ))}
            </div>

            <div className="section-head"><h2>Made for you</h2></div>
            <div className="plist">
              {PLAYLISTS.map((p) => (
                <button className="pcard" key={p.title} onClick={() => playTrack({ title: p.title, artist: "Echo Mix", g1: p.g1, g2: p.g2 })}>
                  <span className="art" style={{ backgroundImage: cover(p.g1, p.g2) }} aria-hidden><span className="play-dot"><IconPlay size={16} /></span></span>
                  <span className="meta"><strong>{p.title}</strong><span>{p.sub}</span></span>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "search" && (
          <>
            <label className="searchbar">
              <IconSearch />
              <input type="text" placeholder="Artists, songs, or podcasts" aria-label="Search" />
            </label>
            <div className="section-head"><h2>Browse all</h2></div>
            <div className="genres">
              {GENRES.map((g) => (
                <button className="genre" key={g.name} style={{ backgroundImage: cover(g.g1, g.g2) }} onClick={() => playTrack({ title: g.name, artist: "Genre radio", g1: g.g1, g2: g.g2 })}>
                  {g.name}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "library" && (
          <section className="card lib">
            {LIBRARY.map((l) => (
              <button className="tx" key={l.title} onClick={() => playTrack({ title: l.title, artist: l.sub.split(" · ")[0], g1: l.g1, g2: l.g2 })}>
                <span className={l.round ? "ava round" : "ava"} style={{ backgroundImage: cover(l.g1, l.g2) }} aria-hidden />
                <span className="meta">
                  <strong>{l.pinned ? "📌 " : ""}{l.title}</strong>
                  <span>{l.sub}</span>
                </span>
                <span className="play-mini" aria-hidden><IconPlay size={16} /></span>
              </button>
            ))}
          </section>
        )}

        {tab === "now" && (
          <div className="np">
            <div className="np-art" style={{ backgroundImage: cover(current.g1, current.g2) }} aria-hidden />
            <div className="np-head">
              <div className="np-title">
                <h2>{current.title}</h2>
                <p className="muted">{current.artist}</p>
              </div>
              <button className={liked ? "heart on" : "heart"} aria-pressed={liked} aria-label="Like" onClick={() => setLiked((v) => !v)}>
                <IconHeart filled={liked} />
              </button>
            </div>
            <div className="progress">
              <span className="track"><span className="fill" style={{ width: "36%" }} /></span>
              <div className="times"><span>1:24</span><span>3:52</span></div>
            </div>
            <div className="controls">
              <button className="ctl" aria-label="Shuffle"><IconShuffle /></button>
              <button className="ctl big" aria-label="Previous"><IconPrev /></button>
              <button className="ctl play" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((v) => !v)}>
                {playing ? <IconPause size={26} /> : <IconPlay size={26} />}
              </button>
              <button className="ctl big" aria-label="Next"><IconNext /></button>
              <button className="ctl" aria-label="Repeat"><IconRepeat /></button>
            </div>
            <button className="np-download"><IconDownload /> Download for offline · lossless</button>
          </div>
        )}
      </main>

      {tab !== "now" && (
        <button className="miniplayer" onClick={() => setTab("now")} aria-label="Open now playing">
          <span className="mp-art" style={{ backgroundImage: cover(current.g1, current.g2) }} aria-hidden />
          <span className="mp-meta"><strong>{current.title}</strong><span>{current.artist}</span></span>
          <span className="mp-play" role="button" aria-label={playing ? "Pause" : "Play"}
            onClick={(e) => { e.stopPropagation(); setPlaying((v) => !v); }}>
            {playing ? <IconPause size={20} /> : <IconPlay size={20} />}
          </span>
        </button>
      )}

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "search" ? "tab active" : "tab"} aria-current={tab === "search" ? "page" : undefined} onClick={() => setTab("search")}><IconSearch active={tab === "search"} /><span>Search</span></button>
        <button className={tab === "library" ? "tab active" : "tab"} aria-current={tab === "library" ? "page" : undefined} onClick={() => setTab("library")}><IconLibrary active={tab === "library"} /><span>Library</span></button>
        <button className={tab === "now" ? "tab active" : "tab"} aria-current={tab === "now" ? "page" : undefined} onClick={() => setTab("now")}><IconWave active={tab === "now"} /><span>Now</span></button>
      </nav>
    </div>
  );
}

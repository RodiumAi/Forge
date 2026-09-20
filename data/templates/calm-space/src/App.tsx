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
function IconExplore({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function IconMoon({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 13.5A8 8 0 1 1 10.5 4a6.4 6.4 0 0 0 9.5 9.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
    </svg>
  );
}
function IconUser({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconPlay() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 5.5 18 12 8 18.5V5.5Z" fill="currentColor" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconDownload() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "calmspace_onboard_done";
const SLIDES = [
  { kicker: "Breathe", title: "A calmer mind in minutes", body: "Short guided sessions that fit your day — no experience needed, just a quiet moment." },
  { kicker: "Guided", title: "Follow the breath", body: "Slow, looping breathing exercises to steady your nerves before anything that matters." },
  { kicker: "Rest", title: "Fall asleep, softly", body: "Sleep stories and gentle soundscapes that fade with you into deeper, easier rest." },
];

type Tab = "home" | "explore" | "sleep" | "profile";

const CATEGORIES = ["Focus", "Anxiety", "Sleep", "Walk"];

const SHORT_SESSIONS = [
  { name: "Morning clarity", meta: "Focus · 5 min", glyph: "☀" },
  { name: "Let go of tension", meta: "Anxiety · 8 min", glyph: "❋" },
  { name: "One quiet minute", meta: "Reset · 1 min", glyph: "◐" },
];

const EXPLORE = [
  { name: "Unwind after work", teacher: "with Maya Okonkwo", mins: "12 min", glyph: "❋" },
  { name: "Deep focus flow", teacher: "with Idris Bello", mins: "20 min", glyph: "◑" },
  { name: "Calm the racing mind", teacher: "with Lena Fischer", mins: "10 min", glyph: "✿" },
  { name: "Walking meditation", teacher: "with Sofia Marchetti", mins: "15 min", glyph: "❂" },
  { name: "Gratitude at dusk", teacher: "with Amara Diallo", mins: "8 min", glyph: "☾" },
];

const SOUNDS = [
  { name: "Gentle rain", meta: "Ambience · loops", glyph: "☂" },
  { name: "Ocean waves", meta: "Ambience · loops", glyph: "≈" },
  { name: "Night forest", meta: "Story · 28 min", glyph: "❁" },
  { name: "Distant thunder", meta: "Ambience · loops", glyph: "☁" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [reminder, setReminder] = useState(true);
  const [breathing, setBreathing] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <div className={breathing ? "orb breathing" : "orb"} />
          <div className="glass">
            <p className="lbl muted" style={{ fontSize: ".72rem" }}>Tonight</p>
            <p className="amt">7h 42m <small>slept</small></p>
            <span className="pill">12-day streak</span>
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
            {last ? "Begin your practice" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Calm Space", explore: "Explore", sleep: "Sleep", profile: "You" };
  const subs: Record<Tab, string> = { home: "Good evening, Noor", explore: "Find your session", sleep: "Wind down for the night", profile: "Noor Haddad" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp"><img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70" alt="" /></span>
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{subs[tab]}</p>
          </div>
        </div>
        <button className="nav-action" aria-label="Reminders"><IconBell /></button>
      </header>

      <main className="app-main">
        {tab === "home" && (
          <>
            <div className="daily">
              <div className="daily-copy">
                <p className="lbl">Daily calm</p>
                <h2>Settle into stillness</h2>
                <span className="daily-meta">Guided · 10 min</span>
              </div>
              <button className="daily-play" aria-label="Play daily session"><IconPlay /></button>
            </div>

            <section className="card breathe-card">
              <button
                className={breathing ? "breathe breathing" : "breathe"}
                aria-pressed={breathing}
                onClick={() => setBreathing((v) => !v)}
              >
                <span className="breathe-ring" aria-hidden />
                <span className="breathe-core" aria-hidden />
                <span className="breathe-label">Breathe</span>
              </button>
              <p className="muted" style={{ textAlign: "center", fontSize: ".82rem" }}>
                {breathing ? "Inhale as it grows, exhale as it falls" : "Tap the circle to begin"}
              </p>
            </section>

            <div className="chips" role="list">
              {CATEGORIES.map((c) => (
                <button className="chip-btn" role="listitem" key={c} onClick={() => setTab("explore")}>{c}</button>
              ))}
            </div>

            <div className="section-head"><h2>Short & sweet</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("explore"); }}>See all</a></div>
            <section className="card">
              {SHORT_SESSIONS.map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.meta}</span></span>
                  <span className="play-mini" aria-hidden><IconPlay /></span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "explore" && (
          <>
            <div className="chips" role="list">
              {CATEGORIES.map((c) => (
                <button className="chip-btn" role="listitem" key={c}>{c}</button>
              ))}
            </div>
            <section className="card">
              {EXPLORE.map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.teacher}</span></span>
                  <span className="dur">{t.mins}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "sleep" && (
          <>
            <div className="daily sleep-hero">
              <div className="daily-copy">
                <p className="lbl">Sleep story</p>
                <h2>The quiet harbour</h2>
                <span className="daily-meta">Narrated · 32 min</span>
              </div>
              <button className="daily-play" aria-label="Play sleep story"><IconPlay /></button>
            </div>

            <div className="section-head"><h2>Sounds & stories</h2></div>
            <section className="card">
              {SOUNDS.map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.meta}</span></span>
                  <span className="play-mini" aria-hidden><IconPlay /></span>
                </div>
              ))}
            </section>

            <section className="card">
              <div className="row">
                <div><strong style={{ fontSize: ".95rem" }}>Bedtime reminder</strong><p className="muted" style={{ fontSize: ".8rem" }}>Every night at 10:30 PM</p></div>
                <button className={reminder ? "toggle on" : "toggle"} aria-pressed={reminder} onClick={() => setReminder((v) => !v)} />
              </div>
            </section>
          </>
        )}

        {tab === "profile" && (
          <>
            <section className="card stats">
              <div className="stat"><strong>128</strong><span>minutes</span></div>
              <div className="stat"><strong>12</strong><span>day streak</span></div>
              <div className="stat"><strong>34</strong><span>sessions</span></div>
            </section>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden><IconBell /></span><span className="meta"><strong>Reminders</strong><span>Daily calm · 8:00 AM</span></span><span className="link">Edit</span></div>
              <div className="tx"><span className="ava" aria-hidden><IconDownload /></span><span className="meta"><strong>Downloads</strong><span>6 sessions offline</span></span><span className="link">Manage</span></div>
              <div className="tx"><span className="ava" aria-hidden>♡</span><span className="meta"><strong>Favourites</strong><span>9 saved sessions</span></span><span className="link">Open</span></div>
              <div className="tx"><span className="ava" aria-hidden>✦</span><span className="meta"><strong>Calm Space+</strong><span>Unlock every session</span></span><span className="link">Upgrade</span></div>
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "explore" ? "tab active" : "tab"} aria-current={tab === "explore" ? "page" : undefined} onClick={() => setTab("explore")}><IconExplore active={tab === "explore"} /><span>Explore</span></button>
        <button className={tab === "sleep" ? "tab active" : "tab"} aria-current={tab === "sleep" ? "page" : undefined} onClick={() => setTab("sleep")}><IconMoon active={tab === "sleep"} /><span>Sleep</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconUser active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

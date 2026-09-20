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
function IconRuns({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 18c3-6 5.5-6 8.5-3s5.5 1.5 7.5-4" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.9} />
      <circle cx="4" cy="18" r="1.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
      <circle cx="20" cy="11" r="1.7" fill="currentColor" fillOpacity={active ? 1 : 0.9} />
    </svg>
  );
}
function IconStats({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="12" width="3.4" height="8" rx="1" fill="currentColor" fillOpacity={active ? 0.9 : 0.55} />
      <rect x="10.3" y="7" width="3.4" height="13" rx="1" fill="currentColor" fillOpacity={active ? 1 : 0.75} />
      <rect x="16.6" y="4" width="3.4" height="16" rx="1" fill="currentColor" fillOpacity={active ? 0.9 : 0.55} />
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
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="currentColor" /></svg>;
}
function IconBolt() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconTrophy() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M7 4h10v3a5 5 0 0 1-10 0V4ZM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 20h6M12 12v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* Tiny CSS-free route trace (inline SVG, unique per seed) */
function RouteThumb({ seed }: { seed: number }) {
  const paths = [
    "M4 26c4-10 8 2 12-6s10 8 12-2",
    "M4 14c6-2 4 12 10 8s6-16 12-8",
    "M6 8c-2 8 10 6 6 14s10 2 8-8",
    "M4 20c8 0 4-14 12-12s2 16 10 12",
  ];
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden>
      <path d={paths[seed % paths.length]} stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy={[26, 14, 8, 20][seed % 4]} r="2.1" fill="var(--accent)" />
    </svg>
  );
}

const ONBOARD_KEY = "temporun_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "Track every run", body: "Distance, pace and elevation for every session — from a 5K to marathon day." },
  { kicker: "Live", title: "Pace & GPS, in real time", body: "See your route draw itself and hear split cues while your watch keeps score." },
  { kicker: "Goals", title: "Hit your weekly target", body: "Set a weekly distance goal, close your rings and keep the streak alive." },
];

type Tab = "home" | "runs" | "stats" | "profile";

const RUNS = [
  { name: "Riverside Loop", when: "Today · 6:42 AM", km: "8.4", pace: "5:12", time: "43:41", seed: 0 },
  { name: "Hill Repeats", when: "Yesterday · 6:10 PM", km: "6.1", pace: "5:48", time: "35:22", seed: 1 },
  { name: "Easy Recovery", when: "Mon · 7:05 AM", km: "5.0", pace: "6:20", time: "31:40", seed: 2 },
  { name: "Tempo Session", when: "Sat · 8:20 AM", km: "12.3", pace: "4:58", time: "61:05", seed: 3 },
  { name: "Sunset Sprint", when: "Fri · 7:40 PM", km: "4.2", pace: "4:44", time: "19:53", seed: 0 },
];

const WEEK = [
  { d: "M", h: 52 }, { d: "T", h: 74 }, { d: "W", h: 30 },
  { d: "T", h: 88 }, { d: "F", h: 40 }, { d: "S", h: 96 }, { d: "S", h: 58 },
];

/* Three activity meters for the Home hero (conic rings in CSS) */
const RINGS = [
  { label: "Distance", value: "8.4", unit: "km", pct: 84, note: "of 10 km" },
  { label: "Pace", value: "5:12", unit: "/km", pct: 72, note: "target 5:20" },
  { label: "Calories", value: "612", unit: "kcal", pct: 61, note: "of 1,000" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [autoPause, setAutoPause] = useState(true);

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
          <div className="ring-hero big" style={{ ["--p" as string]: "84" }}>
            <div className="ring-core">
              <span className="rv">8.4</span>
              <span className="ru">km today</span>
            </div>
          </div>
          <div className="glass">
            <p className="lbl">Weekly goal</p>
            <p className="amt">32.1 <small>/ 40 km</small></p>
            <span className="pill"><IconBolt /> 3-day streak</span>
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
            {last ? "Start running" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Tempo", runs: "Runs", stats: "Stats", profile: "Profile" };
  const subs: Record<Tab, string> = { home: "Good morning, Kaya", runs: "Recent sessions", stats: "This week", profile: "Kaya Mensah" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp"><img src="https://images.unsplash.com/photo-1571008887538-b36bb32f4571?auto=format&fit=crop&w=200&q=70" alt="" /></span>
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{subs[tab]}</p>
          </div>
        </div>
        <button className="nav-action" aria-label="Notifications"><IconBell /></button>
      </header>

      <main className="app-main">
        {tab === "home" && (
          <>
            <section className="rings-card">
              <div className="row" style={{ marginBottom: ".9rem" }}>
                <h2>Today's activity</h2>
                <span className="pill"><IconBolt /> On track</span>
              </div>
              <div className="rings">
                {RINGS.map((r) => (
                  <div className="ring" key={r.label}>
                    <div className="ring-hero" style={{ ["--p" as string]: String(r.pct) }}>
                      <div className="ring-core">
                        <span className="rv">{r.value}</span>
                        <span className="ru">{r.unit}</span>
                      </div>
                    </div>
                    <span className="ring-lbl">{r.label}</span>
                    <span className="ring-note">{r.note}</span>
                  </div>
                ))}
              </div>
            </section>

            <button className="start-run">
              <span className="ic"><IconPlay /></span>
              <span className="txt"><strong>Start run</strong><span>GPS ready · Auto-splits on</span></span>
              <span className="go">GO</span>
            </button>

            <div className="section-head"><h2>Last run</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("runs"); }}>All runs</a></div>
            <section className="card last-run">
              <div className="lr-top">
                <span className="route" aria-hidden><RouteThumb seed={0} /></span>
                <div className="lr-meta">
                  <strong>Riverside Loop</strong>
                  <span className="muted">Today · 6:42 AM</span>
                </div>
              </div>
              <div className="lr-stats">
                <div><span className="k">Distance</span><span className="v">8.4 km</span></div>
                <div><span className="k">Time</span><span className="v">43:41</span></div>
                <div><span className="k">Pace</span><span className="v">5:12 /km</span></div>
              </div>
            </section>

            <section className="card">
              <div className="row"><h3>This week</h3><span className="pill">32.1 km</span></div>
              <div className="bars" aria-hidden>
                {WEEK.map((b, i) => (
                  <div className="col" key={i}>
                    <div className="bar" style={{ height: `${b.h}%` }} />
                    <span className="bl">{b.d}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === "runs" && (
          <section className="card runs-list">
            {RUNS.map((r) => (
              <div className="runrow" key={r.name}>
                <span className="route sm" aria-hidden><RouteThumb seed={r.seed} /></span>
                <span className="meta">
                  <strong>{r.name}</strong>
                  <span>{r.when}</span>
                </span>
                <span className="runstat">
                  <b>{r.km} km</b>
                  <span>{r.pace} /km</span>
                </span>
              </div>
            ))}
          </section>
        )}

        {tab === "stats" && (
          <>
            <div className="stat-tiles">
              <div className="tile">
                <span className="k">This week</span>
                <span className="v">32.1 <small>km</small></span>
                <span className="pill up"><IconBolt /> +12%</span>
              </div>
              <div className="tile">
                <span className="k">This month</span>
                <span className="v">148 <small>km</small></span>
                <span className="pill">18 runs</span>
              </div>
            </div>

            <section className="card">
              <div className="row"><h3>Weekly distance</h3><span className="muted" style={{ fontSize: ".78rem" }}>km / day</span></div>
              <div className="bars tall" aria-hidden>
                {WEEK.map((b, i) => (
                  <div className="col" key={i}>
                    <div className="bar" style={{ height: `${b.h}%` }} />
                    <span className="bl">{b.d}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="section-head"><h2>Personal bests</h2><span className="link"><IconTrophy /></span></div>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>5K</span><span className="meta"><strong>21:04</strong><span>Riverside Loop · Aug 30</span></span><span className="amount in">4:12 /km</span></div>
              <div className="tx"><span className="ava" aria-hidden>10K</span><span className="meta"><strong>44:38</strong><span>Marina Route · Aug 12</span></span><span className="amount in">4:27 /km</span></div>
              <div className="tx"><span className="ava" aria-hidden>½</span><span className="meta"><strong>1:38:20</strong><span>City Half · Jul 06</span></span><span className="amount in">4:39 /km</span></div>
              <div className="tx"><span className="ava" aria-hidden>↑</span><span className="meta"><strong>Longest run</strong><span>City Half · 21.1 km</span></span><span className="amount">21.1 km</span></div>
            </section>
          </>
        )}

        {tab === "profile" && (
          <>
            <section className="card goal-card">
              <div className="row"><h3>Weekly goal</h3><span className="pill">32.1 / 40 km</span></div>
              <div className="meter" aria-hidden><span style={{ width: "80%" }} /></div>
              <p className="muted" style={{ fontSize: ".8rem", marginTop: ".55rem" }}>7.9 km to go — one more easy session closes it.</p>
            </section>

            <div className="section-head"><h2>Connected devices</h2></div>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>⌚</span><span className="meta"><strong>Apple Watch Ultra</strong><span>Syncing · 84% battery</span></span><span className="dot-ok" aria-hidden /></div>
              <div className="tx"><span className="ava" aria-hidden>◎</span><span className="meta"><strong>Garmin HRM-Pro</strong><span>Heart rate · connected</span></span><span className="dot-ok" aria-hidden /></div>
              <div className="tx"><span className="ava" aria-hidden>＋</span><span className="meta"><strong>Add a device</strong><span>Foot pod, headphones, bike</span></span><span className="link">Pair</span></div>
            </section>

            <div className="section-head"><h2>Settings</h2></div>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>⚑</span><span className="meta"><strong>Units</strong><span>Kilometres · metric</span></span><span className="link">Edit</span></div>
              <div className="row" style={{ padding: ".7rem 0", borderBottom: "1px solid var(--line)" }}>
                <div><strong style={{ fontSize: ".92rem" }}>Auto-pause</strong><p className="muted" style={{ fontSize: ".8rem" }}>Pause the timer when you stop</p></div>
                <button className={autoPause ? "toggle on" : "toggle"} aria-pressed={autoPause} onClick={() => setAutoPause((v) => !v)} />
              </div>
              <div className="tx"><span className="ava" aria-hidden>♪</span><span className="meta"><strong>Split cues</strong><span>Voice every 1 km</span></span><span className="link">Manage</span></div>
              <div className="tx"><span className="ava" aria-hidden>?</span><span className="meta"><strong>Help & support</strong><span>Guides and contact</span></span><span className="link">Open</span></div>
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "runs" ? "tab active" : "tab"} aria-current={tab === "runs" ? "page" : undefined} onClick={() => setTab("runs")}><IconRuns active={tab === "runs"} /><span>Runs</span></button>
        <button className={tab === "stats" ? "tab active" : "tab"} aria-current={tab === "stats" ? "page" : undefined} onClick={() => setTab("stats")}><IconStats active={tab === "stats"} /><span>Stats</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconUser active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

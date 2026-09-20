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
      <path d="M15 9l-2 4-4 2 2-4 4-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function IconAdd({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
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
function IconLeaf() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14 0 0-1-3 2-6 2-2 5-3 5-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconDrop() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3.5c3.4 4 5.5 6.7 5.5 9.6a5.5 5.5 0 0 1-11 0c0-2.9 2.1-5.6 5.5-9.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}
function IconSun() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" /><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
function IconCheck() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5 10 17.5 19 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconSearch() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" /><path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

const ONBOARD_KEY = "fern_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "Never forget to water again", body: "Fern learns each plant's rhythm and nudges you the day a drink is due." },
  { kicker: "Learn", title: "Care guides for every leaf", body: "Light, water and difficulty for hundreds of houseplants — in plain language." },
  { kicker: "Thrive", title: "Watch your jungle flourish", body: "Track streaks, log waterings, and keep every plant green and happy." },
];

type Tab = "home" | "explore" | "add" | "profile";

const DUE = [
  { id: "fiddle", name: "Fiddle Leaf Fig", room: "Living room", glyph: "🌿" },
  { id: "calathea", name: "Calathea Orbifolia", room: "Bedroom", glyph: "🌱" },
  { id: "pothos", name: "Golden Pothos", room: "Kitchen shelf", glyph: "🍃" },
];

const PLANTS = [
  { name: "Monstera", next: "in 3 days", light: "Bright", glyph: "🌿", grad: 0 },
  { name: "Snake Plant", next: "in 9 days", light: "Low light", glyph: "🌱", grad: 1 },
  { name: "Peace Lily", next: "Today", light: "Shade", glyph: "🍃", grad: 2 },
  { name: "ZZ Plant", next: "in 5 days", light: "Medium", glyph: "🌿", grad: 3 },
];

const GUIDES = [
  { name: "Monstera Deliciosa", diff: "Easy", light: "Bright indirect" },
  { name: "Fiddle Leaf Fig", diff: "Tricky", light: "Bright indirect" },
  { name: "Snake Plant", diff: "Very easy", light: "Low to bright" },
  { name: "Calathea Orbifolia", diff: "Fussy", light: "Medium, no direct" },
  { name: "Golden Pothos", diff: "Easy", light: "Low to bright" },
  { name: "Peace Lily", diff: "Easy", light: "Shade to medium" },
];

const LIGHTS = ["Low light", "Medium", "Bright indirect", "Full sun"];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [watered, setWatered] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState(true);
  const [notify, setNotify] = useState(true);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", room: "", interval: "7", light: LIGHTS[2] });
  const [saved, setSaved] = useState(false);

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
          <span className="leaf-glyph big">🌿</span>
          <div className="glass">
            <p className="lbl muted" style={{ fontSize: ".72rem" }}>Watering today</p>
            <p className="amt">3 <small>plants</small></p>
            <span className="pill">7-day streak</span>
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
            {last ? "Start growing" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Fern", explore: "Explore", add: "Add a plant", profile: "Profile" };
  const subs: Record<Tab, string> = { home: "Good morning, Lina", explore: "Care guides", add: "Log a new plant", profile: "Lina Moreau" };

  const dueLeft = DUE.filter((p) => !watered[p.id]).length;
  const filtered = GUIDES.filter((g) => g.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp" aria-hidden>🌵</span>
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
            <div className="hero">
              <span className="hero-leaf" aria-hidden><IconLeaf /></span>
              <p className="lbl">Water today</p>
              <p className="amt">{dueLeft || 0} <small>{dueLeft === 1 ? "plant thirsty" : "plants thirsty"}</small></p>
              <span className="delta"><IconDrop /> {dueLeft ? "Give them a drink" : "All caught up — nice"}</span>
            </div>

            <section className="card">
              <div className="row" style={{ marginBottom: ".6rem" }}>
                <h3>Water today</h3>
                <span className="pill">{dueLeft} due</span>
              </div>
              {DUE.map((p) => (
                <div className="tx" key={p.id}>
                  <span className="ava" aria-hidden>{p.glyph}</span>
                  <span className="meta">
                    <strong style={watered[p.id] ? { textDecoration: "line-through", opacity: .6 } : undefined}>{p.name}</strong>
                    <span>{p.room}</span>
                  </span>
                  <button
                    className={watered[p.id] ? "waterbtn done" : "waterbtn"}
                    aria-pressed={!!watered[p.id]}
                    onClick={() => setWatered((w) => ({ ...w, [p.id]: !w[p.id] }))}
                  >
                    {watered[p.id] ? <><IconCheck /> Done</> : <><IconDrop /> Water</>}
                  </button>
                </div>
              ))}
            </section>

            <div className="section-head"><h2>My plants</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("explore"); }}>Guides</a></div>
            <div className="plant-grid">
              {PLANTS.map((p) => (
                <div className={`plant-card g${p.grad}`} key={p.name}>
                  <span className="plant-glyph" aria-hidden>{p.glyph}</span>
                  <strong>{p.name}</strong>
                  <span className="next"><IconDrop /> {p.next}</span>
                  <span className="light"><IconSun /> {p.light}</span>
                </div>
              ))}
            </div>

            <div className="tip">
              <span className="tip-ic" aria-hidden>💧</span>
              <p><strong>Care tip.</strong> Let the top 3cm of soil dry before watering — most houseplants prefer a little thirst to soggy roots.</p>
            </div>
          </>
        )}

        {tab === "explore" && (
          <>
            <div className="search">
              <IconSearch />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search plant guides" aria-label="Search plant guides" />
            </div>
            <section className="card">
              {filtered.length === 0 && <p className="muted" style={{ padding: ".4rem 0" }}>No guides match “{query}”.</p>}
              {filtered.map((g) => (
                <div className="tx" key={g.name}>
                  <span className="ava" aria-hidden>🌿</span>
                  <span className="meta"><strong>{g.name}</strong><span><IconSun /> {g.light}</span></span>
                  <span className={`chip-diff ${g.diff === "Easy" || g.diff === "Very easy" ? "ok" : "warn"}`}>{g.diff}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "add" && (
          <section className="card form">
            <h3>Identify &amp; add a plant</h3>
            <p className="muted" style={{ fontSize: ".82rem", marginBottom: ".4rem" }}>A few details and Fern builds a watering schedule.</p>

            <label className="field">
              <span>Plant name</span>
              <input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setSaved(false); }} placeholder="e.g. Rubber plant" />
            </label>

            <label className="field">
              <span>Room</span>
              <input value={form.room} onChange={(e) => { setForm({ ...form, room: e.target.value }); setSaved(false); }} placeholder="e.g. Living room" />
            </label>

            <label className="field">
              <span>Watering interval</span>
              <div className="stepper">
                <button type="button" aria-label="Less often" onClick={() => setForm({ ...form, interval: String(Math.max(1, Number(form.interval) - 1)) })}>–</button>
                <span>{form.interval} days</span>
                <button type="button" aria-label="More often" onClick={() => setForm({ ...form, interval: String(Math.min(60, Number(form.interval) + 1)) })}>+</button>
              </div>
            </label>

            <label className="field">
              <span>Light</span>
              <div className="segmented">
                {LIGHTS.map((l) => (
                  <button type="button" key={l} className={form.light === l ? "seg on" : "seg"} onClick={() => setForm({ ...form, light: l })}>{l}</button>
                ))}
              </div>
            </label>

            <button className="btn-primary" onClick={() => setSaved(true)}>Add plant</button>
            {saved && <p className="saved"><IconCheck /> {form.name || "Plant"} added — reminders set every {form.interval} days.</p>}
          </section>
        )}

        {tab === "profile" && (
          <>
            <div className="stat-row">
              <div className="stat"><span className="n">12</span><span className="l">Plants</span></div>
              <div className="stat"><span className="n">7</span><span className="l">Day streak</span></div>
              <div className="stat"><span className="n">94%</span><span className="l">On time</span></div>
            </div>
            <section className="card">
              <div className="row" style={{ marginBottom: ".7rem" }}>
                <div><strong style={{ fontSize: ".95rem" }}>Watering reminders</strong><p className="muted" style={{ fontSize: ".8rem" }}>Nudge me when a plant is due</p></div>
                <button className={reminders ? "toggle on" : "toggle"} aria-pressed={reminders} onClick={() => setReminders((v) => !v)} />
              </div>
              <div className="row">
                <div><strong style={{ fontSize: ".95rem" }}>Push notifications</strong><p className="muted" style={{ fontSize: ".8rem" }}>Alerts on this device</p></div>
                <button className={notify ? "toggle on" : "toggle"} aria-pressed={notify} onClick={() => setNotify((v) => !v)} />
              </div>
            </section>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>🌤️</span><span className="meta"><strong>Light sensor</strong><span>Measure a spot's brightness</span></span><span className="link">Open</span></div>
              <div className="tx"><span className="ava" aria-hidden>📷</span><span className="meta"><strong>Plant identifier</strong><span>Snap a photo to identify</span></span><span className="link">Scan</span></div>
              <div className="tx"><span className="ava" aria-hidden>🌱</span><span className="meta"><strong>Care history</strong><span>Every watering, logged</span></span><span className="link">View</span></div>
              <div className="tx"><span className="ava" aria-hidden>?</span><span className="meta"><strong>Help &amp; support</strong><span>Ask our plant guides</span></span><span className="link">Chat</span></div>
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "explore" ? "tab active" : "tab"} aria-current={tab === "explore" ? "page" : undefined} onClick={() => setTab("explore")}><IconExplore active={tab === "explore"} /><span>Explore</span></button>
        <button className={tab === "add" ? "tab active" : "tab"} aria-current={tab === "add" ? "page" : undefined} onClick={() => setTab("add")}><IconAdd active={tab === "add"} /><span>Add</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconUser active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

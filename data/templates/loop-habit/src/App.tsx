import { useEffect, useMemo, useState } from "react";

/* ---- Inline icons (kit runs React-only: no icon packs) ---- */
function IconToday({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.6" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconHabits({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h4M5 12h4M5 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="16.5" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
      <circle cx="16.5" cy="12" r="2" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
      <circle cx="16.5" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
    </svg>
  );
}
function IconStats({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="12" width="3.6" height="7" rx="1.1" stroke="currentColor" strokeWidth="1.7" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <rect x="10.2" y="8" width="3.6" height="11" rx="1.1" stroke="currentColor" strokeWidth="1.7" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <rect x="16.4" y="5" width="3.6" height="14" rx="1.1" stroke="currentColor" strokeWidth="1.7" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
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
function IconFlame() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M13 3c.6 3-1.8 4.2-1.8 6.4 0 1.2.9 2.1 2 2.1 1.6 0 2.4-1.4 2.2-2.9 1.7 1.3 2.6 3.2 2.6 5.1 0 3.4-2.7 5.8-6 5.8s-6-2.5-6-6c0-4 3-6.4 4.4-9.1C11.4 8 10.8 5.3 13 3Z" fill="currentColor" /></svg>;
}
function IconCheck() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12.5 10 17.5 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconPlus() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "loop_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "Build habits that stick", body: "Pick a few small routines and check them off each day. Loop keeps the momentum going." },
  { kicker: "Streaks", title: "Never break the chain", body: "Every day you show up grows your streak. Watch the flame count climb and the loop close." },
  { kicker: "Gentle nudges", title: "Reminders, not pressure", body: "Soft nudges at the right time. No guilt, no noise — just a quiet tap forward." },
];

type Tab = "today" | "habits" | "stats" | "profile";

type Habit = {
  id: string;
  name: string;
  glyph: string;
  schedule: string;
  streak: number;
  done: boolean;
};

const INITIAL_HABITS: Habit[] = [
  { id: "water", name: "Drink water", glyph: "💧", schedule: "8 glasses · Daily", streak: 24, done: true },
  { id: "read", name: "Read 20 min", glyph: "📖", schedule: "Evening · Daily", streak: 12, done: true },
  { id: "workout", name: "Workout", glyph: "🏋", schedule: "Mon–Fri · 30 min", streak: 6, done: true },
  { id: "meditate", name: "Meditate", glyph: "🧘", schedule: "Morning · 10 min", streak: 41, done: false },
  { id: "sugar", name: "No sugar", glyph: "🚫", schedule: "All day · Daily", streak: 3, done: false },
];

/* Heatmap: 7 rows (weekdays) × 18 weeks of graded intensity (0–4). */
const HEAT_ROWS = ["M", "T", "W", "T", "F", "S", "S"];
const HEAT = [
  [3, 4, 2, 4, 3, 1, 0, 4, 4, 3, 2, 4, 3, 4, 2, 3, 4, 4],
  [2, 3, 4, 3, 4, 2, 1, 3, 4, 4, 3, 2, 4, 3, 4, 4, 3, 4],
  [4, 2, 3, 4, 2, 3, 4, 2, 3, 4, 4, 3, 2, 4, 3, 2, 4, 3],
  [1, 4, 3, 2, 4, 4, 3, 4, 2, 3, 4, 4, 3, 4, 2, 3, 4, 4],
  [3, 3, 4, 4, 3, 2, 4, 3, 4, 2, 3, 4, 4, 3, 4, 4, 2, 4],
  [0, 2, 3, 1, 4, 3, 2, 4, 3, 1, 2, 3, 4, 2, 3, 4, 3, 2],
  [2, 1, 0, 3, 2, 1, 3, 0, 2, 3, 1, 2, 0, 3, 2, 1, 4, 3],
];

const ACHIEVEMENTS = [
  { glyph: "🔥", name: "30-day streak", sub: "Meditate", got: true },
  { glyph: "🌅", name: "Early bird", sub: "14 mornings in a row", got: true },
  { glyph: "💯", name: "Perfect week", sub: "All habits, 7 days", got: true },
  { glyph: "🏔", name: "100 days total", sub: "Almost there — 86", got: false },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("today");
  const [habits, setHabits] = useState<Habit[]>(INITIAL_HABITS);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function toggle(id: string) {
    setHabits((list) =>
      list.map((h) =>
        h.id === id
          ? { ...h, done: !h.done, streak: h.done ? h.streak - 1 : h.streak + 1 }
          : h
      )
    );
  }

  const doneCount = habits.filter((h) => h.done).length;
  const total = habits.length;
  const pct = Math.round((doneCount / total) * 100);
  const ring = useMemo(
    () => `conic-gradient(var(--accent) ${pct * 3.6}deg, color-mix(in srgb, var(--fg) 10%, transparent) 0)`,
    [pct]
  );
  const totalDays = habits.reduce((n, h) => n + h.streak, 0);

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <div className="ring-badge">
            <div className="ring big" style={{ background: "conic-gradient(var(--accent) 252deg, color-mix(in srgb, var(--fg) 12%, transparent) 0)" }}>
              <div className="ring-hole"><b>5</b><span>day loop</span></div>
            </div>
          </div>
          <div className="glass">
            <span className="flame"><IconFlame /> 41</span>
            <p className="lbl muted">Longest streak · Meditate</p>
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
            {last ? "Start my first loop" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { today: "Today", habits: "Habits", stats: "Stats", profile: "Profile" };
  const subs: Record<Tab, string> = {
    today: "Tuesday, Sep 19",
    habits: "5 active routines",
    stats: "Last 18 weeks",
    profile: "Maya Okonkwo",
  };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="mark" aria-hidden>◍</span>
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{subs[tab]}</p>
          </div>
        </div>
        <button className="nav-action" aria-label="Notifications"><IconBell /></button>
      </header>

      <main className="app-main">
        {tab === "today" && (
          <>
            <div className="progress">
              <div className="ring" style={{ background: ring }}>
                <div className="ring-hole">
                  <b>{doneCount}/{total}</b>
                  <span>done</span>
                </div>
              </div>
              <div className="progress-copy">
                <p className="lbl">Today's loop</p>
                <p className="big">{pct}% complete</p>
                <span className="delta">{doneCount === total ? "Loop closed — nice work" : `${total - doneCount} habit${total - doneCount > 1 ? "s" : ""} to go`}</span>
              </div>
            </div>

            <div className="section-head"><h2>Your habits</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("habits"); }}>Manage</a></div>
            <section className="card list">
              {habits.map((h) => (
                <div className={h.done ? "habit done" : "habit"} key={h.id}>
                  <span className="ava" aria-hidden>{h.glyph}</span>
                  <span className="meta">
                    <strong>{h.name}</strong>
                    <span className="streak"><IconFlame /> {h.streak} day{h.streak === 1 ? "" : "s"}</span>
                  </span>
                  <button
                    className={h.done ? "check on" : "check"}
                    aria-pressed={h.done}
                    aria-label={h.done ? `Mark ${h.name} not done` : `Mark ${h.name} done`}
                    onClick={() => toggle(h.id)}
                  >
                    {h.done && <IconCheck />}
                  </button>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "habits" && (
          <>
            <button className="add">
              <span className="ic"><IconPlus /></span>
              <span className="meta"><strong>Add a habit</strong><span>Name it, set a schedule, pick a cue</span></span>
            </button>
            <section className="card list">
              {habits.map((h) => (
                <div className="habit" key={h.id}>
                  <span className="ava" aria-hidden>{h.glyph}</span>
                  <span className="meta">
                    <strong>{h.name}</strong>
                    <span>{h.schedule}</span>
                  </span>
                  <span className="streak-pill"><IconFlame /> {h.streak}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "stats" && (
          <>
            <div className="stat-grid">
              <div className="card stat">
                <p className="lbl">Longest streak</p>
                <p className="big">41 <small>days</small></p>
                <span className="streak"><IconFlame /> Meditate</span>
              </div>
              <div className="card stat">
                <p className="lbl">Completion</p>
                <p className="big">87<small>%</small></p>
                <span className="delta">this month</span>
              </div>
            </div>
            <section className="card">
              <div className="row"><h3>Consistency</h3><span className="pill">86 of 90 days</span></div>
              <div className="heatmap" aria-hidden>
                <div className="heat-days">
                  {HEAT_ROWS.map((d, i) => <span key={i}>{d}</span>)}
                </div>
                <div className="heat-grid">
                  {HEAT.map((row, r) => (
                    <div className="heat-row" key={r}>
                      {row.map((v, c) => (
                        <span className="cell" key={c} style={{ opacity: v === 0 ? 1 : undefined, background: v === 0 ? "color-mix(in srgb, var(--fg) 7%, transparent)" : `color-mix(in srgb, var(--accent) ${v * 25}%, transparent)` }} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="legend">
                <span>Less</span>
                <i style={{ background: "color-mix(in srgb, var(--fg) 7%, transparent)" }} />
                <i style={{ background: "color-mix(in srgb, var(--accent) 25%, transparent)" }} />
                <i style={{ background: "color-mix(in srgb, var(--accent) 50%, transparent)" }} />
                <i style={{ background: "color-mix(in srgb, var(--accent) 75%, transparent)" }} />
                <i style={{ background: "color-mix(in srgb, var(--accent) 100%, transparent)" }} />
                <span>More</span>
              </div>
            </section>
          </>
        )}

        {tab === "profile" && (
          <>
            <div className="profile-head">
              <span className="pfp"><img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70" alt="" /></span>
              <div>
                <h2 className="pname">Maya Okonkwo</h2>
                <p className="muted">Since March · {totalDays} streak days total</p>
              </div>
            </div>
            <section className="card">
              <div className="row" style={{ marginBottom: ".7rem" }}>
                <div><strong style={{ fontSize: ".95rem" }}>Reminders</strong><p className="muted" style={{ fontSize: ".8rem" }}>Gentle nudges · 8:00 & 20:00</p></div>
                <button className={reminders ? "toggle on" : "toggle"} aria-pressed={reminders} onClick={() => setReminders((v) => !v)} />
              </div>
              <div className="habit"><span className="ava" aria-hidden>◐</span><span className="meta"><strong>Theme</strong><span>Dark · Teal accent</span></span><span className="link">Change</span></div>
              <div className="habit"><span className="ava" aria-hidden>↺</span><span className="meta"><strong>Week starts</strong><span>Monday</span></span><span className="link">Edit</span></div>
            </section>
            <div className="section-head"><h2>Achievements</h2><span className="link">3 of 12</span></div>
            <section className="card list">
              {ACHIEVEMENTS.map((a) => (
                <div className={a.got ? "habit" : "habit locked"} key={a.name}>
                  <span className="ava" aria-hidden>{a.glyph}</span>
                  <span className="meta"><strong>{a.name}</strong><span>{a.sub}</span></span>
                  <span className={a.got ? "badge" : "badge off"}>{a.got ? "Earned" : "Locked"}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "today" ? "tab active" : "tab"} aria-current={tab === "today" ? "page" : undefined} onClick={() => setTab("today")}><IconToday active={tab === "today"} /><span>Today</span></button>
        <button className={tab === "habits" ? "tab active" : "tab"} aria-current={tab === "habits" ? "page" : undefined} onClick={() => setTab("habits")}><IconHabits active={tab === "habits"} /><span>Habits</span></button>
        <button className={tab === "stats" ? "tab active" : "tab"} aria-current={tab === "stats" ? "page" : undefined} onClick={() => setTab("stats")}><IconStats active={tab === "stats"} /><span>Stats</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconUser active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

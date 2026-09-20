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
function IconAdd({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconStats({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="12" width="4" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <rect x="10" y="8" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <rect x="16" y="5" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.8" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
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
function IconBack() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconCal() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><rect x="4" y="5" width="16" height="16" rx="2.4" stroke="currentColor" strokeWidth="1.8" /><path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconDel() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L3 12l6-6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M12 10l4 4M16 10l-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

const ONBOARD_KEY = "kobo_onboard_done";
const SLIDES = [
  { kicker: "See it", title: "Know where money goes", body: "Every expense sorted into clear categories, the moment you log it." },
  { kicker: "Plan it", title: "Set a budget per category", body: "Give groceries, transport and fun a monthly limit that fits your life." },
  { kicker: "Keep it", title: "Stay on track all month", body: "A single glance shows what's left, so payday never feels like a surprise." },
];

type Tab = "home" | "add" | "stats" | "account";

/* Monthly budget model (CFA) */
const BUDGET = 2000;
const SPENT = 1240;
const LEFT = BUDGET - SPENT;
const PCT = Math.round((SPENT / BUDGET) * 100);

const CATS = [
  { name: "Groceries", glyph: "🛒", spent: 380, limit: 450, hue: "var(--accent)" },
  { name: "Transport", glyph: "🚌", spent: 210, limit: 240, hue: "#38bdf8" },
  { name: "Rent", glyph: "🏠", spent: 520, limit: 520, hue: "#a78bfa" },
  { name: "Fun", glyph: "🎬", spent: 96, limit: 150, hue: "#f472b6" },
  { name: "Savings", glyph: "🪙", spent: 34, limit: 200, hue: "#34d399" },
];

const RECENT = [
  { name: "Marché Kermel", cat: "Groceries · Today", amt: "-6,200", glyph: "🛒" },
  { name: "Bus DDD", cat: "Transport · Today", amt: "-350", glyph: "🚌" },
  { name: "Cinéma Sea Plaza", cat: "Fun · Yesterday", amt: "-3,000", glyph: "🎬" },
  { name: "Salary — Baobab Ltd", cat: "Income · 1 Sep", amt: "+845,000", glyph: "↓", in: true },
];

const MONTHS = [
  { d: "Apr", h: 58 }, { d: "May", h: 71 }, { d: "Jun", h: 49 },
  { d: "Jul", h: 88 }, { d: "Aug", h: 64 }, { d: "Sep", h: 62 },
];

const CHIPS = ["Groceries", "Transport", "Rent", "Fun", "Savings", "Health"];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

function ProgressRing({ pct }: { pct: number }) {
  const r = 74;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  return (
    <svg className="ring" viewBox="0 0 180 180" aria-hidden>
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--track)" strokeWidth="14" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--accent)" strokeWidth="14"
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 90 90)" />
    </svg>
  );
}

function Bar({ spent, limit, hue }: { spent: number; limit: number; hue: string }) {
  const pct = Math.min(Math.round((spent / limit) * 100), 100);
  const over = spent >= limit;
  return (
    <div className="track">
      <div className="fill" style={{ width: `${pct}%`, background: over ? "var(--danger)" : hue }} />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [amount, setAmount] = useState("12.50");
  const [chip, setChip] = useState("Groceries");
  const [note, setNote] = useState("");

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function press(k: string) {
    setAmount((v) => {
      if (k === "del") return v.length > 1 ? v.slice(0, -1) : "0";
      if (k === "." && v.includes(".")) return v;
      if (v === "0" && k !== ".") return k;
      return v.length >= 8 ? v : v + k;
    });
  }

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <div className="ring-wrap">
            <ProgressRing pct={62} />
            <div className="ring-center">
              <span className="rc-lbl">Left</span>
              <span className="rc-amt">760</span>
              <span className="rc-sub">of 2,000</span>
            </div>
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
            {last ? "Start budgeting" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "September", add: "New expense", stats: "Statistics", account: "Account" };
  const subs: Record<Tab, string> = { home: "Budget overview", add: "Log a spend", stats: "Last 6 months", account: "Awa Diallo" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          {tab === "add"
            ? <button className="nav-action ghost" aria-label="Back" onClick={() => setTab("home")}><IconBack /></button>
            : <span className="mark" aria-hidden>k</span>}
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{subs[tab]}</p>
          </div>
        </div>
        {tab !== "add" && <button className="nav-action" aria-label="Change month"><IconCal /></button>}
      </header>

      <main className="app-main">
        {tab === "home" && (
          <>
            <div className="hero">
              <div className="ring-wrap">
                <ProgressRing pct={PCT} />
                <div className="ring-center">
                  <span className="rc-lbl">Left this month</span>
                  <span className="rc-amt">{LEFT.toLocaleString()}</span>
                  <span className="rc-sub">of {BUDGET.toLocaleString()} CFA</span>
                </div>
              </div>
              <div className="hero-legend">
                <span><i className="d spent" />Spent {SPENT.toLocaleString()}</span>
                <span><i className="d left" />{PCT}% used · 11 days left</span>
              </div>
            </div>

            <div className="section-head"><h2>Categories</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("stats"); }}>Stats</a></div>
            <section className="card cats">
              {CATS.map((c) => {
                const over = c.spent >= c.limit;
                return (
                  <div className="cat" key={c.name}>
                    <span className="cat-ico" aria-hidden>{c.glyph}</span>
                    <div className="cat-body">
                      <div className="cat-top">
                        <strong>{c.name}</strong>
                        <span className={over ? "cat-amt over" : "cat-amt"}>{c.spent} / {c.limit}</span>
                      </div>
                      <Bar spent={c.spent} limit={c.limit} hue={c.hue} />
                    </div>
                  </div>
                );
              })}
            </section>

            <div className="section-head"><h2>Recent expenses</h2></div>
            <section className="card">
              {RECENT.slice(0, 3).map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.cat}</span></span>
                  <span className={t.in ? "amount in" : "amount"}>{t.amt}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "add" && (
          <div className="add">
            <div className="amount-display">
              <span className="cur">CFA</span>
              <span className="big">{amount}</span>
            </div>
            <div className="chips" role="group" aria-label="Category">
              {CHIPS.map((c) => (
                <button key={c} className={c === chip ? "chip on" : "chip"} onClick={() => setChip(c)}>{c}</button>
              ))}
            </div>
            <input className="note" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="keypad" aria-hidden>
              {KEYS.map((k) => (
                <button key={k} className="key" onClick={() => press(k)}>
                  {k === "del" ? <IconDel /> : k}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => setTab("home")}>Save expense</button>
          </div>
        )}

        {tab === "stats" && (
          <>
            <section className="card">
              <div className="row"><h3>Monthly spend</h3><span className="pill">Avg 1,410</span></div>
              <div className="bars" aria-hidden>
                {MONTHS.map((b, i) => (
                  <div className="col" key={i}>
                    <div className="bar" style={{ height: `${b.h}%` }} />
                    <span className="bl">{b.d}</span>
                  </div>
                ))}
              </div>
            </section>

            <div className="io">
              <div className="io-card in">
                <span className="io-lbl">Income</span>
                <span className="io-amt">845,000</span>
              </div>
              <div className="io-card out">
                <span className="io-lbl">Expenses</span>
                <span className="io-amt">-612,300</span>
              </div>
            </div>

            <div className="section-head"><h2>Top categories</h2></div>
            <section className="card cats">
              {CATS.slice(0, 4).map((c) => (
                <div className="cat" key={c.name}>
                  <span className="cat-ico" aria-hidden>{c.glyph}</span>
                  <div className="cat-body">
                    <div className="cat-top"><strong>{c.name}</strong><span className="cat-amt">{Math.round((c.spent / SPENT) * 100)}%</span></div>
                    <Bar spent={c.spent} limit={c.limit} hue={c.hue} />
                  </div>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "account" && (
          <>
            <div className="profile">
              <span className="pfp-lg" aria-hidden>AD</span>
              <div>
                <strong>Awa Diallo</strong>
                <p className="muted" style={{ fontSize: ".82rem" }}>awa@kobo.app</p>
              </div>
            </div>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>◎</span><span className="meta"><strong>Monthly budget</strong><span>2,000 CFA · resets 1st</span></span><span className="link">Edit</span></div>
              <div className="tx"><span className="ava" aria-hidden>▤</span><span className="meta"><strong>Accounts</strong><span>Cash · Wave · Orange Money</span></span><span className="link">Manage</span></div>
              <div className="tx"><span className="ava" aria-hidden>⇩</span><span className="meta"><strong>Export data</strong><span>Download CSV of all expenses</span></span><span className="link">Export</span></div>
              <div className="tx"><span className="ava" aria-hidden>🔔</span><span className="meta"><strong>Reminders</strong><span>Daily log · 20:00</span></span><span className="link">Set</span></div>
            </section>
            <section className="card">
              <div className="tx"><span className="ava" aria-hidden>⛨</span><span className="meta"><strong>Security</strong><span>App lock · PIN</span></span><span className="link">Edit</span></div>
              <div className="tx"><span className="ava" aria-hidden>?</span><span className="meta"><strong>Help &amp; support</strong><span>Guides and contact</span></span><span className="link">Open</span></div>
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "add" ? "tab active" : "tab"} aria-current={tab === "add" ? "page" : undefined} onClick={() => setTab("add")}><IconAdd active={tab === "add"} /><span>Add</span></button>
        <button className={tab === "stats" ? "tab active" : "tab"} aria-current={tab === "stats" ? "page" : undefined} onClick={() => setTab("stats")}><IconStats active={tab === "stats"} /><span>Stats</span></button>
        <button className={tab === "account" ? "tab active" : "tab"} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><IconUser active={tab === "account"} /><span>Account</span></button>
      </nav>
    </div>
  );
}

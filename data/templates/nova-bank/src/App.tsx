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
function IconCard({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5.5" width="18" height="13" rx="2.4" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="M3 9.5h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconActivity({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 13h3l2.5-6 4 12L16 11h4" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" opacity={active ? 1 : 0.9} />
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
function IconArrowUp() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 19V6M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconPlus() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function IconScan() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconSplit() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 14 16 7M9 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "nova_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "One account, every move", body: "Spend, save and send in seconds. Nova keeps your money in clear view." },
  { kicker: "Instant", title: "Send money in a tap", body: "Free transfers to any Nova user, and clean receipts for everyone else." },
  { kicker: "In control", title: "See where it goes", body: "Weekly spending, smart categories, and alerts the moment cash moves." },
];

type Tab = "home" | "cards" | "activity" | "account";

const TX = [
  { name: "Kora Coffee", cat: "Café · Today", amt: "-2,400", in: false, glyph: "☕" },
  { name: "Salary — Northwind", cat: "Income · Yesterday", amt: "+845,000", in: true, glyph: "↓" },
  { name: "Yassir Ride", cat: "Transport · Yesterday", amt: "-3,150", in: false, glyph: "🚕" },
  { name: "Spotify", cat: "Subscription · Mon", amt: "-4,990", in: false, glyph: "♪" },
  { name: "From Awa D.", cat: "Transfer · Mon", amt: "+15,000", in: true, glyph: "↓" },
];

const SPEND = [
  { d: "M", h: 44 }, { d: "T", h: 62 }, { d: "W", h: 38 },
  { d: "T", h: 80 }, { d: "F", h: 95 }, { d: "S", h: 54 }, { d: "S", h: 30 },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [frozen, setFrozen] = useState(false);

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
          <div className="glass">
            <p className="lbl muted" style={{ fontSize: ".72rem" }}>Total balance</p>
            <p className="amt">2,318,540 <small>CFA</small></p>
            <span className="pill">+ 4.2% this month</span>
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
            {last ? "Create free account" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Nova", cards: "Cards", activity: "Activity", account: "Account" };
  const subs: Record<Tab, string> = { home: "Good morning, Amine", cards: "Manage your cards", activity: "This week", account: "Amine Kada" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp"><img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=70" alt="" /></span>
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
            <div className="balance">
              <span className="card-chip" aria-hidden />
              <p className="lbl">Total balance</p>
              <p className="amt">2,318,540 <small>CFA</small></p>
              <span className="delta"><IconArrowUp /> +42,900 this week</span>
            </div>

            <div className="actions">
              <button className="action"><span className="ic"><IconArrowUp /></span>Send</button>
              <button className="action"><span className="ic"><IconPlus /></span>Add</button>
              <button className="action"><span className="ic"><IconScan /></span>Pay</button>
              <button className="action"><span className="ic"><IconSplit /></span>Split</button>
            </div>

            <div className="section-head"><h2>Recent activity</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("activity"); }}>See all</a></div>
            <section className="card">
              {TX.slice(0, 4).map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.cat}</span></span>
                  <span className={t.in ? "amount in" : "amount"}>{t.amt}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "cards" && (
          <>
            <div className="paycard accent">
              <div className="row"><span className="brand">NOVA</span><span className="chip" aria-hidden /></div>
              <p className="num">4921 •••• •••• 8830</p>
              <div className="foot"><span>AMINE KADA</span><span>08 / 28</span></div>
            </div>
            <section className="card">
              <div className="row" style={{ marginBottom: ".7rem" }}>
                <div><strong style={{ fontSize: ".95rem" }}>Freeze card</strong><p className="muted" style={{ fontSize: ".8rem" }}>Instantly block payments</p></div>
                <button className={frozen ? "toggle on" : "toggle"} aria-pressed={frozen} onClick={() => setFrozen((v) => !v)} />
              </div>
              <div className="tx"><span className="ava" aria-hidden>◫</span><span className="meta"><strong>Card limits</strong><span>Daily · 500,000 CFA</span></span><span className="link">Edit</span></div>
              <div className="tx"><span className="ava" aria-hidden>≈</span><span className="meta"><strong>Contactless</strong><span>Enabled</span></span><span className="link">Manage</span></div>
              <div className="tx"><span className="ava" aria-hidden>＋</span><span className="meta"><strong>Virtual card</strong><span>Create a single-use number</span></span><span className="link">New</span></div>
            </section>
          </>
        )}

        {tab === "activity" && (
          <>
            <section className="card">
              <div className="row"><h3>Spent this week</h3><span className="pill">-63,180 CFA</span></div>
              <div className="bars" aria-hidden>
                {SPEND.map((b, i) => (
                  <div className="col" key={i}>
                    <div className="bar" style={{ height: `${b.h}%` }} />
                    <span className="bl">{b.d}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="card">
              {TX.map((t) => (
                <div className="tx" key={t.name}>
                  <span className="ava" aria-hidden>{t.glyph}</span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.cat}</span></span>
                  <span className={t.in ? "amount in" : "amount"}>{t.amt}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "account" && (
          <section className="card">
            <div className="tx"><span className="ava" aria-hidden>★</span><span className="meta"><strong>Nova+ membership</strong><span>Free transfers, higher limits</span></span><span className="link">Upgrade</span></div>
            <div className="tx"><span className="ava" aria-hidden>♁</span><span className="meta"><strong>Linked accounts</strong><span>Wave · Orange Money</span></span><span className="link">Manage</span></div>
            <div className="tx"><span className="ava" aria-hidden>⛨</span><span className="meta"><strong>Security</strong><span>Face ID · PIN</span></span><span className="link">Edit</span></div>
            <div className="tx"><span className="ava" aria-hidden>?</span><span className="meta"><strong>Help & support</strong><span>Chat with us 24/7</span></span><span className="link">Open</span></div>
          </section>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "cards" ? "tab active" : "tab"} aria-current={tab === "cards" ? "page" : undefined} onClick={() => setTab("cards")}><IconCard active={tab === "cards"} /><span>Cards</span></button>
        <button className={tab === "activity" ? "tab active" : "tab"} aria-current={tab === "activity" ? "page" : undefined} onClick={() => setTab("activity")}><IconActivity active={tab === "activity"} /><span>Activity</span></button>
        <button className={tab === "account" ? "tab active" : "tab"} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><IconUser active={tab === "account"} /><span>Account</span></button>
      </nav>
    </div>
  );
}

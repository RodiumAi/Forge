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
function IconTrips({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6.5" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <circle cx="17.5" cy="17.5" r="2.2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M6.5 8.7v4.3a3 3 0 0 0 3 3h5.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 3.4" />
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
function IconSearch() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.9" /><path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function IconPin() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.8" /></svg>;
}
function IconCar() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 16v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1h9v1a1 1 0 0 0 1 1H20a1 1 0 0 0 1-1v-2m-1-1-1.4-4.2A2 2 0 0 0 16.7 8H7.3a2 2 0 0 0-1.9 1.4L4 15h16Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="7.5" cy="15" r="1.1" fill="currentColor" /><circle cx="16.5" cy="15" r="1.1" fill="currentColor" /></svg>;
}
function IconComfort() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 16v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-1h9v1a1 1 0 0 0 1 1H20a1 1 0 0 0 1-1v-2m-1-1-1.4-4.2A2 2 0 0 0 16.7 8H7.3a2 2 0 0 0-1.9 1.4L4 15h16Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 8V6.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><circle cx="7.5" cy="15" r="1.1" fill="currentColor" /><circle cx="16.5" cy="15" r="1.1" fill="currentColor" /></svg>;
}
function IconVan() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M3 16v2a1 1 0 0 0 1 1h1.4a1 1 0 0 0 1-1v-1h9.2v1a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1v-2V8.5A1.5 1.5 0 0 0 18.5 7H4.5A1.5 1.5 0 0 0 3 8.5V16Zm0-4h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.6" cy="15" r="1.1" fill="currentColor" /><circle cx="16.4" cy="15" r="1.1" fill="currentColor" /></svg>;
}
function IconBolt() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity={0.16} /></svg>;
}
function IconChevron() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "rida_onboard_done";
const SLIDES = [
  { kicker: "Move now", title: "A ride in minutes", body: "Tap once and a nearby driver is on the way. No calls, no waiting on the curb." },
  { kicker: "No surprises", title: "Upfront prices", body: "See the exact fare before you book — every tier, every trip, locked in." },
  { kicker: "Peace of mind", title: "Track your driver", body: "Watch the car approach in real time and share your route with people you trust." },
];

type Tab = "home" | "trips" | "activity" | "account";
type RideId = "eco" | "comfort" | "van";

const RIDES: { id: RideId; name: string; desc: string; price: string; eta: string; Glyph: () => JSX.Element }[] = [
  { id: "eco", name: "Eco", desc: "Affordable, everyday", price: "2,400", eta: "3 min", Glyph: IconCar },
  { id: "comfort", name: "Comfort", desc: "Newer cars, more room", price: "3,650", eta: "5 min", Glyph: IconComfort },
  { id: "van", name: "Van", desc: "Up to 6 seats", price: "5,900", eta: "7 min", Glyph: IconVan },
];

const TRIPS = [
  { from: "Home", to: "Airport T2", date: "Today · 14:20", fare: "5,900", status: "Upcoming", up: true },
  { from: "Office", to: "Almadies", date: "Yesterday · 19:05", fare: "3,150", status: "Completed", up: false },
  { from: "Plateau", to: "Home", date: "Mon · 08:40", fare: "2,400", status: "Completed", up: false },
  { from: "Mall", to: "Ngor", date: "Sun · 21:15", fare: "4,200", status: "Cancelled", up: false },
];

const PLACES = [
  { label: "Home", addr: "Rue 12, Point E", glyph: "⌂" },
  { label: "Work", addr: "Rida HQ, Plateau", glyph: "▣" },
];

const RECEIPTS = [
  { name: "Airport T2", cat: "Comfort · Today", amt: "5,900" },
  { name: "Almadies", cat: "Eco · Yesterday", amt: "3,150" },
  { name: "Home", cat: "Eco · Mon", amt: "2,400" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [ride, setRide] = useState<RideId>("comfort");

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
          <div className="map-grid" />
          <svg className="onboard-route" viewBox="0 0 300 300" preserveAspectRatio="none">
            <path d="M40 250 C 90 190, 120 210, 160 150 S 230 70, 262 52" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
          </svg>
          <span className="map-origin" />
          <span className="map-pin"><IconPin /></span>
          <div className="glass">
            <p className="lbl muted" style={{ fontSize: ".72rem" }}>Nearest driver</p>
            <p className="amt">2 min <small>away</small></p>
            <span className="pill"><IconBolt /> Eco · 2,400 CFA</span>
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
            {last ? "Get started" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Rida", trips: "Trips", activity: "Activity", account: "Account" };
  const subs: Record<Tab, string> = { home: "Point E · Dakar", trips: "Your rides", activity: "This month", account: "Amine Kada" };

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
        <button className="nav-action" aria-label="Saved places"><IconPin /></button>
      </header>

      <main className="app-main">
        {tab === "home" && (
          <div className="ride-screen">
            <div className="map" aria-hidden>
              <div className="map-grid" />
              <svg className="map-route" viewBox="0 0 340 260" preserveAspectRatio="none">
                <path d="M46 214 C 96 170, 120 176, 150 132 S 214 66, 292 44" fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round" />
              </svg>
              <span className="map-origin" />
              <span className="map-pin"><IconPin /></span>
              <span className="map-car"><IconCar /></span>
            </div>

            <div className="ride-sheet">
              <span className="grabber" aria-hidden />
              <button className="wa-field">
                <span className="wa-ic"><IconSearch /></span>
                <span className="wa-text">Where to?</span>
                <span className="wa-tag">Now</span>
              </button>

              <p className="sheet-lbl">Choose a ride</p>
              <div className="rides">
                {RIDES.map((r) => (
                  <button
                    key={r.id}
                    className={ride === r.id ? "ride-opt sel" : "ride-opt"}
                    aria-pressed={ride === r.id}
                    onClick={() => setRide(r.id)}
                  >
                    <span className="ride-glyph"><r.Glyph /></span>
                    <span className="ride-meta">
                      <strong>{r.name}</strong>
                      <span>{r.desc} · {r.eta} away</span>
                    </span>
                    <span className="ride-price">{r.price}<small>CFA</small></span>
                  </button>
                ))}
              </div>

              <button className="btn-primary book"><IconBolt /> Book ride</button>
            </div>
          </div>
        )}

        {tab === "trips" && (
          <section className="card">
            {TRIPS.map((t) => (
              <div className="tx" key={t.from + t.date}>
                <span className="ava route-ava" aria-hidden><i className="r-dot" /><i className="r-line" /><i className="r-pin" /></span>
                <span className="meta">
                  <strong>{t.from} → {t.to}</strong>
                  <span>{t.date}</span>
                </span>
                <span className="trip-right">
                  <span className="amount">{t.fare}</span>
                  <span className={"status " + (t.up ? "up" : t.status === "Cancelled" ? "off" : "done")}>{t.status}</span>
                </span>
              </div>
            ))}
          </section>
        )}

        {tab === "activity" && (
          <>
            <div className="balance">
              <span className="card-chip" aria-hidden />
              <p className="lbl">Spent this month</p>
              <p className="amt">64,300 <small>CFA</small></p>
              <span className="delta"><IconBolt /> 18 rides · 214 km</span>
            </div>

            <div className="section-head"><h2>Favorite places</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("account"); }}>Edit</a></div>
            <div className="places">
              {PLACES.map((p) => (
                <div className="place" key={p.label}>
                  <span className="place-ic" aria-hidden>{p.glyph}</span>
                  <div><strong>{p.label}</strong><span className="muted">{p.addr}</span></div>
                </div>
              ))}
            </div>

            <div className="section-head"><h2>Receipts</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("trips"); }}>See all</a></div>
            <section className="card">
              {RECEIPTS.map((t) => (
                <div className="tx" key={t.name + t.cat}>
                  <span className="ava" aria-hidden><IconCar /></span>
                  <span className="meta"><strong>{t.name}</strong><span>{t.cat}</span></span>
                  <span className="amount">-{t.amt}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "account" && (
          <section className="card">
            <div className="tx"><span className="ava" aria-hidden>▤</span><span className="meta"><strong>Payment methods</strong><span>Wave · Visa •••• 8830</span></span><span className="link">Manage</span></div>
            <div className="tx"><span className="ava" aria-hidden>⌂</span><span className="meta"><strong>Saved places</strong><span>Home · Work · Gym</span></span><span className="link">Edit</span></div>
            <div className="tx"><span className="ava" aria-hidden>⛨</span><span className="meta"><strong>Safety</strong><span>Trusted contacts · Share trip</span></span><span className="link">Set up</span></div>
            <div className="tx"><span className="ava" aria-hidden>?</span><span className="meta"><strong>Help & support</strong><span>Trip issues · 24/7 chat</span></span><span className="link">Open</span></div>
          </section>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "trips" ? "tab active" : "tab"} aria-current={tab === "trips" ? "page" : undefined} onClick={() => setTab("trips")}><IconTrips active={tab === "trips"} /><span>Trips</span></button>
        <button className={tab === "activity" ? "tab active" : "tab"} aria-current={tab === "activity" ? "page" : undefined} onClick={() => setTab("activity")}><IconActivity active={tab === "activity"} /><span>Activity</span></button>
        <button className={tab === "account" ? "tab active" : "tab"} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><IconUser active={tab === "account"} /><span>Account</span></button>
      </nav>
    </div>
  );
}

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
      <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconBookmark({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0} />
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
function IconClock() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v4.2l2.8 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconFlame() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3c1 3-1.5 4-1.5 6.5A2.5 2.5 0 0 0 13 12c.4-1 .3-1.7.3-1.7 1.8 1.2 3.2 3.1 3.2 5.4A5.5 5.5 0 1 1 6.5 15c0-2.4 1.5-3.9 2.6-5.2C10.6 8 11.8 6 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
function IconStar() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconCart() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 5h2l1.6 10.2a1.5 1.5 0 0 0 1.5 1.3h7.6a1.5 1.5 0 0 0 1.5-1.2L20 8H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><circle cx="10" cy="20" r="1.3" fill="currentColor" /><circle cx="17" cy="20" r="1.3" fill="currentColor" /></svg>;
}

const ONBOARD_KEY = "sabor_onboard_done";
const SLIDES = [
  { kicker: "Cook tonight", title: "Recipes for real weeknights", body: "Honest dinners you can actually pull off after work — no 40-ingredient marathons." },
  { kicker: "Step by step", title: "Follow along, hands free", body: "Clear steps, timers, and swaps so you always know what happens next in the pan." },
  { kicker: "Save & shop", title: "Keep favorites, shop faster", body: "Bookmark what you love and turn any recipe into a tidy shopping list in a tap." },
];

type Tab = "home" | "search" | "saved" | "profile";

const HERO = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=70";
const THUMB_A = "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=200&q=70";
const THUMB_B = "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=200&q=70";

const CATEGORIES = ["Breakfast", "Quick", "Veggie", "Dessert", "Grill"];
const CUISINES = ["All", "Italian", "West African", "Thai", "Mexican", "Levantine"];

type Recipe = { name: string; meta: string; min: number; rating: number; img: string };

const RECIPES: Recipe[] = [
  { name: "Smoky Tomato Shakshuka", meta: "Breakfast · 2 servings", min: 25, rating: 4.8, img: THUMB_A },
  { name: "Peanut Chicken Bowls", meta: "West African · 4 servings", min: 35, rating: 4.7, img: THUMB_B },
  { name: "Charred Lemon Broccoli", meta: "Veggie · Side", min: 18, rating: 4.6, img: THUMB_A },
  { name: "Brown Butter Banana Bread", meta: "Dessert · 8 slices", min: 55, rating: 4.9, img: THUMB_B },
];

const SEARCH_RESULTS: Recipe[] = [
  { name: "15-Minute Garlic Noodles", meta: "Quick · Vegetarian", min: 15, rating: 4.7, img: THUMB_B },
  { name: "Weeknight Beef Tacos", meta: "Mexican · 4 servings", min: 30, rating: 4.5, img: THUMB_A },
  { name: "Green Curry with Tofu", meta: "Thai · 3 servings", min: 40, rating: 4.6, img: THUMB_B },
];

type Saved = { name: string; meta: string; min: number; times: number; img: string };
const SAVED: Saved[] = [
  { name: "Crispy Chili Fried Rice", meta: "Quick · Dinner", min: 20, times: 6, img: THUMB_A },
  { name: "One-Pot Tomato Orzo", meta: "Veggie · Dinner", min: 28, times: 3, img: THUMB_B },
  { name: "Honey Harissa Salmon", meta: "Grill · Dinner", min: 22, times: 4, img: THUMB_A },
  { name: "Coconut Rice Pudding", meta: "Dessert", min: 35, times: 2, img: THUMB_B },
];

const SHOPPING = [
  { item: "Roma tomatoes", qty: "6", done: false },
  { item: "Fresh cilantro", qty: "1 bunch", done: true },
  { item: "Coconut milk", qty: "2 cans", done: false },
];

const ALLERGIES = ["Peanut-free", "Low dairy", "No shellfish"];

const CHEFS = [
  { name: "Amara Okafor", note: "West African comfort", glyph: "🍲" },
  { name: "Leo Bianchi", note: "Fast Italian classics", glyph: "🍝" },
  { name: "Mei Tan", note: "Weeknight noodles", glyph: "🍜" },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="rating"><IconStar /> {n.toFixed(1)}</span>
  );
}

function RecipeRow({ r, tag }: { r: Recipe & { times?: number }; tag?: string }) {
  return (
    <div className="recipe">
      <span className="thumb" aria-hidden><img src={r.img} alt="" /></span>
      <span className="meta">
        <strong>{r.name}</strong>
        <span className="sub">{r.meta}</span>
        <span className="stats">
          <span className="stat"><IconClock /> {r.min} min</span>
          <Stars n={r.rating} />
          {tag && <span className="cook-again">{tag}</span>}
        </span>
      </span>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [cat, setCat] = useState("Breakfast");
  const [cuisine, setCuisine] = useState("All");
  const [query, setQuery] = useState("");

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
          <img src={HERO} alt="" />
          <div className="glass">
            <span className="pill"><IconClock /> 25 min · Easy</span>
            <p className="dish">Smoky Tomato Shakshuka</p>
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
            {last ? "Start cooking" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Sabor", search: "Search", saved: "Saved", profile: "Profile" };
  const subs: Record<Tab, string> = { home: "Good evening, Nadia", search: "Find tonight's dinner", saved: "Your cookbook", profile: "Nadia Rahmani" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp"><img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=70" alt="" /></span>
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
            <article className="hero">
              <img src={HERO} alt="" />
              <div className="hero-scrim" aria-hidden />
              <div className="hero-body">
                <span className="eyebrow">Featured tonight</span>
                <h2>Smoky Tomato Shakshuka</h2>
                <div className="hero-pills">
                  <span className="pill"><IconClock /> 25 min</span>
                  <span className="pill soft"><IconFlame /> Easy</span>
                </div>
              </div>
            </article>

            <div className="chips" role="tablist" aria-label="Categories">
              {CATEGORIES.map((c) => (
                <button key={c} className={c === cat ? "chip on" : "chip"} aria-pressed={c === cat} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>

            <div className="section-head"><h2>Popular this week</h2><a href="#" onClick={(e) => { e.preventDefault(); setTab("search"); }}>See all</a></div>
            <section className="card list">
              {RECIPES.map((r) => <RecipeRow key={r.name} r={r} />)}
            </section>
          </>
        )}

        {tab === "search" && (
          <>
            <label className="search">
              <IconSearch />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipes, ingredients…" aria-label="Search recipes" />
            </label>
            <div className="chips" role="tablist" aria-label="Cuisines">
              {CUISINES.map((c) => (
                <button key={c} className={c === cuisine ? "chip on" : "chip"} aria-pressed={c === cuisine} onClick={() => setCuisine(c)}>{c}</button>
              ))}
            </div>
            <div className="section-head"><h2>{cuisine === "All" ? "Trending" : cuisine}</h2><span className="muted count">{SEARCH_RESULTS.length} results</span></div>
            <section className="card list">
              {SEARCH_RESULTS.map((r) => <RecipeRow key={r.name} r={r} />)}
            </section>
          </>
        )}

        {tab === "saved" && (
          <>
            <div className="section-head"><h2>Saved recipes</h2><span className="pill soft">{SAVED.length} dishes</span></div>
            <div className="saved-grid">
              {SAVED.map((r) => (
                <article className="saved-card" key={r.name}>
                  <span className="saved-img" aria-hidden><img src={r.img} alt="" /></span>
                  <span className="cook-again floating">Cook again · {r.times}×</span>
                  <div className="saved-body">
                    <strong>{r.name}</strong>
                    <span className="sub">{r.meta}</span>
                    <span className="stat"><IconClock /> {r.min} min</span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "profile" && (
          <>
            <section className="card streak">
              <div>
                <p className="lbl">Cooking streak</p>
                <p className="streak-n">12 <small>days</small></p>
                <span className="pill soft"><IconFlame /> On a roll</span>
              </div>
              <div className="streak-week" aria-hidden>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} className={i < 5 ? "day on" : "day"}>{d}</span>
                ))}
              </div>
            </section>

            <div className="section-head"><h2>Shopping list</h2><span className="link">Clear</span></div>
            <section className="card list">
              {SHOPPING.map((s) => (
                <div className="shop" key={s.item}>
                  <span className={s.done ? "check on" : "check"} aria-hidden>{s.done ? "✓" : ""}</span>
                  <span className="meta"><strong className={s.done ? "struck" : ""}>{s.item}</strong></span>
                  <span className="qty">{s.qty}</span>
                </div>
              ))}
              <button className="add-shop"><IconCart /> Add ingredients</button>
            </section>

            <div className="section-head"><h2>Preferences</h2></div>
            <section className="card">
              <p className="lbl">Allergies & diet</p>
              <div className="chips wrap">
                {ALLERGIES.map((a) => <span key={a} className="chip on static">{a}</span>)}
              </div>
            </section>

            <div className="section-head"><h2>Following chefs</h2></div>
            <section className="card list">
              {CHEFS.map((c) => (
                <div className="chef" key={c.name}>
                  <span className="ava" aria-hidden>{c.glyph}</span>
                  <span className="meta"><strong>{c.name}</strong><span className="sub">{c.note}</span></span>
                  <span className="link">Following</span>
                </div>
              ))}
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "search" ? "tab active" : "tab"} aria-current={tab === "search" ? "page" : undefined} onClick={() => setTab("search")}><IconSearch active={tab === "search"} /><span>Search</span></button>
        <button className={tab === "saved" ? "tab active" : "tab"} aria-current={tab === "saved" ? "page" : undefined} onClick={() => setTab("saved")}><IconBookmark active={tab === "saved"} /><span>Saved</span></button>
        <button className={tab === "profile" ? "tab active" : "tab"} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><IconUser active={tab === "profile"} /><span>Profile</span></button>
      </nav>
    </div>
  );
}

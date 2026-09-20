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
      <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconBag({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 8h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8.5A1.5 1.5 0 0 1 7 19.5L6 8Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0} />
      <path d="M9 8V6.6a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
function IconLoupe() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.9" /><path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}
function IconPlus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" /></svg>;
}
function IconMinus() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" /></svg>;
}
function IconTrend() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 16l5-5 3.5 3.5L20 7M20 7h-4M20 7v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconBell() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "trove_onboard_done";
const SLIDES = [
  { kicker: "Welcome", title: "Curated finds, daily", body: "A hand-picked market of makers and small labels. Trove keeps the good stuff up front." },
  { kicker: "Checkout", title: "Buy it in two taps", body: "Saved cards and one-tap address. No forms, no friction — just your order on its way." },
  { kicker: "After the buy", title: "Track every parcel", body: "Live delivery updates, easy returns, and a wishlist that remembers what you loved." },
];

type Tab = "home" | "search" | "cart" | "account";

type Product = {
  id: string; name: string; label: string; price: number;
  img: string; grad: string;
};

const PRODUCTS: Product[] = [
  { id: "watch", name: "Heirloom Watch", label: "Tech · Kestrel Co.", price: 189, img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fed7aa,#fdba74)" },
  { id: "runner", name: "Trail Runner", label: "Style · Mesa Athletic", price: 120, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#ffedd5,#fb923c)" },
  { id: "tee", name: "Garment-Dyed Tee", label: "Style · Loom & Co.", price: 34, img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fef3c7,#fcd34d)" },
  { id: "overshirt", name: "Wool Overshirt", label: "Style · North Field", price: 96, img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fde68a,#f59e0b)" },
];

const CHIPS = ["New", "Home", "Style", "Tech", "Gifts"];
const TRENDING = ["Linen shirts", "Ceramic mugs", "Desk lamps", "Vintage watches", "Wool socks"];

const money = (n: number) => "$" + n.toLocaleString("en-US");

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("home");
  const [chip, setChip] = useState("New");
  const [cart, setCart] = useState<Record<string, number>>({ watch: 1, tee: 2 });

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function add(id: string) {
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  }
  function bump(id: string, delta: number) {
    setCart((c) => {
      const next = (c[id] || 0) + delta;
      const copy = { ...c };
      if (next <= 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartLines = PRODUCTS.filter((p) => cart[p.id]);
  const subtotal = cartLines.reduce((sum, p) => sum + p.price * cart[p.id], 0);

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <div className="tile" style={{ backgroundImage: PRODUCTS[1].grad }}>
            <img src={PRODUCTS[1].img} alt="" />
          </div>
          <div className="tile small" style={{ backgroundImage: PRODUCTS[0].grad }}>
            <img src={PRODUCTS[0].img} alt="" />
          </div>
          <div className="glass">
            <span className="pill">Free shipping over $75</span>
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
            {last ? "Start shopping" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { home: "Trove", search: "Search", cart: "Your cart", account: "Account" };
  const subs: Record<Tab, string> = { home: "Curated for Léa", search: "Find something good", cart: `${cartCount} item${cartCount === 1 ? "" : "s"}`, account: "Léa Moreau" };

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
        <button className="nav-action" aria-label={`Cart, ${cartCount} items`} onClick={() => setTab("cart")}>
          <IconBag />
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </button>
      </header>

      <main className="app-main">
        {tab === "home" && (
          <>
            <button className="searchbar" onClick={() => setTab("search")}>
              <IconLoupe /><span>Search makers, goods, gifts</span>
            </button>

            <div className="chips" role="tablist">
              {CHIPS.map((c) => (
                <button key={c} className={c === chip ? "chip on" : "chip"} onClick={() => setChip(c)}>{c}</button>
              ))}
            </div>

            <div className="promo">
              <div className="promo-copy">
                <span className="promo-tag">Autumn edit</span>
                <h2>Up to 30% off<br />makers we love</h2>
                <span className="promo-cta">Shop the edit →</span>
              </div>
              <span className="promo-orb" aria-hidden />
            </div>

            <div className="section-head"><h2>Fresh finds</h2><a href="#" onClick={(e) => { e.preventDefault(); setChip("New"); }}>See all</a></div>
            <div className="grid">
              {PRODUCTS.map((p) => (
                <article className="product" key={p.id}>
                  <div className="thumb" style={{ backgroundImage: p.grad }}>
                    <img src={p.img} alt="" loading="lazy" />
                  </div>
                  <div className="pmeta">
                    <strong>{p.name}</strong>
                    <span>{p.label}</span>
                  </div>
                  <div className="prow">
                    <span className="price">{money(p.price)}</span>
                    <button className="add" aria-label={`Add ${p.name} to cart`} onClick={() => add(p.id)}><IconPlus /></button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {tab === "search" && (
          <>
            <div className="searchbar live">
              <IconLoupe /><input placeholder="Search makers, goods, gifts" aria-label="Search" />
            </div>

            <div className="section-head"><h2>Trending now</h2></div>
            <div className="chips wrap">
              {TRENDING.map((t) => (
                <button key={t} className="chip"><IconTrend /> {t}</button>
              ))}
            </div>

            <div className="section-head"><h2>Popular picks</h2></div>
            <section className="card">
              {PRODUCTS.map((p) => (
                <div className="row-item" key={p.id}>
                  <span className="ava" style={{ backgroundImage: p.grad }}><img src={p.img} alt="" loading="lazy" /></span>
                  <span className="meta"><strong>{p.name}</strong><span>{p.label}</span></span>
                  <span className="price">{money(p.price)}</span>
                </div>
              ))}
            </section>
          </>
        )}

        {tab === "cart" && (
          <>
            {cartLines.length === 0 ? (
              <section className="card empty">
                <span className="empty-orb" aria-hidden><IconBag /></span>
                <strong>Your cart is empty</strong>
                <p className="muted">Browse the edit and tap + to add your first find.</p>
                <button className="btn-primary" onClick={() => setTab("home")}>Start shopping</button>
              </section>
            ) : (
              <>
                <section className="card">
                  {cartLines.map((p) => (
                    <div className="row-item" key={p.id}>
                      <span className="ava" style={{ backgroundImage: p.grad }}><img src={p.img} alt="" loading="lazy" /></span>
                      <span className="meta">
                        <strong>{p.name}</strong>
                        <span className="price sm">{money(p.price)}</span>
                      </span>
                      <span className="stepper">
                        <button aria-label={`Remove one ${p.name}`} onClick={() => bump(p.id, -1)}><IconMinus /></button>
                        <b>{cart[p.id]}</b>
                        <button aria-label={`Add one ${p.name}`} onClick={() => bump(p.id, 1)}><IconPlus /></button>
                      </span>
                    </div>
                  ))}
                </section>

                <section className="card summary">
                  <div className="row"><span className="muted">Subtotal</span><span className="price">{money(subtotal)}</span></div>
                  <div className="row"><span className="muted">Shipping</span><span className="price free">{subtotal >= 75 ? "Free" : money(6)}</span></div>
                  <div className="row total"><span>Total</span><span className="price">{money(subtotal >= 75 ? subtotal : subtotal + 6)}</span></div>
                </section>

                <button className="btn-primary checkout">Checkout · {money(subtotal >= 75 ? subtotal : subtotal + 6)}</button>
              </>
            )}
          </>
        )}

        {tab === "account" && (
          <>
            <section className="card profile">
              <span className="pfp lg"><img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70" alt="" /></span>
              <div><strong>Léa Moreau</strong><p className="muted">Trove member since 2023</p></div>
              <span className="pill">Gold</span>
            </section>
            <section className="card">
              <div className="row-item"><span className="ava tint" aria-hidden>❑</span><span className="meta"><strong>Orders</strong><span>2 on the way · 14 delivered</span></span><span className="link">Track</span></div>
              <div className="row-item"><span className="ava tint" aria-hidden>⌂</span><span className="meta"><strong>Addresses</strong><span>Home · Studio</span></span><span className="link">Edit</span></div>
              <div className="row-item"><span className="ava tint" aria-hidden>▭</span><span className="meta"><strong>Payment</strong><span>Visa •••• 4417</span></span><span className="link">Manage</span></div>
              <div className="row-item"><span className="ava tint" aria-hidden>♡</span><span className="meta"><strong>Wishlist</strong><span>9 saved items</span></span><span className="link">Open</span></div>
              <div className="row-item"><span className="ava tint" aria-hidden><IconBell /></span><span className="meta"><strong>Notifications</strong><span>Drops & delivery updates</span></span><span className="link">Set</span></div>
            </section>
          </>
        )}
      </main>

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "home" ? "tab active" : "tab"} aria-current={tab === "home" ? "page" : undefined} onClick={() => setTab("home")}><IconHome active={tab === "home"} /><span>Home</span></button>
        <button className={tab === "search" ? "tab active" : "tab"} aria-current={tab === "search" ? "page" : undefined} onClick={() => setTab("search")}><IconSearch active={tab === "search"} /><span>Search</span></button>
        <button className={tab === "cart" ? "tab active" : "tab"} aria-current={tab === "cart" ? "page" : undefined} onClick={() => setTab("cart")}>
          <span className="tab-ic">
            <IconBag active={tab === "cart"} />
            {cartCount > 0 && <span className="badge">{cartCount}</span>}
          </span>
          <span>Cart</span>
        </button>
        <button className={tab === "account" ? "tab active" : "tab"} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><IconUser active={tab === "account"} /><span>Account</span></button>
      </nav>
    </div>
  );
}

const U = (id: string, w: number, extra = "") =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70${extra}`;

const popular = [
  { name: "Heritage Chrono Watch", cat: "Accessories", price: "$129.00", old: "$159.00", g: "linear-gradient(135deg,#d6c9b8,#8a7a63)", img: U("photo-1523275335684-37898b6baf30", 800), alt: "Minimalist wristwatch with a tan leather strap" },
  { name: "Court Classic Sneaker", cat: "Men", price: "$74.00", old: "", g: "linear-gradient(135deg,#e8d5d0,#b08a80)", img: U("photo-1542291026-7eec264c27ff", 800), alt: "Red and white running sneaker on a red background" },
  { name: "Organic Cotton Tee", cat: "Women", price: "$24.50", old: "$32.00", g: "linear-gradient(135deg,#cfd8dc,#78909c)", img: U("photo-1521572163474-6864f9cf17ab", 800), alt: "Plain white cotton t-shirt on a hanger" },
  { name: "Studio Over-Ear Headphones", cat: "Accessories", price: "$89.00", old: "", g: "linear-gradient(135deg,#e0dcd3,#9c9484)", img: U("photo-1505740420928-5e560c06d30e", 800), alt: "Black over-ear wireless headphones" },
];

const latest = [
  { name: "Waxed Field Jacket", cat: "Men", price: "$118.00", old: "$140.00", g: "linear-gradient(135deg,#f2e2c4,#c9a15a)", img: U("photo-1591047139829-d91aecb6caea", 800), alt: "Man wearing a dark waxed canvas jacket" },
  { name: "Capsule Wardrobe Set", cat: "Women", price: "$96.00", old: "", g: "linear-gradient(135deg,#c8d6c4,#6e8a68)", img: U("photo-1434389677669-e08b4cac3105", 800), alt: "Rack of neutral-toned garments on wooden hangers" },
  { name: "Heritage Chrono, Steel", cat: "Accessories", price: "$139.00", old: "$165.00", g: "linear-gradient(135deg,#d8c4b4,#7d5a44)", img: U("photo-1523275335684-37898b6baf30", 800, "&crop=entropy"), alt: "Close crop of a leather-strap wristwatch" },
  { name: "Court Classic, Crimson", cat: "Men", price: "$79.50", old: "", g: "linear-gradient(135deg,#c4d4e4,#5a7a9c)", img: U("photo-1542291026-7eec264c27ff", 800, "&crop=entropy"), alt: "Detail crop of a red sneaker sole" },
];

const categories = [
  { label: "Men", g: "linear-gradient(160deg,#374151,#111827)", img: U("photo-1521572163474-6864f9cf17ab", 800), alt: "White t-shirt on a hanger" },
  { label: "Women", g: "linear-gradient(160deg,#9a6a5a,#5a3a30)", img: U("photo-1591047139829-d91aecb6caea", 800), alt: "Person wearing a dark field jacket" },
  { label: "Accessories", g: "linear-gradient(160deg,#8a7a52,#4a4028)", img: U("photo-1505740420928-5e560c06d30e", 800), alt: "Black over-ear headphones" },
];

type Product = { name: string; cat: string; price: string; old: string; g: string; img: string; alt: string };

function ProductCard({ p }: { p: Product }) {
  return (
    <article className="card">
      <div className="card-img" style={{ background: p.g }}>
        <img src={p.img} alt={p.alt} loading="lazy" />
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="cat">{p.cat}</p>
        <p className="price">
          <span>{p.price}</span>
          {p.old ? <s>{p.old}</s> : null}
        </p>
        <button className="btn btn-cart">Add to Cart</button>
      </div>
    </article>
  );
}

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <span className="logo">Verano&amp;Co</span>
        <nav>
          <a href="#shop">Home</a>
          <a href="#shop">Men</a>
          <a href="#shop">Women</a>
          <a href="#shop">Accessories</a>
        </nav>
        <button className="cart" aria-label="Cart">
          <span className="cart-icon">&#9645;</span> Cart <span className="badge">3</span>
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Autumn drop 2026</p>
          <h1>Everyday pieces, made to outlast the season</h1>
          <p className="lead">
            Natural fabrics, honest cuts and prices that don&apos;t need a sale sticker.
          </p>
          <a className="btn btn-accent" href="#shop">Shop the collection</a>
        </div>
        <div className="hero-art">
          <img
            src={U("photo-1434389677669-e08b4cac3105", 1200)}
            alt="Curated rack of neutral-toned clothing on wooden hangers"
          />
        </div>
      </section>

      <section className="cats">
        {categories.map((c) => (
          <a key={c.label} className="cat-tile" href="#shop" style={{ background: c.g }}>
            <img src={c.img} alt={c.alt} loading="lazy" />
            <h2>{c.label}</h2>
            <span>Shop now &rarr;</span>
          </a>
        ))}
      </section>

      <section className="grid-section" id="shop">
        <h2>Popular products</h2>
        <div className="grid">
          {popular.map((p) => <ProductCard key={p.name} p={p} />)}
        </div>
      </section>

      <section className="promo">
        <h2>Join the list, get 15% off your first order</h2>
        <form onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="you@example.com" aria-label="Email" />
          <button className="btn btn-dark" type="submit">Subscribe</button>
        </form>
      </section>

      <section className="grid-section">
        <h2>Latest arrivals</h2>
        <div className="grid">
          {latest.map((p) => <ProductCard key={p.name} p={p} />)}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-cols">
          <div>
            <h3>Verano&amp;Co</h3>
            <p>A small fictional label shipping slow fashion since never.</p>
          </div>
          <div>
            <h4>Shop</h4>
            <a href="#shop">Men</a>
            <a href="#shop">Women</a>
            <a href="#shop">Accessories</a>
          </div>
          <div>
            <h4>Help</h4>
            <a href="#shop">Shipping</a>
            <a href="#shop">Returns</a>
            <a href="#shop">Contact</a>
          </div>
        </div>
        <p className="copyright">&copy; 2026 Verano&amp;Co. A fictional demo storefront.</p>
      </footer>
    </div>
  );
}

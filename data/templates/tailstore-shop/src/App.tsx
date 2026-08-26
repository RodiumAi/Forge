const popular = [
  { name: "Linen Field Jacket", cat: "Men", price: "$54.00", old: "$68.00", g: "linear-gradient(135deg,#d6c9b8,#8a7a63)" },
  { name: "Ribbed Knit Dress", cat: "Women", price: "$42.00", old: "", g: "linear-gradient(135deg,#e8d5d0,#b08a80)" },
  { name: "Canvas Weekender Bag", cat: "Accessories", price: "$36.50", old: "$45.00", g: "linear-gradient(135deg,#cfd8dc,#78909c)" },
  { name: "Slim Chino Trousers", cat: "Men", price: "$38.00", old: "", g: "linear-gradient(135deg,#e0dcd3,#9c9484)" },
];

const latest = [
  { name: "Pleated Midi Skirt", cat: "Women", price: "$34.00", old: "$41.00", g: "linear-gradient(135deg,#f2e2c4,#c9a15a)" },
  { name: "Merino Crew Sweater", cat: "Men", price: "$59.00", old: "", g: "linear-gradient(135deg,#c8d6c4,#6e8a68)" },
  { name: "Leather Card Wallet", cat: "Accessories", price: "$22.00", old: "$28.00", g: "linear-gradient(135deg,#d8c4b4,#7d5a44)" },
  { name: "Oversized Denim Shirt", cat: "Women", price: "$44.50", old: "", g: "linear-gradient(135deg,#c4d4e4,#5a7a9c)" },
];

const categories = [
  { label: "Men", g: "linear-gradient(160deg,#374151,#111827)" },
  { label: "Women", g: "linear-gradient(160deg,#9a6a5a,#5a3a30)" },
  { label: "Accessories", g: "linear-gradient(160deg,#8a7a52,#4a4028)" },
];

type Product = { name: string; cat: string; price: string; old: string; g: string };

function ProductCard({ p }: { p: Product }) {
  return (
    <article className="card">
      <div className="card-img" style={{ background: p.g }} />
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
        <div className="hero-art" />
      </section>

      <section className="cats">
        {categories.map((c) => (
          <a key={c.label} className="cat-tile" href="#shop" style={{ background: c.g }}>
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

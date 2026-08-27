import { useState } from "react";

const lookbook = [
  {
    img: "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1200&q=70",
    title: "Look 01 — Robe Colonne",
    note: "Silk crêpe, hand-draped",
  },
  {
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=70",
    title: "Look 02 — Manteau Arc",
    note: "Double-face cashmere",
  },
  {
    img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1200&q=70",
    title: "Look 03 — Trio d'Ivoire",
    note: "Collection ensemble",
  },
  {
    img: "https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=1200&q=70",
    title: "Look 04 — Ligne Nue",
    note: "Bias-cut charmeuse",
  },
];

const products = [
  {
    img: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=70",
    name: "Le Trench Vernet",
    fabric: "Water-resistant gabardine",
    price: "€2,450",
  },
  {
    img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=1200&q=70",
    name: "Chemise Aube",
    fabric: "Washed silk twill",
    price: "€890",
  },
  {
    img: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=70",
    name: "Robe Méridienne",
    fabric: "Fluid crêpe de Chine",
    price: "€1,780",
  },
  {
    img: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=70",
    name: "Veste Atelier",
    fabric: "Structured wool bouclé",
    price: "€1,960",
  },
];

const heritage = [
  { year: "1932", event: "Élise Vernet opens a two-room atelier on Rue Cambon, Paris." },
  { year: "1954", event: "The Robe Colonne debuts and enters the permanent collection of the Musée des Arts Décoratifs." },
  { year: "1987", event: "The maison introduces its made-to-measure salon, by appointment only." },
  { year: "2021", event: "Third-generation direction; every piece still cut and finished by hand in Paris." },
];

const journal = [
  {
    date: "March 2026",
    title: "Inside the Toile Room",
    excerpt: "Before silk, there is cotton. A look at the muslin prototypes behind Look 01.",
  },
  {
    date: "January 2026",
    title: "The Weavers of Lake Como",
    excerpt: "Meet the family mill that has supplied the maison's crêpe for four decades.",
  },
  {
    date: "November 2025",
    title: "A Coat, Repaired Twice",
    excerpt: "One client, one trench, twenty-two years. Notes from the restoration bench.",
  },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="page">
      {/* Announcement */}
      <div className="announce">Complimentary worldwide delivery on orders over €1,000 — returns within 30 days</div>

      {/* Navbar */}
      <header className="topbar">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          {menuOpen ? "✕" : "☰"}
        </button>
        <nav className={`nav ${menuOpen ? "open" : ""}`}>
          <a href="#collection">Collection</a>
          <a href="#lookbook">Lookbook</a>
          <a href="#heritage">Maison</a>
        </nav>
        <div className="brand">MAISON VERNET</div>
        <div className="topbar-right">
          <a href="#collection" className="top-link">Search</a>
          <a href="#collection" className="top-link">Cart (0)</a>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <img
          className="hero-img"
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=70"
          alt="Editorial fashion portrait"
        />
        <div className="hero-veil" />
        <div className="hero-copy">
          <p className="kicker">Automne — Hiver 2026</p>
          <h1>La Ligne Silencieuse</h1>
          <p className="hero-sub">Twenty-two looks cut in ivory, ink and bronze. Draped by hand in the Paris atelier.</p>
          <a href="#collection" className="btn-ghost">Discover the collection</a>
        </div>
      </section>

      {/* Marquee band */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[0, 1].map((i) => (
            <span key={i} className="marquee-seg">
              HAUTE COUTURE&nbsp;·&nbsp;PARIS&nbsp;·&nbsp;DEPUIS 1932&nbsp;·&nbsp;FAIT MAIN&nbsp;·&nbsp;
              HAUTE COUTURE&nbsp;·&nbsp;PARIS&nbsp;·&nbsp;DEPUIS 1932&nbsp;·&nbsp;FAIT MAIN&nbsp;·&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Lookbook — offset grid */}
      <section className="lookbook" id="lookbook">
        <div className="section-head">
          <p className="kicker">Lookbook</p>
          <h2>The Season, Framed</h2>
        </div>
        <div className="look-grid">
          {lookbook.map((look, i) => (
            <figure className={`look look-${i + 1}`} key={look.title}>
              <img src={look.img} alt={look.title} loading="lazy" />
              <figcaption>
                <span className="look-title">{look.title}</span>
                <span className="look-note">{look.note}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Products */}
      <section className="shop" id="collection">
        <div className="section-head">
          <p className="kicker">The Collection</p>
          <h2>Pieces of the Season</h2>
          <p className="section-sub">Each garment is numbered, signed by its première main, and delivered in the maison's linen box.</p>
        </div>
        <div className="product-grid">
          {products.map((p) => (
            <article className="product" key={p.name}>
              <div className="product-media">
                <img src={p.img} alt={p.name} loading="lazy" />
                <span className="product-hover">View piece →</span>
              </div>
              <div className="product-info">
                <h3>{p.name}</h3>
                <p className="product-fabric">{p.fabric}</p>
                <p className="product-price">{p.price}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="shop-more">
          <a href="#collection" className="btn-line">View all 22 pieces</a>
        </div>
      </section>

      {/* Heritage */}
      <section className="heritage" id="heritage">
        <div className="heritage-media">
          <img
            src="https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1200&q=70"
            alt="Garments in the atelier"
            loading="lazy"
          />
        </div>
        <div className="heritage-copy">
          <p className="kicker">La Maison</p>
          <h2>Ninety Years of the Quiet Hand</h2>
          <p className="heritage-lede">
            Maison Vernet has never advertised. It has never licensed a perfume. It makes clothes, slowly,
            for people who understand that restraint is the rarest luxury of all.
          </p>
          <ul className="timeline">
            {heritage.map((h) => (
              <li key={h.year}>
                <span className="timeline-year">{h.year}</span>
                <span className="timeline-event">{h.event}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Services */}
      <section className="services">
        <div className="service">
          <span className="service-mark">I</span>
          <h3>Made to Measure</h3>
          <p>Three fittings in our Rue Cambon salon. Six weeks from first sketch to final press.</p>
        </div>
        <div className="service">
          <span className="service-mark">II</span>
          <h3>Lifetime Repair</h3>
          <p>Every Vernet piece may return to the atelier for restoration, without charge, forever.</p>
        </div>
        <div className="service">
          <span className="service-mark">III</span>
          <h3>Private Appointment</h3>
          <p>The full collection presented over tea, in Paris or at your residence in Europe.</p>
        </div>
      </section>

      {/* Journal */}
      <section className="journal">
        <div className="section-head">
          <p className="kicker">Journal</p>
          <h2>Notes from the Atelier</h2>
        </div>
        <div className="journal-grid">
          {journal.map((j) => (
            <article className="journal-card" key={j.title}>
              <p className="journal-date">{j.date}</p>
              <h3>{j.title}</h3>
              <p className="journal-excerpt">{j.excerpt}</p>
              <a href="#heritage" className="btn-line">Read the note</a>
            </article>
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="letter">
        <p className="kicker">Correspondence</p>
        <h2>Le Journal de la Maison</h2>
        <p className="letter-sub">One letter per season. Atelier notes, fabric stories, and first access to new pieces.</p>
        {subscribed ? (
          <p className="letter-thanks">Merci. Your first letter arrives with the new season.</p>
        ) : (
          <form
            className="letter-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setSubscribed(true);
            }}
          >
            <input
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">Subscribe</button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-brand">MAISON VERNET</div>
        <div className="footer-cols">
          <div>
            <h4>Maison</h4>
            <a href="#heritage">Our story</a>
            <a href="#heritage">The atelier</a>
            <a href="#heritage">Savoir-faire</a>
          </div>
          <div>
            <h4>Client care</h4>
            <a href="#collection">Shipping</a>
            <a href="#collection">Returns</a>
            <a href="#collection">Size guide</a>
          </div>
          <div>
            <h4>Visit</h4>
            <p className="footer-addr">
              31 Rue Cambon
              <br />
              75001 Paris
              <br />
              By appointment
            </p>
          </div>
        </div>
        <div className="footer-base">
          <span>© 2026 Maison Vernet</span>
          <span>Paris — Fait main depuis 1932</span>
        </div>
      </footer>
    </div>
  );
}

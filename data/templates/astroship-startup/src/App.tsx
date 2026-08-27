const features = [
  { icon: "◆", title: "Composable Blocks", text: "Assemble your pages from prebuilt sections and swap them out without touching the rest of your layout." },
  { icon: "⚡", title: "Zero-Weight Pages", text: "Every page ships as lean static markup, so visitors see content instantly on any connection." },
  { icon: "◔", title: "Smart Hydration", text: "Interactive widgets wake up only when they scroll into view, keeping the main thread free." },
  { icon: "⬡", title: "Plays Well With Others", text: "Bring your favorite tooling — type checking, scoped styles, markdown content and npm packages all just work." },
  { icon: "▲", title: "Search Ready", text: "Sitemaps, feeds and structured metadata are generated for you, so discoverability is never an afterthought." },
  { icon: "✦", title: "Guided by Makers", text: "A growing library of recipes and examples from indie builders keeps you moving when you get stuck." },
];

const logos = ["Norvane", "Quillbay", "Hexlight", "Marloe", "Driftkit", "Souther"];

export default function App() {
  return (
    <div className="page">
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href="#">
            Launch<span>path</span>
          </a>
          <nav className="nav">
            <a href="#features">Features</a>
            <a href="#">Pricing</a>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Contact</a>
          </nav>
          <div className="topbar-actions">
            <a className="link-quiet" href="#">Log in</a>
            <a className="btn btn-dark" href="#">Sign up</a>
          </div>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-art">
          <img
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70"
            alt="Analytics dashboard showing product metrics on a screen"
          />
        </div>
        <div className="hero-copy">
          <h1>Ship your startup site before lunch</h1>
          <p>
            Launchpath is a fictional starter kit for founders who want a marketing
            site that loads fast, reads well and grows with the product — without
            hiring a whole front-end team.
          </p>
          <div className="hero-cta">
            <a className="btn btn-dark" href="#">Get Started Free</a>
            <a className="btn btn-ghost" href="#">View on GitHub</a>
          </div>
        </div>
      </section>

      <section className="logos container">
        <p className="logos-label">Trusted by teams that move quickly</p>
        <div className="logos-row">
          {logos.map((l) => (
            <span key={l} className="logo-item">{l}</span>
          ))}
        </div>
      </section>

      <section id="features" className="features container">
        <div className="section-head">
          <h2>Everything you need to launch with confidence</h2>
          <p>
            Batteries included. Launchpath bundles the essentials so your first
            deploy already feels production grade.
          </p>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <article key={f.title} className="feature">
              <div className="feature-icon">{f.icon}</div>
              <div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta container">
        <div className="cta-visual">
          <img
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=70"
            alt="Laptop displaying growth charts on a desk"
            loading="lazy"
          />
        </div>
        <div className="cta-box">
          <h2>Build faster. Launch sooner.</h2>
          <p>Spin up a polished marketing site today and iterate as your product finds its audience.</p>
          <a className="btn btn-light" href="#">Get Started</a>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-inner">
          <p>Copyright © 2026 Launchpath. All rights reserved.</p>
          <p className="footer-muted">A fictional product built for demo purposes.</p>
        </div>
      </footer>
    </div>
  );
}

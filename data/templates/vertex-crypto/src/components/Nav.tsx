import BrandMark from "./BrandMark";

export default function Nav() {
  return (
    <header className="nav">
      <div className="container nav-inner">
        <a className="brand" href="#top">
          <BrandMark size={22} />
          VERTEX
        </a>
        <nav className="nav-links">
          <a href="#markets">Markets</a>
          <a href="#features">Trade</a>
          <a href="#security">Security</a>
          <a href="#top">Institutional</a>
          <a href="#top">Learn</a>
        </nav>
        <div className="nav-actions">
          <a className="btn btn-ghost" href="#top">Log in</a>
          <a className="btn btn-neon" href="#cta">Get started</a>
        </div>
      </div>
    </header>
  );
}

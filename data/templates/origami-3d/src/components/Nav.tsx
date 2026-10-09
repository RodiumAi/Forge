export default function Nav() {
  return (
    <header className="nav">
      <a className="nav-logo" href="#top">
        <span className="nav-mark" aria-hidden="true" />
        Foldspace
      </a>
      <nav className="nav-links">
        <a href="#how">How it works</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#faq">FAQ</a>
      </nav>
      <div className="nav-actions">
        <a className="btn btn-ghost" href="#pricing">Sign in</a>
        <a className="btn btn-solid" href="#pricing">Start folding</a>
      </div>
    </header>
  );
}

export default function Nav() {
  return (
    <header className="topbar">
      <span className="brand">Pulsedeck</span>
      <nav className="nav">
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="#contact">Contact</a>
      </nav>
      <a className="btn btn-primary" href="#pricing">Get started</a>
    </header>
  );
}

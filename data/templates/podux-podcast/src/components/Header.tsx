export default function Header() {
  return (
    <header className="header">
      <span className="logo">Signal&amp;Noise</span>
      <nav>
        <a href="#episodes">Episodes</a>
        <a href="#hosts">Hosts</a>
        <a href="#subscribe">Subscribe</a>
      </nav>
      <a className="btn btn-accent" href="#subscribe">Follow the show</a>
    </header>
  );
}

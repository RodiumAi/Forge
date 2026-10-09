export default function Nav() {
  return (
    <header className="nav">
      <a className="logo" href="#top">
        META<span>MORPH</span>
      </a>
      <nav className="nav-links">
        <a href="#work">Work</a>
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#contact" className="nav-pill">Let's talk</a>
      </nav>
    </header>
  );
}

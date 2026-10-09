export default function Topbar() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <a className="brand" href="#">Kovento<span>.</span></a>
        <nav className="nav">
          <a href="#services">Services</a>
          <a href="#work">Work</a>
          <a href="#process">Process</a>
          <a href="#">Blog</a>
          <a href="#">Contact</a>
        </nav>
        <a className="btn btn-accent" href="#">Get Started</a>
      </div>
    </header>
  );
}

export default function Topbar() {
  return (
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
  );
}

const NAV = ["Index", "Essay", "Quote", "Archive", "Subscribe"];

export default function Masthead() {
  return (
    <header className="masthead">
      <div className="masthead-row">
        <span className="masthead-date">February 2026</span>
        <a className="wordmark" href="#top">MONOCHROME</a>
        <span className="masthead-issue">Issue <span className="accent">№ 12</span></span>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
        ))}
      </nav>
    </header>
  );
}

const NAV = ["Experience", "Projects", "Education", "Testimonials", "Blogs"];

export default function Nav() {
  return (
    <header className="topbar">
      <span className="brand">mira.solano<span className="brand-dot">()</span></span>
      <nav className="nav">
        {NAV.map((item) => (
          <a key={item} href={"#" + item.toLowerCase()}>{item}</a>
        ))}
      </nav>
    </header>
  );
}

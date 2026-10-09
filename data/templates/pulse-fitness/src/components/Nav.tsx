import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="nav">
      <a className="nav-logo" href="#top">
        PULSE<span>/</span>CLUB
      </a>
      <nav className={"nav-links" + (menuOpen ? " open" : "")}>
        <a href="#programs" onClick={() => setMenuOpen(false)}>Programs</a>
        <a href="#results" onClick={() => setMenuOpen(false)}>Results</a>
        <a href="#coaches" onClick={() => setMenuOpen(false)}>Coaches</a>
        <a href="#plans" onClick={() => setMenuOpen(false)}>Plans</a>
      </nav>
      <a className="nav-cta" href="#plans">JOIN NOW</a>
      <button className="nav-burger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
    </header>
  );
}

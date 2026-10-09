import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <a className="wordmark" href="#top">
        QUANTUM<span>PARTNERS</span>
      </a>
      <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <nav className={`nav ${menuOpen ? "open" : ""}`}>
        <a href="#practices">Practices</a>
        <a href="#evidence">Evidence</a>
        <a href="#cases">Case Studies</a>
        <a href="#leadership">Leadership</a>
        <a href="#contact" className="nav-contact">Start a conversation</a>
      </nav>
    </header>
  );
}

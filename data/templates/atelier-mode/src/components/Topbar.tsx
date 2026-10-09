import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="topbar">
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
        {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>
      <nav className={`nav ${menuOpen ? "open" : ""}`}>
        <a href="#collection">Collection</a>
        <a href="#lookbook">Lookbook</a>
        <a href="#heritage">Maison</a>
      </nav>
      <div className="brand">MAISON VERNET</div>
      <div className="topbar-right">
        <a href="#collection" className="top-link">Search</a>
        <a href="#collection" className="top-link">Cart (0)</a>
      </div>
    </header>
  );
}

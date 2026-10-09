import { useState } from "react";
import { Menu } from "lucide-react";
import Brand from "./Brand";

const NAV_LINKS = ["Product", "Features", "Pricing", "Customers", "Docs"];

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="nav">
      <div className="container nav-inner">
        <Brand />
        <nav className={`nav-links ${menuOpen ? "open" : ""}`}>
          {NAV_LINKS.map((link) => (
            <a key={link} href={`#${link.toLowerCase()}`} onClick={() => setMenuOpen(false)}>
              {link}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <a className="btn btn-ghost" href="#pricing">Sign in</a>
          <a className="btn btn-primary" href="#pricing">Get started</a>
          <button className="nav-burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <Menu size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

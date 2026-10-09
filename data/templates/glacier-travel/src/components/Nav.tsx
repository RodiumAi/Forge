import { Triangle } from "lucide-react";

export default function Nav() {
  return (
    <header className="nav">
      <a className="nav-logo" href="#top">
        <span className="nav-peak" aria-hidden="true">
          <Triangle className="logo-peak" size={15} fill="currentColor" />
        </span> Glacier Expeditions
      </a>
      <nav className="nav-links">
        <a href="#destinations">Destinations</a>
        <a href="#itinerary">Itinerary</a>
        <a href="#guides">Guides</a>
        <a href="#book" className="nav-book">Book a journey</a>
      </nav>
    </header>
  );
}

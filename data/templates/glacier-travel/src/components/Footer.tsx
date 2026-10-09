import { Triangle } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <p className="footer-logo">
            <Triangle className="logo-peak" size={15} fill="currentColor" aria-hidden="true" /> Glacier Expeditions
          </p>
          <p className="footer-small">
            Longyearbyen · Punta Arenas · Reykjavík
            <br />© 2026 Glacier Expeditions AS
          </p>
        </div>
        <div>
          <p className="footer-head">Journeys</p>
          <a href="#destinations">Patagonia</a>
          <a href="#destinations">Svalbard</a>
          <a href="#destinations">Iceland</a>
          <a href="#destinations">Karakoram</a>
        </div>
        <div>
          <p className="footer-head">Company</p>
          <a href="#guides">Guides</a>
          <a href="#top">Safety record</a>
          <a href="#top">Journal</a>
        </div>
        <div>
          <p className="footer-head">Contact</p>
          <a href="#book">hello@glacierexp.com</a>
          <a href="#book">+47 79 02 33 10</a>
        </div>
      </div>
    </footer>
  );
}

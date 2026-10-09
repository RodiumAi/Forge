import { Flower } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <span className="logo-dot"><Flower size={15} aria-hidden="true" /></span> Bloom Studio
          <p>A small sanctuary for slow hours.</p>
        </div>
        <div className="footer-links">
          <a href="#treatments">Treatments</a>
          <a href="#schedule">Classes</a>
          <a href="#ritual">The Ritual</a>
          <a href="#visit">Book</a>
        </div>
      </div>
      <div className="footer-base">
        <span>© 2026 Bloom Studio</span>
        <span>Made with warm towels and patience</span>
      </div>
    </footer>
  );
}

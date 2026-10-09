import { Star } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <span className="footer-brand">
          RAW<Star className="brand-star" size={19} fill="currentColor" strokeWidth={0} aria-hidden="true" />WORKS
        </span>
        <div className="footer-links">
          <a href="#work">Work</a>
          <a href="#services">Services</a>
          <a href="#top">Instagram</a>
          <a href="#top">Dribbble</a>
          <a href="#top">LinkedIn</a>
        </div>
      </div>
      <div className="footer-base">
        <span>© 2026 Raw Works BV — KvK 68492017</span>
        <span>Made loudly in Rotterdam. No AI wrote this. (A human did. Angrily.)</span>
      </div>
    </footer>
  );
}

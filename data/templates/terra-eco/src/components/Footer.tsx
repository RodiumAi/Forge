import { Leaf } from "lucide-react";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand"><span aria-hidden><Leaf size={20} fill="currentColor" /></span> Terra Collective</div>
          <p className="footer-tag">Regeneration, measured and shared.</p>
        </div>
        <div className="footer-col">
          <h4>Explore</h4>
          <a href="#projects">Projects</a>
          <a href="#impact">Impact dashboard</a>
          <a href="#standards">Methodology</a>
        </div>
        <div className="footer-col">
          <h4>Organisation</h4>
          <a href="#mission">Our mission</a>
          <a href="#top">Annual reports</a>
          <a href="#top">Careers</a>
        </div>
        <div className="footer-col">
          <h4>Contact</h4>
          <a href="#top">hello@terra.earth</a>
          <a href="#top">Press kit</a>
          <a href="#top">Partner with us</a>
        </div>
      </div>
      <div className="footer-bottom">
        © 2026 Terra Collective SCIC — Lyon, France · Printed nothing to make this site.
      </div>
    </footer>
  );
}

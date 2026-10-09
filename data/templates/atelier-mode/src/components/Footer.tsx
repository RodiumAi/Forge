export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">MAISON VERNET</div>
      <div className="footer-cols">
        <div>
          <h4>Maison</h4>
          <a href="#heritage">Our story</a>
          <a href="#heritage">The atelier</a>
          <a href="#heritage">Savoir-faire</a>
        </div>
        <div>
          <h4>Client care</h4>
          <a href="#collection">Shipping</a>
          <a href="#collection">Returns</a>
          <a href="#collection">Size guide</a>
        </div>
        <div>
          <h4>Visit</h4>
          <p className="footer-addr">
            31 Rue Cambon
            <br />
            75001 Paris
            <br />
            By appointment
          </p>
        </div>
      </div>
      <div className="footer-base">
        <span>© 2026 Maison Vernet</span>
        <span>Paris — Fait main depuis 1932</span>
      </div>
    </footer>
  );
}

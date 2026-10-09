export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <p className="footer-logo">Lumen.Atelier</p>
          <p className="footer-small">
            14 Fournier Street
            <br />
            London E1 6QE
          </p>
        </div>
        <div>
          <p className="footer-head">Studio</p>
          <a href="#work">Work</a>
          <a href="#philosophy">Philosophy</a>
          <a href="#studio">People</a>
        </div>
        <div>
          <p className="footer-head">Elsewhere</p>
          <a href="#top">Instagram</a>
          <a href="#top">Are.na</a>
          <a href="#top">Press kit</a>
        </div>
      </div>
      <p className="footer-legal">
        © 2026 Lumen Atelier Ltd. RIBA Chartered Practice no. 20014582.
      </p>
    </footer>
  );
}

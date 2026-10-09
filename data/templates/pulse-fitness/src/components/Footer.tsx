export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <p className="footer-logo">PULSE<span>/</span>CLUB</p>
          <p className="footer-small">
            88 Turbine Wharf, East Docklands
            <br />
            Open 24/7 · Staffed 06:00–22:00
          </p>
        </div>
        <div>
          <p className="footer-head">Club</p>
          <a href="#programs">Programs</a>
          <a href="#coaches">Coaches</a>
          <a href="#plans">Membership</a>
        </div>
        <div>
          <p className="footer-head">Social</p>
          <a href="#top">Instagram</a>
          <a href="#top">YouTube</a>
          <a href="#top">Strava club</a>
        </div>
      </div>
      <p className="footer-legal">© 2026 Pulse Club Ltd. Train hard, waive nothing — read the small print anyway.</p>
    </footer>
  );
}

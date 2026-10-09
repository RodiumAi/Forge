export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">KINETIC<span className="brand-year">27</span></div>
        <div className="footer-cols">
          <div>
            <h4>Event</h4>
            <a href="#program">Program</a>
            <a href="#speakers">Speakers</a>
            <a href="#tickets">Tickets</a>
          </div>
          <div>
            <h4>Info</h4>
            <a href="#venue">Venue & access</a>
            <a href="#top">Code of conduct</a>
            <a href="#top">Press kit</a>
          </div>
          <div>
            <h4>Social</h4>
            <a href="#top">Mastodon</a>
            <a href="#top">Instagram</a>
            <a href="#top">YouTube</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2027 Kinetic Conference GmbH — Berlin</span>
        <span>Designed loud, on purpose.</span>
      </div>
    </footer>
  );
}

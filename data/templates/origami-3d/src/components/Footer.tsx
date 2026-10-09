export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div>
          <p className="footer-logo">
            <span className="nav-mark" aria-hidden="true" /> Foldspace
          </p>
          <p className="footer-small">Hardware at software speed.<br />© 2026 Foldspace Inc.</p>
        </div>
        <div>
          <p className="footer-head">Product</p>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#top">Changelog</a>
        </div>
        <div>
          <p className="footer-head">Resources</p>
          <a href="#top">Docs</a>
          <a href="#top">API reference</a>
          <a href="#top">Fab network</a>
        </div>
        <div>
          <p className="footer-head">Company</p>
          <a href="#top">About</a>
          <a href="#top">Careers</a>
          <a href="#top">Contact</a>
        </div>
      </div>
    </footer>
  );
}

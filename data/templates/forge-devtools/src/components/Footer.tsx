export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand">hexbin</div>
          <p className="footer-tag">Bundle forensics for humans.</p>
        </div>
        <div className="footer-col">
          <h4>Product</h4>
          <a href="#features">Features</a>
          <a href="#compare">Benchmarks</a>
          <a href="#top">Changelog</a>
        </div>
        <div className="footer-col">
          <h4>Resources</h4>
          <a href="#docs">Documentation</a>
          <a href="#integrations">Adapters</a>
          <a href="#top">Blog</a>
        </div>
        <div className="footer-col">
          <h4>Community</h4>
          <a href="#open-source">GitHub</a>
          <a href="#top">Discord</a>
          <a href="#top">Mastodon</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Hexbin Labs — MIT License</span>
        <span className="footer-mono">exit code 0</span>
      </div>
    </footer>
  );
}

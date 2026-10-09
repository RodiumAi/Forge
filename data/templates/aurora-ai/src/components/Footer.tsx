import Brand from "./Brand";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Brand />
          <p>Intelligence that works while you sleep. Built in Stockholm & San Francisco.</p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#top">Changelog</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#top">About</a>
            <a href="#top">Careers</a>
            <a href="#top">Blog</a>
          </div>
          <div>
            <h4>Resources</h4>
            <a href="#top">Docs</a>
            <a href="#top">API status</a>
            <a href="#top">Security</a>
          </div>
        </div>
      </div>
      <div className="container footer-base">
        <span>© 2026 Aurora Labs AB. All rights reserved.</span>
        <span>Privacy · Terms · DPA</span>
      </div>
    </footer>
  );
}

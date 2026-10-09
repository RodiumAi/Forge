import BrandMark from "./BrandMark";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <a className="brand" href="#top">
            <BrandMark size={20} />
            VERTEX
          </a>
          <p className="footer-blurb">
            The exchange for serious traders. Vilnius · Frankfurt · Singapore.
          </p>
        </div>
        <div className="footer-cols">
          <div>
            <h4>Products</h4>
            <a href="#markets">Spot</a>
            <a href="#markets">Futures</a>
            <a href="#markets">Earn</a>
            <a href="#top">API</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#top">About</a>
            <a href="#top">Careers</a>
            <a href="#top">Press</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#top">Terms</a>
            <a href="#top">Privacy</a>
            <a href="#top">Proof of reserves</a>
          </div>
        </div>
      </div>
      <div className="container footer-base">
        <span>© 2026 Vertex Europe UAB. All rights reserved.</span>
        <span>Not investment advice.</span>
      </div>
    </footer>
  );
}

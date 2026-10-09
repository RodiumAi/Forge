export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((i) => (
          <span key={i} className="marquee-seg">
            HAUTE COUTURE&nbsp;·&nbsp;PARIS&nbsp;·&nbsp;DEPUIS 1932&nbsp;·&nbsp;FAIT MAIN&nbsp;·&nbsp;
            HAUTE COUTURE&nbsp;·&nbsp;PARIS&nbsp;·&nbsp;DEPUIS 1932&nbsp;·&nbsp;FAIT MAIN&nbsp;·&nbsp;
          </span>
        ))}
      </div>
    </div>
  );
}

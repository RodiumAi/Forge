const barData = [
  { label: "Financial services", pct: 34 },
  { label: "Industrials & energy", pct: 27 },
  { label: "Healthcare & life sciences", pct: 21 },
  { label: "Technology & media", pct: 18 },
];

export default function Evidence() {
  return (
    <section className="evidence" id="evidence">
      <div className="sec-rule">
        <span className="sec-num">§2</span>
        <h2>Where the work concentrates</h2>
      </div>
      <div className="charts">
        <div className="chart-block">
          <div className="donut" aria-hidden="true">
            <div className="donut-hole">
              <span>340+</span>
              <small>engagements</small>
            </div>
          </div>
          <ul className="legend">
            <li><i className="sw sw-1" /> Financial services — 34%</li>
            <li><i className="sw sw-2" /> Industrials & energy — 27%</li>
            <li><i className="sw sw-3" /> Healthcare — 21%</li>
            <li><i className="sw sw-4" /> Technology — 18%</li>
          </ul>
        </div>
        <div className="chart-block">
          <h3 className="chart-title">Engagement mix by sector, 2016–2026</h3>
          {barData.map((b) => (
            <div className="bar-row" key={b.label}>
              <span className="bar-label">{b.label}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${b.pct}%` }} />
              </div>
              <span className="bar-pct">{b.pct}%</span>
            </div>
          ))}
          <p className="chart-note">Source: internal engagement ledger, audited annually.</p>
        </div>
      </div>
    </section>
  );
}

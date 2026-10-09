const results = [
  { label: "Members hitting a PR each month", pct: 82 },
  { label: "Average strength gain, first 12 weeks", pct: 64 },
  { label: "Class attendance rate", pct: 91 },
  { label: "Members who bring a friend", pct: 47 },
];

export default function Results() {
  return (
    <section className="section" id="results">
      <div className="section-head">
        <h2 className="section-title">NUMBERS DON'T<br /><span className="lime">FLINCH.</span></h2>
        <p className="section-sub">
          We test every member quarterly. This is last quarter, club-wide. No cherry-picking.
        </p>
      </div>
      <div className="bars">
        {results.map((r) => (
          <div className="bar-row" key={r.label}>
            <div className="bar-head">
              <span className="bar-label">{r.label}</span>
              <span className="bar-pct">{r.pct}%</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${r.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

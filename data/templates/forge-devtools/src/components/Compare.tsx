import { Check, X } from "lucide-react";

const COMPARE = [
  { label: "Time to find a bundle regression", before: "45 min of bisecting commits", after: "8 seconds — `hexbin blame`" },
  { label: "Bundle size after first week", before: "2.4 MB and growing", after: "1.1 MB, gated in CI" },
  { label: "Duplicate dependencies", before: "11 (three lodashes)", after: "0, enforced" },
  { label: "Who reads the bundle report", before: "One heroic senior dev", after: "The whole team, in PR comments" },
];

export default function Compare() {
  return (
    <section className="section" id="compare">
      <h2 className="h2">Before Hexbin / after Hexbin</h2>
      <p className="section-sub">Numbers from the Relay team at Northwind, four weeks after adoption.</p>
      <div className="compare">
        <div className="compare-head">
          <span />
          <span className="col-before">Before</span>
          <span className="col-after">After</span>
        </div>
        {COMPARE.map((r) => (
          <div className="compare-row" key={r.label}>
            <span className="compare-label">{r.label}</span>
            <span className="compare-before"><X className="compare-icon" strokeWidth={2.5} aria-hidden="true" /> {r.before}</span>
            <span className="compare-after"><Check className="compare-icon" strokeWidth={2.5} aria-hidden="true" /> {r.after}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

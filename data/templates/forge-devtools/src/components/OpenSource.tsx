import { ArrowRight } from "lucide-react";

const GH_STATS = [
  { n: "24.8k", label: "GitHub stars" },
  { n: "412", label: "Contributors" },
  { n: "1,930", label: "Merged PRs" },
  { n: "98.2%", label: "Issues closed < 7 days" },
];

export default function OpenSource() {
  return (
    <section className="section oss" id="open-source">
      <div className="oss-inner">
        <div>
          <h2 className="h2">MIT licensed. Forever.</h2>
          <p className="section-sub left">
            Hexbin's CLI and every adapter are open source — no license keys, no
            "open core" bait. The company sells the hosted dashboard; the tool
            you run stays free.
          </p>
          <div className="oss-ctas">
            <a className="btn btn-accent" href="#top">
              Read the source <ArrowRight className="btn-icon" aria-hidden="true" />
            </a>
            <a className="btn btn-ghost" href="#docs">Contribution guide</a>
          </div>
        </div>
        <div className="oss-stats">
          {GH_STATS.map((s) => (
            <div className="oss-stat" key={s.label}>
              <div className="oss-n">{s.n}</div>
              <div className="oss-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

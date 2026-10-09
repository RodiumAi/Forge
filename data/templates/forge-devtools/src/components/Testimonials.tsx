import { MessageCircle } from "lucide-react";

export default function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <h2 className="h2">Engineers, unprompted</h2>
      <p className="section-sub">Pulled from public posts. We asked permission, not for edits.</p>
      <div className="feature-grid">
        <article className="feature">
          <span className="feature-icon" aria-hidden><MessageCircle /></span>
          <h3 className="feature-title">@sarah_builds — Staff Eng</h3>
          <p className="feature-desc">
            "Ran hexbin on a 5-year-old monorepo expecting pain. It found 340 KB
            of a charting lib we removed from the UI in 2023. The import was
            still there. Nobody knew."
          </p>
        </article>
        <article className="feature">
          <span className="feature-icon" aria-hidden><MessageCircle /></span>
          <h3 className="feature-title">@perfmatters — Web perf consultant</h3>
          <p className="feature-desc">
            "I used to bill two days for bundle audits. hexbin does 90% of it
            in eight seconds, so now I bill two days for fixing things instead.
            Better deal for everyone."
          </p>
        </article>
        <article className="feature">
          <span className="feature-icon" aria-hidden><MessageCircle /></span>
          <h3 className="feature-title">@ktrz_dev — OSS maintainer</h3>
          <p className="feature-desc">
            "The CI gate comment is the killer feature. Juniors stopped asking
            'is this dependency fine?' — the PR just tells them, with numbers,
            before review."
          </p>
        </article>
      </div>
    </section>
  );
}

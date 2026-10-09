import { MoveRight } from "lucide-react";

const ARTICLES = [
  {
    n: "01",
    date: "Feb 12, 2026",
    category: "Technology",
    title: "The tyranny of the feed, ten years on",
    excerpt: "We were told infinite scroll was neutral engineering. A decade of attention research says otherwise — and the counter-movement is finally shipping products.",
    length: "18 min",
  },
  {
    n: "02",
    date: "Feb 05, 2026",
    category: "Cities",
    title: "What Vienna knows about housing that we refuse to learn",
    excerpt: "Sixty percent of Viennese live in social housing so good that architects compete to build it. The waiting list is short. The stigma is nonexistent.",
    length: "24 min",
  },
  {
    n: "03",
    date: "Jan 29, 2026",
    category: "Language",
    title: "In defense of the long sentence",
    excerpt: "Readability tools flag anything over twenty words. Proust averaged forty-three. Somewhere between the two, we traded rhythm for compliance.",
    length: "12 min",
  },
  {
    n: "04",
    date: "Jan 22, 2026",
    category: "Science",
    title: "The replication crisis was the best thing to happen to psychology",
    excerpt: "A field that spent forty years chasing headlines is quietly rebuilding itself around boring, sturdy, pre-registered truth. It deserves more credit.",
    length: "21 min",
  },
  {
    n: "05",
    date: "Jan 15, 2026",
    category: "Work",
    title: "Nobody's job survives contact with its description",
    excerpt: "An anthropologist embedded in three companies for a year. What people are hired to do and what actually keeps the lights on rarely overlap.",
    length: "16 min",
  },
];

export default function ArticleIndex() {
  return (
    <section className="section" id="index">
      <div className="section-rule">
        <h2 className="section-title">In this issue</h2>
        <span className="section-note">Theme: <span className="accent">Attention, revisited</span></span>
      </div>
      <ol className="article-list">
        {ARTICLES.map((a) => (
          <li className="article" key={a.n}>
            <span className="article-n">{a.n}</span>
            <div className="article-main">
              <div className="article-meta">
                <span>{a.date}</span>
                <span className="meta-sep">·</span>
                <span>{a.category}</span>
                <span className="meta-sep">·</span>
                <span>{a.length} read</span>
              </div>
              <h3 className="article-title"><a href="#essay">{a.title}</a></h3>
              <p className="article-excerpt">{a.excerpt}</p>
            </div>
            <span className="article-arrow" aria-hidden>
              <MoveRight size={22} strokeWidth={1.25} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

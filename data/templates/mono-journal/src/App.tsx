import { useState } from "react";

const NAV = ["Index", "Essay", "Quote", "Archive", "Subscribe"];

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

const ARCHIVE = [
  { issue: "Issue № 11", theme: "Attention", date: "Winter 2025" },
  { issue: "Issue № 10", theme: "Repair", date: "Autumn 2025" },
  { issue: "Issue № 09", theme: "Silence", date: "Summer 2025" },
  { issue: "Issue № 08", theme: "Borders", date: "Spring 2025" },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  return (
    <div className="page">
      {/* ── Masthead ── */}
      <header className="masthead">
        <div className="masthead-row">
          <span className="masthead-date">February 2026</span>
          <a className="wordmark" href="#top">MONOCHROME</a>
          <span className="masthead-issue">Issue <span className="accent">№ 12</span></span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n} href={`#${n.toLowerCase()}`}>{n}</a>
          ))}
        </nav>
      </header>

      {/* ── Hero ── */}
      <section className="hero" id="top">
        <p className="hero-kicker">A journal of slow ideas · published monthly · no algorithm decides what you read</p>
        <h1 className="hero-title">
          Everything worth understanding<br />takes longer than a scroll.
        </h1>
        <div className="hero-rule" />
        <div className="hero-cols">
          <p>
            Monochrome is a monthly journal of essays on technology, cities, language
            and work — written slowly, edited hard, and set in type that respects
            your eyes. No trackers. No comments. No push notifications.
          </p>
          <p>
            Each issue is organised around a single theme and printed in a
            limited letterpress run for subscribers who prefer paper. The web
            edition is free, complete, and will remain so.
          </p>
        </div>
      </section>

      {/* ── Article index ── */}
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
              <span className="article-arrow" aria-hidden>→</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Featured essay with drop cap ── */}
      <section className="section" id="essay">
        <div className="section-rule">
          <h2 className="section-title">From the lead essay</h2>
          <span className="section-note">“The tyranny of the feed, ten years on”</span>
        </div>
        <div className="essay-grid">
          <figure className="essay-figure">
            <img
              src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1200&q=70"
              alt="Tall library shelves in black and white"
              loading="lazy"
            />
            <figcaption>The reading room, before the feed. Photograph, 2025.</figcaption>
          </figure>
          <div className="essay-text">
            <p className="dropcap">
              The feed was never designed for you. It was designed for the
              measurable version of you — the one that clicks, lingers, returns.
              Ten years ago this magazine published a skeptical essay about
              infinite scroll; we were accused of nostalgia. Today the engineers
              who built these systems say sharper things than we ever dared.
            </p>
            <p>
              What changed was not the technology but the accounting. Attention,
              it turns out, behaves like topsoil: it can be strip-mined for a
              while, and the yields even look spectacular, until suddenly nothing
              grows. Publishers noticed first. Then advertisers. Then, finally,
              the platforms themselves, staring at engagement charts that only
              went up while satisfaction charts only went down.
            </p>
            <p>
              The interesting story of 2026 is not another jeremiad against the
              feed. It is the quiet profusion of things built against it: apps
              that end, newsletters that arrive weekly on purpose, and reading
              software whose only metric is whether you finished.
            </p>
            <a className="essay-more" href="#index">Continue reading in the issue →</a>
          </div>
        </div>
      </section>

      {/* ── Full-page pull quote ── */}
      <section className="quote" id="quote">
        <blockquote className="quote-text">
          “Attention is the rarest and purest form of generosity.”
        </blockquote>
        <div className="quote-cite">— Simone Weil, quoted in Issue № 12</div>
      </section>

      {/* ── Archive ── */}
      <section className="section" id="archive">
        <div className="section-rule">
          <h2 className="section-title">The archive</h2>
          <span className="section-note">Eleven issues, all free to read</span>
        </div>
        <div className="archive-grid">
          {ARCHIVE.map((i) => (
            <a className="archive-card" href="#index" key={i.issue}>
              <span className="archive-issue">{i.issue}</span>
              <span className="archive-theme">{i.theme}</span>
              <span className="archive-date">{i.date}</span>
            </a>
          ))}
        </div>
        <figure className="archive-figure">
          <img
            src="https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=70"
            alt="An open book, black and white"
            loading="lazy"
          />
          <figcaption>The letterpress edition of Issue № 09, “Silence”.</figcaption>
        </figure>
      </section>

      {/* ── Letters to the editor ── */}
      <section className="section" id="letters">
        <div className="section-rule">
          <h2 className="section-title">Letters to the editor</h2>
          <span className="section-note">Selected replies to Issue № 11, “Attention”</span>
        </div>
        <ol className="article-list">
          <li className="article">
            <span className="article-n">i.</span>
            <div className="article-main">
              <div className="article-meta">
                <span>From R. Whitfield</span>
                <span className="meta-sep">·</span>
                <span>Edinburgh</span>
              </div>
              <h3 className="article-title"><a href="#letters">On finishing things</a></h3>
              <p className="article-excerpt">
                Your essay on unfinished books shamed me into completing
                “Middlemarch” after eleven years of trying. I am writing to
                report that the last hundred pages were worth the decade.
              </p>
            </div>
            <span className="article-arrow" aria-hidden>→</span>
          </li>
          <li className="article">
            <span className="article-n">ii.</span>
            <div className="article-main">
              <div className="article-meta">
                <span>From T. Okonkwo</span>
                <span className="meta-sep">·</span>
                <span>Lagos</span>
              </div>
              <h3 className="article-title"><a href="#letters">A correction, gently</a></h3>
              <p className="article-excerpt">
                The Lagos danfo network you cited as “informal” moves four
                million people daily with better on-time rates than two European
                capitals I have lived in. Informal is doing heavy lifting there.
              </p>
            </div>
            <span className="article-arrow" aria-hidden>→</span>
          </li>
          <li className="article">
            <span className="article-n">iii.</span>
            <div className="article-main">
              <div className="article-meta">
                <span>From M. Duras-Lemoine</span>
                <span className="meta-sep">·</span>
                <span>Marseille</span>
              </div>
              <h3 className="article-title"><a href="#letters">Against the tote bag</a></h3>
              <p className="article-excerpt">
                You will sell tote bags eventually. Every publication does.
                I write only to ask that when you do, you at least have the
                decency to set the type properly on them.
              </p>
            </div>
            <span className="article-arrow" aria-hidden>→</span>
          </li>
        </ol>
      </section>

      {/* ── Subscribe ── */}
      <section className="subscribe" id="subscribe">
        <div className="subscribe-inner">
          <h2 className="subscribe-title">One email a month.<br />Nothing else, ever.</h2>
          <p className="subscribe-copy">
            The full issue in your inbox on the first Monday of the month.
            No digests, no “we miss you”, no partner offers. Unsubscribing
            takes one click and no guilt.
          </p>
          {subscribed ? (
            <p className="subscribe-done">Thank you. Issue № 13 — “Repair, continued” — arrives March 2.</p>
          ) : (
            <form
              className="subscribe-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.includes("@")) setSubscribed(true);
              }}
            >
              <input
                className="subscribe-input"
                type="email"
                placeholder="your@address.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button className="subscribe-btn" type="submit">Subscribe</button>
            </form>
          )}
          <p className="subscribe-fine">Free forever. The letterpress edition is €96/year, shipped worldwide.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-row">
          <span className="footer-wordmark">MONOCHROME</span>
          <div className="footer-links">
            <a href="#index">Index</a>
            <a href="#archive">Archive</a>
            <a href="#subscribe">Subscribe</a>
            <a href="#top">Colophon</a>
            <a href="#top">RSS</a>
          </div>
        </div>
        <div className="footer-fine">
          © 2026 Monochrome Journal · Set in old-style serifs · No cookies were used in the making of this site.
        </div>
      </footer>
    </div>
  );
}

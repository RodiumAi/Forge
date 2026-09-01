import { useState } from "react";

const NAV = ["Features", "Compare", "Integrations", "Open Source", "Docs"];

const FEATURES = [
  {
    icon: "🔬",
    title: "Byte-level attribution",
    desc: "Every byte in your bundle traced back to the exact import, loader and plugin that put it there. No more guessing which dependency ate 200 KB.",
  },
  {
    icon: "⚡",
    title: "Zero-config tracing",
    desc: "Drop into any Vite, webpack, Rollup or esbuild project. Hexbin reads your existing config — you change nothing, not even one flag.",
  },
  {
    icon: "📉",
    title: "Regression gates in CI",
    desc: "Fail the build when a PR adds more than your byte budget. Comments land on the PR with the exact module diff, not a vague total.",
  },
  {
    icon: "🧬",
    title: "Duplicate hunting",
    desc: "Finds the three copies of lodash, the two moment builds and the polyfill nobody remembers adding — then tells you which resolution fixes it.",
  },
  {
    icon: "🗺️",
    title: "Interactive treemaps",
    desc: "Not a screenshot — a queryable map. Filter by package, author, license or age. Export as JSON for your own dashboards.",
  },
  {
    icon: "🔒",
    title: "Fully local analysis",
    desc: "Your source never leaves the machine. The CLI is offline-first; the optional cloud dashboard only ever sees hashed module names.",
  },
];

const COMPARE = [
  { label: "Time to find a bundle regression", before: "45 min of bisecting commits", after: "8 seconds — `hexbin blame`" },
  { label: "Bundle size after first week", before: "2.4 MB and growing", after: "1.1 MB, gated in CI" },
  { label: "Duplicate dependencies", before: "11 (three lodashes)", after: "0, enforced" },
  { label: "Who reads the bundle report", before: "One heroic senior dev", after: "The whole team, in PR comments" },
];

const GH_STATS = [
  { n: "24.8k", label: "GitHub stars" },
  { n: "412", label: "Contributors" },
  { n: "1,930", label: "Merged PRs" },
  { n: "98.2%", label: "Issues closed < 7 days" },
];

const TERMINAL_LINES: Array<{ prompt?: boolean; parts: Array<{ t: string; c?: string }> }> = [
  { prompt: true, parts: [{ t: "hexbin analyze ./dist", c: "cmd" }] },
  { parts: [{ t: "  ✓ ", c: "green" }, { t: "parsed 1,284 modules in ", c: "dim" }, { t: "0.42s", c: "violet" }] },
  { parts: [{ t: "  ✓ ", c: "green" }, { t: "source maps resolved (", c: "dim" }, { t: "100%", c: "green" }, { t: " coverage)", c: "dim" }] },
  { parts: [{ t: "", c: "dim" }] },
  { parts: [{ t: "  TOP OFFENDERS", c: "violet" }, { t: "                    size     % of bundle", c: "dim" }] },
  { parts: [{ t: "  1. ", c: "dim" }, { t: "moment/locale/*", c: "cmd" }, { t: "           291 KB   ", c: "yellow" }, { t: "24.1%", c: "red" }] },
  { parts: [{ t: "  2. ", c: "dim" }, { t: "lodash", c: "cmd" }, { t: " (×3 copies!)", c: "red" }, { t: "      212 KB   ", c: "yellow" }, { t: "17.6%", c: "red" }] },
  { parts: [{ t: "  3. ", c: "dim" }, { t: "@corp/icons", c: "cmd" }, { t: "               96 KB    ", c: "yellow" }, { t: "7.9%", c: "yellow" }] },
  { parts: [{ t: "", c: "dim" }] },
  { parts: [{ t: "  💡 fix available: ", c: "dim" }, { t: "hexbin fix --dedupe --tree-shake-locales", c: "green" }] },
  { parts: [{ t: "     estimated savings: ", c: "dim" }, { t: "-38.4% (461 KB)", c: "green" }] },
  { prompt: true, parts: [{ t: "", c: "cmd" }], },
];

function IntegrationLogo({ name, path }: { name: string; path: string }) {
  return (
    <div className="integ" title={name}>
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden>
        <path d={path} />
      </svg>
      <span>{name}</span>
    </div>
  );
}

const INTEGRATIONS = [
  { name: "Vite", path: "M12 1 1 4l10.5 19L23 4 12 1zm0 3.5L18.5 6 12 18 5.5 6 12 4.5z" },
  { name: "webpack", path: "M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3 6.7 3.7-6.7 3.7L5.3 8 12 4.3zM5 9.7l6 3.3v6.7l-6-3.4V9.7zm14 0v6.6l-6 3.4V13l6-3.3z" },
  { name: "Rollup", path: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 3a7 7 0 0 1 5.6 11.2L12 8l-5 9.5A7 7 0 0 1 12 5z" },
  { name: "esbuild", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 8l4 4-4 4V8zm5 0l4 4-4 4V8z" },
  { name: "GitHub Actions", path: "M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.4-3.4-1.4-.4-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.7s.9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.8-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2z" },
  { name: "GitLab CI", path: "m12 21.4-3.7-11.3h7.4L12 21.4zM3.9 10.1 12 21.4 5.7 3.9a.4.4 0 0 0-.8 0L3.2 9.3a.9.9 0 0 0 .7.8zm16.2 0L12 21.4l6.3-17.5a.4.4 0 0 1 .8 0l1.7 5.4a.9.9 0 0 1-.7.8z" },
];

export default function App() {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"npm" | "pnpm" | "brew">("npm");

  const INSTALL: Record<typeof tab, string> = {
    npm: "npm install -g hexbin",
    pnpm: "pnpm add -g hexbin",
    brew: "brew install hexbin",
  };

  return (
    <div className="page">
      {/* ── Navbar ── */}
      <header className="topbar">
        <a className="brand" href="#top">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 2 21 7v10l-9 5-9-5V7l9-5z" className="brand-hex" />
            <path d="M8 12h8M12 8v8" />
          </svg>
          hexbin
        </a>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n} href={`#${n.toLowerCase().replace(" ", "-")}`}>{n}</a>
          ))}
        </nav>
        <div className="topbar-actions">
          <a className="btn btn-ghost" href="#open-source">★ 24.8k</a>
          <a className="btn btn-accent" href="#install">Install</a>
        </div>
      </header>

      {/* ── Hero with terminal ── */}
      <section className="hero" id="top">
        <div className="hero-glow" aria-hidden />
        <span className="hero-badge">v3.2 — now with esbuild metafile support</span>
        <h1 className="h1">
          Trace <span className="grad">every byte</span> your build ships.
        </h1>
        <p className="lede">
          Hexbin is a bundle forensics CLI. It tells you what's in your JavaScript,
          why it's there, and exactly how to make it smaller — in one command,
          with zero configuration.
        </p>

        <div className="install-box" id="install">
          <div className="install-tabs">
            {(["npm", "pnpm", "brew"] as const).map((t) => (
              <button key={t} className={tab === t ? "itab active" : "itab"} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="install-row">
            <code className="install-cmd">
              <span className="dollar">$</span> {INSTALL[tab]}
            </code>
            <button className="copy-btn" onClick={() => setCopied(true)}>
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="terminal">
          <div className="terminal-bar">
            <span className="dot red" /><span className="dot yellow" /><span className="dot green" />
            <span className="terminal-title">hexbin — zsh</span>
          </div>
          <pre className="terminal-body">
            {TERMINAL_LINES.map((line, i) => (
              <div className="tline" key={i}>
                {line.prompt && <span className="tprompt">➜ ~ </span>}
                {line.parts.map((p, j) => (
                  <span key={j} className={`tk-${p.c ?? "dim"}`}>{p.t}</span>
                ))}
                {i === TERMINAL_LINES.length - 1 && <span className="cursor" aria-hidden />}
              </div>
            ))}
          </pre>
        </div>
      </section>

      {/* ── Features (glow grid) ── */}
      <section className="section" id="features">
        <h2 className="h2">Built for the build you actually have</h2>
        <p className="section-sub">
          Six things Hexbin does that your bundler's <code>--analyze</code> flag never will.
        </p>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <article className="feature" key={f.title}>
              <span className="feature-icon" aria-hidden>{f.icon}</span>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ── Before / After ── */}
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
              <span className="compare-before">✗ {r.before}</span>
              <span className="compare-after">✓ {r.after}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Integrations ── */}
      <section className="section" id="integrations">
        <h2 className="h2">Plugs into what you already run</h2>
        <p className="section-sub">First-class adapters, all maintained in the core repo.</p>
        <div className="integ-grid">
          {INTEGRATIONS.map((i) => (
            <IntegrationLogo key={i.name} {...i} />
          ))}
        </div>
      </section>

      {/* ── Open source ── */}
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
              <a className="btn btn-accent" href="#top">Read the source →</a>
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

      {/* ── What engineers say ── */}
      <section className="section" id="testimonials">
        <h2 className="h2">Engineers, unprompted</h2>
        <p className="section-sub">Pulled from public posts. We asked permission, not for edits.</p>
        <div className="feature-grid">
          <article className="feature">
            <span className="feature-icon" aria-hidden>💬</span>
            <h3 className="feature-title">@sarah_builds — Staff Eng</h3>
            <p className="feature-desc">
              "Ran hexbin on a 5-year-old monorepo expecting pain. It found 340 KB
              of a charting lib we removed from the UI in 2023. The import was
              still there. Nobody knew."
            </p>
          </article>
          <article className="feature">
            <span className="feature-icon" aria-hidden>💬</span>
            <h3 className="feature-title">@perfmatters — Web perf consultant</h3>
            <p className="feature-desc">
              "I used to bill two days for bundle audits. hexbin does 90% of it
              in eight seconds, so now I bill two days for fixing things instead.
              Better deal for everyone."
            </p>
          </article>
          <article className="feature">
            <span className="feature-icon" aria-hidden>💬</span>
            <h3 className="feature-title">@ktrz_dev — OSS maintainer</h3>
            <p className="feature-desc">
              "The CI gate comment is the killer feature. Juniors stopped asking
              'is this dependency fine?' — the PR just tells them, with numbers,
              before review."
            </p>
          </article>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta" id="docs">
        <h2 className="cta-title">Your bundle has secrets.</h2>
        <p className="cta-sub">One command. Eight seconds. No account.</p>
        <code className="cta-cmd"><span className="dollar">$</span> npx hexbin analyze ./dist</code>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">hexbin</div>
            <p className="footer-tag">Bundle forensics for humans.</p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#compare">Benchmarks</a>
            <a href="#top">Changelog</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#docs">Documentation</a>
            <a href="#integrations">Adapters</a>
            <a href="#top">Blog</a>
          </div>
          <div className="footer-col">
            <h4>Community</h4>
            <a href="#open-source">GitHub</a>
            <a href="#top">Discord</a>
            <a href="#top">Mastodon</a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Hexbin Labs — MIT License</span>
          <span className="footer-mono">exit code 0</span>
        </div>
      </footer>
    </div>
  );
}

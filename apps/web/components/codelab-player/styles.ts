/**
 * Player stylesheet, scoped under `.fcl-root`. Injected as a <style> element
 * by the player itself, so the editor preview, the published page and the
 * PDF export render identically without a CSS pipeline.
 *
 * Colours come from the design system tokens on the root (`--bg`, `--fg`,
 * `--muted`, `--accent`, `--surface`, `--border`, `--font-*`). Syntax colours
 * are Shiki's `--shiki-token-*` variables, given a light and a dark palette
 * that lean on the accent.
 */

export const CODELAB_CSS = String.raw`
.fcl-root {
  --fcl-bg: var(--bg, #ffffff);
  --fcl-fg: var(--fg, #1c1f26);
  --fcl-muted: var(--muted, #5b6170);
  --fcl-accent: var(--accent, #eb6118);
  --fcl-surface: var(--surface, color-mix(in srgb, var(--fcl-fg) 5%, var(--fcl-bg)));
  --fcl-border: var(--border, color-mix(in srgb, var(--fcl-fg) 14%, var(--fcl-bg)));
  --fcl-code-bg: color-mix(in srgb, var(--fcl-fg) 4%, var(--fcl-bg));
  --fcl-code-head: color-mix(in srgb, var(--fcl-fg) 7%, var(--fcl-bg));
  --fcl-hl: color-mix(in srgb, var(--fcl-accent) 14%, transparent);
  --fcl-add: color-mix(in srgb, #1f9d55 16%, transparent);
  --fcl-add-fg: #1a7f45;
  --fcl-del: color-mix(in srgb, #d64545 15%, transparent);
  --fcl-del-fg: #b83232;
  --fcl-radius: 10px;
  --fcl-font-body: var(--font-body, system-ui, sans-serif);
  --fcl-font-display: var(--font-display, var(--fcl-font-body));
  --fcl-font-mono: var(--font-mono, ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace);
  --shiki-foreground: var(--fcl-fg);
  --shiki-background: transparent;
  --shiki-token-constant: #a1501a;
  --shiki-token-string: #2f7d4f;
  --shiki-token-string-expression: #2f7d4f;
  --shiki-token-comment: color-mix(in srgb, var(--fcl-muted) 85%, var(--fcl-bg));
  --shiki-token-keyword: color-mix(in srgb, var(--fcl-accent) 80%, #6b21a8);
  --shiki-token-parameter: #9a4f00;
  --shiki-token-function: #1f5fbf;
  --shiki-token-punctuation: color-mix(in srgb, var(--fcl-fg) 70%, var(--fcl-bg));
  --shiki-token-link: var(--fcl-accent);
  --shiki-token-inserted: var(--fcl-add-fg);
  --shiki-token-deleted: var(--fcl-del-fg);
  --shiki-token-changed: var(--fcl-accent);
  background: var(--fcl-bg);
  color: var(--fcl-fg);
  font-family: var(--fcl-font-body);
  font-size: 16px;
  line-height: 1.65;
  min-height: 100%;
  -webkit-font-smoothing: antialiased;
}
.fcl-root[data-scheme="dark"] {
  --fcl-add-fg: #6fdc9a;
  --fcl-del-fg: #ff8a8a;
  --fcl-code-bg: color-mix(in srgb, #000 30%, var(--fcl-bg));
  --fcl-code-head: color-mix(in srgb, #fff 6%, var(--fcl-code-bg));
  --shiki-token-constant: #f2a86b;
  --shiki-token-string: #9fd6a6;
  --shiki-token-string-expression: #9fd6a6;
  --shiki-token-keyword: color-mix(in srgb, var(--fcl-accent) 70%, #f0a5ff);
  --shiki-token-parameter: #ffcf8a;
  --shiki-token-function: #8cc4ff;
}
.fcl-root *, .fcl-root *::before, .fcl-root *::after { box-sizing: border-box; }
.fcl-root a { color: var(--fcl-accent); text-underline-offset: 3px; }
.fcl-root button { font: inherit; color: inherit; }
.fcl-root :focus-visible { outline: 2px solid var(--fcl-accent); outline-offset: 2px; }

/* Layout */
.fcl-shell { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }
.fcl-root[data-embedded] .fcl-shell { min-height: 100%; height: 100%; }
.fcl-side { position: sticky; top: 0; height: 100vh; overflow: auto; border-right: 1px solid var(--fcl-border); background: var(--fcl-surface); padding: 20px 14px 28px; display: flex; flex-direction: column; gap: 14px; }
.fcl-root[data-embedded] .fcl-side { height: 100%; }
.fcl-side-title { font-family: var(--fcl-font-display); font-weight: 700; font-size: 17px; line-height: 1.3; margin: 0 6px; }
.fcl-progress { height: 6px; border-radius: 99px; background: var(--fcl-border); overflow: hidden; margin: 0 6px; }
.fcl-progress > span { display: block; height: 100%; background: var(--fcl-accent); transition: width .25s ease; }
.fcl-progress-label { font-size: 12px; color: var(--fcl-muted); margin: -8px 6px 0; }
.fcl-search { position: relative; margin: 0 6px; }
.fcl-search input { width: 100%; border: 1px solid var(--fcl-border); background: var(--fcl-bg); color: var(--fcl-fg); border-radius: 8px; padding: 8px 10px 8px 32px; font: inherit; font-size: 14px; }
.fcl-search svg { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--fcl-muted); }
.fcl-results { list-style: none; margin: 0; padding: 0 6px; display: grid; gap: 4px; font-size: 13px; }
.fcl-results button { width: 100%; text-align: left; border: 0; background: transparent; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.fcl-results button:hover { background: var(--fcl-hl); }
.fcl-results b { display: block; font-weight: 600; }
.fcl-results mark { background: var(--fcl-hl); color: inherit; border-radius: 3px; }
.fcl-results small { color: var(--fcl-muted); }
.fcl-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; counter-reset: fcl-step; }
.fcl-steps button { width: 100%; display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 8px; align-items: center; text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 7px 8px; cursor: pointer; font-size: 14px; line-height: 1.35; }
.fcl-steps button:hover { background: color-mix(in srgb, var(--fcl-fg) 6%, transparent); }
.fcl-steps button[aria-current="step"] { background: var(--fcl-hl); font-weight: 600; }
.fcl-step-num { width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; border: 1.5px solid var(--fcl-border); color: var(--fcl-muted); background: var(--fcl-bg); }
.fcl-steps button[data-visited] .fcl-step-num { border-color: var(--fcl-accent); color: var(--fcl-accent); }
.fcl-steps button[aria-current="step"] .fcl-step-num { background: var(--fcl-accent); border-color: var(--fcl-accent); color: var(--accent-contrast, #fff); }
.fcl-step-min { font-size: 12px; color: var(--fcl-muted); white-space: nowrap; }
.fcl-side-foot { margin-top: auto; display: grid; gap: 6px; padding: 0 6px; font-size: 12px; color: var(--fcl-muted); }
.fcl-main { min-width: 0; display: flex; flex-direction: column; }
.fcl-topbar { display: none; position: sticky; top: 0; z-index: 5; align-items: center; gap: 10px; padding: 10px 16px; background: var(--fcl-bg); border-bottom: 1px solid var(--fcl-border); }
.fcl-topbar-title { font-weight: 600; font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcl-content { width: 100%; max-width: 860px; margin: 0 auto; padding: 40px 32px 48px; flex: 1; }
.fcl-step-meta { font-size: 13px; color: var(--fcl-muted); display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
.fcl-nav { display: flex; justify-content: space-between; gap: 12px; padding: 20px 32px 40px; max-width: 860px; width: 100%; margin: 0 auto; }

/* Buttons */
.fcl-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--fcl-border); background: var(--fcl-bg); border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 14px; text-decoration: none; color: var(--fcl-fg); }
.fcl-btn:hover { border-color: color-mix(in srgb, var(--fcl-accent) 50%, var(--fcl-border)); }
.fcl-btn-primary { background: var(--fcl-accent); border-color: var(--fcl-accent); color: var(--accent-contrast, #fff); font-weight: 600; }
.fcl-btn-primary:hover { filter: brightness(1.05); }
.fcl-btn-ghost { border: 0; background: transparent; padding: 4px 8px; font-size: 12.5px; color: var(--fcl-muted); border-radius: 6px; }
.fcl-btn-ghost:hover { color: var(--fcl-fg); background: color-mix(in srgb, var(--fcl-fg) 8%, transparent); }
.fcl-btn-ghost[data-state="copied"] { color: var(--fcl-add-fg); }
.fcl-icon-btn { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--fcl-border); background: var(--fcl-bg); cursor: pointer; }

/* Home and end pages */
.fcl-hero h1 { font-family: var(--fcl-font-display); font-size: clamp(30px, 4vw, 44px); line-height: 1.1; margin: 0 0 14px; }
.fcl-hero .fcl-lead { font-size: 18px; color: var(--fcl-muted); margin: 0 0 22px; }
.fcl-facts { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 28px; padding: 0; list-style: none; }
.fcl-facts li { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--fcl-border); border-radius: 99px; padding: 5px 12px; font-size: 14px; background: var(--fcl-surface); }
.fcl-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin: 0 0 28px; }
.fcl-card { border: 1px solid var(--fcl-border); border-radius: var(--fcl-radius); padding: 16px 18px; background: var(--fcl-surface); }
.fcl-card h2 { font-size: 15px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: .04em; color: var(--fcl-muted); }
.fcl-card ul { margin: 0; padding-left: 20px; }
.fcl-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

/* Markdown */
.fcl-md { overflow-wrap: anywhere; }
.fcl-md h1, .fcl-md h2, .fcl-md h3, .fcl-md h4 { font-family: var(--fcl-font-display); line-height: 1.25; margin: 1.6em 0 .6em; }
.fcl-md h1 { font-size: 32px; margin-top: 0; }
.fcl-md h2 { font-size: 24px; }
.fcl-md h3 { font-size: 19px; }
.fcl-md p, .fcl-md ul, .fcl-md ol, .fcl-md blockquote { margin: 0 0 1em; }
.fcl-md li + li { margin-top: .25em; }
.fcl-md img { max-width: 100%; height: auto; border-radius: var(--fcl-radius); border: 1px solid var(--fcl-border); display: block; margin: 1em auto; }
.fcl-md blockquote { border-left: 3px solid var(--fcl-accent); padding: 2px 0 2px 16px; color: var(--fcl-muted); }
.fcl-md :not(pre) > code { font-family: var(--fcl-font-mono); font-size: .88em; background: var(--fcl-code-bg); border: 1px solid var(--fcl-border); border-radius: 5px; padding: .1em .35em; }
.fcl-md hr { border: 0; border-top: 1px solid var(--fcl-border); margin: 2em 0; }
.fcl-table-wrap { overflow-x: auto; margin: 0 0 1em; }
.fcl-md table { border-collapse: collapse; width: 100%; font-size: 15px; }
.fcl-md th, .fcl-md td { border: 1px solid var(--fcl-border); padding: 7px 10px; text-align: left; vertical-align: top; }
.fcl-md th { background: var(--fcl-surface); }

/* Code */
.fcl-code { margin: 0 0 1.2em; border: 1px solid var(--fcl-border); border-radius: var(--fcl-radius); overflow: hidden; background: var(--fcl-code-bg); }
.fcl-code-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 6px 4px 12px; background: var(--fcl-code-head); border-bottom: 1px solid var(--fcl-border); font-size: 13px; min-height: 36px; }
.fcl-code-file { display: inline-flex; align-items: center; gap: 7px; min-width: 0; color: var(--fcl-muted); }
.fcl-code-name { font-family: var(--fcl-font-mono); color: var(--fcl-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fcl-code-lang { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; border: 1px solid var(--fcl-border); border-radius: 5px; padding: 0 6px; }
.fcl-code-actions { display: inline-flex; gap: 2px; flex-shrink: 0; }
.fcl-code-body { position: relative; }
.fcl-code-body[data-collapsed]::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; background: linear-gradient(transparent, var(--fcl-code-bg)); pointer-events: none; }
.fcl-pre { margin: 0; padding: 12px 0; overflow-x: auto; font-family: var(--fcl-font-mono); font-size: 13.5px; line-height: 1.6; white-space: pre; tab-size: 2; color: var(--shiki-foreground); }
.fcl-pre code { display: block; min-width: max-content; font-family: inherit; }
.fcl-line { display: block; padding: 0 16px 0 0; }
.fcl-line[data-hl] { background: var(--fcl-hl); box-shadow: inset 3px 0 0 var(--fcl-accent); }
.fcl-line[data-diff="add"] { background: var(--fcl-add); }
.fcl-line[data-diff="del"] { background: var(--fcl-del); }
.fcl-line[data-diff="meta"] { color: var(--fcl-muted); font-style: italic; }
.fcl-line[data-diff="add"] .fcl-sign { color: var(--fcl-add-fg); }
.fcl-line[data-diff="del"] .fcl-sign { color: var(--fcl-del-fg); }
.fcl-ln { display: inline-block; width: 3.4em; padding-right: 1em; text-align: right; color: color-mix(in srgb, var(--fcl-muted) 70%, transparent); user-select: none; -webkit-user-select: none; }
.fcl-sign { display: inline-block; width: 1.4em; user-select: none; -webkit-user-select: none; font-weight: 700; }
.fcl-code:not(:has(.fcl-ln)) .fcl-line { padding-left: 16px; }
.fcl-code-more { width: 100%; border: 0; border-top: 1px solid var(--fcl-border); background: var(--fcl-code-head); padding: 7px; cursor: pointer; font-size: 13px; color: var(--fcl-muted); }
.fcl-code-more:hover { color: var(--fcl-fg); }
.fcl-terminal .fcl-line { padding-left: 16px; }
.fcl-prompt { color: var(--fcl-accent); user-select: none; -webkit-user-select: none; font-weight: 600; }
.fcl-line[data-term="output"] { color: var(--fcl-muted); opacity: .85; }
.fcl-tree-list { list-style: none; margin: 0; padding: 12px 16px; font-family: var(--fcl-font-mono); font-size: 13.5px; line-height: 1.7; overflow-x: auto; }
.fcl-tree-row { display: flex; align-items: center; gap: 6px; white-space: pre; }
.fcl-tree-guides { color: var(--fcl-border); }
.fcl-tree-icon { color: var(--fcl-muted); flex-shrink: 0; }
.fcl-tree-icon[data-folder] { color: var(--fcl-accent); }
.fcl-tree-name[data-folder] { font-weight: 600; }
.fcl-tree-note { color: var(--fcl-muted); font-family: var(--fcl-font-body); font-size: 12.5px; margin-left: 6px; }

/* Tabs */
.fcl-tabs { margin: 0 0 1.2em; }
.fcl-tablist { display: flex; gap: 2px; border-bottom: 1px solid var(--fcl-border); margin-bottom: 10px; overflow-x: auto; }
.fcl-tab { border: 0; background: transparent; padding: 8px 14px; cursor: pointer; font-size: 14px; color: var(--fcl-muted); border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
.fcl-tab[aria-selected="true"] { color: var(--fcl-fg); border-bottom-color: var(--fcl-accent); font-weight: 600; }
.fcl-tabpanel > .fcl-code:last-child { margin-bottom: 0; }

/* Callouts */
.fcl-callout { --fcl-c: #2563eb; border: 1px solid color-mix(in srgb, var(--fcl-c) 35%, var(--fcl-border)); background: color-mix(in srgb, var(--fcl-c) 8%, var(--fcl-bg)); border-left-width: 4px; border-left-color: var(--fcl-c); border-radius: var(--fcl-radius); padding: 12px 16px; margin: 0 0 1.2em; }
.fcl-callout[data-kind="tip"] { --fcl-c: #16a34a; }
.fcl-callout[data-kind="warning"] { --fcl-c: #d97706; }
.fcl-callout[data-kind="danger"] { --fcl-c: #dc2626; }
.fcl-callout-title { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-weight: 700; color: color-mix(in srgb, var(--fcl-c) 75%, var(--fcl-fg)); }
.fcl-callout-body > .fcl-md > :last-child, .fcl-callout-body > :last-child { margin-bottom: 0; }

/* Downloads */
.fcl-downloads { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; margin: 0 0 1.2em; }
.fcl-download { display: flex; gap: 12px; align-items: center; border: 1px solid var(--fcl-border); border-radius: var(--fcl-radius); padding: 12px 14px; background: var(--fcl-surface); text-decoration: none; color: var(--fcl-fg) !important; }
.fcl-download:hover { border-color: var(--fcl-accent); }
.fcl-download svg { color: var(--fcl-accent); flex-shrink: 0; }
.fcl-download[data-pending] { opacity: .7; }
.fcl-download-text { display: grid; min-width: 0; }
.fcl-download-label { font-weight: 600; font-size: 14px; }
.fcl-download-meta { font-size: 12px; color: var(--fcl-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Badge */
.fcl-badge { position: fixed; right: 14px; bottom: 14px; z-index: 20; font-size: 12px; padding: 6px 10px; border-radius: 99px; background: var(--fcl-fg); color: var(--fcl-bg) !important; text-decoration: none; opacity: .88; }
.fcl-root[data-embedded] .fcl-badge { position: absolute; }

/* Small screens: the step menu becomes a drawer. */
@media (max-width: 860px) {
  .fcl-shell { grid-template-columns: minmax(0, 1fr); }
  .fcl-side { position: fixed; z-index: 30; inset: 0 auto 0 0; width: min(320px, 88vw); transform: translateX(-102%); transition: transform .2s ease; box-shadow: 0 0 40px rgba(0,0,0,.25); }
  .fcl-root[data-menu-open] .fcl-side { transform: none; }
  .fcl-topbar { display: flex; }
  .fcl-content { padding: 24px 16px 32px; }
  .fcl-nav { padding: 16px 16px 32px; }
}

/* Print: every step, one after the other, no chrome. */
.fcl-print-step { break-before: page; }
.fcl-print-step:first-of-type { break-before: auto; }
@media print {
  .fcl-root { background: #fff; color: #000; font-size: 12pt; }
  .fcl-side, .fcl-topbar, .fcl-nav, .fcl-badge, .fcl-code-actions, .fcl-code-more, .fcl-no-print { display: none !important; }
  .fcl-shell { display: block; }
  .fcl-content { max-width: none; padding: 0; }
  .fcl-code-body[data-collapsed]::after { display: none; }
  .fcl-pre { white-space: pre-wrap; word-break: break-word; }
  .fcl-pre code { min-width: 0; }
  .fcl-code, .fcl-callout, .fcl-download { break-inside: avoid; }
  .fcl-tabpanel[hidden] { display: block !important; }
  .fcl-tablist { display: none; }
}
`;

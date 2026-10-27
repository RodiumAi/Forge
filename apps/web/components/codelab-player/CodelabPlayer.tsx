"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Clock,
  Menu,
  MessageSquare,
  Printer,
  RotateCcw,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import type { Codelab } from "@/lib/contracts/forge-design";

import type { ThemeTokens } from "../deck-player/types";
import { downloadsOf, RenderEnvProvider, type DownloadInfo, type RenderEnv } from "./context";
import { Cover, PresenterPage, SetupPage } from "./CoverPages";
import { firstHeading } from "./markdown/blocks";
import { CodelabMarkdown, DownloadCards } from "./markdown/Markdown";
import {
  clearProgress,
  hashOfView,
  introPages,
  loadProgress,
  nextView,
  previousView,
  progressPercent,
  saveProgress,
  searchCodelab,
  viewFromHash,
  type View,
} from "./navigation";
import { resolveCodelabLocale, translator, type CodelabLocale } from "./strings";
import { CODELAB_CSS } from "./styles";
import { ForgeMark } from "../ForgeMark";
import { schemeOf, type ColorScheme } from "./theme";

export const BADGE_URL = "https://forge.rodiumai.io";

export type CodelabPlayerProps = {
  codelab: Codelab;
  /** Markdown of each step, by step id. */
  steps: Record<string, string>;
  tokens: ThemeTokens;
  scheme?: ColorScheme;
  /** URL of a project file ("public/images/a.webp", "files/starter/main.py"). */
  assetUrl: (path: string) => string;
  /** Published downloads (URL, size); the declared ones are shown either way. */
  downloads?: DownloadInfo[];
  locale?: CodelabLocale | string;
  /** Browser storage namespace (progress, tab choices); one per codelab. */
  storageKey?: string;
  /** "Made with Forge" badge. */
  badge?: boolean;
  feedbackUrl?: string;
  /** Public URL of the published codelab, shown as a QR code on the cover. */
  publicUrl?: string;
  /** `print` renders every step one after the other (PDF export). */
  mode?: "interactive" | "print";
  /** Inside the editor: no URL hash, no fixed elements, keys only when focused. */
  embedded?: boolean;
  /** Embedded only: the view to show. */
  view?: View;
  onViewChange?: (view: View) => void;
};

export function stepTitle(codelab: Codelab, steps: Record<string, string>, index: number): string {
  const step = codelab.steps[index];
  if (!step) return "";
  return step.title || firstHeading(steps[step.id] ?? "") || step.id;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function CodelabPlayer(props: CodelabPlayerProps) {
  const { codelab, steps, tokens, assetUrl, badge, feedbackUrl, embedded, mode = "interactive" } = props;
  const locale = resolveCodelabLocale(props.locale);
  const t = useMemo(() => translator(locale), [locale]);
  const storageKey = props.storageKey ?? `forge-codelab:${codelab.title}`;
  const scheme = props.scheme ?? schemeOf(tokens);
  const downloads = useMemo(() => downloadsOf(codelab, props.downloads), [codelab, props.downloads]);
  const [printing, setPrinting] = useState(false);
  const print = mode === "print" || printing;
  const env: RenderEnv = useMemo(
    () => ({ t, locale, assetUrl, downloads, storageKey, print }),
    [t, locale, assetUrl, downloads, storageKey, print],
  );

  const [ownView, setOwnView] = useState<View>({ kind: "home" });
  const view = embedded && props.view ? props.view : ownView;
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Progress and the step in the URL hash (published page only).
  useEffect(() => {
    const stored = loadProgress(storageKey);
    setVisited(new Set(stored.visited));
    if (embedded || mode === "print") return;
    const read = () => setOwnView(viewFromHash(window.location.hash, codelab));
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [codelab, embedded, mode, storageKey]);

  const go = useCallback(
    (next: View) => {
      setMenuOpen(false);
      if (embedded) {
        setOwnView(next);
        props.onViewChange?.(next);
      } else {
        const hash = hashOfView(next, codelab);
        if (hash) window.location.hash = hash;
        else window.history.pushState(null, "", window.location.pathname + window.location.search);
        setOwnView(next);
        props.onViewChange?.(next);
      }
      contentRef.current?.scrollTo?.({ top: 0 });
      if (!embedded) document.scrollingElement?.scrollTo?.({ top: 0 });
    },
    [codelab, embedded, props],
  );

  // A step counts as visited once shown.
  useEffect(() => {
    if (view.kind !== "step" || mode === "print") return;
    const id = codelab.steps[view.index]?.id;
    if (!id) return;
    setVisited((current) => {
      if (current.has(id)) {
        saveProgress(storageKey, { visited: [...current], last: id });
        return current;
      }
      const next = new Set(current).add(id);
      saveProgress(storageKey, { visited: [...next], last: id });
      return next;
    });
  }, [view, codelab, storageKey, mode]);

  // Keyboard: arrows (and n / p) move, "/" searches. Embedded: only while focused.
  useEffect(() => {
    if (mode === "print") return;
    const target: HTMLElement | Window | null = embedded ? rootRef.current : window;
    if (!target) return;
    const onKey = (event: Event) => {
      const e = event as KeyboardEvent;
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === "ArrowRight" || e.key === "n") {
        e.preventDefault();
        go(nextView(view, codelab));
      } else if (e.key === "ArrowLeft" || e.key === "p") {
        e.preventDefault();
        go(previousView(view, codelab));
      } else if (e.key === "/") {
        e.preventDefault();
        setMenuOpen(true);
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }, [codelab, embedded, go, mode, view]);

  // Print button: render everything expanded, print, then come back.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    const timer = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  const titles = useMemo(() => codelab.steps.map((_, i) => stepTitle(codelab, steps, i)), [codelab, steps]);
  const hits = useMemo(() => searchCodelab(query, codelab, steps, (i) => titles[i]), [query, codelab, steps, titles]);
  const intro = useMemo(() => introPages(codelab), [codelab]);
  const percent = progressPercent(codelab, visited);
  const lastIndex = useMemo(() => {
    const last = loadProgressSafe(storageKey);
    return last ? codelab.steps.findIndex((s) => s.id === last) : -1;
  }, [storageKey, codelab, visited]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = { ...(tokens as Record<string, string>) } as CSSProperties;
  const rootProps = {
    ref: rootRef,
    className: "fcl-root",
    style,
    "data-scheme": scheme,
    "data-embedded": embedded || undefined,
    "data-menu-open": menuOpen || undefined,
    "data-codelab-player": "",
    tabIndex: embedded ? 0 : undefined,
    lang: locale,
  };

  if (print) {
    return (
      <div {...rootProps} data-print="">
        <style>{CODELAB_CSS}</style>
        <RenderEnvProvider value={env}>
          <main className="fcl-content">
            <Cover
              codelab={codelab}
              titles={titles}
              downloads={downloads}
              publicUrl={props.publicUrl}
              hidePrerequisites={intro.includes("setup")}
              t={t}
            />
            {intro.map((page) => (
              <section key={page} className="fcl-print-step" data-page={page}>
                {page === "presenter" ? <PresenterPage codelab={codelab} t={t} /> : <SetupPage codelab={codelab} t={t} />}
              </section>
            ))}
            {codelab.steps.map((step, index) => (
              <section key={step.id} className="fcl-print-step" data-step-id={step.id}>
                <p className="fcl-step-meta">
                  {t("stepOf", { n: index + 1, total: codelab.steps.length })} · {t("minutes", { n: step.minutes })}
                </p>
                <CodelabMarkdown markdown={steps[step.id] ?? ""} />
              </section>
            ))}
          </main>
        </RenderEnvProvider>
      </div>
    );
  }

  const current = view.kind === "step" ? codelab.steps[view.index] : null;
  const isLast = view.kind === "step" && view.index === codelab.steps.length - 1;
  const paged = view.kind === "step" || view.kind === "presenter" || view.kind === "setup";
  const introLabel = (page: "presenter" | "setup") => (page === "presenter" ? t("presenter") : t("setupMenu"));

  return (
    <div {...rootProps}>
      <style>{CODELAB_CSS}</style>
      <RenderEnvProvider value={env}>
        <div className="fcl-shell">
          <nav className="fcl-side" aria-label={t("menu")}>
            <div className="fcl-actions" style={{ justifyContent: "space-between" }}>
              <button type="button" className="fcl-btn fcl-btn-ghost" onClick={() => go({ kind: "home" })}>
                <BookOpen size={14} aria-hidden />
                <span>{t("home")}</span>
              </button>
              <button
                type="button"
                className="fcl-icon-btn fcl-topbar-close"
                aria-label={t("closeMenu")}
                onClick={() => setMenuOpen(false)}
                style={{ display: menuOpen ? undefined : "none" }}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <p className="fcl-side-title">{codelab.title}</p>
            <div
              className="fcl-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-label={t("progress", { n: percent })}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <p className="fcl-progress-label">{t("progress", { n: percent })}</p>
            <label className="fcl-search">
              <Search size={14} aria-hidden />
              <input
                ref={searchRef}
                type="search"
                value={query}
                placeholder={t("search")}
                aria-label={t("search")}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hits[0]) {
                    go({ kind: "step", index: hits[0].index });
                  } else if (e.key === "Escape") {
                    setQuery("");
                  }
                }}
              />
            </label>
            {query.trim().length >= 2 ? (
              <ul className="fcl-results" aria-live="polite">
                {hits.length ? (
                  hits.map((hit) => (
                    <li key={hit.index}>
                      <button type="button" onClick={() => go({ kind: "step", index: hit.index })}>
                        <b>
                          {hit.index + 1}. {hit.title}
                        </b>
                        <small>
                          {hit.before}
                          <mark>{hit.match}</mark>
                          {hit.after}
                        </small>
                      </button>
                    </li>
                  ))
                ) : (
                  <li>
                    <small>{t("searchEmpty")}</small>
                  </li>
                )}
              </ul>
            ) : (
              <>
              {intro.length ? (
                <ul className="fcl-steps fcl-intro-links" aria-label={t("beforeStart")}>
                  {intro.map((page) => (
                    <li key={page}>
                      <button
                        type="button"
                        aria-current={view.kind === page ? "step" : undefined}
                        onClick={() => go({ kind: page })}
                      >
                        <span className="fcl-step-num">
                          {page === "presenter" ? <UserRound size={13} aria-hidden /> : <Wrench size={13} aria-hidden />}
                        </span>
                        <span>{introLabel(page)}</span>
                        <span />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ol className="fcl-steps" aria-label={t("steps")}>
                {codelab.steps.map((step, index) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      aria-current={view.kind === "step" && view.index === index ? "step" : undefined}
                      data-visited={visited.has(step.id) || undefined}
                      onClick={() => go({ kind: "step", index })}
                    >
                      <span className="fcl-step-num">{index + 1}</span>
                      <span>{titles[index]}</span>
                      <span className="fcl-step-min">{t("minutes", { n: step.minutes })}</span>
                    </button>
                  </li>
                ))}
              </ol>
              </>
            )}
            <div className="fcl-side-foot">
              <button type="button" className="fcl-btn fcl-btn-ghost" onClick={() => setPrinting(true)}>
                <Printer size={14} aria-hidden />
                <span>{t("print")}</span>
              </button>
              <span>{t("shortcuts")}</span>
            </div>
          </nav>
          <div className="fcl-main">
            <header className="fcl-topbar">
              <button type="button" className="fcl-icon-btn" aria-label={t("menu")} onClick={() => setMenuOpen(true)}>
                <Menu size={16} aria-hidden />
              </button>
              <span className="fcl-topbar-title">
                {view.kind === "step"
                  ? `${view.index + 1}. ${titles[view.index]}`
                  : view.kind === "presenter" || view.kind === "setup"
                    ? introLabel(view.kind)
                    : codelab.title}
              </span>
            </header>
            <main className="fcl-content" ref={contentRef} aria-live="polite">
              {view.kind === "home" ? (
                <>
                  <Cover
                    codelab={codelab}
                    titles={titles}
                    downloads={downloads}
                    publicUrl={props.publicUrl}
                    showQrPlaceholder={embedded}
                    hidePrerequisites={intro.includes("setup")}
                    t={t}
                  />
                  <div className="fcl-actions">
                    {lastIndex > 0 ? (
                      <>
                        <button
                          type="button"
                          className="fcl-btn fcl-btn-primary"
                          onClick={() => go({ kind: "step", index: lastIndex })}
                        >
                          <span>{t("resume", { n: lastIndex + 1 })}</span>
                          <ArrowRight size={16} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="fcl-btn"
                          onClick={() => {
                            clearProgress(storageKey);
                            setVisited(new Set());
                            go({ kind: "step", index: 0 });
                          }}
                        >
                          <RotateCcw size={14} aria-hidden />
                          <span>{t("restart")}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="fcl-btn fcl-btn-primary"
                        disabled={!codelab.steps.length && !intro.length}
                        onClick={() => go(nextView({ kind: "home" }, codelab))}
                      >
                        <span>{t("start")}</span>
                        <ArrowRight size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </>
              ) : view.kind === "presenter" ? (
                <PresenterPage codelab={codelab} t={t} />
              ) : view.kind === "setup" ? (
                <SetupPage codelab={codelab} t={t} />
              ) : view.kind === "end" ? (
                <End
                  codelab={codelab}
                  titles={titles}
                  downloads={downloads}
                  feedbackUrl={feedbackUrl}
                  t={t}
                  onStep={(index) => go({ kind: "step", index })}
                  onHome={() => go({ kind: "home" })}
                />
              ) : current ? (
                <article data-step-id={current.id}>
                  <p className="fcl-step-meta">
                    <span>{t("stepOf", { n: view.index + 1, total: codelab.steps.length })}</span>
                    <span>
                      <Clock size={13} aria-hidden style={{ verticalAlign: "-2px" }} /> {t("minutes", { n: current.minutes })}
                    </span>
                  </p>
                  {(steps[current.id] ?? "").trim() ? (
                    <CodelabMarkdown markdown={steps[current.id] ?? ""} />
                  ) : (
                    <p className="fcl-md">{t("empty")}</p>
                  )}
                </article>
              ) : null}
            </main>
            {paged ? (
              <div className="fcl-nav">
                <button type="button" className="fcl-btn" onClick={() => go(previousView(view, codelab))}>
                  <ArrowLeft size={16} aria-hidden />
                  <span>{previousView(view, codelab).kind === "home" ? t("home") : t("previous")}</span>
                </button>
                <button type="button" className="fcl-btn fcl-btn-primary" onClick={() => go(nextView(view, codelab))}>
                  <span>{isLast ? t("finish") : t("next")}</span>
                  <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            ) : null}
          </div>
        </div>
        {badge ? (
          <a className="fcl-badge" href={BADGE_URL} target="_blank" rel="noopener noreferrer" aria-label={t("madeWith")}>
            <ForgeMark />
            By Forge
          </a>
        ) : null}
      </RenderEnvProvider>
    </div>
  );
}

function loadProgressSafe(storageKey: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  return loadProgress(storageKey).last;
}

type Translate = ReturnType<typeof translator>;

function End({
  codelab,
  titles,
  downloads,
  feedbackUrl,
  t,
  onStep,
  onHome,
}: {
  codelab: Codelab;
  titles: string[];
  downloads: DownloadInfo[];
  feedbackUrl?: string;
  t: Translate;
  onStep: (index: number) => void;
  onHome: () => void;
}) {
  return (
    <section className="fcl-hero">
      <h1>{t("doneTitle")}</h1>
      <p className="fcl-lead">{t("doneLead")}</p>
      <ol className="fcl-md" style={{ marginBottom: 24 }}>
        {codelab.steps.map((step, index) => (
          <li key={step.id}>
            <a
              href={`#${encodeURIComponent(step.id)}`}
              onClick={(e) => {
                e.preventDefault();
                onStep(index);
              }}
            >
              {titles[index]}
            </a>
          </li>
        ))}
      </ol>
      {codelab.learn?.length ? (
        <div className="fcl-card" style={{ marginBottom: 24 }}>
          <h2>{t("learn")}</h2>
          <ul>
            {codelab.learn.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {downloads.length ? <DownloadCards items={downloads} /> : null}
      <div className="fcl-actions">
        {feedbackUrl ? (
          <a className="fcl-btn fcl-btn-primary" href={feedbackUrl} target="_blank" rel="noopener noreferrer">
            <MessageSquare size={16} aria-hidden />
            <span>{t("feedback")}</span>
          </a>
        ) : null}
        <button type="button" className="fcl-btn" onClick={onHome}>
          <RotateCcw size={14} aria-hidden />
          <span>{t("backToStart")}</span>
        </button>
      </div>
    </section>
  );
}

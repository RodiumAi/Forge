/**
 * Full deck player: fit scaling with letterboxing, slide transitions, element
 * animations by step, keyboard and presentation remotes (plan 5.4), swipe,
 * full screen, black and white screens, "go to slide N", and a presenter view
 * in a second window synced over BroadcastChannel.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize, Minimize, Presentation } from "lucide-react";
import { easingOf, slideStates, transitionBetween, transitionDuration, type SlideMotionContext } from "./animations";
import { canvasSize } from "./geometry";
import { isEditableTarget, mapKey, resolveKey, type PlayerAction } from "./keys";
import { detectLocale, playerLabels } from "./labels";
import { matchMorph, morphedSourceIds, type Box } from "./morph";
import { channelName, openChannel, type Channel, type PresenterMessage, type Screen } from "./presenter-channel";
import { PresenterView, visibleSlides } from "./PresenterView";
import { FittedSlide, SlideCanvas } from "./SlideView";
import { nextPosition, previousPosition, stepCount, type Position } from "./steps";
import type { AssetUrl, Deck, PlayerLocale, Slide, ThemeTokens } from "./types";

export type DeckPlayerProps = {
  deck: Deck;
  slides: Record<string, Slide>;
  notes?: Record<string, string>;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  /** Index of the first slide shown, among visible slides. */
  startAt?: number;
  /** "Made with Forge" badge. */
  badge?: boolean;
  onSlideChange?: (index: number) => void;
  /** Interface language; defaults to the browser language. */
  locale?: PlayerLocale;
  /** Listen to the keyboard and remotes on the window (default true). */
  keyboard?: boolean;
  /** Bottom control bar (default true). */
  controls?: boolean;
  /** BroadcastChannel name shared with the presenter view (default from the deck). */
  channel?: string;
  /** Open this URL as presenter view instead of rendering it in a popup. */
  presenterUrl?: string;
};

export const BADGE_URL = "https://forge.rodiumai.io";

type Nav = { pos: Position; ctx: SlideMotionContext; morphFrom?: Map<string, Box>; leaving?: { index: number; hide: Set<string> } };

const LeavingContext = createContext<{ index: number; hide: Set<string> } | undefined>(undefined);

function PresentSlide(props: { index: number; slide: Slide; size: { width: number; height: number }; tokens: ThemeTokens; assetUrl: AssetUrl; step: number; morphFrom?: Map<string, Box>; morphMs: number }) {
  const leaving = useContext(LeavingContext);
  const hideIds = leaving && leaving.index === props.index ? leaving.hide : undefined;
  return (
    <SlideCanvas
      slide={props.slide}
      size={props.size}
      tokens={props.tokens}
      mode="present"
      step={props.step}
      assetUrl={props.assetUrl}
      morphFrom={props.morphFrom}
      morphMs={props.morphMs}
      hideIds={hideIds}
    />
  );
}

function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, Math.floor(index)), total - 1);
}

export function DeckPlayer({
  deck,
  slides,
  notes,
  tokens,
  assetUrl,
  startAt = 0,
  badge = false,
  onSlideChange,
  locale: localeProp,
  keyboard = true,
  controls = true,
  channel,
  presenterUrl,
}: DeckPlayerProps) {
  const refs = useMemo(() => deck.slides.filter((ref) => !ref.hidden), [deck]);
  const list = useMemo(() => visibleSlides(deck, slides), [deck, slides]);
  const total = list.length;
  const size = canvasSize(deck);
  const [locale, setLocale] = useState<PlayerLocale>(localeProp ?? "fr");
  useEffect(() => setLocale(localeProp ?? detectLocale()), [localeProp]);
  const labels = playerLabels(locale);

  const [nav, setNav] = useState<Nav>(() => ({ pos: { index: clampIndex(startAt, total), step: 0 }, ctx: { transition: { type: "none" }, dir: 1 } }));
  const [screen, setScreen] = useState<Screen>("none");
  const [buffer, setBuffer] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [presenterWin, setPresenterWin] = useState<Window | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef("");
  const navRef = useRef(nav);
  navRef.current = nav;
  const channelRef = useRef<Channel | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const stepsOf = useCallback((index: number) => stepCount(list[index]), [list]);

  const goTo = useCallback(
    (target: Position) => {
      const current = navRef.current;
      const index = clampIndex(target.index, total);
      const pos = { index, step: Math.max(0, Math.min(target.step, stepsOf(index))) };
      if (pos.index === current.pos.index && pos.step === current.pos.step) return;
      if (pos.index === current.pos.index) {
        setNav({ ...current, pos });
        return;
      }
      const ctx = transitionBetween(refs, current.pos.index, pos.index);
      let morphFrom: Map<string, Box> | undefined;
      let leaving: Nav["leaving"];
      if (ctx.transition.type === "morph") {
        morphFrom = matchMorph(list[current.pos.index], list[pos.index]);
        leaving = { index: current.pos.index, hide: morphedSourceIds(list[current.pos.index], list[pos.index]) };
      }
      setNav({ pos, ctx, morphFrom, leaving });
    },
    [list, refs, stepsOf, total],
  );

  const enterFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (el && typeof el.requestFullscreen === "function" && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);
  const exitFullscreen = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement && typeof document.exitFullscreen === "function") {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const perform = useCallback(
    (action: PlayerAction | { type: "goto"; index: number }) => {
      const { pos } = navRef.current;
      switch (action.type) {
        case "next":
        case "prev":
          // A blank screen swallows the first press, like PowerPoint.
          if (screen !== "none") {
            setScreen("none");
            return;
          }
          goTo(action.type === "next" ? nextPosition(pos, stepsOf, total) : previousPosition(pos, stepsOf));
          return;
        case "first":
          goTo({ index: 0, step: 0 });
          return;
        case "last":
          goTo({ index: total - 1, step: 0 });
          return;
        case "goto":
          goTo({ index: action.index, step: 0 });
          return;
        case "start":
          if (!action.fromCurrent) goTo({ index: 0, step: 0 });
          setScreen("none");
          enterFullscreen();
          return;
        case "exit":
          setScreen("none");
          exitFullscreen();
          return;
        case "black":
          setScreen((s) => (s === "black" ? "none" : "black"));
          return;
        case "white":
          setScreen((s) => (s === "white" ? "none" : "white"));
          return;
        default:
          return;
      }
    },
    [enterFullscreen, exitFullscreen, goTo, screen, stepsOf, total],
  );

  // Keyboard and presentation remotes.
  useEffect(() => {
    if (!keyboard) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const action = mapKey(event);
      if (!action) return;
      const { result, buffer: nextBuffer } = resolveKey(action, bufferRef.current);
      bufferRef.current = nextBuffer;
      setBuffer(nextBuffer);
      if (result.kind === "goto") perform({ type: "goto", index: result.slide - 1 });
      else if (result.kind === "action") perform(result.action);
      // Escape keeps its native full screen exit; everything else is ours.
      if (!(action.type === "exit")) event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, perform]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Auto-hiding controls.
  useEffect(() => {
    if (!controlsVisible) return;
    const id = setTimeout(() => setControlsVisible(false), 2500);
    return () => clearTimeout(id);
  }, [controlsVisible, nav]);

  const { pos } = nav;
  useEffect(() => {
    onSlideChange?.(pos.index);
  }, [pos.index, onSlideChange]);

  // Presenter sync.
  const name = channel ?? channelName(deck);
  const performRef = useRef(perform);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const totalRef = useRef(total);
  totalRef.current = total;
  performRef.current = perform;
  useEffect(() => {
    const ch = openChannel(name, (message: PresenterMessage) => {
      if (message.kind === "hello") {
        const { pos: p } = navRef.current;
        ch?.post({ kind: "state", index: p.index, step: p.step, total: totalRef.current, screen: screenRef.current });
      } else if (message.kind === "command") {
        performRef.current({ type: message.action });
      } else if (message.kind === "goto") {
        performRef.current({ type: "goto", index: message.index });
      }
    });
    channelRef.current = ch;
    return () => {
      ch?.close();
      channelRef.current = null;
    };
    // The channel lives as long as the deck; state is read through refs.
  }, [name]);
  useEffect(() => {
    channelRef.current?.post({ kind: "state", index: pos.index, step: pos.step, total, screen });
  }, [pos.index, pos.step, total, screen]);

  const openPresenter = useCallback(() => {
    if (typeof window === "undefined") return;
    if (presenterUrl) {
      window.open(presenterUrl, `${name}-presenter`, "width=1280,height=800");
      return;
    }
    if (presenterWin && !presenterWin.closed) {
      presenterWin.focus();
      return;
    }
    const win = window.open("", `${name}-presenter`, "width=1280,height=800");
    if (!win) return;
    win.document.title = `${deck.title ?? "Forge"} · ${labels.presenter}`;
    win.document.body.style.margin = "0";
    win.document.body.style.background = "#0B0D12";
    win.document.body.innerHTML = "";
    setPresenterWin(win);
  }, [deck.title, labels.presenter, name, presenterUrl, presenterWin]);

  useEffect(() => {
    if (!presenterWin) return;
    const id = setInterval(() => {
      if (presenterWin.closed) setPresenterWin(null);
    }, 1000);
    const close = () => presenterWin.close();
    window.addEventListener("pagehide", close);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", close);
    };
  }, [presenterWin]);
  useEffect(() => () => presenterWin?.close(), [presenterWin]);

  const onClick = (event: ReactMouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest?.("a,button,iframe,video,input,textarea,select,[data-player-controls]")) return;
    perform({ type: "next" });
  };
  const onTouchStart = (event: ReactTouchEvent) => {
    const t = event.touches[0];
    if (t) touchRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (event: ReactTouchEvent) => {
    const start = touchRef.current;
    const t = event.changedTouches[0];
    touchRef.current = null;
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      perform({ type: dx < 0 ? "next" : "prev" });
      event.preventDefault();
    }
  };

  const slide = list[pos.index];
  const duration = transitionDuration(nav.ctx.transition) / 1000;
  const ease = easingOf(nav.ctx.transition.easing);
  const variants = {
    enter: (c: SlideMotionContext) => slideStates(c).enter,
    center: (c: SlideMotionContext) => ({ ...slideStates(c).center, transition: { duration: transitionDuration(c.transition) / 1000, ease: easingOf(c.transition.easing) } }),
    exit: (c: SlideMotionContext) => {
      const states = slideStates(c);
      return { ...states.exit, transition: { duration: (transitionDuration(c.transition) / 1000) * (states.exitDurationScale ?? 1), ease: easingOf(c.transition.easing) } };
    },
  };

  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    background: "#000",
    overflow: "hidden",
    outline: "none",
    userSelect: "none",
    touchAction: "pan-y",
    cursor: controlsVisible ? "default" : "none",
  };

  return (
    <div
      ref={rootRef}
      style={rootStyle}
      tabIndex={-1}
      onClick={onClick}
      onMouseMove={() => setControlsVisible(true)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      data-deck-player=""
      data-index={pos.index}
      data-step={pos.step}
      data-screen={screen}
    >
      <FittedSlide size={size} background="#000">
        <div style={{ position: "relative", width: size.width, height: size.height, perspective: size.width * 1.5, overflow: "hidden" }}>
          <MotionConfig reducedMotion="user">
            <LeavingContext.Provider value={nav.leaving}>
              <AnimatePresence initial={false} custom={nav.ctx}>
                {slide && (
                  <motion.div
                    key={`${pos.index}:${slide.id}`}
                    custom={nav.ctx}
                    variants={variants as never}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration, ease }}
                    style={{ position: "absolute", inset: 0 }}
                  >
                    <PresentSlide
                      index={pos.index}
                      slide={slide}
                      size={size}
                      tokens={tokens}
                      assetUrl={assetUrl}
                      step={pos.step}
                      morphFrom={nav.morphFrom}
                      morphMs={transitionDuration(nav.ctx.transition)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </LeavingContext.Provider>
          </MotionConfig>
        </div>
      </FittedSlide>

      {screen !== "none" && (
        <div style={{ position: "absolute", inset: 0, background: screen === "black" ? "#000" : "#fff", zIndex: 20 }} data-blank-screen={screen} aria-label={screen === "black" ? labels.blackScreen : labels.whiteScreen} />
      )}

      {buffer && (
        <div style={{ position: "absolute", left: "50%", top: 24, transform: "translateX(-50%)", zIndex: 30, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "8px 16px", borderRadius: 8, font: "600 18px system-ui, sans-serif" }} data-goto-buffer="">
          {labels.goTo} {buffer}
        </div>
      )}

      {badge && (
        <a
          href={BADGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ position: "absolute", right: 12, bottom: 12, zIndex: 25, background: "rgba(11,13,18,0.82)", color: "#F5F7FA", border: "1px solid rgba(255,255,255,0.18)", padding: "4px 10px", borderRadius: 999, font: "600 12px system-ui, sans-serif", textDecoration: "none" }}
          data-forge-badge=""
        >
          {labels.madeWith}
        </a>
      )}

      {controls && (
        <div
          data-player-controls=""
          style={{
            position: "absolute",
            left: "50%",
            bottom: 16,
            transform: "translateX(-50%)",
            zIndex: 26,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 4,
            borderRadius: 999,
            background: "rgba(11,13,18,0.82)",
            color: "#F5F7FA",
            font: "500 14px system-ui, sans-serif",
            opacity: controlsVisible ? 1 : 0,
            transition: "opacity 200ms",
            pointerEvents: controlsVisible ? "auto" : "none",
          }}
        >
          <ControlButton label={labels.previous} onClick={() => perform({ type: "prev" })}>
            <ChevronLeft size={18} />
          </ControlButton>
          <span style={{ minWidth: 56, textAlign: "center", fontVariantNumeric: "tabular-nums" }} data-counter="">
            {total === 0 ? "0 / 0" : `${pos.index + 1} / ${total}`}
          </span>
          <ControlButton label={labels.next} onClick={() => perform({ type: "next" })}>
            <ChevronRight size={18} />
          </ControlButton>
          <ControlButton label={labels.presenter} onClick={openPresenter}>
            <Presentation size={18} />
          </ControlButton>
          <ControlButton label={fullscreen ? labels.exitFullscreen : labels.fullscreen} onClick={fullscreen ? exitFullscreen : enterFullscreen}>
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </ControlButton>
        </div>
      )}

      {presenterWin &&
        !presenterWin.closed &&
        createPortal(
          <PresenterView deck={deck} slides={slides} notes={notes} tokens={tokens} assetUrl={assetUrl} channel={name} locale={locale} />,
          presenterWin.document.body,
        )}
    </div>
  );
}

function ControlButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: 0, borderRadius: 999, background: "transparent", color: "inherit", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

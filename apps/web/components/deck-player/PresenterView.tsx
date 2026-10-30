/**
 * Presenter view, laid out like Canva's: clock, timer and tools on top, the
 * current slide at its step, a strip of every slide to jump to, and the notes
 * on the right with an adjustable text size. Runs in a second window and
 * follows the audience window over the deck's BroadcastChannel; its keys and
 * buttons are sent back as commands.
 * Exported so a published page can serve it at its own URL as well.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Minus, Pause, Play, Plus, RotateCcw, Square, X } from "lucide-react";
import { canvasSize } from "./geometry";
import { isEditableTarget, mapKey, resolveKey } from "./keys";
import { playerLabels } from "./labels";
import { channelName, openChannel, type Channel, type PresenterMessage, type Screen } from "./presenter-channel";
import { FittedSlide, SlideCanvas } from "./SlideView";
import { stepCount } from "./steps";
import type { AssetUrl, Deck, PlayerLocale, Slide, ThemeTokens } from "./types";

export type PresenterViewProps = {
  deck: Deck;
  slides: Record<string, Slide>;
  notes?: Record<string, string>;
  tokens: ThemeTokens;
  assetUrl: AssetUrl;
  /** Defaults to `channelName(deck)`; must match the audience player. */
  channel?: string;
  locale?: PlayerLocale;
};

export function visibleSlides(deck: Deck, slides: Record<string, Slide>): Slide[] {
  return deck.slides.filter((ref) => !ref.hidden).map((ref) => slides[ref.id] ?? { id: ref.id, elements: [] });
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

const BG = "#0B0D12";
const LINE = "#2a3140";
const ACCENT = "#EB6118";
const NOTES_SIZES = [16, 20, 24, 28, 34, 40, 48];
const NOTES_DEFAULT = 28;
const NOTES_KEY = "forge.presenter.notesSize";
const STRIP_HEIGHT = 96;

const iconButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "none",
  width: 44,
  height: 44,
  background: "transparent",
  color: "#F5F7FA",
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  font: "inherit",
  cursor: "pointer",
};

const stripNumber: CSSProperties = {
  position: "absolute",
  left: 6,
  bottom: 4,
  fontSize: 11,
  padding: "1px 6px",
  borderRadius: 6,
  background: "rgba(0, 0, 0, 0.6)",
  color: "#fff",
};

function stripItem(size: { width: number; height: number }, current: boolean): CSSProperties {
  return {
    position: "relative",
    flex: "none",
    width: Math.round((STRIP_HEIGHT * size.width) / size.height),
    height: STRIP_HEIGHT,
    padding: 0,
    borderRadius: 10,
    overflow: "hidden",
    background: "#000",
    border: current ? `3px solid ${ACCENT}` : `1px solid ${LINE}`,
    boxSizing: "border-box",
    color: "inherit",
    font: "inherit",
    cursor: current ? "default" : "pointer",
  };
}

function storedNotesSize(): number {
  try {
    const n = Number(window.localStorage.getItem(NOTES_KEY));
    return NOTES_SIZES.includes(n) ? n : NOTES_DEFAULT;
  } catch {
    return NOTES_DEFAULT;
  }
}

/** Icon button of the top bar; the label is its tooltip and accessible name. */
function Tool({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      style={{ ...iconButton, background: active ? "#232a37" : "transparent" }}
    >
      {children}
    </button>
  );
}

export function PresenterView({ deck, slides, notes, tokens, assetUrl, channel, locale = "fr" }: PresenterViewProps) {
  const labels = playerLabels(locale);
  const list = visibleSlides(deck, slides);
  const size = canvasSize(deck);
  const [state, setState] = useState<{ index: number; step: number; screen: Screen } | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notesSize, setNotesSize] = useState(NOTES_DEFAULT);
  const channelRef = useRef<Channel | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLElement | null>(null);
  const bufferRef = useRef("");

  useEffect(() => setNotesSize(storedNotesSize()), []);
  const changeNotesSize = (direction: 1 | -1) => {
    const at = NOTES_SIZES.indexOf(notesSize);
    const next = NOTES_SIZES[Math.min(NOTES_SIZES.length - 1, Math.max(0, (at < 0 ? 3 : at) + direction))];
    setNotesSize(next);
    try {
      window.localStorage.setItem(NOTES_KEY, String(next));
    } catch {
      // Storage refused: the size only lasts for this window.
    }
  };

  useEffect(() => {
    const ch = openChannel(channel ?? channelName(deck), (message: PresenterMessage) => {
      if (message.kind === "state") setState({ index: message.index, step: message.step, screen: message.screen });
    });
    channelRef.current = ch;
    ch?.post({ kind: "hello" });
    return () => {
      ch?.close();
      channelRef.current = null;
    };
  }, [channel, deck]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const win = rootRef.current?.ownerDocument?.defaultView ?? (typeof window !== "undefined" ? window : null);
    if (!win) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;
      const action = mapKey(event);
      if (!action) return;
      const { result, buffer } = resolveKey(action, bufferRef.current);
      bufferRef.current = buffer;
      const post = (m: PresenterMessage) => channelRef.current?.post(m);
      if (result.kind === "goto") post({ kind: "goto", index: result.slide - 1 });
      else if (result.kind === "action") {
        const a = result.action.type;
        if (a === "next" || a === "prev" || a === "first" || a === "last" || a === "black" || a === "white") {
          post({ kind: "command", action: a });
        } else return;
      }
      event.preventDefault();
    };
    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, []);

  const index = state?.index ?? 0;

  // Keep the current slide visible in the strip.
  useEffect(() => {
    const item = stripRef.current?.querySelector<HTMLElement>(`[data-strip-index="${index}"]`);
    item?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  const send = (action: "next" | "prev" | "black") => channelRef.current?.post({ kind: "command", action });
  const goTo = (target: number) => channelRef.current?.post({ kind: "goto", index: target });
  const current = list[index];
  const steps = current ? stepCount(current) : 0;
  const elapsed = (pausedAt ?? now) - startedAt;
  const note = current ? (notes?.[current.id] ?? "").trim() : "";
  const togglePause = () => {
    if (pausedAt === null) setPausedAt(Date.now());
    else {
      setStartedAt(startedAt + (Date.now() - pausedAt));
      setPausedAt(null);
    }
  };
  const clock = new Date(now).toLocaleTimeString(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 30%)",
        background: BG,
        color: "#F5F7FA",
        fontFamily: "'Open Sauce Sans', Inter, system-ui, sans-serif",
        fontSize: 16,
        boxSizing: "border-box",
      }}
      data-presenter-view=""
    >
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, padding: "16px 20px", gap: 14, borderRight: `1px solid ${LINE}` }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums" }} title={labels.clock}>
            {clock}
          </span>
          <span aria-hidden style={{ width: 1, height: 32, background: LINE, margin: "0 8px" }} />
          <strong
            style={{ fontSize: 32, fontWeight: 600, fontVariantNumeric: "tabular-nums", opacity: pausedAt === null ? 1 : 0.55 }}
            title={labels.elapsed}
            data-timer=""
          >
            {formatElapsed(elapsed)}
          </strong>
          <Tool
            label={labels.reset}
            onClick={() => {
              setStartedAt(Date.now());
              setPausedAt(pausedAt === null ? null : Date.now());
            }}
          >
            <RotateCcw size={18} aria-hidden />
          </Tool>
          <Tool label={pausedAt === null ? labels.pause : labels.resume} onClick={togglePause}>
            {pausedAt === null ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
          </Tool>
          <span style={{ marginLeft: "auto", opacity: 0.75, fontVariantNumeric: "tabular-nums" }} data-counter="">
            {state ? `${index + 1} / ${list.length}` : labels.waiting}
            {state && steps > 0 ? ` · ${labels.step} ${Math.min(state.step, steps)}/${steps}` : ""}
            {state?.screen === "black" ? ` · ${labels.blackScreen}` : state?.screen === "white" ? ` · ${labels.whiteScreen}` : ""}
          </span>
          <Tool label={labels.blackScreen} active={state?.screen === "black"} onClick={() => send("black")}>
            <Square size={18} fill="currentColor" aria-hidden />
          </Tool>
          <Tool label={labels.endPresentation} onClick={() => rootRef.current?.ownerDocument?.defaultView?.close()}>
            <X size={18} aria-hidden />
          </Tool>
        </header>

        <section style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", gap: 10 }} aria-label={labels.current}>
          <Tool label={labels.previous} onClick={() => send("prev")}>
            <ChevronLeft size={20} aria-hidden />
          </Tool>
          <div style={{ flex: 1, height: "100%", minWidth: 0 }}>
            {current && (
              <FittedSlide size={size}>
                <SlideCanvas key={`${current.id}-${index}`} slide={current} size={size} tokens={tokens} mode="present" step={state?.step ?? 0} assetUrl={assetUrl} />
              </FittedSlide>
            )}
          </div>
          <Tool label={labels.next} onClick={() => send("next")}>
            <ChevronRight size={20} aria-hidden />
          </Tool>
        </section>

        <nav ref={stripRef} aria-label={labels.goTo} style={{ display: "flex", gap: 12, overflowX: "auto", padding: "4px 2px 8px", flex: "none" }}>
          {list.map((slide, i) => {
            const isCurrent = i === index && state !== null;
            return (
              <button
                key={slide.id}
                type="button"
                data-strip-index={i}
                aria-current={isCurrent || undefined}
                onClick={() => (isCurrent ? undefined : goTo(i))}
                title={`${labels.goTo} ${i + 1}`}
                aria-label={`${labels.goTo} ${i + 1}`}
                style={stripItem(size, isCurrent)}
              >
                {/* The current slide is already shown large: its tile stays empty. */}
                {isCurrent ? null : (
                  <FittedSlide size={size}>
                    <SlideCanvas slide={slide} size={size} tokens={tokens} mode="thumbnail" assetUrl={assetUrl} />
                  </FittedSlide>
                )}
                <span style={stripNumber}>{i + 1}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <aside style={{ display: "flex", flexDirection: "column", minHeight: 0, padding: "16px 20px" }} aria-label={labels.notes}>
        <div style={{ textAlign: "center", paddingBottom: 10, borderBottom: `2px solid ${ACCENT}`, fontWeight: 600 }}>{labels.notes}</div>
        <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "18px 2px", whiteSpace: "pre-wrap", fontSize: notesSize, lineHeight: 1.35 }} data-notes="">
          {note || <span style={{ opacity: 0.5, fontSize: 18 }}>{labels.noNotes}</span>}
        </div>
        <div
          role="group"
          aria-label={labels.notesSize}
          style={{ display: "inline-flex", alignSelf: "flex-start", border: `1px solid ${LINE}`, borderRadius: 12, overflow: "hidden" }}
        >
          <button
            type="button"
            onClick={() => changeNotesSize(-1)}
            disabled={notesSize <= NOTES_SIZES[0]}
            aria-label={labels.notesSmaller}
            title={labels.notesSmaller}
            style={{ ...iconButton, border: 0, borderRadius: 0 }}
          >
            <Minus size={18} aria-hidden />
          </button>
          <span aria-hidden style={{ ...iconButton, border: 0, borderRadius: 0, borderLeft: `1px solid ${LINE}`, borderRight: `1px solid ${LINE}`, cursor: "default", fontSize: 14 }}>
            aA
          </span>
          <button
            type="button"
            onClick={() => changeNotesSize(1)}
            disabled={notesSize >= NOTES_SIZES[NOTES_SIZES.length - 1]}
            aria-label={labels.notesLarger}
            title={labels.notesLarger}
            style={{ ...iconButton, border: 0, borderRadius: 0 }}
          >
            <Plus size={18} aria-hidden />
          </button>
        </div>
      </aside>
    </div>
  );
}

/**
 * Presenter view: current slide at its step, next slide, notes, timer and
 * clock. Runs in a second window and follows the audience window over the
 * deck's BroadcastChannel; its keys and buttons are sent back as commands.
 * Exported so a published page can serve it at its own URL as well.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
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

const panel: CSSProperties = {
  background: "#151922",
  borderRadius: 10,
  padding: 12,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const buttonStyle: CSSProperties = {
  background: "#232a37",
  color: "#F5F7FA",
  border: "1px solid #313a4a",
  borderRadius: 8,
  padding: "8px 14px",
  font: "inherit",
  cursor: "pointer",
};

export function PresenterView({ deck, slides, notes, tokens, assetUrl, channel, locale = "fr" }: PresenterViewProps) {
  const labels = playerLabels(locale);
  const list = visibleSlides(deck, slides);
  const size = canvasSize(deck);
  const [state, setState] = useState<{ index: number; step: number; screen: Screen } | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const channelRef = useRef<Channel | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bufferRef = useRef("");

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

  const send = (action: "next" | "prev" | "black" | "white") => channelRef.current?.post({ kind: "command", action });
  const index = state?.index ?? 0;
  const current = list[index];
  const upcoming = list[index + 1];
  const steps = current ? stepCount(current) : 0;
  const elapsed = (pausedAt ?? now) - startedAt;
  const note = current ? (notes?.[current.id] ?? "").trim() : "";

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
        gridTemplateRows: "auto minmax(0, 1fr) minmax(0, 1fr)",
        gap: 12,
        padding: 12,
        background: "#0B0D12",
        color: "#F5F7FA",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 16,
        boxSizing: "border-box",
      }}
      data-presenter-view=""
    >
      <header style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 28, fontVariantNumeric: "tabular-nums" }} title={labels.elapsed} data-timer="">
          {formatElapsed(elapsed)}
        </strong>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            if (pausedAt === null) setPausedAt(Date.now());
            else {
              setStartedAt(startedAt + (Date.now() - pausedAt));
              setPausedAt(null);
            }
          }}
        >
          {pausedAt === null ? labels.pause : labels.resume}
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            setStartedAt(Date.now());
            setPausedAt(pausedAt === null ? null : Date.now());
          }}
        >
          {labels.reset}
        </button>
        <span style={{ opacity: 0.7 }} title={labels.clock}>
          {new Date(now).toLocaleTimeString(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }} data-counter="">
          {state ? `${index + 1} / ${list.length}` : labels.waiting}
          {state && steps > 0 ? ` · ${labels.step} ${Math.min(state.step, steps)}/${steps}` : ""}
          {state?.screen === "black" ? ` · ${labels.blackScreen}` : state?.screen === "white" ? ` · ${labels.whiteScreen}` : ""}
        </span>
        <button type="button" style={buttonStyle} onClick={() => send("prev")} aria-label={labels.previous}>
          {labels.previous}
        </button>
        <button type="button" style={buttonStyle} onClick={() => send("next")} aria-label={labels.next}>
          {labels.next}
        </button>
      </header>
      <section style={{ ...panel, gridRow: "2 / 4" }} aria-label={labels.current}>
        <div style={{ flex: 1, minHeight: 0 }}>
          {current && (
            <FittedSlide size={size}>
              <SlideCanvas key={`${current.id}-${index}`} slide={current} size={size} tokens={tokens} mode="present" step={state?.step ?? 0} assetUrl={assetUrl} />
            </FittedSlide>
          )}
        </div>
      </section>
      <section style={panel} aria-label={labels.nextSlide}>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{labels.nextSlide}</div>
        <div style={{ flex: 1, minHeight: 0 }}>
          {upcoming ? (
            <FittedSlide size={size}>
              <SlideCanvas slide={upcoming} size={size} tokens={tokens} mode="thumbnail" assetUrl={assetUrl} />
            </FittedSlide>
          ) : (
            <div style={{ opacity: 0.6, padding: 8 }}>{labels.endOfDeck}</div>
          )}
        </div>
      </section>
      <section style={{ ...panel, overflow: "auto" }} aria-label={labels.notes}>
        <div style={{ opacity: 0.7, fontSize: 13 }}>{labels.notes}</div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 20, lineHeight: 1.5 }} data-notes="">
          {note || <span style={{ opacity: 0.5 }}>{labels.noNotes}</span>}
        </div>
      </section>
    </div>
  );
}

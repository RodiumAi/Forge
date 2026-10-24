/**
 * Element renderers: every element type of the slide schema, absolutely
 * positioned in canvas pixels. Group children are positioned relative to the
 * group's top-left corner.
 */

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { motion } from "framer-motion";
import { elementMotion } from "./animations";
import { ChartView } from "./chart";
import { CODE_COLORS, highlightLine, parseHighlight } from "./highlight";
import { FallbackIcon, lucideIcon } from "./icons";
import type { Box } from "./morph";
import type { Schedule } from "./steps";
import { colorRef, fontRef } from "./theme";
import type { AssetUrl, PlayerMode, SlideElement } from "./types";

type TextElement = Extract<SlideElement, { type: "text" }>;
type ImageElement = Extract<SlideElement, { type: "image" }>;
type ShapeElement = Extract<SlideElement, { type: "shape" }>;
type IconElement = Extract<SlideElement, { type: "icon" }>;
type TableElement = Extract<SlideElement, { type: "table" }>;
type VideoElement = Extract<SlideElement, { type: "video" }>;
type CodeElement = Extract<SlideElement, { type: "code" }>;
type Inline = { text?: string; runs?: { text: string; bold?: boolean; italic?: boolean; underline?: boolean; link?: string; color?: string }[] };

export type StageContextValue = {
  mode: PlayerMode;
  assetUrl: AssetUrl;
  schedule: Schedule;
  step: number;
  /** Step the slide was mounted at: elements already shown then do not replay. */
  mountStep: number;
  /** Morph: starting boxes of matched elements, keyed by element id. */
  morphFrom?: Map<string, Box>;
  morphMs?: number;
  /** Elements hidden at once (sources of a morph while their slide leaves). */
  hideIds?: Set<string>;
};

export const StageContext = createContext<StageContextValue | null>(null);

function useStage(): StageContextValue {
  const ctx = useContext(StageContext);
  if (!ctx) throw new Error("deck-player elements must render inside a slide stage");
  return ctx;
}

export const ROLE_SIZES: Record<string, number> = {
  title: 96,
  subtitle: 48,
  heading: 64,
  body: 32,
  caption: 22,
  quote: 40,
  label: 20,
};

function sortByZ(elements: SlideElement[]): SlideElement[] {
  return elements
    .map((element, index) => ({ element, index }))
    .sort((a, b) => (a.element.z ?? 0) - (b.element.z ?? 0) || a.index - b.index)
    .map(({ element }) => element);
}

export function ElementList({ elements }: { elements: SlideElement[] }) {
  return (
    <>
      {sortByZ(elements).map((element) => (
        <ElementView key={element.id} element={element} />
      ))}
    </>
  );
}

export function ElementView({ element }: { element: SlideElement }) {
  const stage = useStage();
  const { mode } = stage;
  if (element.hidden && mode !== "edit") return null;

  const baseOpacity = (element.opacity ?? 1) * (element.hidden ? 0.35 : 1);
  const box: CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    width: element.w,
    height: element.h,
    zIndex: element.z ?? 0,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "50% 50%",
    opacity: baseOpacity,
  };
  const dataProps = {
    "data-element-id": element.id,
    "data-element-type": element.type,
    ...(element.hidden ? { "data-hidden": "" } : {}),
  };

  let body = <ElementBody element={element} />;
  if (element.link && mode === "present") {
    body = (
      <a href={element.link} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%", color: "inherit" }}>
        {body}
      </a>
    );
  }

  const animated = mode === "present";
  const morph = animated ? stage.morphFrom?.get(element.id) : undefined;
  const hide = animated && stage.hideIds?.has(element.id);

  if (morph) {
    const ms = (stage.morphMs ?? 800) / 1000;
    return (
      <motion.div
        {...dataProps}
        style={{ ...box, transform: undefined, opacity: undefined, left: 0, top: 0 }}
        initial={{ x: morph.x, y: morph.y, width: morph.w, height: morph.h, rotate: morph.rotation, opacity: morph.opacity }}
        animate={{ x: element.x, y: element.y, width: element.w, height: element.h, rotate: element.rotation ?? 0, opacity: baseOpacity }}
        transition={{ duration: ms, ease: [0.42, 0, 0.58, 1] }}
      >
        {body}
      </motion.div>
    );
  }

  const entry = stage.schedule.entries.get(element.id);
  if (!animated || !entry || !element.animation) {
    return (
      <div {...dataProps} style={hide ? { ...box, visibility: "hidden" } : box}>
        {body}
      </div>
    );
  }

  const motionDef = elementMotion(element.animation);
  const visible = entry.step <= stage.step;
  const startsHidden = stage.mountStep === 0 || entry.step > stage.mountStep;
  const timing = visible
    ? motionDef.spring
      ? { type: "spring" as const, bounce: motionDef.spring.bounce, duration: entry.durationMs / 1000, delay: entry.delayMs / 1000 }
      : { duration: entry.durationMs / 1000, delay: entry.delayMs / 1000, ease: motionDef.ease }
    : { duration: 0 };
  return (
    <div {...dataProps} data-step={entry.step} style={hide ? { ...box, visibility: "hidden" } : box}>
      <motion.div
        style={{ width: "100%", height: "100%" }}
        initial={startsHidden ? motionDef.hidden : false}
        animate={visible ? motionDef.visible : motionDef.hidden}
        transition={timing as never}
      >
        {body}
      </motion.div>
    </div>
  );
}

function ElementBody({ element }: { element: SlideElement }) {
  switch (element.type) {
    case "text":
      return <TextView element={element} />;
    case "image":
      return <ImageView element={element} />;
    case "shape":
      return <ShapeView element={element} />;
    case "icon":
      return <IconView element={element} />;
    case "table":
      return <TableView element={element} />;
    case "chart":
      return <ChartView element={element} />;
    case "video":
      return <VideoView element={element} />;
    case "code":
      return <CodeView element={element} />;
    case "group":
      return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <ElementList elements={element.children} />
        </div>
      );
    default:
      return null;
  }
}

// ── text ────────────────────────────────────────────────────────────────────

export function InlineContent({ inline }: { inline: Inline }): ReactNode {
  if (inline.runs && inline.runs.length > 0) {
    return inline.runs.map((run, i) => {
      const style: CSSProperties = {
        fontWeight: run.bold ? 700 : undefined,
        fontStyle: run.italic ? "italic" : undefined,
        textDecoration: run.underline || run.link ? "underline" : undefined,
        color: run.color ? colorRef(run.color) : undefined,
      };
      if (run.link) {
        return (
          <a key={i} href={run.link} target="_blank" rel="noopener noreferrer" style={{ ...style, color: style.color ?? "inherit" }}>
            {run.text}
          </a>
        );
      }
      return (
        <span key={i} style={style}>
          {run.text}
        </span>
      );
    });
  }
  return inline.text ?? "";
}

function TextView({ element }: { element: TextElement }) {
  const style = element.style ?? {};
  const size = style.size ?? ROLE_SIZES[element.role ?? "body"] ?? 32;
  const justify = style.valign === "middle" ? "center" : style.valign === "bottom" ? "flex-end" : "flex-start";
  const font = style.font ?? (element.role === "title" || element.role === "heading" || element.role === "subtitle" ? "display" : "body");
  const css: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: justify,
    fontFamily: fontRef(font),
    fontSize: size,
    fontWeight: style.weight ?? (element.role === "title" || element.role === "heading" ? 700 : 400),
    fontStyle: style.italic || element.role === "quote" ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    textTransform: style.uppercase ? "uppercase" : undefined,
    color: colorRef(style.color ?? "--fg"),
    textAlign: style.align ?? "left",
    lineHeight: style.lineHeight ?? 1.2,
    letterSpacing: style.letterSpacing !== undefined ? style.letterSpacing : undefined,
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
    margin: 0,
  };
  return (
    <div style={css} data-role={element.role}>
      {element.content.map((block, i) => {
        if (block.type === "paragraph") {
          return (
            <p key={i} style={{ margin: 0 }}>
              <InlineContent inline={block} />
            </p>
          );
        }
        const List = block.type === "ordered-list" ? "ol" : "ul";
        return (
          <List key={i} style={{ margin: 0, paddingLeft: "1.2em" }}>
            {block.items.map((item, j) => (
              <li key={j} style={{ marginLeft: `${(item.level ?? 0) * 1.2}em` }}>
                <InlineContent inline={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}

// ── image ───────────────────────────────────────────────────────────────────

/**
 * Size and offset of an <img> so the crop rectangle (fractions of the source)
 * fills a w x h box with the given fit. Natural size of the source required.
 */
export function cropLayout(
  natural: { width: number; height: number },
  crop: { x: number; y: number; w: number; h: number },
  box: { w: number; h: number },
  fit: "cover" | "contain" | "fill",
): { width: number; height: number; left: number; top: number } {
  const cw = crop.w * natural.width;
  const ch = crop.h * natural.height;
  let sx = box.w / cw;
  let sy = box.h / ch;
  if (fit === "cover") sx = sy = Math.max(sx, sy);
  if (fit === "contain") sx = sy = Math.min(sx, sy);
  return {
    width: natural.width * sx,
    height: natural.height * sy,
    left: (box.w - cw * sx) / 2 - crop.x * natural.width * sx,
    top: (box.h - ch * sy) / 2 - crop.y * natural.height * sy,
  };
}

export function Credit({ credit }: { credit: NonNullable<ImageElement["credit"]> }) {
  const label = [credit.author, credit.source === "upload" || credit.source === "other" ? null : credit.source].filter(Boolean).join(" / ");
  if (!label) return null;
  const text = credit.source === "generated" && !credit.author ? "AI" : label;
  const css: CSSProperties = {
    position: "absolute",
    right: 8,
    bottom: 8,
    padding: "2px 8px",
    borderRadius: 4,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 14,
    fontFamily: fontRef("body"),
    lineHeight: 1.4,
    maxWidth: "80%",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  return credit.url ? (
    <a href={credit.url} target="_blank" rel="noopener noreferrer" style={{ ...css, textDecoration: "none" }} data-credit="">
      {text}
    </a>
  ) : (
    <span style={css} data-credit="">
      {text}
    </span>
  );
}

function ImageView({ element }: { element: ImageElement }) {
  const { assetUrl, mode } = useStage();
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const fit = element.fit ?? "cover";
  const src = assetUrl(element.src);
  const crop = element.crop;
  let img: ReactNode;
  if (crop && natural) {
    const l = cropLayout(natural, crop, { w: element.w, h: element.h }, fit);
    img = (
      <img src={src} alt={element.alt ?? ""} draggable={false} style={{ position: "absolute", left: l.left, top: l.top, width: l.width, height: l.height, maxWidth: "none" }} />
    );
  } else {
    img = (
      <img
        src={src}
        alt={element.alt ?? ""}
        draggable={false}
        onLoad={crop ? (e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight }) : undefined}
        style={{ width: "100%", height: "100%", objectFit: crop ? "fill" : fit, display: "block" }}
      />
    );
  }
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", borderRadius: element.radius ?? 0 }}>
      {img}
      {element.credit && mode !== "thumbnail" && <Credit credit={element.credit} />}
    </div>
  );
}

// ── shape ───────────────────────────────────────────────────────────────────

function ShapeView({ element }: { element: ShapeElement }) {
  const { w, h } = element;
  const isLine = element.shape === "line" || element.shape === "arrow";
  const strokeWidth = element.strokeWidth ?? (isLine ? 4 : 0);
  const stroke = element.stroke ? colorRef(element.stroke) : isLine ? colorRef("--fg") : "none";
  const fill = element.fill ? colorRef(element.fill) : isLine ? "none" : colorRef("--accent");
  const half = strokeWidth / 2;
  let shape: ReactNode;
  if (element.shape === "rect") {
    const r = Math.min(element.radius ?? 0, w / 2, h / 2);
    shape = <rect x={half} y={half} width={Math.max(0, w - strokeWidth)} height={Math.max(0, h - strokeWidth)} rx={r} ry={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  } else if (element.shape === "ellipse") {
    shape = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - half)} ry={Math.max(0, h / 2 - half)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  } else {
    // Lines run horizontally through the middle of their box; rotation angles them.
    const head = element.shape === "arrow" ? Math.max(12, strokeWidth * 4) : 0;
    const y = h / 2;
    shape = (
      <>
        <line x1={0} y1={y} x2={w - head * 0.8} y2={y} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={head ? "butt" : "round"} />
        {head > 0 && <path d={`M ${w - head} ${y - head * 0.6} L ${w} ${y} L ${w - head} ${y + head * 0.6} Z`} fill={stroke} />}
      </>
    );
  }
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", overflow: "visible" }} data-shape={element.shape}>
      {shape}
    </svg>
  );
}

// ── icon ────────────────────────────────────────────────────────────────────

function IconView({ element }: { element: IconElement }) {
  const color = colorRef(element.color ?? "--fg");
  const strokeWidth = element.strokeWidth ?? 2;
  const Icon = lucideIcon(element.icon);
  return (
    <div style={{ width: "100%", height: "100%", color }} data-icon={element.icon}>
      {Icon ? <Icon width="100%" height="100%" color={color} strokeWidth={strokeWidth} absoluteStrokeWidth={false} /> : <FallbackIcon color={color} strokeWidth={strokeWidth} />}
    </div>
  );
}

// ── table ───────────────────────────────────────────────────────────────────

function TableView({ element }: { element: TableElement }) {
  const style = element.style ?? {};
  const border = colorRef(style.border ?? "--border", "rgba(127,127,127,0.4)");
  const columns = Math.max(...element.rows.map((row) => row.length));
  const widths = element.columnWidths && element.columnWidths.length > 0 ? element.columnWidths : null;
  const total = widths ? widths.slice(0, columns).reduce((a, b) => a + b, 0) || 1 : columns;
  return (
    <table
      style={{
        width: "100%",
        height: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        fontFamily: fontRef("body"),
        fontSize: style.size ?? 24,
        color: colorRef(style.color ?? "--fg"),
      }}
    >
      <colgroup>
        {Array.from({ length: columns }, (_, i) => (
          <col key={i} style={{ width: `${((widths ? (widths[i] ?? 1) : 1) / total) * 100}%` }} />
        ))}
      </colgroup>
      <tbody>
        {element.rows.map((row, r) => {
          const header = r === 0 && !!element.headerRow;
          const Cell = header ? "th" : "td";
          return (
            <tr key={r} style={header ? { background: colorRef(style.headerFill ?? "--surface", "transparent") } : undefined}>
              {Array.from({ length: columns }, (_, c) => (
                <Cell key={c} style={{ border: `1px solid ${border}`, padding: "0.35em 0.6em", textAlign: "left", fontWeight: header ? 700 : 400, overflow: "hidden" }}>
                  {row[c] ? <InlineContent inline={row[c]} /> : null}
                </Cell>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── video ───────────────────────────────────────────────────────────────────

/** Embeddable player URL for YouTube and Vimeo links; null for other links. */
export function videoEmbedUrl(url: string, opts: { autoplay?: boolean; muted?: boolean } = {}): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  const params = new URLSearchParams();
  if (opts.autoplay) params.set("autoplay", "1");
  if (opts.muted) params.set("mute", "1");
  let id: string | null = null;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = parsed.searchParams.get("v") ?? (/^\/(embed|shorts|live)\/([^/?#]+)/.exec(parsed.pathname)?.[2] ?? null);
  } else if (host === "youtu.be") {
    id = parsed.pathname.slice(1).split("/")[0] || null;
  }
  if (id && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    const q = params.toString();
    return `https://www.youtube-nocookie.com/embed/${id}${q ? `?${q}` : ""}`;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vid = /\/(\d{5,12})(?:$|[/?#])/.exec(parsed.pathname)?.[1];
    if (vid) {
      const vp = new URLSearchParams();
      if (opts.autoplay) vp.set("autoplay", "1");
      if (opts.muted) vp.set("muted", "1");
      const q = vp.toString();
      return `https://player.vimeo.com/video/${vid}${q ? `?${q}` : ""}`;
    }
  }
  return null;
}

function isDirectVideo(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?|#|$)/i.test(url);
}

function VideoView({ element }: { element: VideoElement }) {
  const { mode, assetUrl } = useStage();
  const poster = element.poster ? assetUrl(element.poster) : undefined;
  if (mode === "present") {
    const embed = videoEmbedUrl(element.url, { autoplay: element.autoplay, muted: element.muted });
    if (embed) {
      return (
        <iframe
          src={embed}
          title={element.name ?? "video"}
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }
    if (isDirectVideo(element.url)) {
      return (
        <video
          src={element.url}
          poster={poster}
          controls
          autoPlay={element.autoplay}
          muted={element.muted}
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" }}
        />
      );
    }
  }
  // Edit, print and thumbnails: a still frame with a play mark, linking out when presenting.
  const still = (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", overflow: "hidden" }} data-video-placeholder="">
      {poster && <img src={poster} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
      <svg viewBox="0 0 100 100" style={{ position: "absolute", left: "50%", top: "50%", width: "min(30%, 160px)", height: "min(30%, 160px)", transform: "translate(-50%, -50%)" }} aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="rgba(0,0,0,0.55)" stroke="#fff" strokeWidth="3" />
        <path d="M 40 30 L 72 50 L 40 70 Z" fill="#fff" />
      </svg>
    </div>
  );
  if (mode === "present") {
    return (
      <a href={element.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", width: "100%", height: "100%" }}>
        {still}
      </a>
    );
  }
  return still;
}

// ── code ────────────────────────────────────────────────────────────────────

function CodeView({ element }: { element: CodeElement }) {
  const size = element.size ?? 24;
  const lines = element.code.replace(/\n$/, "").split("\n");
  const marked = parseHighlight(element.highlight);
  const gutter = String(lines.length).length;
  return (
    <pre
      style={{
        margin: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "0.8em 0",
        borderRadius: 12,
        background: "#0D1117",
        color: CODE_COLORS.plain,
        fontFamily: fontRef("mono"),
        fontSize: size,
        lineHeight: 1.5,
      }}
      data-language={element.language}
    >
      <code style={{ display: "block", fontFamily: "inherit" }}>
        {lines.map((line, i) => (
          <div
            key={i}
            data-line={i + 1}
            {...(marked.has(i + 1) ? { "data-highlighted": "" } : {})}
            style={{ padding: "0 1em", whiteSpace: "pre", background: marked.has(i + 1) ? "rgba(242,98,10,0.18)" : undefined }}
          >
            {element.lineNumbers && (
              <span style={{ display: "inline-block", width: `${gutter + 1}ch`, color: CODE_COLORS.comment, userSelect: "none" }}>{i + 1}</span>
            )}
            {highlightLine(line, element.language).map((token, j) => (
              <span key={j} style={token.kind === "plain" ? undefined : { color: CODE_COLORS[token.kind] }} data-token={token.kind}>
                {token.text}
              </span>
            ))}
            {line === "" ? " " : null}
          </div>
        ))}
      </code>
    </pre>
  );
}

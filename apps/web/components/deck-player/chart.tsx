/**
 * Chart element as plain SVG: bars (grouped or stacked), lines, pie. Drawn in
 * the element's own canvas pixels, so it prints and exports exactly like the
 * screen (no measuring container, no async layout).
 */

import type { ReactElement } from "react";
import type { SlideElement } from "./types";
import { colorRef } from "./theme";

type ChartElement = Extract<SlideElement, { type: "chart" }>;

const PALETTE_FALLBACK = ["#F2620A", "#3B82F6", "#10B981", "#A855F7", "#F59E0B", "#EF4444", "#14B8A6", "#EC4899", "#6366F1", "#84CC16", "#0EA5E9", "#F97316"];

const THEME_SERIES = ["--accent-2", "--muted", "--fg", "--border"];

export function seriesColor(index: number, ref: string | undefined): string {
  if (ref) return colorRef(ref);
  const fallback = PALETTE_FALLBACK[index % PALETTE_FALLBACK.length];
  if (index === 0) return `var(--accent, ${fallback})`;
  // Stay inside the deck theme first, then a neutral palette.
  const theme = THEME_SERIES[index - 1];
  return theme
    ? `var(--chart-${index + 1}, var(${theme}, ${fallback}))`
    : `var(--chart-${index + 1}, ${fallback})`;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Math.abs(value) >= 100 ? String(Math.round(value)) : String(Math.round(value * 100) / 100);
}

/** Bounds of the value axis, always including 0. */
export function valueRange(element: Pick<ChartElement, "data" | "options">): { min: number; max: number } {
  const { labels, series } = element.data;
  let min = 0;
  let max = 0;
  if (element.options?.stacked) {
    for (let i = 0; i < labels.length; i++) {
      let pos = 0;
      let neg = 0;
      for (const s of series) {
        const v = s.values[i] ?? 0;
        if (v >= 0) pos += v;
        else neg += v;
      }
      max = Math.max(max, pos);
      min = Math.min(min, neg);
    }
  } else {
    for (const s of series) for (const v of s.values) {
      if (Number.isFinite(v)) {
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
    }
  }
  if (max === min) max = min + 1;
  return { min, max };
}

export function ChartView({ element }: { element: ChartElement }) {
  const { w, h } = element;
  const { labels, series } = element.data;
  const legend = element.options?.legend ?? series.length > 1;
  const showValues = element.options?.values ?? false;
  const font = Math.max(12, Math.min(28, h / 22));
  const textColor = "var(--fg, currentColor)";
  const mutedColor = "var(--muted, rgba(127,127,127,0.8))";
  const legendH = legend ? font * 2 : 0;

  if (element.chart === "pie") {
    const values = (series[0]?.values ?? []).map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = Math.max(1, Math.min(w, h - legendH) / 2 - font);
    const cx = w / 2;
    const cy = (h - legendH) / 2;
    let angle = -Math.PI / 2;
    const slices = values.map((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      const start = angle;
      angle += sweep;
      const end = angle;
      const large = sweep > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const mid = (start + end) / 2;
      const d =
        sweep >= Math.PI * 2 - 1e-6
          ? `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`
          : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
      return { d, color: seriesColor(i, undefined), mid, v, label: labels[i] ?? "" };
    });
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={series[0]?.name ?? "chart"} data-chart="pie">
        {slices.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} stroke="var(--bg, #fff)" strokeWidth={2} />
        ))}
        {showValues &&
          slices.map((s, i) =>
            s.v > 0 ? (
              <text key={i} x={cx + r * 0.65 * Math.cos(s.mid)} y={cy + r * 0.65 * Math.sin(s.mid)} fill="#fff" fontSize={font} textAnchor="middle" dominantBaseline="middle">
                {formatValue(s.v)}
              </text>
            ) : null,
          )}
        {legend && <Legend items={slices.map((s) => ({ name: s.label, color: s.color }))} y={h - legendH / 2} w={w} font={font} color={textColor} />}
      </svg>
    );
  }

  const padLeft = font * 3.2;
  const padBottom = font * 2;
  const padTop = font;
  const plotW = Math.max(1, w - padLeft - font);
  const plotH = Math.max(1, h - padTop - padBottom - legendH);
  const { min, max } = valueRange(element);
  const yOf = (v: number) => padTop + plotH - ((v - min) / (max - min)) * plotH;
  const zeroY = yOf(0);
  const n = Math.max(1, labels.length);
  const band = plotW / n;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);

  const shapes: ReactElement[] = [];
  if (element.chart === "bar") {
    const stacked = !!element.options?.stacked;
    const groupW = band * 0.7;
    const barW = stacked ? groupW : groupW / Math.max(1, series.length);
    for (let i = 0; i < labels.length; i++) {
      let pos = 0;
      let neg = 0;
      series.forEach((s, si) => {
        const v = s.values[i] ?? 0;
        if (!Number.isFinite(v)) return;
        let y0: number;
        let y1: number;
        if (stacked) {
          const base = v >= 0 ? pos : neg;
          y0 = yOf(base);
          y1 = yOf(base + v);
          if (v >= 0) pos += v;
          else neg += v;
        } else {
          y0 = zeroY;
          y1 = yOf(v);
        }
        const x = padLeft + band * i + (band - groupW) / 2 + (stacked ? 0 : barW * si);
        const top = Math.min(y0, y1);
        const height = Math.abs(y1 - y0);
        shapes.push(<rect key={`b${i}-${si}`} x={x} y={top} width={Math.max(1, barW - 2)} height={height} fill={seriesColor(si, s.color)} rx={2} />);
        if (showValues) {
          shapes.push(
            <text key={`v${i}-${si}`} x={x + barW / 2} y={v >= 0 ? top - font * 0.3 : top + height + font} fill={textColor} fontSize={font * 0.85} textAnchor="middle">
              {formatValue(v)}
            </text>,
          );
        }
      });
    }
  } else {
    series.forEach((s, si) => {
      const pts = labels.map((_, i) => ({ x: padLeft + band * i + band / 2, y: yOf(s.values[i] ?? 0), v: s.values[i] }));
      const color = seriesColor(si, s.color);
      shapes.push(
        <polyline key={`l${si}`} points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth={Math.max(2, font / 5)} strokeLinejoin="round" />,
      );
      pts.forEach((p, i) => {
        shapes.push(<circle key={`p${si}-${i}`} cx={p.x} cy={p.y} r={Math.max(3, font / 4)} fill={color} />);
        if (showValues && p.v !== undefined) {
          shapes.push(
            <text key={`t${si}-${i}`} x={p.x} y={p.y - font * 0.6} fill={textColor} fontSize={font * 0.85} textAnchor="middle">
              {formatValue(p.v)}
            </text>,
          );
        }
      });
    });
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={series.map((s) => s.name).join(", ")} data-chart={element.chart}>
      {ticks.map((t, i) => (
        <g key={`g${i}`}>
          <line x1={padLeft} x2={padLeft + plotW} y1={yOf(t)} y2={yOf(t)} stroke={mutedColor} strokeOpacity={0.3} />
          <text x={padLeft - font * 0.4} y={yOf(t)} fill={mutedColor} fontSize={font * 0.8} textAnchor="end" dominantBaseline="middle">
            {formatValue(t)}
          </text>
        </g>
      ))}
      <line x1={padLeft} x2={padLeft + plotW} y1={zeroY} y2={zeroY} stroke={mutedColor} />
      {shapes}
      {labels.map((label, i) => (
        <text key={`x${i}`} x={padLeft + band * i + band / 2} y={padTop + plotH + font * 1.3} fill={textColor} fontSize={font * 0.85} textAnchor="middle">
          {label}
        </text>
      ))}
      {legend && <Legend items={series.map((s, i) => ({ name: s.name, color: seriesColor(i, s.color) }))} y={h - legendH / 2} w={w} font={font} color={textColor} />}
    </svg>
  );
}

function Legend({ items, y, w, font, color }: { items: { name: string; color: string }[]; y: number; w: number; font: number; color: string }) {
  const slot = w / Math.max(1, items.length);
  return (
    <g data-legend="">
      {items.map((item, i) => {
        const cx = slot * i + slot / 2;
        return (
          <g key={i}>
            <rect x={cx - font * 2} y={y - font * 0.35} width={font * 0.7} height={font * 0.7} fill={item.color} rx={2} />
            <text x={cx - font * 1.1} y={y} fill={color} fontSize={font * 0.8} dominantBaseline="middle">
              {item.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}

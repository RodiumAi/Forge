import type { Goals } from "../data";

const RINGS = [
  { key: "move", r: 76, color: "var(--ring-move)" },
  { key: "exercise", r: 58, color: "var(--ring-exercise)" },
  { key: "stand", r: 40, color: "var(--ring-stand)" },
] as const;

type Props = { value: Goals; goals: Goals; size?: number };

/** Signature element: three concentric progress rings (Move, Exercise, Stand), each capped at a full circle. */
export default function Rings({ value, goals, size = 180 }: Props) {
  return (
    <svg className="rings" viewBox="0 0 180 180" width={size} height={size} aria-hidden>
      {RINGS.map(({ key, r, color }) => {
        const c = 2 * Math.PI * r;
        const p = Math.min(value[key] / goals[key], 0.999);
        return (
          <g key={key}>
            <circle cx="90" cy="90" r={r} fill="none" style={{ stroke: color }} strokeOpacity=".16" strokeWidth="15" />
            <circle
              className="ring-arc" cx="90" cy="90" r={r} fill="none" style={{ stroke: color }} strokeWidth="15" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - p)} transform="rotate(-90 90 90)"
            />
          </g>
        );
      })}
    </svg>
  );
}

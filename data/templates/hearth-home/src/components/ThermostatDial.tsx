import { TEMP_MAX, TEMP_MIN, type ClimateMode } from "./HomeState";

type Props = { target: number; current: number; mode: ClimateMode };

const CX = 150;
const CY = 150;
const R = 118;

/** Point on the upper half circle for a fraction 0..1 (left to right). */
function point(f: number, r = R) {
  const a = Math.PI - f * Math.PI;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

/** Semicircular thermostat: tick ring, track, coloured arc up to the target, knob. */
export default function ThermostatDial({ target, current, mode }: Props) {
  const f = (target - TEMP_MIN) / (TEMP_MAX - TEMP_MIN);
  const knob = point(f);
  const now = point((current - TEMP_MIN) / (TEMP_MAX - TEMP_MIN), R + 20);
  const ticks = Array.from({ length: 29 }, (_, i) => i / 28);
  const arc = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;

  return (
    <svg className={`dial ${mode}`} viewBox="0 0 300 168" role="img" aria-label={`Target ${target} degrees, room at ${current}`}>
      <defs>
        <linearGradient id="dial-heat" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#ffd88a" />
          <stop offset="1" stopColor="#f08a24" />
        </linearGradient>
        <linearGradient id="dial-cool" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#b7e6ff" />
          <stop offset="1" stopColor="#3aa8ef" />
        </linearGradient>
        <linearGradient id="dial-auto" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6ec6ff" />
          <stop offset="1" stopColor="#f5b544" />
        </linearGradient>
      </defs>
      {ticks.map((t) => {
        const a = point(t, R + 26);
        const b = point(t, R + (Math.round(t * 28) % 7 === 0 ? 36 : 31));
        return <line key={t} className={t <= f ? "tick lit" : "tick"} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
      })}
      <path className="track" d={arc} />
      <path className="value" d={arc} pathLength={100} strokeDasharray={`${f * 100} 100`} stroke={`url(#dial-${mode})`} />
      <circle className="now" cx={now.x} cy={now.y} r={3.5} />
      <circle className="knob-halo" cx={knob.x} cy={knob.y} r={17} />
      <circle className="knob" cx={knob.x} cy={knob.y} r={10} />
    </svg>
  );
}

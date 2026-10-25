type Props = { done: number; total: number; size?: number };

/** Day progress ring: a track and an arc that fills as habits are checked. */
export default function ProgressRing({ done, total, size = 112 }: Props) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const share = total ? done / total : 0;
  return (
    <svg className="ring" width={size} height={size} viewBox="0 0 112 112" role="img" aria-label={`${done} of ${total} done`}>
      <circle className="ring-track" cx="56" cy="56" r={r} />
      <circle
        className="ring-value"
        cx="56"
        cy="56"
        r={r}
        strokeDasharray={`${c * share} ${c}`}
        transform="rotate(-90 56 56)"
      />
    </svg>
  );
}

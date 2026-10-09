/* Budget-left ring, drawn in SVG (used by onboarding and Home). */
export default function ProgressRing({ pct }: { pct: number }) {
  const r = 74;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  return (
    <svg className="ring" viewBox="0 0 180 180" aria-hidden>
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--track)" strokeWidth="14" />
      <circle cx="90" cy="90" r={r} fill="none" stroke="var(--accent)" strokeWidth="14"
        strokeLinecap="round" strokeDasharray={`${dash} ${c}`} transform="rotate(-90 90 90)" />
    </svg>
  );
}

/* Tiny route trace (inline SVG drawing, unique per seed). Used by Home and Runs. */
const PATHS = [
  "M4 26c4-10 8 2 12-6s10 8 12-2",
  "M4 14c6-2 4 12 10 8s6-16 12-8",
  "M6 8c-2 8 10 6 6 14s10 2 8-8",
  "M4 20c8 0 4-14 12-12s2 16 10 12",
];
const STARTS = [26, 14, 8, 20];

export default function RouteThumb({ seed, small }: { seed: number; small?: boolean }) {
  return (
    <span className={small ? "route sm" : "route"} aria-hidden>
      <svg viewBox="0 0 32 32" width="100%" height="100%" fill="none" aria-hidden>
        <path d={PATHS[seed % PATHS.length]} stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="4" cy={STARTS[seed % 4]} r="2.1" fill="var(--accent)" />
      </svg>
    </span>
  );
}

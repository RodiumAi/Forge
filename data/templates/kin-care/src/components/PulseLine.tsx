/** Small heart-rate trace for the vitals row (a chart, not an icon). */
export default function PulseLine() {
  return (
    <svg className="pulse-line" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <path d="M0 22 H28 L33 22 L38 10 L44 32 L50 4 L56 26 L60 22 H84 L88 18 L92 24 L96 22 H120" />
    </svg>
  );
}

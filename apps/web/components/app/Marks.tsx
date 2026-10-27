/** The stepped mark of the Forge icon, used as a quiet background motif and in empty states. */
export function StepsMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1000 1000" aria-hidden focusable="false">
      <path fill="currentColor" d="M0 0H1000V1000H740V785H525V735H475V525H260V475H215V260H0Z" />
    </svg>
  );
}

/** Grid, faint glow and two stepped marks behind a hero (overview). */
export function HeroBackdrop() {
  return (
    <div className="f-hero-bg" aria-hidden>
      <div className="grid" />
      <div className="glow" />
      <div className="steps">
        <StepsMark />
      </div>
      <div className="steps left">
        <StepsMark />
      </div>
    </div>
  );
}

type Props = { size?: "xs" | "sm" | "md" | "lg" | "xl"; state?: "idle" | "listening" | "speaking" | "muted"; className?: string };

/** Nova's face: layered radial and conic gradients that rotate slowly and
 *  breathe. The state changes the speed and the glow, nothing else. */
export default function Orb({ size = "md", state = "idle", className = "" }: Props) {
  return (
    <span className={`orb orb-${size} orb-${state} ${className}`} aria-hidden>
      <i className="orb-glow" />
      <i className="orb-core" />
      <i className="orb-swirl" />
      <i className="orb-shine" />
    </span>
  );
}

type WaveProps = { flip?: boolean; fill: string };

// Organic section divider (a shape, not an icon).
export default function Wave({ flip, fill }: WaveProps) {
  return (
    <div className={flip ? "wave flip" : "wave"} aria-hidden>
      <svg viewBox="0 0 1440 90" preserveAspectRatio="none">
        <path
          d="M0,48 C240,90 480,6 720,42 C960,78 1200,18 1440,54 L1440,90 L0,90 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

type Props = { pct: number; value: string; unit: string; big?: boolean };

/* Conic progress ring with a value in the core (onboarding + Home). */
export default function ActivityRing({ pct, value, unit, big }: Props) {
  return (
    <div className={big ? "ring-hero big" : "ring-hero"} style={{ ["--p" as string]: String(pct) }}>
      <div className="ring-core">
        <span className="rv">{value}</span>
        <span className="ru">{unit}</span>
      </div>
    </div>
  );
}

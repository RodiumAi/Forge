import type { ReactNode } from "react";

type Props = { background: string; big?: boolean; children: ReactNode };

/* Conic-gradient ring with a hole for the label (onboarding + Today). */
export default function ProgressRing({ background, big, children }: Props) {
  return (
    <div className={big ? "ring big" : "ring"} style={{ background }}>
      <div className="ring-hole">{children}</div>
    </div>
  );
}

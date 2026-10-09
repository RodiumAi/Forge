import { Pause, Play } from "lucide-react";

/* Solid transport icons. `size` is the slot the glyph was designed for; the
   lucide shapes are scaled down so the solid triangle / bars keep that look. */
export function PlayIcon({ size = 22 }: { size?: number }) {
  return <Play size={Math.round(size * 0.68)} strokeWidth={2} fill="currentColor" aria-hidden />;
}

export function PauseIcon({ size = 22 }: { size?: number }) {
  return <Pause size={Math.round(size * 0.78)} strokeWidth={2} fill="currentColor" aria-hidden />;
}

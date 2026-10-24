/** Canvas sizes and fit scaling (letterboxing) of the deck player. */

import type { Deck } from "./types";
import type { CanvasSize } from "./types";

const SIZES: Record<string, CanvasSize> = {
  "16:9": { width: 1920, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

/** Canvas size of a deck, from its format (falls back to 16:9). */
export function canvasSize(deck: Pick<Deck, "format"> | null | undefined): CanvasSize {
  const format = deck?.format;
  if (format && format.width > 0 && format.height > 0) return { width: format.width, height: format.height };
  return SIZES[format?.ratio ?? "16:9"] ?? SIZES["16:9"];
}

export type Fit = {
  /** Uniform scale applied to the canvas. */
  scale: number;
  /** Scaled canvas size, in container pixels. */
  width: number;
  height: number;
  /** Offset of the scaled canvas inside the container (letterbox bands). */
  left: number;
  top: number;
};

/**
 * Largest uniform scale that fits the canvas in the container, centered. The
 * remaining space on one axis becomes the black bands of the player.
 */
export function fitCanvas(container: CanvasSize, canvas: CanvasSize): Fit {
  if (container.width <= 0 || container.height <= 0 || canvas.width <= 0 || canvas.height <= 0) {
    return { scale: 0, width: 0, height: 0, left: 0, top: 0 };
  }
  const scale = Math.min(container.width / canvas.width, container.height / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;
  return { scale, width, height, left: (container.width - width) / 2, top: (container.height - height) / 2 };
}

/**
 * Forge Design deck player. Shared by the deck editor, previews, the
 * published page and the exports; free of Next.js and builder imports so it
 * can be bundled alone (esbuild).
 */

export { SlideView, SlideCanvas, FittedSlide, type SlideViewProps } from "./SlideView";
export { DeckPlayer, BADGE_URL, type DeckPlayerProps } from "./DeckPlayer";
export { PresenterView, visibleSlides, type PresenterViewProps } from "./PresenterView";
export { themeTokensFromDesign, tokensFromDesignSystem, colorRef, fontRef, DEFAULT_TOKENS } from "./theme";
export { canvasSize, fitCanvas, type Fit } from "./geometry";
export { buildSchedule, stepCount, nextPosition, previousPosition, type Schedule, type Position } from "./steps";
export { mapKey, resolveKey, type PlayerAction } from "./keys";
export { matchMorph } from "./morph";
export { channelName } from "./presenter-channel";
export { DEFAULT_TRANSITION_MS } from "./animations";
export type { ThemeTokens, AssetUrl, PlayerMode, PlayerLocale, CanvasSize } from "./types";

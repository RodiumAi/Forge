/**
 * Forge Design codelab player. Shared by the codelab editor (live preview),
 * the published page and the PDF export; free of Next.js and builder imports
 * so it can be bundled alone (esbuild, see `standalone.tsx`).
 */

export { CodelabPlayer, stepTitle, BADGE_URL, type CodelabPlayerProps } from "./CodelabPlayer";
export { CodelabMarkdown, DownloadCards } from "./markdown/Markdown";
export { RenderEnvProvider, defaultEnv, downloadsOf, formatBytes, type DownloadInfo, type RenderEnv } from "./context";
export { parseBlocks, walkBlocks, firstHeading, calloutKind, type Block, type CalloutKind, type Tab } from "./markdown/blocks";
export { parseFenceInfo, parseLineRanges, languageLabel, tabLabel, type FenceInfo } from "./markdown/fence";
export { diffLines, diffCopyText, terminalLines, terminalCopyText, copyToClipboard } from "./markdown/copy";
export { tokenize, grammarFor } from "./markdown/highlight";
export { parseTree } from "./markdown/Tree";
export {
  viewFromHash,
  hashOfView,
  nextView,
  previousView,
  progressPercent,
  searchCodelab,
  stepText,
  END_HASH,
  type View,
} from "./navigation";
export { codelabTokens, schemeOf, luminance, type ColorScheme } from "./theme";
export { translator, resolveCodelabLocale, type CodelabLocale } from "./strings";
export { CODELAB_CSS } from "./styles";

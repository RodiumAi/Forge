/**
 * What the home knows about kinds: tile list, icons, tones, and the small
 * client heuristic that guesses a kind from the prompt when the "Blank" tile
 * is chosen. The server stays the authority (it refuses a disabled kind); the
 * guess only picks what to ask for.
 */

import {
  BookOpen,
  FilePlus2,
  Monitor,
  Palette,
  PanelsTopLeft,
  Presentation,
  Rocket,
  Smartphone,
  SquareStack,
  SwatchBook,
  type LucideIcon,
} from "lucide-react";

import type { CreateOptions, DeckRatio } from "@/lib/create-project";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ProjectKindId } from "@/lib/kinds";

export const KIND_ICONS: Record<ProjectKindId, LucideIcon> = {
  web: Monitor,
  mobile: Smartphone,
  slides: Presentation,
  codelab: BookOpen,
  design_system: Palette,
};

/** Tile and card label of each kind on the home. */
export const KIND_LABEL_KEYS: Record<ProjectKindId, MessageKey> = {
  web: "homeTileWeb",
  mobile: "homeTileMobile",
  slides: "homeTileSlides",
  codelab: "homeTileCodelab",
  design_system: "homeTileDesignSystem",
};

export type HomeTileId =
  | "blank"
  | "web"
  | "mobile"
  | "slides"
  | "codelab"
  | "design_system"
  | "pitch_deck"
  | "social_carousel"
  | "landing_page"
  | "onboarding"
  | "tutorial"
  | "palette";

export type HomeTile = {
  id: HomeTileId;
  /** `null` = Blank: the kind is guessed from the prompt. */
  kind: ProjectKindId | null;
  /** Deck canvas for slides shortcuts. */
  format?: DeckRatio;
  labelKey: MessageKey;
  hintKey?: MessageKey;
  icon: LucideIcon;
  /** A shortcut names a sub-type: it prefixes the prompt and seeds the gallery search. */
  shortcut: boolean;
  /** Search pre-filled in the template gallery when the tile is opened without text. */
  galleryQuery?: string;
};

export const HOME_TILES: readonly HomeTile[] = [
  { id: "blank", kind: null, labelKey: "homeTileBlank", hintKey: "homeTileBlankHint", icon: FilePlus2, shortcut: false },
  { id: "web", kind: "web", labelKey: "homeTileWeb", icon: Monitor, shortcut: false },
  { id: "mobile", kind: "mobile", labelKey: "homeTileMobile", icon: Smartphone, shortcut: false },
  { id: "slides", kind: "slides", labelKey: "homeTileSlides", icon: Presentation, shortcut: false },
  { id: "codelab", kind: "codelab", labelKey: "homeTileCodelab", icon: BookOpen, shortcut: false },
  { id: "design_system", kind: "design_system", labelKey: "homeTileDesignSystem", icon: Palette, shortcut: false },
  {
    id: "pitch_deck",
    kind: "slides",
    format: "16:9",
    labelKey: "homeTilePitchDeck",
    icon: Rocket,
    shortcut: true,
    galleryQuery: "pitch",
  },
  {
    id: "social_carousel",
    kind: "slides",
    format: "1:1",
    labelKey: "homeTileSocialCarousel",
    hintKey: "homeTileSocialCarouselHint",
    icon: SquareStack,
    shortcut: true,
  },
  {
    id: "landing_page",
    kind: "web",
    labelKey: "homeTileLandingPage",
    icon: PanelsTopLeft,
    shortcut: true,
    galleryQuery: "landing",
  },
  {
    id: "onboarding",
    kind: "mobile",
    labelKey: "homeTileOnboarding",
    icon: Smartphone,
    shortcut: true,
    galleryQuery: "onboarding",
  },
  { id: "tutorial", kind: "codelab", labelKey: "homeTileTutorial", icon: BookOpen, shortcut: true },
  { id: "palette", kind: "design_system", labelKey: "homeTilePalette", icon: SwatchBook, shortcut: true },
];

export function getTile(id: HomeTileId): HomeTile {
  return HOME_TILES.find((tile) => tile.id === id) ?? HOME_TILES[0];
}

/** Tiles this instance offers: Blank always, the others when their kind is on. */
export function visibleTiles(enabled: readonly ProjectKindId[]): HomeTile[] {
  return HOME_TILES.filter((tile) => tile.kind === null || enabled.includes(tile.kind));
}

// Ordered: the first family that matches wins. Plain substrings on a
// lowercased, accent-free copy of the prompt; good enough to pick a starting
// kind, and the AI still asks its clarifying questions afterwards.
const KIND_KEYWORDS: readonly [ProjectKindId, readonly string[]][] = [
  ["design_system", ["design system", "charte graphique", "palette", "typographie", "brand kit", "style guide", "identite visuelle", "design tokens"]],
  [
    "slides",
    [
      "presentation",
      "slides",
      "slide",
      "deck",
      "diapo",
      "diaporama",
      "pitch",
      "keynote",
      "powerpoint",
      "pptx",
      "carrousel",
      "carousel",
    ],
  ],
  ["codelab", ["codelab", "tutoriel", "tutorial", "tuto ", "pas a pas", "step by step", "step-by-step", "workshop", "atelier de code"]],
  [
    "mobile",
    [
      "appli mobile",
      "application mobile",
      "app mobile",
      "mobile app",
      "android",
      "iphone",
      "ios app",
      "app ios",
      "smartphone",
    ],
  ],
];

function fold(text: string): string {
  // NFD splits "é" into "e" + a combining accent (U+0300 to U+036F), dropped here.
  const bare = Array.from(text.toLowerCase().normalize("NFD"))
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
  return ` ${bare} `;
}

/** The kind a prompt most likely asks for, among the enabled ones (web otherwise). */
export function inferKind(text: string, enabled: readonly ProjectKindId[]): ProjectKindId {
  const folded = fold(text);
  for (const [kind, words] of KIND_KEYWORDS) {
    if (!enabled.includes(kind)) continue;
    if (words.some((word) => folded.includes(word))) return kind;
  }
  return "web";
}

/** A deck format named in the prompt (carousel means square), else none (16:9). */
export function inferFormat(text: string): DeckRatio | undefined {
  const folded = fold(text);
  if (/\b1[:x/]1\b/.test(folded) || /carrousel|carousel|instagram|linkedin|post carre|square/.test(folded)) {
    return "1:1";
  }
  if (/\b4[:/]3\b/.test(folded)) return "4:3";
  return undefined;
}

export type CreateRequest = {
  platform: ProjectKindId;
  /** The prompt as sent: shortcuts prefix their sub-type. */
  prompt: string;
  options: CreateOptions;
};

/**
 * What a create from the home sends: kind, format, design system and the
 * prompt. `shortcutLabel` is the translated tile label of a shortcut, and
 * `shortcutTemplate` the "{type}: {text}" pattern it is woven in with.
 */
export function buildCreateRequest(args: {
  tile: HomeTile;
  text: string;
  enabled: readonly ProjectKindId[];
  designSystemId?: string | null;
  shortcutLabel?: string;
  shortcutTemplate?: string;
}): CreateRequest {
  const { tile, enabled } = args;
  const text = args.text.trim();
  const platform = tile.kind && enabled.includes(tile.kind) ? tile.kind : inferKind(text, enabled);
  let format: DeckRatio | undefined;
  if (platform === "slides") {
    format = tile.kind === "slides" && tile.format ? tile.format : (inferFormat(text) ?? "16:9");
  }
  let prompt = text;
  if (tile.shortcut && text && args.shortcutLabel) {
    const template = args.shortcutTemplate || "{type}: {text}";
    prompt = template.replace("{type}", args.shortcutLabel).replace("{text}", text);
  }
  const options: CreateOptions = {};
  if (format) options.format = format;
  if (args.designSystemId) options.designSystemId = args.designSystemId;
  return { platform, prompt, options };
}

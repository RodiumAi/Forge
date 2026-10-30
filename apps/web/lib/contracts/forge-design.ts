/**
 * Zod mirror of `contracts/forge-design/*.schema.json` (version 1).
 *
 * The JSON Schemas at the repo root are the source of truth; the API mirrors
 * them in Pydantic (`apps/api/app/contracts/forge_design.py`). Keep every enum,
 * bound and pattern identical: `forge-design.test.ts` replays the shared
 * fixtures through Ajv and these schemas and compares enums and patterns, the
 * API suite does the same on its side. The schemas also enforce what JSON
 * Schema cannot express (unique ids, group depth).
 */

import { z } from "zod";

export const PATTERNS = {
  ID: "^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$",
  COLOR: "^(--[A-Za-z0-9-]{1,48}|#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8}))$",
  ASSET: "^(?!.*\\.\\.)(?!/)[A-Za-z0-9_./-]+$",
  HTTPS: "^https://",
  LAYOUT: "^[a-z0-9][a-z0-9-]{0,47}$",
  STEP_FILE: "^steps/[0-9]{2,3}-[a-z0-9]+(-[a-z0-9]+)*\\.md$",
  DOWNLOAD_PATH: "^files/(?!.*\\.\\.)[A-Za-z0-9_./-]+$",
  ICON: "^[a-z0-9]+(-[a-z0-9]+)*$",
  LANGUAGE: "^[a-z0-9+#-]{1,32}$",
  HIGHLIGHT: "^[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*$",
  FONT_FAMILY: "^[A-Za-z0-9][A-Za-z0-9 .\\-]{0,79}$",
} as const;

/** Deepest allowed nesting of `group` elements in a slide. */
export const MAX_GROUP_DEPTH = 4;
/** Deepest allowed nesting of token groups in a design system. */
export const MAX_TOKEN_DEPTH = 8;

export const DECK_RATIOS = ["16:9", "4:3", "1:1"] as const;
export const FORMAT_SIZES: Record<(typeof DECK_RATIOS)[number], { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "4:3": { width: 1440, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};
export const TRANSITION_TYPES = [
  "none",
  "fade",
  "push",
  "slide",
  "wipe",
  "zoom-in",
  "zoom-out",
  "dissolve",
  "curtain",
  "cube",
  "morph",
] as const;
export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export const EASINGS = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"] as const;
export const ANIMATION_TYPES = [
  "appear",
  "rise",
  "drop",
  "slide",
  "pop",
  "zoom",
  "typewriter",
  "mask-reveal",
  "bounce",
  "pulse",
] as const;
export const ANIMATION_TRIGGERS = ["on-enter", "on-click", "after-previous"] as const;
export const ELEMENT_TYPES = ["text", "image", "shape", "icon", "table", "chart", "video", "code", "group"] as const;
export const TEXT_ROLES = ["title", "subtitle", "heading", "body", "caption", "quote", "label"] as const;
export const FONT_ROLES = ["display", "body", "mono"] as const;
export const TEXT_ALIGNS = ["left", "center", "right", "justify"] as const;
export const VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export const CREDIT_SOURCES = ["pixabay", "openverse", "upload", "generated", "other"] as const;
export const SHAPE_KINDS = ["rect", "ellipse", "line", "arrow"] as const;
export const CHART_KINDS = ["bar", "line", "pie"] as const;
export const CODELAB_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const TOKEN_TYPES = [
  "color",
  "dimension",
  "fontFamily",
  "fontWeight",
  "duration",
  "cubicBezier",
  "number",
  "shadow",
  "border",
  "gradient",
  "typography",
  "transition",
  "strokeStyle",
] as const;
export const SHOWCASE_COMPONENTS = ["button", "input", "card", "badge", "alert", "table"] as const;

const re = (pattern: string) => new RegExp(pattern);

const id = z.string().regex(re(PATTERNS.ID));
const colorRef = z.string().regex(re(PATTERNS.COLOR));
const assetPath = z.string().min(1).max(400).regex(re(PATTERNS.ASSET));
const httpsUrl = z.string().max(2000).regex(re(PATTERNS.HTTPS));
const coord = z.number().min(-10000).max(10000);
const size = z.number().gt(0).max(10000);
const unit = z.number().min(0).max(1);
const int = (min: number, max: number) => z.number().int().min(min).max(max);

function uniqueIds(ctx: z.RefinementCtx, values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", message: `duplicate ${label} ${value}` });
      return;
    }
    seen.add(value);
  }
}

// ── deck.json ───────────────────────────────────────────────────────────────

export const formatSchema = z.discriminatedUnion("ratio", [
  z.strictObject({ ratio: z.literal("16:9"), width: z.literal(1920), height: z.literal(1080) }),
  z.strictObject({ ratio: z.literal("4:3"), width: z.literal(1440), height: z.literal(1080) }),
  z.strictObject({ ratio: z.literal("1:1"), width: z.literal(1080), height: z.literal(1080) }),
]);

export const themeSchema = z.strictObject({
  designSystem: z.string().min(1).max(64),
  tokens: z.string().min(1).max(200),
});

export const transitionSchema = z.strictObject({
  type: z.enum(TRANSITION_TYPES),
  durationMs: int(0, 5000).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  easing: z.enum(EASINGS).optional(),
});

export const slideRefSchema = z.strictObject({
  id,
  layout: z.string().regex(re(PATTERNS.LAYOUT)),
  transition: transitionSchema.optional(),
  hidden: z.boolean().optional(),
});

export const deckSchema = z
  .strictObject({
    version: z.literal(1),
    title: z.string().max(200).optional(),
    format: formatSchema,
    theme: themeSchema,
    slides: z.array(slideRefSchema).max(500),
  })
  .superRefine((deck, ctx) => uniqueIds(ctx, deck.slides.map((ref) => ref.id), "slide id"));

// ── slides/<id>.json ────────────────────────────────────────────────────────

export const creditSchema = z.strictObject({
  source: z.enum(CREDIT_SOURCES),
  author: z.string().max(200).optional(),
  url: httpsUrl.optional(),
});

export const backgroundSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("color"), token: colorRef }),
  z.strictObject({
    type: z.literal("image"),
    src: assetPath,
    fit: z.enum(IMAGE_FITS).optional(),
    overlay: colorRef.optional(),
    overlayOpacity: unit.optional(),
    credit: creditSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("gradient"),
    angle: z.number().min(0).max(360).optional(),
    stops: z.array(z.strictObject({ color: colorRef, at: unit })).min(2).max(8),
  }),
]);

export const animationSchema = z.strictObject({
  type: z.enum(ANIMATION_TYPES),
  trigger: z.enum(ANIMATION_TRIGGERS),
  delayMs: int(0, 10000).optional(),
  durationMs: int(0, 10000).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  order: int(0, 999).optional(),
});

export const runSchema = z.strictObject({
  text: z.string().max(5000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  link: httpsUrl.optional(),
  color: colorRef.optional(),
});

const inlineShape = {
  text: z.string().max(5000).optional(),
  runs: z.array(runSchema).max(100).optional(),
};
export const inlineSchema = z.strictObject(inlineShape);

export const textBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), ...inlineShape }),
  z.strictObject({
    type: z.enum(["bullet-list", "ordered-list"]),
    items: z.array(z.strictObject({ ...inlineShape, level: int(0, 4).optional() })).max(50),
  }),
]);

export const textStyleSchema = z.strictObject({
  font: z.enum(FONT_ROLES).optional(),
  /** Explicit typeface of this text, over the theme font of its role. */
  family: z.string().regex(re(PATTERNS.FONT_FAMILY)).optional(),
  size: z.number().min(6).max(400).optional(),
  weight: int(100, 900).optional(),
  color: colorRef.optional(),
  align: z.enum(TEXT_ALIGNS).optional(),
  valign: z.enum(VERTICAL_ALIGNS).optional(),
  lineHeight: z.number().min(0.5).max(4).optional(),
  letterSpacing: z.number().min(-20).max(100).optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  uppercase: z.boolean().optional(),
});

const elementBase = {
  id,
  name: z.string().max(120).optional(),
  x: coord,
  y: coord,
  w: size,
  h: size,
  rotation: z.number().min(-360).max(360).optional(),
  z: int(0, 10000).optional(),
  opacity: unit.optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  matchKey: z.string().regex(re(PATTERNS.ID)).optional(),
  link: httpsUrl.optional(),
  animation: animationSchema.optional(),
};

export const textElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("text"),
  role: z.enum(TEXT_ROLES).optional(),
  content: z.array(textBlockSchema).max(50),
  style: textStyleSchema.optional(),
});

export const imageElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("image"),
  src: assetPath,
  alt: z.string().max(300).optional(),
  fit: z.enum(IMAGE_FITS).optional(),
  radius: z.number().min(0).max(2000).optional(),
  crop: z
    .strictObject({ x: unit, y: unit, w: z.number().gt(0).max(1), h: z.number().gt(0).max(1) })
    .optional(),
  credit: creditSchema.optional(),
});

export const shapeElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("shape"),
  shape: z.enum(SHAPE_KINDS),
  fill: colorRef.optional(),
  stroke: colorRef.optional(),
  strokeWidth: z.number().min(0).max(200).optional(),
  radius: z.number().min(0).max(2000).optional(),
});

export const iconElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("icon"),
  icon: z.string().max(64).regex(re(PATTERNS.ICON)),
  color: colorRef.optional(),
  strokeWidth: z.number().min(0.5).max(4).optional(),
});

export const tableElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("table"),
  rows: z.array(z.array(inlineSchema).min(1).max(20)).min(1).max(50),
  headerRow: z.boolean().optional(),
  columnWidths: z.array(z.number().gt(0)).max(20).optional(),
  style: z
    .strictObject({
      size: z.number().min(6).max(200).optional(),
      family: z.string().regex(re(PATTERNS.FONT_FAMILY)).optional(),
      color: colorRef.optional(),
      headerFill: colorRef.optional(),
      border: colorRef.optional(),
    })
    .optional(),
});

export const chartElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("chart"),
  chart: z.enum(CHART_KINDS),
  data: z.strictObject({
    labels: z.array(z.string().max(120)).max(100),
    series: z
      .array(
        z.strictObject({
          name: z.string().max(120),
          values: z.array(z.number()).max(100),
          color: colorRef.optional(),
        }),
      )
      .min(1)
      .max(12),
  }),
  options: z
    .strictObject({
      stacked: z.boolean().optional(),
      legend: z.boolean().optional(),
      values: z.boolean().optional(),
    })
    .optional(),
});

export const videoElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("video"),
  url: httpsUrl,
  poster: assetPath.optional(),
  autoplay: z.boolean().optional(),
  muted: z.boolean().optional(),
});

export const codeElementSchema = z.strictObject({
  ...elementBase,
  type: z.literal("code"),
  language: z.string().regex(re(PATTERNS.LANGUAGE)).optional(),
  code: z.string().max(20000),
  lineNumbers: z.boolean().optional(),
  highlight: z.string().regex(re(PATTERNS.HIGHLIGHT)).optional(),
  size: z.number().min(6).max(200).optional(),
});

type GroupShape = z.infer<z.ZodObject<typeof elementBase>> & {
  type: "group";
  children: SlideElement[];
};

export type SlideElement =
  | z.infer<typeof textElementSchema>
  | z.infer<typeof imageElementSchema>
  | z.infer<typeof shapeElementSchema>
  | z.infer<typeof iconElementSchema>
  | z.infer<typeof tableElementSchema>
  | z.infer<typeof chartElementSchema>
  | z.infer<typeof videoElementSchema>
  | z.infer<typeof codeElementSchema>
  | GroupShape;

export const groupElementSchema: z.ZodType<GroupShape> = z.strictObject({
  ...elementBase,
  type: z.literal("group"),
  children: z.lazy(() => z.array(elementSchema).min(1).max(100)),
});

export const elementSchema: z.ZodType<SlideElement> = z.lazy(() =>
  z.union([
    textElementSchema,
    imageElementSchema,
    shapeElementSchema,
    iconElementSchema,
    tableElementSchema,
    chartElementSchema,
    videoElementSchema,
    codeElementSchema,
    groupElementSchema,
  ]),
);

export const slideSchema = z
  .strictObject({
    id,
    background: backgroundSchema.optional(),
    elements: z.array(elementSchema).max(200),
  })
  .superRefine((slide, ctx) => {
    const ids: string[] = [];
    const walk = (elements: SlideElement[], depth: number) => {
      for (const element of elements) {
        ids.push(element.id);
        if (element.type === "group") {
          if (depth + 1 > MAX_GROUP_DEPTH) {
            ctx.addIssue({ code: "custom", message: `groups nest at most ${MAX_GROUP_DEPTH} levels deep` });
            return;
          }
          walk(element.children, depth + 1);
        }
      }
    };
    walk(slide.elements, 0);
    uniqueIds(ctx, ids, "element id");
  });

// ── codelab.json ────────────────────────────────────────────────────────────

const line300 = z.string().min(1).max(300);

export const codelabStepSchema = z.strictObject({
  id,
  title: z.string().max(200).optional(),
  file: z.string().regex(re(PATTERNS.STEP_FILE)),
  minutes: int(0, 600),
});

export const codelabDownloadSchema = z.strictObject({
  id,
  label: z.string().min(1).max(120),
  path: z.string().max(300).regex(re(PATTERNS.DOWNLOAD_PATH)),
  zip: z.boolean().optional(),
});

export const codelabLinkSchema = z.strictObject({
  label: z.string().min(1).max(60),
  url: httpsUrl,
});

export const codelabCoverSchema = z.strictObject({
  eyebrow: z.string().max(160).optional(),
  highlights: z.array(z.string().min(1).max(200)).max(8).optional(),
  showQr: z.boolean().optional(),
});

export const codelabPresenterSchema = z.strictObject({
  name: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  photo: assetPath.optional(),
  bio: z.string().max(1500).optional(),
  links: z.array(codelabLinkSchema).max(6).optional(),
});

export const codelabSetupSchema = z.strictObject({
  intro: z.string().max(1000).optional(),
  tools: z
    .array(z.strictObject({ name: z.string().min(1).max(80), version: z.string().max(40).optional(), url: httpsUrl.optional() }))
    .max(20)
    .optional(),
  groups: z
    .array(
      z.strictObject({
        title: z.string().min(1).max(120),
        items: z
          .array(z.strictObject({ text: line300, url: httpsUrl.optional(), code: z.string().max(200).optional() }))
          .max(12),
      }),
    )
    .max(6)
    .optional(),
  promo: z
    .strictObject({ code: z.string().min(1).max(64), label: z.string().max(200).optional(), url: httpsUrl.optional() })
    .optional(),
  commands: z
    .array(
      z.strictObject({
        label: z.string().max(120).optional(),
        language: z.string().regex(re(PATTERNS.LANGUAGE)).optional(),
        code: z.string().min(1).max(4000),
      }),
    )
    .max(12)
    .optional(),
});

export const codelabSchema = z
  .strictObject({
    version: z.literal(1),
    title: z.string().min(1).max(200),
    summary: z.string().max(2000).optional(),
    level: z.enum(CODELAB_LEVELS),
    durationMinutes: int(0, 6000),
    prerequisites: z.array(line300).max(30).optional(),
    learn: z.array(line300).max(30).optional(),
    author: z.strictObject({ name: z.string().min(1).max(120), url: httpsUrl.optional() }).optional(),
    repoUrl: httpsUrl.optional(),
    theme: themeSchema.optional(),
    steps: z.array(codelabStepSchema).max(200),
    downloads: z.array(codelabDownloadSchema).max(50).optional(),
    cover: codelabCoverSchema.optional(),
    presenter: codelabPresenterSchema.optional(),
    setup: codelabSetupSchema.optional(),
    pages: z.strictObject({ presenter: z.boolean().optional(), setup: z.boolean().optional() }).optional(),
  })
  .superRefine((codelab, ctx) => {
    uniqueIds(ctx, codelab.steps.map((step) => step.id), "step id");
    uniqueIds(ctx, codelab.steps.map((step) => step.file), "step file");
    uniqueIds(ctx, (codelab.downloads ?? []).map((item) => item.id), "download id");
  });

// ── design-system.json ──────────────────────────────────────────────────────

const NAME_RE = re(PATTERNS.ID);
const TOKEN_KEYS = new Set(["$value", "$type", "$description", "$extensions"]);
const TOKEN_TYPE_SET = new Set<string>(TOKEN_TYPES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** W3C token tree check; returns the first problem or null. */
export function tokenTreeProblem(group: unknown, path = "", depth = 0): string | null {
  if (!isPlainObject(group)) return `${path}: a token group must be an object`;
  if ("$value" in group) return `${path}: a group cannot carry $value`;
  if (depth > MAX_TOKEN_DEPTH) return `${path}: token groups nest at most ${MAX_TOKEN_DEPTH} levels deep`;
  const meta = metaProblem(group, path);
  if (meta) return meta;
  for (const [key, child] of Object.entries(group)) {
    if (key === "$type" || key === "$description") continue;
    if (!NAME_RE.test(key)) return `${path}: invalid token name ${key}`;
    const childPath = path ? `${path}.${key}` : key;
    const problem =
      isPlainObject(child) && "$value" in child ? tokenProblem(child, childPath) : tokenTreeProblem(child, childPath, depth + 1);
    if (problem) return problem;
  }
  return null;
}

function metaProblem(node: Record<string, unknown>, path: string): string | null {
  if ("$type" in node && !TOKEN_TYPE_SET.has(String(node.$type))) return `${path}: unknown $type`;
  if ("$description" in node) {
    const desc = node.$description;
    if (typeof desc !== "string" || desc.length > 500) return `${path}: $description must be a short string`;
  }
  return null;
}

function tokenProblem(token: Record<string, unknown>, path: string): string | null {
  for (const key of Object.keys(token)) {
    if (!TOKEN_KEYS.has(key)) return `${path}: unknown token key ${key}`;
  }
  const value = token.$value;
  const ok = typeof value === "string" || typeof value === "number" || Array.isArray(value) || isPlainObject(value);
  if (!ok) return `${path}: $value must be a string, number, array or object`;
  if ("$extensions" in token && !isPlainObject(token.$extensions)) return `${path}: $extensions must be an object`;
  return metaProblem(token, path);
}

const line400 = z.string().min(1).max(400);
const lines = z.array(line400).max(40);

export const guidanceSchema = z.strictObject({
  summary: z.string().max(2000).optional(),
  do: lines.optional(),
  dont: lines.optional(),
});

export const designSystemSchema = z
  .strictObject({
    version: z.literal(1),
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    tokens: z.record(z.string(), z.unknown()),
    brand: z
      .strictObject({
        tagline: z.string().max(160).optional(),
        website: z.string().max(300).regex(re(PATTERNS.HTTPS)).optional(),
        audience: z.string().max(300).optional(),
      })
      .optional(),
    logo: z
      .strictObject({
        src: assetPath,
        darkSrc: assetPath.optional(),
        /** Square mark without the name: app icon and favicon. */
        iconSrc: assetPath.optional(),
        minSizePx: int(8, 2000).optional(),
        clearSpace: z.string().max(200).optional(),
        usage: lines.optional(),
      })
      .optional(),
    voice: guidanceSchema.optional(),
    imagery: guidanceSchema.optional(),
    guidelines: guidanceSchema.optional(),
    components: z.array(z.enum(SHOWCASE_COMPONENTS)).max(20).optional(),
  })
  .superRefine((ds, ctx) => {
    const problem = tokenTreeProblem(ds.tokens);
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["tokens"] });
    for (const required of ["color", "font"]) {
      if (!(required in ds.tokens)) ctx.addIssue({ code: "custom", message: `tokens.${required} is required` });
    }
  });

export type Deck = z.infer<typeof deckSchema>;
export type DeckFormat = z.infer<typeof formatSchema>;
export type Transition = z.infer<typeof transitionSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type Codelab = z.infer<typeof codelabSchema>;
export type DesignSystem = z.infer<typeof designSystemSchema>;

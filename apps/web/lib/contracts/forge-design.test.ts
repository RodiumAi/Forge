import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  ANIMATION_TRIGGERS,
  ANIMATION_TYPES,
  CHART_KINDS,
  CODELAB_LEVELS,
  CREDIT_SOURCES,
  DECK_RATIOS,
  DIRECTIONS,
  EASINGS,
  ELEMENT_TYPES,
  FONT_ROLES,
  FORMAT_SIZES,
  IMAGE_FITS,
  PATTERNS,
  SHAPE_KINDS,
  SHOWCASE_COMPONENTS,
  TEXT_ALIGNS,
  TEXT_ROLES,
  TOKEN_TYPES,
  TRANSITION_TYPES,
  VERTICAL_ALIGNS,
  codelabSchema,
  deckSchema,
  designSystemSchema,
  slideSchema,
} from "./forge-design";

// The schemas and fixtures shared with the API suite (apps/api/tests/test_contracts_forge_design.py).
// Vitest runs from apps/web.
const ROOT = join(process.cwd(), "..", "..", "contracts", "forge-design");

const SCHEMA_FILES = {
  deck: "deck.schema.json",
  slide: "slide.schema.json",
  codelab: "codelab.schema.json",
  "design-system": "design-system.schema.json",
} as const;
type Kind = keyof typeof SCHEMA_FILES;

const ZOD: Record<Kind, ZodType> = {
  deck: deckSchema,
  slide: slideSchema,
  codelab: codelabSchema,
  "design-system": designSystemSchema,
};

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf-8"));
const schema = (kind: Kind) => readJson(join(ROOT, SCHEMA_FILES[kind]));

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = Object.fromEntries(
  (Object.keys(SCHEMA_FILES) as Kind[]).map((kind) => [kind, ajv.compile(schema(kind))]),
) as Record<Kind, ReturnType<typeof ajv.compile>>;

function fixtures(group: string): [string, Kind, unknown][] {
  const dir = join(ROOT, "fixtures", group);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => [name, name.split(".")[0] as Kind, readJson(join(dir, name))]);
}

describe("Forge Design contracts", () => {
  it("covers every document kind", () => {
    expect(new Set(fixtures("valid").map(([, kind]) => kind))).toEqual(new Set(Object.keys(SCHEMA_FILES)));
  });

  it.each(fixtures("valid"))("%s passes the JSON Schema and Zod", (_name, kind, doc) => {
    expect(validators[kind](doc), JSON.stringify(validators[kind].errors)).toBe(true);
    const parsed = ZOD[kind].safeParse(doc);
    expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
  });

  it.each(fixtures("invalid"))("%s fails the JSON Schema and Zod", (_name, kind, doc) => {
    expect(validators[kind](doc)).toBe(false);
    expect(ZOD[kind].safeParse(doc).success).toBe(false);
  });

  it.each(fixtures("invalid-semantic"))("%s fails Zod only", (_name, kind, doc) => {
    // Unique ids and depth are beyond JSON Schema: Zod has to catch them.
    expect(validators[kind](doc)).toBe(true);
    expect(ZOD[kind].safeParse(doc).success).toBe(false);
  });

  const pick = (kind: Kind, pointer: string): unknown =>
    pointer.split("/").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], schema(kind));

  it.each([
    ["deck", "$defs/transition/properties/type/enum", TRANSITION_TYPES],
    ["deck", "$defs/transition/properties/direction/enum", DIRECTIONS],
    ["deck", "$defs/transition/properties/easing/enum", EASINGS],
    ["slide", "$defs/animation/properties/type/enum", ANIMATION_TYPES],
    ["slide", "$defs/animation/properties/trigger/enum", ANIMATION_TRIGGERS],
    ["slide", "$defs/credit/properties/source/enum", CREDIT_SOURCES],
    ["slide", "$defs/textStyle/properties/font/enum", FONT_ROLES],
    ["slide", "$defs/textStyle/properties/align/enum", TEXT_ALIGNS],
    ["slide", "$defs/textStyle/properties/valign/enum", VERTICAL_ALIGNS],
    ["slide", "$defs/textElement/properties/role/enum", TEXT_ROLES],
    ["slide", "$defs/imageElement/properties/fit/enum", IMAGE_FITS],
    ["slide", "$defs/shapeElement/properties/shape/enum", SHAPE_KINDS],
    ["slide", "$defs/chartElement/properties/chart/enum", CHART_KINDS],
    ["codelab", "properties/level/enum", CODELAB_LEVELS],
    ["design-system", "$defs/tokenType/enum", TOKEN_TYPES],
    ["design-system", "properties/components/items/enum", SHOWCASE_COMPONENTS],
  ] as [Kind, string, readonly string[]][])("%s %s matches", (kind, pointer, values) => {
    expect(pick(kind, pointer)).toEqual([...values]);
  });

  it("element types and formats match", () => {
    const slide = schema("slide");
    const consts = (slide.$defs.element.oneOf as { $ref: string }[]).map(
      (ref) => slide.$defs[ref.$ref.split("/").pop() as string].properties.type.const,
    );
    expect(consts).toEqual([...ELEMENT_TYPES]);
    const sizes = Object.fromEntries(
      (schema("deck").$defs.format.oneOf as { properties: Record<string, { const: unknown }> }[]).map((v) => [
        v.properties.ratio.const,
        { width: v.properties.width.const, height: v.properties.height.const },
      ]),
    );
    expect(sizes).toEqual(FORMAT_SIZES);
    expect(Object.keys(sizes)).toEqual([...DECK_RATIOS]);
  });

  it("mirrors every schema pattern", () => {
    const found = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        for (const [key, value] of Object.entries(node)) {
          if (key === "pattern" && typeof value === "string") found.add(value);
          else if (key === "patternProperties") {
            Object.keys(value as object).forEach((p) => found.add(p));
            walk(Object.values(value as object));
          } else walk(value);
        }
      }
    };
    (Object.keys(SCHEMA_FILES) as Kind[]).forEach((kind) => walk(schema(kind)));
    const mirrored = new Set<string>(Object.values(PATTERNS));
    expect([...found].filter((p) => !mirrored.has(p))).toEqual([]);
  });
});

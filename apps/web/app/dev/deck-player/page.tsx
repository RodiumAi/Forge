import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { DeckPlayerDemo, type DemoFixtures } from "./DeckPlayerDemo";

/**
 * Development only: the deck player on the shared contract fixtures
 * (contracts/forge-design/fixtures/valid). The files are read at request time
 * so the production build never reaches outside apps/web.
 */
export const dynamic = "force-dynamic";

function readFixture(name: string): unknown {
  const file = path.join(process.cwd(), "..", "..", "contracts", "forge-design", "fixtures", "valid", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

export default function DeckPlayerDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  let fixtures: DemoFixtures;
  try {
    fixtures = {
      deckFull: readFixture("deck.full.json"),
      deckMinimal: readFixture("deck.minimal.json"),
      deckSquare: readFixture("deck.square-empty.json"),
      designSystem: readFixture("design-system.default.json"),
      slides: {
        full: readFixture("slide.full.json"),
        minimal: readFixture("slide.minimal.json"),
        imageBackground: readFixture("slide.image-background.json"),
        groupDepth: readFixture("slide.group-depth-4.json"),
      },
    };
  } catch (error) {
    return <pre style={{ padding: 24 }}>Fixtures not found: {String(error)}</pre>;
  }
  return <DeckPlayerDemo fixtures={fixtures} />;
}

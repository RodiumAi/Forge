import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { DeckEditorDemo } from "./DeckEditorDemo";

/**
 * Development only: the deck editor on an in-memory document (no API, no
 * login), with a fake AI that answers with `deck.*` events. The theme comes
 * from the shared contract fixtures, read at request time.
 */
export const dynamic = "force-dynamic";

export default function DeckEditorDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  let designSystem = "";
  try {
    designSystem = readFileSync(path.join(process.cwd(), "..", "..", "contracts", "forge-design", "fixtures", "valid", "design-system.default.json"), "utf8");
  } catch {
    designSystem = "";
  }
  return <DeckEditorDemo designSystem={designSystem} />;
}

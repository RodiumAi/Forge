import { describe, expect, it } from "vitest";
import {
  formatIntegrationsMarker,
  integrationsMissingSnippet,
  parseIntegrationsMarker,
  stripIntegrationsMarker,
} from "./integrations-marker";

const maps = { id: "google-maps", name: "Google Maps Embed", embedHosts: ["google.com"] };
const tally = { id: "tally", name: "Tally", embedHosts: ["tally.so"] };
const brevo = { id: "brevo", name: "Brevo", embedHosts: [] };

describe("integrations marker", () => {
  it("round-trips ids and names", () => {
    const marker = formatIntegrationsMarker([maps, tally], "Intégrations");
    expect(marker).toBe("[Intégrations: Google Maps Embed (google-maps), Tally (tally)]");
    expect(parseIntegrationsMarker(`${marker}\n\nAjoute la carte`)).toEqual([
      { id: "google-maps", name: "Google Maps Embed" },
      { id: "tally", name: "Tally" },
    ]);
    expect(stripIntegrationsMarker(`${marker}\n\nAjoute la carte`)).toBe("Ajoute la carte");
    expect(formatIntegrationsMarker([], "Integrations")).toBe("");
  });

  it("flags an integration whose snippet was not pasted", () => {
    const iframe = '<iframe src="https://www.google.com/maps/embed?pb=!1m18" width="600"></iframe>';
    expect(integrationsMissingSnippet(`Ajoute la carte ${iframe}`, [maps])).toEqual([]);
    expect(integrationsMissingSnippet("Ajoute la carte en bas", [maps])).toEqual([maps]);
    expect(integrationsMissingSnippet(iframe, [maps, tally])).toEqual([tally]);
    // A look-alike domain does not count.
    expect(integrationsMissingSnippet("https://notgoogle.com/x", [maps])).toEqual([maps]);
  });

  it("falls back to any embed when the domains are unknown", () => {
    expect(integrationsMissingSnippet("ajoute la newsletter", [brevo])).toEqual([brevo]);
    expect(integrationsMissingSnippet('<script src="https://x.sibforms.com/a.js"></script>', [brevo])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import {
  formatElementSelectionMarker,
  parseElementSelectionMarker,
  parseUserMessageContent,
  selectionChipLabel,
} from "./prompt-attachments";

describe("element selection markers", () => {
  it("round-trips format → parse", () => {
    const marker = formatElementSelectionMarker(
      {
        tag: "div",
        selector: "body > main > .phone",
        text: 'Hello "world"',
      },
      "Sélection",
    );
    const parsed = parseElementSelectionMarker(marker);
    expect(parsed).toEqual({
      tag: "div",
      selector: "body > main > .phone",
      text: "Hello 'world'",
    });
  });

  it("exposes selection separately from display text", () => {
    const raw = [
      '[Selection: nav | selector:header > nav | text:"PromptVault"]',
      "",
      "make this sticky",
    ].join("\n");
    const parsed = parseUserMessageContent(raw);
    expect(parsed.text).toBe("make this sticky");
    expect(parsed.selection?.tag).toBe("nav");
    expect(parsed.selection?.selector).toBe("header > nav");
    expect(selectionChipLabel(parsed.selection!)).toBe('nav · “PromptVault”');
  });
});

import { describe, expect, it } from "vitest";
import { splitMessageSegments } from "./message-segments";

const prose = (raw: string) =>
  splitMessageSegments(raw)
    .filter((s) => s.kind === "text")
    .map((s) => (s.kind === "text" ? s.content : ""))
    .join("\n");

describe("forge-edit blocks", () => {
  it("keeps SEARCH/REPLACE edits out of the prose", () => {
    const raw = `I added the contact page.
<forge-edit path="src/App.tsx">
<<<<<<< SEARCH
import Home from "./pages/Home";
=======
import Home from "./pages/Home";
import ContactPage from "./pages/Contact";
>>>>>>> REPLACE
</forge-edit>
<forge-edit path="src/App.tsx">
<<<<<<< SEARCH
<Route path="*" element={<NotFound />} />
=======
<Route path="/contact" element={<ContactPage />} />
<Route path="*" element={<NotFound />} />
>>>>>>> REPLACE
</forge-edit>
Done.`;
    expect(prose(raw)).toBe("I added the contact page.\nDone.");
    expect(splitMessageSegments(raw).filter((s) => s.kind === "write")).toHaveLength(2);
  });

  it("hides an edit that is still streaming, and its half-written tag", () => {
    expect(prose('Sure.\n<forge-edit path="src/App.tsx">\n<<<<<<< SEARCH\nimport')).toBe("Sure.");
    expect(prose("Sure.\n<forge-ed")).toBe("Sure.");
    expect(prose('Sure.\n<forge-edit path="src/App.tsx">x</forge-edit>\nNext.\n</forge')).toBe("Sure.\nNext.");
  });
});

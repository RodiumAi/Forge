import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Slide, SlideElement } from "@/lib/contracts/forge-design";
import { Autosaver, type SaveConflict, type SaveStatus } from "./autosave";
import { MemoryDocServer } from "./memory-transport";
import { updateElement, type Doc } from "./model";

const el = (id: string, x: number): SlideElement => ({ id, type: "shape", shape: "rect", x, y: 0, w: 10, h: 10 });

function setup() {
  let doc: Doc = {
    deck: {
      version: 1,
      format: { ratio: "16:9", width: 1920, height: 1080 },
      theme: { designSystem: "local", tokens: "DESIGN.md" },
      slides: [
        { id: "s1", layout: "title" },
        { id: "s2", layout: "text" },
      ],
    },
    slides: { s1: { id: "s1", elements: [el("a", 0), el("b", 0)] }, s2: { id: "s2", elements: [el("c", 0)] } },
  };
  let notes: Record<string, string> = { s1: "" };
  const server = new MemoryDocServer(doc.deck, doc.slides, {});
  const statuses: SaveStatus[] = [];
  const conflicts: SaveConflict[] = [];
  const saver = new Autosaver(
    server.transport(),
    {
      getDoc: () => doc,
      getNotes: () => notes,
      applyDeck: (deck) => {
        doc = { ...doc, deck };
      },
      applySlide: (id, slide) => {
        doc = { ...doc, slides: { ...doc.slides, [id]: slide } };
      },
      applyNotes: (id, md) => {
        notes = { ...notes, [id]: md };
      },
      onStatus: (s) => statuses.push(s),
      onConflict: (c) => conflicts.push(c),
    },
    500,
  );
  saver.reset(doc, { deck: server.etagOf("deck"), "slide:s1": server.etagOf("slide:s1"), "slide:s2": server.etagOf("slide:s2") });
  return {
    server,
    saver,
    statuses,
    conflicts,
    get doc() {
      return doc;
    },
    edit(id: string, elId: string, x: number) {
      doc = { ...doc, slides: { ...doc.slides, [id]: { ...doc.slides[id], elements: updateElement(doc.slides[id].elements, elId, (e) => ({ ...e, x })) } } };
      saver.changed();
    },
    setDoc(next: Doc) {
      doc = next;
      saver.changed();
    },
    setNotes(id: string, md: string) {
      notes = { ...notes, [id]: md };
      saver.changed();
    },
  };
}

const xIn = (slide: Slide | undefined, id: string) => slide?.elements.find((e) => e.id === id)?.x;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("autosave", () => {
  it("debounces and writes only the changed slide", async () => {
    const t = setup();
    t.edit("s1", "a", 10);
    await vi.advanceTimersByTimeAsync(300);
    t.edit("s1", "a", 20);
    await vi.advanceTimersByTimeAsync(300);
    expect(t.server.writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(t.server.writes).toEqual(["slide:s1"]);
    expect(xIn(t.server.slides.get("s1")?.value, "a")).toBe(20);
    expect(t.statuses.at(-1)).toBe("saved");
  });

  it("sends the current version so a second write is accepted", async () => {
    const t = setup();
    t.edit("s1", "a", 10);
    await vi.advanceTimersByTimeAsync(600);
    t.edit("s1", "a", 30);
    await vi.advanceTimersByTimeAsync(600);
    expect(t.server.writes).toEqual(["slide:s1", "slide:s1"]);
    expect(t.conflicts).toHaveLength(0);
  });

  it("merges a 409 when the other side changed another element", async () => {
    const t = setup();
    // Someone else moves b; we move a.
    const theirs = { ...t.server.slides.get("s1")!.value };
    theirs.elements = updateElement(theirs.elements, "b", (e) => ({ ...e, x: 99 }));
    t.server.externalSlide(theirs);
    t.edit("s1", "a", 10);
    await vi.advanceTimersByTimeAsync(600);
    const stored = t.server.slides.get("s1")!.value;
    expect(xIn(stored, "a")).toBe(10);
    expect(xIn(stored, "b")).toBe(99);
    // The local copy picked up their change too.
    expect(xIn(t.doc.slides.s1, "b")).toBe(99);
    expect(t.conflicts).toHaveLength(0);
  });

  it("asks when both sides changed the same element, then keeps the chosen side", async () => {
    const t = setup();
    const theirs = { ...t.server.slides.get("s1")!.value };
    theirs.elements = updateElement(theirs.elements, "a", (e) => ({ ...e, x: 77 }));
    t.server.externalSlide(theirs);
    t.edit("s1", "a", 10);
    await vi.advanceTimersByTimeAsync(600);
    expect(t.conflicts).toHaveLength(1);
    expect(t.statuses.at(-1)).toBe("conflict");
    expect(xIn(t.server.slides.get("s1")!.value, "a")).toBe(77);

    t.saver.resolve(t.conflicts[0], "mine");
    await vi.advanceTimersByTimeAsync(10);
    expect(xIn(t.server.slides.get("s1")!.value, "a")).toBe(10);
    expect(t.statuses.at(-1)).toBe("saved");
  });

  it("takes the server copy when the user picks theirs", async () => {
    const t = setup();
    const theirs = { ...t.server.slides.get("s1")!.value };
    theirs.elements = updateElement(theirs.elements, "a", (e) => ({ ...e, x: 77 }));
    t.server.externalSlide(theirs);
    t.edit("s1", "a", 10);
    await vi.advanceTimersByTimeAsync(600);
    t.saver.resolve(t.conflicts[0], "theirs");
    expect(xIn(t.doc.slides.s1, "a")).toBe(77);
    expect(t.saver.dirtyKeys()).toEqual([]);
  });

  it("saves the deck before a new slide it lists", async () => {
    const t = setup();
    t.setDoc({
      deck: { ...t.doc.deck, slides: [...t.doc.deck.slides, { id: "s3", layout: "text" }] },
      slides: { ...t.doc.slides, s3: { id: "s3", elements: [el("n", 5)] } },
    });
    await vi.advanceTimersByTimeAsync(600);
    expect(t.server.writes).toEqual(["deck", "slide:s3"]);
    expect(xIn(t.server.slides.get("s3")!.value, "n")).toBe(5);
  });

  it("refreshes the version after an AI write and keeps other slides' edits", async () => {
    const t = setup();
    t.edit("s2", "c", 42);
    // The AI rewrote s1 on the server and announced it.
    const aiSlide: Slide = { id: "s1", elements: [el("z", 300)] };
    t.server.externalSlide(aiSlide);
    t.setDoc({ ...t.doc, slides: { ...t.doc.slides, s1: aiSlide } });
    t.saver.acceptRemoteSlide("s1", aiSlide);
    await vi.advanceTimersByTimeAsync(600);
    expect(t.server.writes).toEqual(["slide:s2"]);
    expect(xIn(t.server.slides.get("s2")!.value, "c")).toBe(42);
    // A later local edit of s1 goes out on the refreshed version, no conflict.
    t.setDoc({ ...t.doc, slides: { ...t.doc.slides, s1: { id: "s1", elements: [el("z", 310)] } } });
    await vi.advanceTimersByTimeAsync(600);
    expect(t.conflicts).toHaveLength(0);
    expect(xIn(t.server.slides.get("s1")!.value, "z")).toBe(310);
  });

  it("saves notes and retries on a version that only moved", async () => {
    const t = setup();
    t.saver.setNotesBase("s1", "", null);
    t.setNotes("s1", "Hello");
    await vi.advanceTimersByTimeAsync(600);
    expect(t.server.notes.get("s1")?.value).toBe("Hello");
    t.server.externalNotes("s1", "Hello");
    t.setNotes("s1", "Hello again");
    await vi.advanceTimersByTimeAsync(600);
    expect(t.server.notes.get("s1")?.value).toBe("Hello again");
    expect(t.conflicts).toHaveLength(0);
  });

  it("flushes everything at once", async () => {
    const t = setup();
    t.edit("s1", "a", 1);
    t.edit("s2", "c", 2);
    await t.saver.flush();
    expect(t.server.writes.sort()).toEqual(["slide:s1", "slide:s2"]);
  });
});

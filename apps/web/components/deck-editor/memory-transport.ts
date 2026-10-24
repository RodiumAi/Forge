/**
 * In-memory stand-in for the document API, with the same ETag and 409
 * behaviour. Used by the tests and by the offline dev demo.
 */

import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { ConflictError, type DocTransport, type Versioned } from "./autosave";

type Entry<T> = { value: T; version: number };

export class MemoryDocServer {
  deck: Entry<Deck>;
  slides = new Map<string, Entry<Slide>>();
  notes = new Map<string, Entry<string>>();
  writes: string[] = [];
  private counter = 1;

  constructor(deck: Deck, slides: Record<string, Slide>, notes: Record<string, string> = {}) {
    this.deck = { value: clone(deck), version: this.counter++ };
    for (const [id, slide] of Object.entries(slides)) this.slides.set(id, { value: clone(slide), version: this.counter++ });
    for (const [id, md] of Object.entries(notes)) this.notes.set(id, { value: md, version: this.counter++ });
  }

  /** Someone else writes a slide (another tab, the AI). */
  externalSlide(slide: Slide) {
    this.slides.set(slide.id, { value: clone(slide), version: this.counter++ });
  }

  externalDeck(deck: Deck) {
    this.deck = { value: clone(deck), version: this.counter++ };
  }

  externalNotes(id: string, markdown: string) {
    this.notes.set(id, { value: markdown, version: this.counter++ });
  }

  etagOf(key: "deck" | `slide:${string}` | `notes:${string}`): string | null {
    if (key === "deck") return String(this.deck.version);
    if (key.startsWith("slide:")) return this.slides.has(key.slice(6)) ? String(this.slides.get(key.slice(6))!.version) : null;
    return this.notes.has(key.slice(6)) ? String(this.notes.get(key.slice(6))!.version) : null;
  }

  transport(): DocTransport {
    const check = (entry: { version: number } | undefined, etag: string | null) => {
      if (etag && entry && String(entry.version) !== etag) throw new ConflictError();
    };
    const out = <T>(entry: Entry<T>): Versioned<T> => ({ value: clone(entry.value), etag: String(entry.version) });
    return {
      getDeck: async () => out(this.deck),
      putDeck: async (deck, etag) => {
        check(this.deck, etag);
        this.deck = { value: clone(deck), version: this.counter++ };
        for (const ref of deck.slides) {
          if (!this.slides.has(ref.id)) this.slides.set(ref.id, { value: { id: ref.id, elements: [] }, version: this.counter++ });
        }
        this.writes.push("deck");
        return out(this.deck);
      },
      getSlide: async (id) => {
        const entry = this.slides.get(id);
        if (!entry) throw new Error(`no slide ${id}`);
        return out(entry);
      },
      putSlide: async (id, slide, etag) => {
        if (!this.deck.value.slides.some((ref) => ref.id === id)) throw new Error("SLIDE_NOT_FOUND");
        check(this.slides.get(id), etag);
        const entry = { value: clone(slide), version: this.counter++ };
        this.slides.set(id, entry);
        this.writes.push(`slide:${id}`);
        return out(entry);
      },
      getNotes: async (id) => out(this.notes.get(id) ?? { value: "", version: 0 }),
      putNotes: async (id, markdown, etag) => {
        check(this.notes.get(id), etag);
        const entry = { value: markdown, version: this.counter++ };
        this.notes.set(id, entry);
        this.writes.push(`notes:${id}`);
        return out(entry);
      },
    };
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

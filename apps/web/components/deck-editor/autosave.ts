/**
 * Debounced autosave of the deck, each slide and each slide's notes.
 *
 * Every file has its own timer and its own version (ETag): editing slide 3
 * only rewrites `slides/s3.json`. Writes go out one at a time, the deck first
 * when it lists a slide the server does not know yet (the API creates the
 * slide file from the deck).
 *
 * A 409 means someone else wrote the file (another tab, a collaborator, the
 * AI). The saver reads the server copy and merges three ways against the
 * last version it knew; a clean merge is written back, a real conflict is
 * handed to the editor, which asks the user and calls `resolve`.
 *
 * AI events report files the server already wrote: `acceptRemote` takes that
 * content as the new base and refreshes the version before the next write,
 * so the user's unsaved edits to other slides are untouched.
 */

import type { Deck, Slide } from "@/lib/contracts/forge-design";
import { mergeDeck, mergeSlide } from "./merge";
import { sameJson, type Doc } from "./model";

export type Versioned<T> = { value: T; etag: string | null };

export class ConflictError extends Error {
  constructor() {
    super("conflict");
    this.name = "ConflictError";
  }
}

export type DocTransport = {
  getDeck(): Promise<Versioned<Deck>>;
  putDeck(deck: Deck, etag: string | null): Promise<Versioned<Deck>>;
  getSlide(id: string): Promise<Versioned<Slide>>;
  putSlide(id: string, slide: Slide, etag: string | null): Promise<Versioned<Slide>>;
  getNotes(id: string): Promise<Versioned<string>>;
  putNotes(id: string, markdown: string, etag: string | null): Promise<Versioned<string>>;
};

export type SaveKey = "deck" | `slide:${string}` | `notes:${string}`;

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";

export type SaveConflict =
  | { key: "deck"; server: Deck; etag: string | null }
  | { key: `slide:${string}`; id: string; server: Slide; etag: string | null }
  | { key: `notes:${string}`; id: string; server: string; etag: string | null };

export type AutosaveHooks = {
  getDoc(): Doc | null;
  getNotes(): Record<string, string>;
  /** Replace local content with a merge result or the server copy (not an undo step). */
  applyDeck(deck: Deck): void;
  applySlide(id: string, slide: Slide): void;
  applyNotes(id: string, markdown: string): void;
  onStatus(status: SaveStatus): void;
  onConflict(conflict: SaveConflict): void;
  onError?(error: unknown, key: SaveKey): void;
};

export const AUTOSAVE_DELAY_MS = 800;

const emptySlide = (id: string): Slide => ({ id, elements: [] });

export class Autosaver {
  private baseDeck: Deck | null = null;
  private baseSlides = new Map<string, Slide>();
  private baseNotes = new Map<string, string>();
  private etags = new Map<SaveKey, string | null>();
  /** Versions to read again before the next write (the server wrote the file). */
  private stale = new Set<SaveKey>();
  private conflicted = new Set<SaveKey>();
  private failed = new Set<SaveKey>();
  private timers = new Map<SaveKey, ReturnType<typeof setTimeout>>();
  private queue: Promise<void> = Promise.resolve();
  private running = 0;
  private disposed = false;

  constructor(
    private readonly transport: DocTransport,
    private readonly hooks: AutosaveHooks,
    private readonly delay = AUTOSAVE_DELAY_MS,
  ) {}

  /** The state just loaded from the server, with the versions of each file. */
  reset(doc: Doc, etags: Partial<Record<SaveKey, string | null>>, notes: Record<string, string> = {}) {
    this.clearTimers();
    this.baseDeck = doc.deck;
    this.baseSlides = new Map(Object.entries(doc.slides));
    this.baseNotes = new Map(Object.entries(notes));
    this.etags = new Map(Object.entries(etags) as [SaveKey, string | null][]);
    this.stale.clear();
    this.conflicted.clear();
    this.failed.clear();
    this.emit();
  }

  /** Remember the version of a notes file read after load. */
  setNotesBase(id: string, markdown: string, etag: string | null) {
    this.baseNotes.set(id, markdown);
    this.etags.set(`notes:${id}`, etag);
  }

  dispose() {
    this.disposed = true;
    this.clearTimers();
  }

  /** Files whose local copy differs from what the server has. */
  dirtyKeys(): SaveKey[] {
    const doc = this.hooks.getDoc();
    if (!doc) return [];
    const keys: SaveKey[] = [];
    if (this.baseDeck && !sameJson(doc.deck, this.baseDeck)) keys.push("deck");
    for (const ref of doc.deck.slides) {
      const slide = doc.slides[ref.id];
      if (slide && !sameJson(slide, this.baseSlides.get(ref.id) ?? emptySlide(ref.id))) keys.push(`slide:${ref.id}`);
    }
    for (const [id, markdown] of Object.entries(this.hooks.getNotes())) {
      if (markdown !== (this.baseNotes.get(id) ?? "")) keys.push(`notes:${id}`);
    }
    return keys;
  }

  /** Call after every local change: (re)arms the timer of each changed file. */
  changed() {
    if (this.disposed) return;
    for (const key of this.dirtyKeys()) {
      if (this.conflicted.has(key)) continue;
      this.schedule(key);
    }
    this.emit();
  }

  /** The server wrote this content (AI event): it becomes the base, version refreshed later. */
  acceptRemoteDeck(deck: Deck) {
    this.baseDeck = deck;
    this.stale.add("deck");
    this.drop("deck");
  }

  acceptRemoteSlide(id: string, slide: Slide) {
    this.baseSlides.set(id, slide);
    this.stale.add(`slide:${id}`);
    this.drop(`slide:${id}`);
  }

  acceptRemoteNotes(id: string, markdown: string) {
    this.baseNotes.set(id, markdown);
    this.stale.add(`notes:${id}`);
    this.drop(`notes:${id}`);
  }

  forgetSlide(id: string) {
    this.baseSlides.delete(id);
    this.drop(`slide:${id}`);
    this.drop(`notes:${id}`);
  }

  /** Answer to a conflict: keep the local copy (overwrite) or take the server's. */
  resolve(conflict: SaveConflict, choice: "mine" | "theirs") {
    const key = conflict.key;
    this.conflicted.delete(key);
    this.etags.set(key, conflict.etag);
    this.stale.delete(key);
    if (conflict.key === "deck") {
      this.baseDeck = conflict.server;
      if (choice === "theirs") this.hooks.applyDeck(conflict.server);
    } else if ("id" in conflict && conflict.key.startsWith("slide:")) {
      this.baseSlides.set(conflict.id, conflict.server as Slide);
      if (choice === "theirs") this.hooks.applySlide(conflict.id, conflict.server as Slide);
    } else if ("id" in conflict) {
      this.baseNotes.set(conflict.id, conflict.server as string);
      if (choice === "theirs") this.hooks.applyNotes(conflict.id, conflict.server as string);
    }
    if (choice === "mine") this.schedule(key, 0);
    this.emit();
  }

  /** Save everything now (leaving the page, presenting, before an AI run). */
  async flush(): Promise<void> {
    const keys = this.dirtyKeys().filter((k) => !this.conflicted.has(k));
    for (const key of keys) this.enqueue(key);
    await this.queue;
  }

  private drop(key: SaveKey) {
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
    this.conflicted.delete(key);
    this.failed.delete(key);
    this.emit();
  }

  private clearTimers() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private schedule(key: SaveKey, delay = this.delay) {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.enqueue(key);
      }, delay),
    );
  }

  private enqueue(key: SaveKey) {
    this.running++;
    this.emit();
    this.queue = this.queue
      .then(() => this.save(key))
      .catch((error) => {
        this.failed.add(key);
        this.hooks.onError?.(error, key);
      })
      .finally(() => {
        this.running--;
        this.emit();
      });
  }

  private emit() {
    if (this.disposed) return;
    let status: SaveStatus = "saved";
    if (this.conflicted.size) status = "conflict";
    else if (this.failed.size) status = "error";
    else if (this.running) status = "saving";
    else if (this.timers.size) status = "pending";
    this.hooks.onStatus(status);
  }

  private async save(key: SaveKey): Promise<void> {
    if (this.disposed || this.conflicted.has(key)) return;
    this.failed.delete(key);
    if (key === "deck") return this.saveDeck();
    if (key.startsWith("slide:")) return this.saveSlide(key.slice(6));
    return this.saveNotes(key.slice(6));
  }

  private async saveDeck(): Promise<void> {
    const doc = this.hooks.getDoc();
    if (!doc || !this.baseDeck || sameJson(doc.deck, this.baseDeck)) return;
    const local = doc.deck;
    let etag = this.etags.get("deck") ?? null;
    if (this.stale.has("deck")) {
      const fresh = await this.transport.getDeck();
      this.stale.delete("deck");
      if (!sameJson(fresh.value, this.baseDeck)) return this.mergeDeckWith(local, fresh);
      etag = fresh.etag;
      this.etags.set("deck", etag);
    }
    try {
      const saved = await this.transport.putDeck(local, etag);
      this.baseDeck = local;
      this.etags.set("deck", saved.etag);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      await this.mergeDeckWith(local, await this.transport.getDeck());
    }
  }

  private async mergeDeckWith(local: Deck, server: Versioned<Deck>): Promise<void> {
    const merged = mergeDeck(this.baseDeck ?? server.value, local, server.value);
    this.etags.set("deck", server.etag);
    if (!merged.ok) {
      this.baseDeck = server.value;
      this.conflicted.add("deck");
      this.hooks.onConflict({ key: "deck", server: server.value, etag: server.etag });
      return;
    }
    this.baseDeck = server.value;
    if (!sameJson(merged.value, local)) this.hooks.applyDeck(merged.value);
    if (sameJson(merged.value, server.value)) return;
    const saved = await this.transport.putDeck(merged.value, server.etag);
    this.baseDeck = merged.value;
    this.etags.set("deck", saved.etag);
  }

  private async saveSlide(id: string): Promise<void> {
    const doc = this.hooks.getDoc();
    const local = doc?.slides[id];
    if (!doc || !local || !doc.deck.slides.some((ref) => ref.id === id)) return;
    // The API only accepts slides listed in the stored deck: save the deck first.
    if (this.baseDeck && !this.baseDeck.slides.some((ref) => ref.id === id)) {
      await this.saveDeck();
      if (!this.baseDeck?.slides.some((ref) => ref.id === id)) return;
    }
    const key: SaveKey = `slide:${id}`;
    const base = this.baseSlides.get(id) ?? emptySlide(id);
    if (sameJson(local, base)) return;
    let etag = this.etags.get(key) ?? null;
    if (this.stale.has(key)) {
      const fresh = await this.transport.getSlide(id);
      this.stale.delete(key);
      if (!sameJson(fresh.value, base)) return this.mergeSlideWith(id, local, fresh);
      etag = fresh.etag;
      this.etags.set(key, etag);
    }
    try {
      const saved = await this.transport.putSlide(id, local, etag);
      this.baseSlides.set(id, local);
      this.etags.set(key, saved.etag);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      await this.mergeSlideWith(id, local, await this.transport.getSlide(id));
    }
  }

  private async mergeSlideWith(id: string, local: Slide, server: Versioned<Slide>): Promise<void> {
    const key: SaveKey = `slide:${id}`;
    const base = this.baseSlides.get(id) ?? emptySlide(id);
    const merged = mergeSlide(base, local, server.value);
    this.etags.set(key, server.etag);
    this.baseSlides.set(id, server.value);
    if (!merged.ok) {
      this.conflicted.add(key);
      this.hooks.onConflict({ key, id, server: server.value, etag: server.etag });
      return;
    }
    if (!sameJson(merged.value, local)) this.hooks.applySlide(id, merged.value);
    if (sameJson(merged.value, server.value)) return;
    const saved = await this.transport.putSlide(id, merged.value, server.etag);
    this.baseSlides.set(id, merged.value);
    this.etags.set(key, saved.etag);
  }

  private async saveNotes(id: string): Promise<void> {
    const key: SaveKey = `notes:${id}`;
    const local = this.hooks.getNotes()[id];
    const base = this.baseNotes.get(id) ?? "";
    if (local === undefined || local === base) return;
    let etag = this.etags.get(key) ?? null;
    if (this.stale.has(key)) {
      const fresh = await this.transport.getNotes(id);
      this.stale.delete(key);
      etag = fresh.etag;
      this.etags.set(key, etag);
      if (fresh.value !== base) return this.notesConflict(id, fresh);
    }
    try {
      const saved = await this.transport.putNotes(id, local, etag);
      this.baseNotes.set(id, local);
      this.etags.set(key, saved.etag);
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
      const fresh = await this.transport.getNotes(id);
      if (fresh.value === base || fresh.value === local) {
        // Nobody else changed the text (or they wrote the same): retry on the new version.
        this.baseNotes.set(id, fresh.value);
        this.etags.set(key, fresh.etag);
        if (fresh.value === local) return;
        const saved = await this.transport.putNotes(id, local, fresh.etag);
        this.baseNotes.set(id, local);
        this.etags.set(key, saved.etag);
        return;
      }
      this.notesConflict(id, fresh);
    }
  }

  private notesConflict(id: string, fresh: Versioned<string>) {
    const key: SaveKey = `notes:${id}`;
    this.etags.set(key, fresh.etag);
    this.baseNotes.set(id, fresh.value);
    this.conflicted.add(key);
    this.hooks.onConflict({ key, id, server: fresh.value, etag: fresh.etag });
  }
}

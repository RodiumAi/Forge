/**
 * Audience window and presenter view talk through a BroadcastChannel: no
 * server, works on the published link as well as in the editor. The audience
 * window owns the position; the presenter view sends commands and mirrors the
 * state it receives.
 */

import type { Deck } from "./types";

export type Screen = "none" | "black" | "white";

export type PresenterCommand = "next" | "prev" | "first" | "last" | "black" | "white";

export type PresenterMessage =
  | { kind: "state"; index: number; step: number; total: number; screen: Screen }
  | { kind: "command"; action: PresenterCommand }
  | { kind: "goto"; index: number }
  | { kind: "hello" };

export type Channel = { post: (message: PresenterMessage) => void; close: () => void };

/** Stable channel name for a deck: same deck, same name in every tab. */
export function channelName(deck: Pick<Deck, "title" | "slides">): string {
  const source = `${deck.title ?? ""}|${deck.slides.map((s) => s.id).join(",")}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `forge-deck:${(hash >>> 0).toString(36)}`;
}

function isMessage(data: unknown): data is PresenterMessage {
  if (typeof data !== "object" || data === null) return false;
  const kind = (data as { kind?: unknown }).kind;
  return kind === "state" || kind === "command" || kind === "goto" || kind === "hello";
}

/** Opens the channel; null where BroadcastChannel does not exist (old browsers, SSR). */
export function openChannel(name: string, onMessage: (message: PresenterMessage) => void): Channel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  const channel = new BroadcastChannel(name);
  channel.onmessage = (event: MessageEvent) => {
    if (isMessage(event.data)) onMessage(event.data);
  };
  return {
    post: (message) => {
      try {
        channel.postMessage(message);
      } catch {
        // A closed channel only means the other window is gone.
      }
    },
    close: () => channel.close(),
  };
}

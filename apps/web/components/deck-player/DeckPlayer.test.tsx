import { act, fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "framer-motion";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DeckPlayer } from "./DeckPlayer";
import { formatElapsed, PresenterView } from "./PresenterView";
import { DEFAULT_TOKENS } from "./theme";
import type { Deck, Slide } from "./types";

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

const rect = (id: string, extra: Record<string, unknown> = {}) => ({ id, type: "shape" as const, shape: "rect" as const, x: 0, y: 0, w: 10, h: 10, ...extra });

const deck: Deck = {
  version: 1,
  title: "Test",
  format: { ratio: "16:9", width: 1920, height: 1080 },
  theme: { designSystem: "local", tokens: "DESIGN.md" },
  slides: [
    { id: "a", layout: "title" },
    { id: "hidden", layout: "title", hidden: true },
    { id: "b", layout: "content", transition: { type: "push", direction: "left" } },
    { id: "c", layout: "content", transition: { type: "morph" } },
  ],
};

const slides: Record<string, Slide> = {
  a: { id: "a", elements: [rect("a1", { animation: { type: "appear", trigger: "on-click" } }), rect("a2", { animation: { type: "rise", trigger: "on-click" } })] },
  hidden: { id: "hidden", elements: [] },
  b: { id: "b", elements: [rect("b1", { matchKey: "m" })] },
  c: { id: "c", elements: [rect("c1", { matchKey: "m", x: 500 })] },
};

function setup(props: Partial<Parameters<typeof DeckPlayer>[0]> = {}) {
  const onSlideChange = vi.fn();
  const utils = render(
    <DeckPlayer deck={deck} slides={slides} tokens={DEFAULT_TOKENS} assetUrl={(p) => p} onSlideChange={onSlideChange} locale="en" {...props} />,
  );
  const root = utils.container.querySelector<HTMLElement>("[data-deck-player]")!;
  const key = (k: string, init: KeyboardEventInit = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...init }));
  const pos = () => `${root.getAttribute("data-index")}.${root.getAttribute("data-step")}`;
  return { ...utils, root, key, pos, onSlideChange };
}

describe("DeckPlayer", () => {
  it("skips hidden slides and consumes click steps before changing slide", () => {
    const { key, pos, onSlideChange, container } = setup();
    expect(pos()).toBe("0.0");
    key("ArrowRight");
    expect(pos()).toBe("0.1");
    key(" ");
    expect(pos()).toBe("0.2");
    key("PageDown");
    expect(pos()).toBe("1.0");
    expect(container.querySelector("[data-slide-id='b']")).toBeTruthy();
    expect(onSlideChange).toHaveBeenLastCalledWith(1);
    key("n");
    expect(pos()).toBe("2.0");
    key("n");
    expect(pos()).toBe("2.0");
  });

  it("goes back to the previous slide shown complete", () => {
    const { key, pos } = setup({ startAt: 1 });
    expect(pos()).toBe("1.0");
    key("ArrowLeft");
    expect(pos()).toBe("0.2");
    key("p");
    expect(pos()).toBe("0.1");
    key("Backspace");
    key("PageUp");
    expect(pos()).toBe("0.0");
  });

  it("handles Home, End and typed slide numbers", () => {
    const { key, pos, container } = setup();
    key("End");
    expect(pos()).toBe("2.0");
    key("Home");
    expect(pos()).toBe("0.0");
    key("2");
    expect(container.querySelector("[data-goto-buffer]")?.textContent).toContain("2");
    key("Enter");
    expect(pos()).toBe("1.0");
    expect(container.querySelector("[data-goto-buffer]")).toBeNull();
    key("Enter");
    expect(pos()).toBe("2.0");
  });

  it("blanks the screen in black or white and the next press restores it", () => {
    const { key, pos, root } = setup();
    key("b");
    expect(root.getAttribute("data-screen")).toBe("black");
    key(".");
    expect(root.getAttribute("data-screen")).toBe("none");
    key("W");
    expect(root.getAttribute("data-screen")).toBe("white");
    key("ArrowRight");
    expect(root.getAttribute("data-screen")).toBe("none");
    expect(pos()).toBe("0.0");
  });

  it("starts the show from the beginning on F5 and from the current slide on Shift+F5", () => {
    const request = vi.fn(() => Promise.resolve());
    const { key, pos, root } = setup({ startAt: 2 });
    root.requestFullscreen = request as never;
    key("F5", { shiftKey: true });
    expect(pos()).toBe("2.0");
    expect(request).toHaveBeenCalledTimes(1);
    key("F5");
    expect(pos()).toBe("0.0");
  });

  it("advances on click but not on the controls, and with the buttons", () => {
    const { root, pos } = setup();
    act(() => void fireEvent.click(root.querySelector("[data-slide-id]")!));
    expect(pos()).toBe("0.1");
    act(() => void fireEvent.click(screen.getByRole("button", { name: "Next" })));
    expect(pos()).toBe("0.2");
    act(() => void fireEvent.click(screen.getByRole("button", { name: "Previous" })));
    expect(pos()).toBe("0.1");
  });

  it("follows swipes on touch screens", () => {
    const { root, pos } = setup();
    act(() => {
      fireEvent.touchStart(root, { touches: [{ clientX: 300, clientY: 100 }] });
      fireEvent.touchEnd(root, { changedTouches: [{ clientX: 100, clientY: 110 }] });
    });
    expect(pos()).toBe("0.1");
    act(() => {
      fireEvent.touchStart(root, { touches: [{ clientX: 100, clientY: 100 }] });
      fireEvent.touchEnd(root, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    });
    expect(pos()).toBe("0.0");
  });

  it("ignores keys typed in a field", () => {
    const { pos } = setup();
    const input = document.createElement("input");
    document.body.appendChild(input);
    act(() => void fireEvent.keyDown(input, { key: "ArrowRight" }));
    expect(pos()).toBe("0.0");
    input.remove();
  });

  it("shows the badge only when asked", () => {
    expect(setup().container.querySelector("[data-forge-badge]")).toBeNull();
    const badge = setup({ badge: true }).container.querySelector("[data-forge-badge]");
    expect(badge?.textContent).toBe("By Forge");
    expect(badge?.getAttribute("aria-label")).toBe("Made with Forge");
    expect(badge?.querySelector("svg")).not.toBeNull();
    expect(badge?.getAttribute("href")).toBe("https://forge.rodiumai.io");
  });

  it("renders an empty deck without crashing", () => {
    const { container } = render(<DeckPlayer deck={{ ...deck, slides: [] }} slides={{}} tokens={DEFAULT_TOKENS} assetUrl={(p) => p} />);
    expect(container.querySelector("[data-counter]")?.textContent).toBe("0 / 0");
  });

  it("answers the presenter view over the BroadcastChannel", async () => {
    const { key, pos } = setup();
    const peer = new BroadcastChannel((await import("./presenter-channel")).channelName(deck));
    const received: unknown[] = [];
    peer.onmessage = (event) => received.push(event.data);
    key("ArrowRight");
    await act(async () => {
      peer.postMessage({ kind: "command", action: "next" });
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(pos()).toBe("0.2");
    expect(received).toContainEqual({ kind: "state", index: 0, step: 1, total: 3, screen: "none" });
    await act(async () => {
      peer.postMessage({ kind: "goto", index: 2 });
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(pos()).toBe("2.0");
    peer.close();
  });
});

describe("PresenterView", () => {
  it("shows notes, the next slide and follows the audience state", async () => {
    const { container } = render(
      <PresenterView deck={deck} slides={slides} notes={{ a: "Say hello", b: "Second" }} tokens={DEFAULT_TOKENS} assetUrl={(p) => p} locale="en" />,
    );
    expect(container.querySelector("[data-notes]")?.textContent).toBe("Say hello");
    expect(container.querySelector("[data-counter]")?.textContent).toContain("Waiting");
    const peer = new BroadcastChannel((await import("./presenter-channel")).channelName(deck));
    await act(async () => {
      peer.postMessage({ kind: "state", index: 1, step: 0, total: 3, screen: "none" });
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(container.querySelector("[data-notes]")?.textContent).toBe("Second");
    expect(container.querySelector("[data-counter]")?.textContent).toBe("2 / 3");
    expect(container.querySelectorAll("[data-slide-id='c']")).toHaveLength(1);
    peer.close();
  });

  it("formats the timer", () => {
    expect(formatElapsed(65_000)).toBe("01:05");
    expect(formatElapsed(3_725_000)).toBe("1:02:05");
  });
});

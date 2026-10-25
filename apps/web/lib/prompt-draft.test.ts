import { act, fireEvent, render } from "@testing-library/react";
import { createElement, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_TTL_MS,
  clearPromptDraft,
  readPromptDraft,
  usePromptDraft,
  writePromptDraft,
} from "./prompt-draft";

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("prompt drafts", () => {
  it("saves, reads back and clears a draft", () => {
    writePromptDraft("p1", { text: "Ajoute une carte", extras: { pages: ["/contact"] } }, 1000);
    expect(readPromptDraft("p1", 2000)).toEqual({ text: "Ajoute une carte", extras: { pages: ["/contact"] }, savedAt: 1000 });
    clearPromptDraft("p1");
    expect(readPromptDraft("p1")).toBeNull();
  });

  it("removes the draft when the field is emptied", () => {
    writePromptDraft("p1", { text: "x" });
    writePromptDraft("p1", { text: "  ", extras: { pages: [] } });
    expect(readPromptDraft("p1")).toBeNull();
  });

  it("keeps a draft made only of tags", () => {
    writePromptDraft("p1", { text: "", extras: { integrations: [{ id: "tally" }] } });
    expect(readPromptDraft("p1")?.extras).toEqual({ integrations: [{ id: "tally" }] });
  });

  it("drops a draft older than a week", () => {
    writePromptDraft("p1", { text: "old" }, 0);
    expect(readPromptDraft("p1", DRAFT_TTL_MS + 1)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("ignores a corrupted entry", () => {
    localStorage.setItem("forge.draft.p1", "{not json");
    expect(readPromptDraft("p1")).toBeNull();
  });
});

function Field({ storageKey, paused = false }: { storageKey: string; paused?: boolean }) {
  const [text, setText] = useState("");
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  usePromptDraft({
    key: storageKey,
    draft: { text },
    onRestore: (d) => setText((prev) => prev || d.text),
    pausedRef,
  });
  return createElement("textarea", { value: text, onChange: (e: { target: { value: string } }) => setText(e.target.value) });
}

describe("usePromptDraft", () => {
  it("restores the saved text on mount, then saves edits after a short delay", () => {
    vi.useFakeTimers();
    writePromptDraft("p1", { text: "brouillon" });
    const { container } = render(createElement(Field, { storageKey: "p1" }));
    const area = container.querySelector("textarea")!;
    expect(area.value).toBe("brouillon");
    act(() => {
      fireEvent.change(area, { target: { value: "brouillon modifié" } });
    });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(readPromptDraft("p1")?.text).toBe("brouillon modifié");
  });

  it("does not erase the draft while a send is in flight", () => {
    vi.useFakeTimers();
    writePromptDraft("p1", { text: "en cours d'envoi" });
    const view = render(createElement(Field, { storageKey: "p1", paused: true }));
    const area = view.container.querySelector("textarea")!;
    act(() => {
      fireEvent.change(area, { target: { value: "" } });
      vi.advanceTimersByTime(400);
    });
    expect(readPromptDraft("p1")?.text).toBe("en cours d'envoi");
  });
});

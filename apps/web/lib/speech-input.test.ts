import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { joinSpoken, speechLang, useSpeechInput } from "@/lib/speech-input";

/** A stand-in for the browser recognizer the tests drive by hand. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
  hear(parts: { text: string; final: boolean }[]) {
    const results = parts.map((p) => ({ isFinal: p.final, 0: { transcript: p.text } }));
    this.onresult?.({ resultIndex: 0, results });
  }
}

function setup(initial = "") {
  let value = initial;
  const onChange = vi.fn((next: string) => {
    value = next;
  });
  const hook = renderHook(({ v }) => useSpeechInput({ value: v, onChange, locale: "fr", maxLength: 50 }), {
    initialProps: { v: initial },
  });
  const sync = () => hook.rerender({ v: value });
  return { hook, onChange, sync, current: () => value };
}

describe("joinSpoken / speechLang", () => {
  it("adds one space between the typed text and the dictated words", () => {
    expect(joinSpoken("", " bonjour ")).toBe("bonjour");
    expect(joinSpoken("Une landing", "pour RodiPay")).toBe("Une landing pour RodiPay");
    expect(joinSpoken("Une landing ", "pour RodiPay")).toBe("Une landing pour RodiPay");
    expect(joinSpoken("Une landing", "  ")).toBe("Une landing");
  });

  it("gives the recognizer a full language tag", () => {
    expect(speechLang("fr")).toBe("fr-FR");
    expect(speechLang("en")).toBe("en-US");
    expect(speechLang("fr-BE")).toBe("fr-BE");
  });
});

describe("useSpeechInput", () => {
  beforeEach(() => {
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
  });
  afterEach(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    FakeRecognition.last = null;
  });

  it("writes the words live after the typed text, and keeps only the final ones on stop", () => {
    const { hook, sync, current } = setup("Une landing");
    expect(hook.result.current.supported).toBe(true);

    act(() => hook.result.current.start());
    sync();
    const rec = FakeRecognition.last!;
    expect(rec.lang).toBe("fr-FR");
    expect(hook.result.current.listening).toBe(true);

    act(() => rec.hear([{ text: "pour RodiPay", final: true }, { text: " en ble", final: false }]));
    expect(current()).toBe("Une landing pour RodiPay en ble");

    act(() => hook.result.current.stop());
    expect(current()).toBe("Une landing pour RodiPay");
    expect(hook.result.current.listening).toBe(false);
  });

  it("puts the text back as it was on cancel", () => {
    const { hook, sync, current } = setup("Une landing");
    act(() => hook.result.current.start());
    sync();
    act(() => FakeRecognition.last!.hear([{ text: "à jeter", final: true }]));
    expect(current()).toBe("Une landing à jeter");

    act(() => hook.result.current.cancel());
    expect(current()).toBe("Une landing");
    expect(hook.result.current.listening).toBe(false);
  });

  it("never writes past the field's limit", () => {
    const { hook, sync, current } = setup("x".repeat(45));
    act(() => hook.result.current.start());
    sync();
    act(() => FakeRecognition.last!.hear([{ text: "une phrase bien trop longue", final: true }]));
    expect(current()).toHaveLength(50);
  });

  it("names a blocked microphone", () => {
    const { hook } = setup();
    act(() => hook.result.current.start());
    act(() => {
      FakeRecognition.last!.onerror?.({ error: "not-allowed" });
      FakeRecognition.last!.onend?.();
    });
    expect(hook.result.current.error).toBe("denied");
    expect(hook.result.current.listening).toBe(false);
  });

  it("is off where the browser has no recognition", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
    const { hook } = setup();
    expect(hook.result.current.supported).toBe(false);
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ANALYTICS_CONSENT_KEY,
  readAnalyticsConsent,
  resetAnalyticsConsentMemoryForTests,
  subscribeAnalyticsConsent,
  useAnalyticsConsent,
  writeAnalyticsConsent,
} from "./consent";

beforeEach(() => {
  window.localStorage.clear();
  resetAnalyticsConsentMemoryForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("analytics consent store", () => {
  it("has no choice by default", () => {
    expect(readAnalyticsConsent()).toBeNull();
  });

  it("persists a choice and notifies subscribers", () => {
    const onChange = vi.fn();
    const stop = subscribeAnalyticsConsent(onChange);
    writeAnalyticsConsent("granted");
    expect(readAnalyticsConsent()).toBe("granted");
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe("granted");
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    writeAnalyticsConsent("denied");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores unknown stored values", () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, "maybe");
    expect(readAnalyticsConsent()).toBeNull();
  });

  it("forgets the choice on reset", () => {
    writeAnalyticsConsent("denied");
    writeAnalyticsConsent(null);
    expect(readAnalyticsConsent()).toBeNull();
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  });

  it("keeps the choice for the page session when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    writeAnalyticsConsent("granted");
    expect(readAnalyticsConsent()).toBe("granted");
  });
});

describe("useAnalyticsConsent", () => {
  it("reflects grant, deny and reset", () => {
    const { result } = renderHook(() => useAnalyticsConsent());
    expect(result.current.consent).toBeNull();
    act(() => result.current.grant());
    expect(result.current.consent).toBe("granted");
    act(() => result.current.deny());
    expect(result.current.consent).toBe("denied");
    act(() => result.current.reset());
    expect(result.current.consent).toBeNull();
  });
});

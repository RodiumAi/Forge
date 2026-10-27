import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  identify: vi.fn(),
  capture: vi.fn(),
  reset: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthogMock }));

async function loadClient(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "phc_test");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_ALLOW_LOCAL", "true");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const consent = await import("@/lib/analytics/consent");
  const client = await import("./client");
  return { client, consent };
}

beforeEach(() => {
  window.localStorage.clear();
  Object.values(posthogMock).forEach((fn) => fn.mockReset());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("posthog client", () => {
  it("loads nothing before the visitor chooses", async () => {
    const { client } = await loadClient();
    expect(client.posthogActive()).toBe(false);
    expect(await client.getPostHog()).toBeNull();
    client.capturePosthogEvent("anything");
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("loads nothing after a refusal", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("denied");
    expect(await client.getPostHog()).toBeNull();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it("initializes once after consent with the privacy-first options", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    await client.getPostHog();
    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    const [key, options] = posthogMock.init.mock.calls[0];
    expect(key).toBe("phc_test");
    expect(options).toMatchObject({
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      disable_session_recording: true,
      defaults: "2025-05-24",
    });
    expect(typeof options.before_send).toBe("function");
  });

  it("only enables session replay when explicitly asked", async () => {
    const { client, consent } = await loadClient({
      NEXT_PUBLIC_POSTHOG_REPLAY: "true",
    });
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    expect(posthogMock.init.mock.calls[0][1].disable_session_recording).toBe(
      false,
    );
  });

  it("stays off on localhost unless allowed", async () => {
    const { client, consent } = await loadClient({
      NEXT_PUBLIC_POSTHOG_ALLOW_LOCAL: "",
    });
    consent.writeAnalyticsConsent("granted");
    expect(client.posthogActive()).toBe(false);
    expect(await client.getPostHog()).toBeNull();
  });

  it("adds the product context and scrubs secrets in before_send", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    const beforeSend = posthogMock.init.mock.calls[0][1].before_send;
    const out = beforeSend({
      uuid: "u",
      event: "$pageview",
      properties: {
        $current_url: "https://rodiumai.io/verify-email?token=SECRET",
      },
    });
    expect(out.properties.app).toBe("forge");
    expect(out.properties.environment).toBeTruthy();
    expect(JSON.stringify(out)).not.toContain("SECRET");
    expect(
      beforeSend({
        uuid: "u",
        event: "$exception",
        properties: {
          $exception_list: [
            { type: "Error", value: "ResizeObserver loop limit exceeded" },
          ],
        },
      }),
    ).toBeNull();
  });

  it("identifies an account once, even when called repeatedly", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("granted");
    client.identifyPosthogUser("user-1", { email: "a@b.c" });
    client.identifyPosthogUser("user-1", { email: "a@b.c" });
    client.identifyPosthogUser("user-1", { email: "a@b.c" });
    await client.getPostHog();
    expect(posthogMock.identify).toHaveBeenCalledTimes(1);
    expect(posthogMock.identify).toHaveBeenCalledWith("user-1", {
      email: "a@b.c",
    });
  });

  it("applies an identity known before consent right after consent", async () => {
    const { client, consent } = await loadClient();
    client.identifyPosthogUser("user-2", { role: "user" });
    expect(posthogMock.identify).not.toHaveBeenCalled();
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    expect(posthogMock.identify).toHaveBeenCalledWith("user-2", {
      role: "user",
    });
  });

  it("opts out when consent is withdrawn and in again when granted", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    consent.writeAnalyticsConsent("denied");
    // Listeners of earlier test modules share the window, hence "called", not "once".
    expect(posthogMock.opt_out_capturing).toHaveBeenCalled();
    expect(await client.getPostHog()).toBeNull();
    consent.writeAnalyticsConsent("granted");
    expect(posthogMock.opt_in_capturing).toHaveBeenLastCalledWith({
      captureEventName: false,
    });
  });

  it("restores the SDK consent after a logout reset", async () => {
    const { client, consent } = await loadClient();
    consent.writeAnalyticsConsent("granted");
    await client.getPostHog();
    posthogMock.opt_in_capturing.mockClear();
    client.resetPosthogUser();
    await vi.waitFor(() => expect(posthogMock.reset).toHaveBeenCalled());
    expect(posthogMock.opt_in_capturing).toHaveBeenCalled();
    expect(
      posthogMock.reset.mock.invocationCallOrder[0],
    ).toBeLessThan(posthogMock.opt_in_capturing.mock.invocationCallOrder[0]);
  });
});

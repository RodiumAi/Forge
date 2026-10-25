import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

async function configuredHeaders() {
  const routes = await nextConfig.headers?.();
  if (!routes) throw new Error("Next security headers are not configured");
  return routes;
}

describe("Next security headers", () => {
  it("enforces the global browser policy", async () => {
    const routes = await configuredHeaders();
    const global = routes.find((route) => route.source === "/:path*");
    const headers = Object.fromEntries(
      (global?.headers ?? []).map(({ key, value }) => [key, value]),
    );

    expect(headers).toMatchObject({
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy":
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(self), payment=(), usb=()",
      "X-Frame-Options": "DENY",
    });
    expect(headers["Strict-Transport-Security"]).not.toContain("includeSubDomains");
    expect(headers["Content-Security-Policy-Report-Only"]).toBeUndefined();

    const csp = headers["Content-Security-Policy"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
    expect(csp).toContain("https://eu.i.posthog.com");
    expect(csp).toContain("https://*.i.posthog.com");
    expect(csp).toContain("https://*.googleapis.com");
    expect(csp).toContain("https://*.firebaseapp.com");
    expect(csp).toContain(
      new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100").origin,
    );
  });

  it("lets deck videos embed YouTube (nocookie) and Vimeo players only", async () => {
    const routes = await configuredHeaders();
    const global = routes.find((route) => route.source === "/:path*");
    const csp = (global?.headers ?? []).find(({ key }) => key === "Content-Security-Policy")?.value ?? "";
    const frameSrc = csp.split(";").map((part) => part.trim()).find((part) => part.startsWith("frame-src")) ?? "";
    expect(frameSrc).toContain("https://www.youtube-nocookie.com");
    expect(frameSrc).toContain("https://player.vimeo.com");
    expect(frameSrc).not.toContain("https://www.youtube.com");
  });

  it.each(["/login", "/register", "/auth/:path*"])(
    "preserves Firebase/OAuth popup opener on %s",
    async (source) => {
      const routes = await configuredHeaders();
      const route = routes.find((candidate) => candidate.source === source);
      expect(route?.headers).toContainEqual({
        key: "Cross-Origin-Opener-Policy",
        value: "same-origin-allow-popups",
      });
    },
  );
});

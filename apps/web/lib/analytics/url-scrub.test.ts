import { describe, expect, it } from "vitest";
import { scrubUrl } from "./url-scrub";

describe("scrubUrl", () => {
  it("drops one-time tokens from the query string", () => {
    expect(
      scrubUrl("https://forge.rodiumai.io/reset-password?token=abc123XYZ"),
    ).toBe("https://forge.rodiumai.io/reset-password");
    expect(scrubUrl("https://forge.rodiumai.io/verify-email?token=abc")).toBe(
      "https://forge.rodiumai.io/verify-email",
    );
  });

  it("drops the whole fragment, including a hand-off code", () => {
    expect(scrubUrl("https://forge.rodiumai.io/auth/handoff#code=secret")).toBe(
      "https://forge.rodiumai.io/auth/handoff",
    );
  });

  it("keeps campaign and navigation parameters", () => {
    expect(
      scrubUrl(
        "https://rodiumai.io/pricing?utm_source=x&utm_medium=y&plan=pro&tab=forge&token=drop",
      ),
    ).toBe("https://rodiumai.io/pricing?utm_source=x&utm_medium=y&plan=pro&tab=forge");
  });

  it("works on relative paths", () => {
    expect(scrubUrl("/dashboard?tab=recent&session=s1#frag")).toBe(
      "/dashboard?tab=recent",
    );
    expect(scrubUrl("/pay?session_token=zzz")).toBe("/pay");
  });

  it("is case-insensitive on parameter names and caps long values", () => {
    expect(scrubUrl("https://rodiumai.io/?UTM_Campaign=a")).toBe(
      "https://rodiumai.io/?UTM_Campaign=a",
    );
    const long = "a".repeat(500);
    const out = scrubUrl(`https://rodiumai.io/?utm_source=${long}`);
    expect(out.length).toBeLessThan(200);
  });

  it("leaves clean URLs and empty input alone", () => {
    expect(scrubUrl("https://rodiumai.io/docs/code")).toBe(
      "https://rodiumai.io/docs/code",
    );
    expect(scrubUrl("")).toBe("");
  });

  it("never leaks the part after ? or # when the value cannot be parsed", () => {
    expect(scrubUrl("http://[bad?token=1")).not.toContain("token");
  });
});

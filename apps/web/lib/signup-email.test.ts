import { describe, expect, it } from "vitest";

import { signupEmailError } from "./auth-validation";
import { signupEmailProblem } from "./signup-email";

/**
 * Same table as `apps/api/tests/test_signup_email.py` and the Nest backend
 * (`src/common/validation/signup-email.spec.ts`); change all together.
 */
const REFUSED = [
  // 1. "rodiumai" anywhere
  "ops@rodiumai.io",
  "OPS@RodiumAi.IO",
  "  someone@rodiumai.io  ",
  "a@rodiumai.com",
  "a@x.rodiumai.io",
  "rodiumai.dev@gmail.com",
  "myrodiumaiaccount@gmail.com",
  "a@gmail.rodiumai",
  // 2. reserved domains and TLDs
  "jane@example.com",
  "jane@example.org",
  "jane@example.net",
  "jane@mail.example.co",
  "jane@foo.test",
  "jane@test.com",
  "jane@site.invalid",
  "jane@localhost",
  "jane@box.local",
  "jane@corp.example",
  "jane@localhost.com",
  // 3. placeholder local parts
  "test@gmail.com",
  "test1@gmail.com",
  "test.1@gmail.com",
  "test_42@gmail.com",
  "test-7@gmail.com",
  "test+promo@gmail.com",
  "testing@outlook.com",
  "tester@outlook.com",
  "tests@outlook.com",
  "example@gmail.com",
  "exemple@gmail.com",
  "demo@company.fr",
  "fake@gmail.com",
  "dummy@gmail.com",
  "sample@gmail.com",
  "foo@gmail.com",
  "bar@gmail.com",
  "foobar@gmail.com",
  "baz@gmail.com",
  "asdf@gmail.com",
  "qwerty@gmail.com",
  "azerty@gmail.com",
  "abc@gmail.com",
  "abc123@gmail.com",
  "xxx@gmail.com",
  "aaa@gmail.com",
  "noreply@company.com",
  "no-reply@company.com",
  "nobody@company.com",
  "null@gmail.com",
  "undefined@gmail.com",
  // malformed
  "",
  "no-at-sign",
  "@gmail.com",
  "jane@",
];

const ALLOWED = [
  "jane.doe@gmail.com",
  "contest@gmail.com",
  "sample.store@shop.com",
  "testimony@gmail.com",
  "latest@gmail.com",
  "protest@yahoo.fr",
  "demonstration@gmail.com",
  "foobarista@gmail.com",
  "abcd@gmail.com",
  "bart@gmail.com",
  "jane+test@gmail.com",
  "jane@testing.com",
  "jane@contest.io",
  "jane@examples.com",
  "jane@local.fr",
  "jane@company.co.uk",
  "parfait.toke@outlook.com",
  "rodium@gmail.com",
  "jane@rodium.ai",
];

describe("signupEmailProblem", () => {
  it.each(REFUSED)("refuses %j", (email) => {
    expect(signupEmailProblem(email)).toBe("invalid_email_address");
  });

  it.each(ALLOWED)("allows %j", (email) => {
    expect(signupEmailProblem(email)).toBeNull();
  });
});

describe("signupEmailError", () => {
  it("keeps the format messages first", () => {
    expect(signupEmailError("")).toBe("lndAuthEmailRequired");
    expect(signupEmailError("not-an-email")).toBe("lndAuthEmailInvalid");
  });

  it("refuses reserved and placeholder addresses", () => {
    expect(signupEmailError("ops@rodiumai.io")).toBe("authEmailReserved");
    expect(signupEmailError("test@gmail.com")).toBe("authEmailReserved");
    expect(signupEmailError("jane@example.com")).toBe("authEmailReserved");
  });

  it("accepts an ordinary address", () => {
    expect(signupEmailError("jane.doe@gmail.com")).toBeNull();
  });
});

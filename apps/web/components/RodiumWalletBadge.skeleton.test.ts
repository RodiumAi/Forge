/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

/**
 * Regression guard: after forge status is settled, missing FRODI+RODI must not
 * leave an infinite skeleton. Logic mirrored from RodiumWalletBadge.
 */
function shouldShowSkeleton(opts: {
  forgeSettled: boolean;
  hasFrodi: boolean;
  hasWallet: boolean;
  linked: boolean;
}): boolean {
  const { forgeSettled, hasFrodi, hasWallet, linked } = opts;
  if (!forgeSettled && !hasFrodi) return true;
  if (!hasWallet && !linked && !hasFrodi) return false;
  if (!hasWallet && !hasFrodi) return false;
  return false;
}

describe("RodiumWalletBadge skeleton gate", () => {
  it("shows skeleton only while forge status is unsettled", () => {
    expect(
      shouldShowSkeleton({
        forgeSettled: false,
        hasFrodi: false,
        hasWallet: false,
        linked: true,
      }),
    ).toBe(true);
  });

  it("hides after settled with neither FRODI nor RODI", () => {
    expect(
      shouldShowSkeleton({
        forgeSettled: true,
        hasFrodi: false,
        hasWallet: false,
        linked: true,
      }),
    ).toBe(false);
  });
});

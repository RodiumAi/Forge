/** Official RodiumAI URLs — aligned with rodiumai_user social-links + legal routes. */
export const RODIUM_SITE = "https://www.rodiumai.io" as const;

export const SOCIAL_LINKS = {
  discord: "https://discord.gg/Av7J9GBJAJ",
  linkedin: "https://www.linkedin.com/company/rodium-ai",
  github: "https://github.com/RodiumAi",
  youtube: "https://www.youtube.com/@rodium-ai",
  x: "https://x.com/rodium_ai",
} as const;

export const FORGE_REPO = "https://github.com/RodiumAi/Forge" as const;
export const FORGE_CONTRIBUTE = `${FORGE_REPO}#contributing` as const;

export const RODIUM_LEGAL = {
  help: `${RODIUM_SITE}/help`,
  privacy: `${RODIUM_SITE}/privacy`,
  terms: `${RODIUM_SITE}/terms`,
  trust: `${RODIUM_SITE}/trust`,
  cookies: `${RODIUM_SITE}/privacy#cookies`,
} as const;

/** Origin of the RodiumAI user app — where payment links live. */
export function rodiumUserAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_RODIUM_USER_APP_URL?.trim() ||
    "http://localhost:3000";
  let origin = raw.replace(/\/$/, "");
  // Apex `rodiumai.io` is fronted by LiteSpeed (N0C) which 301s to
  // `https://www.rodiumai.io/` and drops the path — `/pay?…` becomes `/?…`.
  // Always prefer www so the detached pay funnel stays on Amplify/CloudFront.
  if (origin === "https://rodiumai.io" || origin === "http://rodiumai.io") {
    origin = "https://www.rodiumai.io";
  }
  return origin;
}

/**
 * Detached top-up link: `rodiumai.io/pay?uid=…&purpose=credit`.
 *
 * The page is unauthenticated and identifies the account to credit by `uid`
 * (the platform's `rodium_sub`), so a Forge user can top up without logging
 * into the RodiumAI dashboard first. `redirectUrl` brings them back here once
 * the payment settles; it must be on the platform's redirect allow-list
 * (`PAY_LINK_ALLOWED_REDIRECT_ORIGINS`) or the link is rejected.
 *
 * Only a free-amount link can be built client-side. A fixed price has to be
 * signed by the platform — mint it through `POST /api/v1/internal/pay-links`
 * from `apps/api` instead.
 */
export function buildRodiumPayUrl(options: {
  uid: string;
  purpose?: "credit";
  redirectUrl?: string;
}): string {
  const url = new URL(`${rodiumUserAppOrigin()}/pay`);
  url.searchParams.set("uid", options.uid);
  url.searchParams.set("purpose", options.purpose ?? "credit");
  if (options.redirectUrl) {
    url.searchParams.set("redirect_url", options.redirectUrl);
  }
  return url.toString();
}

/**
 * Where an "upgrade plan" control sends the user.
 *
 * Plans are chosen on Forge itself (the public pricing section). A signed-in
 * account already has a RodiumAI user behind it, so the pricing buttons open
 * the pay page with that account. They never send someone to create a second
 * account on the RodiumAI site.
 */
export function rodiumUpgradeUrl(): string {
  return "/dashboard/pricing";
}

/**
 * Where a "top up RODI" control sends the user.
 *
 * Preferred: the detached `/pay` page, which credits the account without
 * requiring a RodiumAI login and returns here afterwards. That needs the
 * platform user id; until `/auth/me` has resolved it we fall back to the
 * dashboard recharge page, which works but costs a sign-in.
 *
 * Shared by the wallet badge and the "no credit left" error bubble so both
 * lead to the same place — the badge used to own this privately.
 */
export function rodiumRechargeUrl(
  rodiumSub: string | null | undefined,
  returnTo?: string,
): string {
  if (!rodiumSub) return `${rodiumUserAppOrigin()}/dashboard/billing/recharge`;
  return buildRodiumPayUrl({
    uid: rodiumSub,
    purpose: "credit",
    redirectUrl:
      returnTo ??
      (typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/settings?tab=generation`),
  });
}

const FORGE_PLAN_SLUGS = new Set([
  "starter",
  "builder",
  "pro",
  "scale",
  "team-pro",
]);

/** Relative path the login page may return to after a pricing CTA. */
export function forgeSubscribeReturnPath(options: {
  plan: string;
  currency: string;
  country: string;
  seats?: number | null;
}): string {
  const params = new URLSearchParams({
    subscribe: options.plan,
    currency: options.currency,
    country: options.country,
  });
  if (options.seats && options.seats > 0) {
    params.set("seats", String(options.seats));
  }
  return `/?${params.toString()}#pricing`;
}

/**
 * Detached Forge subscription checkout. `uid` is required: without it the
 * pay page refuses the link ("missing the account it should credit").
 */
export function forgeSubscriptionPayUrl(options: {
  uid: string;
  plan: string;
  currency: string;
  country: string;
  seats?: number | null;
}): string {
  const url = new URL(`${rodiumUserAppOrigin()}/pay`);
  url.searchParams.set("uid", options.uid);
  url.searchParams.set("purpose", "forge_subscription");
  url.searchParams.set("plan", options.plan);
  url.searchParams.set("currency", options.currency);
  url.searchParams.set("country", options.country);
  const forgeOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3100"
  ).replace(/\/$/, "");
  url.searchParams.set("redirect_url", `${forgeOrigin}/dashboard`);
  if (options.seats && options.seats > 0) {
    url.searchParams.set("seats", String(options.seats));
  }
  return url.toString();
}

/** Read `?subscribe=` left by the login return and build the pay URL. */
export function forgeSubscribeResumeUrl(
  search: string,
  rodiumSub: string,
): string | null {
  const params = new URLSearchParams(search);
  const plan = params.get("subscribe")?.trim() ?? "";
  if (!FORGE_PLAN_SLUGS.has(plan)) return null;
  const currency = (params.get("currency")?.trim() || "XOF").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  const country = (params.get("country")?.trim() || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const seatsRaw = params.get("seats")?.trim() ?? "";
  const seats = /^\d+$/.test(seatsRaw) ? Number(seatsRaw) : null;
  return forgeSubscriptionPayUrl({ uid: rodiumSub, plan, currency, country, seats });
}

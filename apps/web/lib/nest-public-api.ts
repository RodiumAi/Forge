/** Nest public API origin for SSR proxies (plans, payment countries). */
export function nestPublicApiBase(): string {
  const fromEnv = process.env.RODIUM_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  // Amplify SSR sometimes omits non-NEXT_PUBLIC branch env at runtime.
  if (process.env.NODE_ENV === "production") {
    return "https://rsb.rodiumai.io/api/v1";
  }
  return "http://127.0.0.1:3001/api/v1";
}

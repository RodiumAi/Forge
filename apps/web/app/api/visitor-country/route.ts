import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ISO = "TG";

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || real || "";
  if (!candidate || isPrivate(candidate)) return null;
  return candidate;
}

function isPrivate(ip: string) {
  const value = ip.replace(/^::ffff:/, "");
  return (
    value === "::1" ||
    value.startsWith("127.") ||
    value.startsWith("10.") ||
    value.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) ||
    value.startsWith("fc") ||
    value.startsWith("fd")
  );
}

async function lookupCountry(ip: string | null): Promise<string | null> {
  const attempts = [lookupIpApi(ip), lookupIpWho(ip)].map((attempt) =>
    attempt.then((iso) => {
      if (!iso) throw new Error("empty");
      return iso;
    }),
  );
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

async function lookupIpWho(ip: string | null): Promise<string | null> {
  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const body = (await response.json()) as { success?: boolean; country_code?: string };
  return body.success && body.country_code ? body.country_code.toUpperCase() : null;
}

async function lookupIpApi(ip: string | null): Promise<string | null> {
  // HTTPS only — the former ip-api.com free endpoint was HTTP plaintext.
  const url = ip
    ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    : "https://ipapi.co/json/";
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  const body = (await response.json()) as { error?: boolean; country_code?: string };
  return !body.error && body.country_code ? body.country_code.toUpperCase() : null;
}

export async function GET(request: NextRequest) {
  try {
    const iso2 = (await lookupCountry(clientIp(request))) ?? DEFAULT_ISO;
    return NextResponse.json({ iso2 });
  } catch {
    return NextResponse.json({ iso2: DEFAULT_ISO });
  }
}

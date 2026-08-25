import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function previewHostMiddleware(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const match = host.match(/^([a-z0-9-]+)\.lvh\.me(?::\d+)?$/i);
  if (!match) return NextResponse.next();
  const slug = match[1];
  if (!slug || slug === "www") return NextResponse.next();
  const api = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100").replace(/\/$/, "");
  const dest = `${api}/preview-by-slug/${slug}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return NextResponse.rewrite(dest);
}

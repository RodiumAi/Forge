import { NextRequest, NextResponse } from "next/server";
import { nestPublicApiBase } from "@/lib/nest-public-api";

export async function GET(request: NextRequest) {
  const currency = request.nextUrl.searchParams.get("currency") || "XOF";
  try {
    const response = await fetch(
      `${nestPublicApiBase()}/public/forge/plans?currency=${encodeURIComponent(currency)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return NextResponse.json({ currency: "XOF", fallback: true, plans: [] });
    }
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json({ currency: "XOF", fallback: true, plans: [] });
  }
}

import { NextResponse } from "next/server";

const NEST_API =
  process.env.RODIUM_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001/api/v1";

export async function GET() {
  try {
    const response = await fetch(`${NEST_API}/public/payment-countries`, {
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json([]);
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json([]);
  }
}

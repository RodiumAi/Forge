import { NextResponse } from "next/server";
import { nestPublicApiBase } from "@/lib/nest-public-api";

export async function GET() {
  try {
    const response = await fetch(`${nestPublicApiBase()}/public/payment-countries`, {
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json([]);
    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json([]);
  }
}

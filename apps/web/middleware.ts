import type { NextRequest } from "next/server";
import { previewHostMiddleware } from "@/lib/preview-host";

export function middleware(request: NextRequest) {
  return previewHostMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.png|icon.png).*)"],
};

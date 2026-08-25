"use client";

import { Suspense } from "react";
import { TopProgressBar } from "@/components/TopProgressBar";

/** Suspense boundary required because TopProgressBar uses useSearchParams. */
export function TopProgressHost() {
  return (
    <Suspense fallback={null}>
      <TopProgressBar />
    </Suspense>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Connectors hub retired — RodiumAi lives in Settings → Generation. */
export default function ConnectorsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings?tab=generation");
  }, [router]);
  return null;
}

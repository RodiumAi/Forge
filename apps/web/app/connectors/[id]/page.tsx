"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy connector detail URLs redirect to Settings → Generation. */
export default function ConnectorDetailRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/settings?tab=generation");
  }, [router]);
  return null;
}

"use client";

import { useEffect, useState } from "react";

function toDataUrl(contentType: string, bytes: ArrayBuffer): string {
  const ct = (contentType || "application/octet-stream").split(";")[0].trim();
  if (ct.includes("svg")) {
    const text = new TextDecoder().decode(bytes);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  }
  const u8 = new Uint8Array(bytes);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return `data:${ct};base64,${btoa(binary)}`;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/[\s\-_.]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

/**
 * Load API-hosted logos as data URLs (same-origin for <img>).
 * Avoids CSP img-src + blob revoke races under React Strict Mode.
 */
export function IntegrationLogo({
  src,
  alt = "",
  label = "",
  width,
  height,
  className,
}: {
  src: string;
  alt?: string;
  /** Used for lettermark fallback while loading / on error */
  label?: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(src, { cache: "no-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 32) throw new Error("empty");
        if (cancelled) return;
        setDataUrl(toDataUrl(res.headers.get("content-type") || "", buf));
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!dataUrl) {
    const mark = initialsFromName(label || alt || "?");
    return (
      <span
        className={className}
        style={{
          width,
          height,
          display: "inline-grid",
          placeItems: "center",
          fontSize: Math.max(10, Math.round(width * 0.38)),
          fontWeight: 600,
          color: failed ? "#fdba74" : "var(--muted)",
          opacity: failed ? 1 : 0.55,
        }}
        aria-hidden={alt ? undefined : true}
      >
        {mark}
      </span>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
      decoding="async"
    />
  );
}

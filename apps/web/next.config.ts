import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

function httpOrigin(value: string | undefined, fallback: string): string {
  try {
    const url = new URL(value?.trim() || fallback);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : fallback;
  } catch {
    return fallback;
  }
}

function firebaseAuthOrigin(): string {
  const domain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  if (!domain) return "https://*.firebaseapp.com";
  return httpOrigin(domain.includes("://") ? domain : `https://${domain}`, "https://*.firebaseapp.com");
}

const apiOrigin = httpOrigin(process.env.NEXT_PUBLIC_API_URL, "http://localhost:8100");
const posthogOrigin = httpOrigin(
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
  "https://eu.i.posthog.com",
);
const scriptEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src 'self' ${apiOrigin} ${posthogOrigin} https://*.i.posthog.com https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com`,
  "font-src 'self' data: https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `frame-src 'self' ${apiOrigin} ${firebaseAuthOrigin()} https://accounts.google.com https://*.firebaseapp.com`,
  "img-src 'self' data: blob: https:",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${scriptEval} ${posthogOrigin} https://*.i.posthog.com https://apis.google.com https://accounts.google.com https://*.firebaseapp.com https://*.googleapis.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
] as const;

function s3RemotePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    { protocol: "https", hostname: "cdn.rodiumai.io", pathname: "/**" },
    {
      protocol: "https",
      hostname: "rodiumai-media-prod.s3.eu-west-1.amazonaws.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "*.s3.eu-west-1.amazonaws.com",
      pathname: "/**",
    },
  ];
  const base = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (base) {
    try {
      const url = new URL(base);
      patterns.push({
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        pathname: "/**",
      });
    } catch {
      /* ignore */
    }
  }
  return patterns;
}

/** Standalone bundle is for Docker/Railway only — breaks Amplify WEB_COMPUTE routing. */
const useStandaloneOutput = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  ...(useStandaloneOutput ? { output: "standalone" as const } : {}),
  images: {
    remotePatterns: s3RemotePatterns(),
  },
  // Let Firebase / RodiumAi OAuth popups keep `window.opener` when possible.
  // Storage-event fallback still works if a hop clears the opener.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
      {
        source: "/login",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        source: "/register",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    if (useStandaloneOutput) {
      const fallbackFonts = path.join(configDir, "lib/fonts.fallback.ts");
      config.resolve ??= {};
      config.resolve.alias ??= {};
      // Redirect every `@/lib/fonts` resolution path so Docker never hits Google Fonts.
      config.resolve.alias["@/lib/fonts"] = fallbackFonts;
      config.resolve.alias[path.join(configDir, "lib/fonts.ts")] = fallbackFonts;
      config.resolve.alias[path.join(configDir, "lib/fonts")] = fallbackFonts;
    }
    return config;
  },
};

export default nextConfig;

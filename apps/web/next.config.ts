import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

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

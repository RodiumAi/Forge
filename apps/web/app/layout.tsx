import type { Metadata } from "next";
import { TopProgressHost } from "@/components/TopProgressHost";
import { LandingJsonLd } from "@/components/landing/LandingJsonLd";
import { appFonts } from "@/lib/fonts";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3100";

const titleDefault = "Forge by RodiumAi · Prototype en moins de 5 minutes";
const description =
  "Créez des applications et des sites web en discutant avec l'IA. Forge génère une vraie app React, preview live, templates et export. Propulsé par RodiumAi.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Forge by RodiumAi",
  title: {
    default: titleDefault,
    template: "%s · Forge by RodiumAi",
  },
  description,
  keywords: [
    "Forge",
    "RodiumAi",
    "AI web builder",
    "prototype IA",
    "générateur d'app React",
    "Vite React AI",
    "no-code AI",
    "prompt to app",
    "live preview",
    "templates web",
  ],
  authors: [{ name: "RodiumAi", url: "https://rodiumai.io" }],
  creator: "RodiumAi",
  publisher: "RodiumAi",
  category: "technology",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", type: "image/png" }],
    shortcut: ["/icon.png"],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Forge by RodiumAi",
    title: titleDefault,
    description,
    locale: "fr_FR",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Forge by RodiumAi · Prototype in minutes",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: titleDefault,
    description,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: "/",
    languages: {
      fr: "/",
      en: "/",
    },
  },
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("forge_theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      data-theme="dark"
      className={appFonts.className}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Display serif for the hero tagline. Runtime <link> (not next/font):
            Docker builds run offline with FORGE_FONT_MODE=fallback, where a
            build-time font fetch would fail. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout applies to every page */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&display=swap"
        />
        <LandingJsonLd siteUrl={siteUrl} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>
            <TopProgressHost />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

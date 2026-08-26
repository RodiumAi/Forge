import type { Metadata } from "next";
import { TopProgressHost } from "@/components/TopProgressHost";
import { appFonts } from "@/lib/fonts";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "highlight.js/styles/github-dark.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Forge by RodiumAi",
  description: "Build web apps with AI — powered by RodiumAi",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", type: "image/png" }],
    shortcut: ["/icon.png"],
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

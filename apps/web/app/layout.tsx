import type { Metadata } from "next";
import { DM_Sans, Syne } from "next/font/google";
import { TopProgressHost } from "@/components/TopProgressHost";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Forge by RodiumAi",
  description: "Build web apps with AI — powered by RodiumAi",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("forge_theme");document.documentElement.dataset.theme=t==="light"?"light":"dark";}catch(e){document.documentElement.dataset.theme="dark";}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      data-theme="dark"
      className={`${syne.variable} ${dmSans.variable}`}
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

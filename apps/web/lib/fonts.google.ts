import localFont from "next/font/local";

/**
 * Brand typeface for Forge UI (landing + builder).
 * Local WOFF — same files as rodiumai_user / admin (not Google DM Sans / Syne).
 */
const openSauceSans = localFont({
  src: [
    {
      path: "../public/fonts/open-sauce-sans/open-sauce-sans-latin-400-normal.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/open-sauce-sans/open-sauce-sans-latin-500-normal.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/open-sauce-sans/open-sauce-sans-latin-600-normal.woff",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/open-sauce-sans/open-sauce-sans-latin-700-normal.woff",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-open-sauce-sans",
  display: "swap",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

export const appFonts = {
  className: `${openSauceSans.variable} ${openSauceSans.className}`,
};

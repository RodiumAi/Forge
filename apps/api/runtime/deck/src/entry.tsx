/**
 * Browser entry of the standalone deck player (published page, presenter
 * page, single-file HTML export, and the print page the PDF, PNG and PPTX
 * exports render).
 *
 * When the page is drawn, fonts are in and images settled,
 * `document.documentElement.dataset.deckReady` becomes "1" (or "error").
 */

import { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { DeckPlayer, PresenterView, themeTokensFromDesign } from "@forge/deck-player";
import { assetResolver, loadData, readConfig, type DeckConfig, type DeckData } from "./data";
import { googleFamilies, googleFontsHrefs } from "./fonts";
import { PrintPages } from "./print";
import { installExportApi } from "./extract";

declare const __FORGE_EXPORT__: boolean;

/** Adds the font stylesheets; resolves when each has loaded (or failed). */
function addFontLinks(hrefs: string[]): Promise<unknown> {
  const loads: Promise<unknown>[] = [];
  for (const href of hrefs) {
    if (document.querySelector(`link[data-forge-font="${CSS.escape(href)}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.forgeFont = href;
    loads.push(
      new Promise((resolve) => {
        link.addEventListener("load", resolve, { once: true });
        link.addEventListener("error", resolve, { once: true });
      }),
    );
    document.head.appendChild(link);
  }
  return Promise.all(loads);
}

/**
 * Asks for each family at the weights and styles the slides use. Until a
 * face is requested, `document.fonts.ready` resolves at once and the first
 * slides would be captured in a fallback font.
 */
function loadFamilies(families: string[]): Promise<unknown> {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const faces = families.flatMap((f) => [`400 1em "${f}"`, `700 1em "${f}"`, `italic 400 1em "${f}"`]);
  return Promise.all(faces.map((face) => fonts.load(face).catch(() => undefined)));
}

async function settle(fontsLoading: Promise<unknown>): Promise<void> {
  const images = Array.from(document.images).filter((img) => !img.complete);
  await Promise.race([
    Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
  await Promise.race([
    fontsLoading.then(() => document.fonts?.ready),
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
}

function markReady(state: "1" | "error") {
  document.documentElement.dataset.deckReady = state;
}

function App({ data, config }: { data: DeckData; config: DeckConfig }) {
  const tokens = useMemo(() => themeTokensFromDesign(data.design), [data.design]);
  const assetUrl = useMemo(() => assetResolver(data, config), [data, config]);
  useEffect(() => {
    const fontsLoading =
      config.webFonts !== false
        ? addFontLinks(googleFontsHrefs(tokens)).then(() => loadFamilies(googleFamilies(tokens)))
        : Promise.resolve();
    let cancelled = false;
    // Two frames so the first layout (and its <img> tags) exists before waiting.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        settle(fontsLoading).then(() => {
          if (!cancelled) markReady("1");
        });
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [tokens, config.webFonts]);

  const presenter = config.mode === "presenter" || window.location.hash === "#presenter";
  if (config.mode === "print") {
    return <PrintPages deck={data.deck} slides={data.slides} tokens={tokens} assetUrl={assetUrl} steps={!!config.steps} />;
  }
  if (presenter) {
    return <PresenterView deck={data.deck} slides={data.slides} notes={data.notes} tokens={tokens} assetUrl={assetUrl} locale={config.locale} />;
  }
  const presenterUrl = config.presenter ? new URL(config.presenter, new URL(config.base ?? "./", document.baseURI)).href : undefined;
  return (
    <DeckPlayer
      deck={data.deck}
      slides={data.slides}
      notes={data.notes}
      tokens={tokens}
      assetUrl={assetUrl}
      badge={!!config.badge}
      locale={config.locale}
      presenterUrl={presenterUrl}
    />
  );
}

async function main() {
  const config = readConfig();
  const root = document.getElementById("forge-deck");
  if (!root) return;
  try {
    const data = await loadData(config);
    if (data.deck.title && !document.title) document.title = data.deck.title;
    if (__FORGE_EXPORT__) installExportApi(data);
    createRoot(root).render(<App data={data} config={config} />);
  } catch (err) {
    root.textContent = "This presentation could not be loaded.";
    markReady("error");
    console.error(err);
  }
}

void main();

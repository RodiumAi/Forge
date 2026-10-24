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
import { googleFontsHrefs } from "./fonts";
import { PrintPages } from "./print";
import { installExportApi } from "./extract";

declare const __FORGE_EXPORT__: boolean;

function addFontLinks(hrefs: string[]) {
  for (const href of hrefs) {
    if (document.querySelector(`link[data-forge-font="${CSS.escape(href)}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.forgeFont = href;
    document.head.appendChild(link);
  }
}

async function settle(): Promise<void> {
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
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, new Promise((resolve) => setTimeout(resolve, 4000))]);
}

function markReady(state: "1" | "error") {
  document.documentElement.dataset.deckReady = state;
}

function App({ data, config }: { data: DeckData; config: DeckConfig }) {
  const tokens = useMemo(() => themeTokensFromDesign(data.design), [data.design]);
  const assetUrl = useMemo(() => assetResolver(data, config), [data, config]);
  useEffect(() => {
    if (config.webFonts !== false) addFontLinks(googleFontsHrefs(tokens));
    let cancelled = false;
    // Two frames so the first layout (and its <img> tags) exists before waiting.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        settle().then(() => {
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

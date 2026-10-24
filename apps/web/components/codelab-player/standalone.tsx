/**
 * Entry of the published codelab page (bundled by
 * `scripts/build-codelab-player.mjs` into `apps/api/runtime/codelab/dist`).
 *
 * Reads `codelab-data.json` (written by `services/codelab/publish.py`), then
 * mounts the player on `#codelab-root`. `?print=1` renders every step for the
 * PDF export and flags the page `data-codelab-ready` once fonts and code
 * highlighting have settled.
 */

import { createRoot } from "react-dom/client";

import type { Codelab } from "@/lib/contracts/forge-design";

import { CodelabPlayer } from "./CodelabPlayer";
import type { DownloadInfo } from "./context";
import { codelabTokens } from "./theme";

type PublishedData = {
  codelab: Codelab;
  steps: Record<string, string>;
  design?: string;
  downloads?: DownloadInfo[];
  feedbackUrl?: string | null;
  badge?: boolean;
  locale?: string;
};

function relativeAsset(path: string): string {
  // Published files sit next to the page: keep project paths relative.
  return path.replace(/^\/+/, "");
}

async function main() {
  const root = document.getElementById("codelab-root");
  if (!root) return;
  const source = root.dataset.src || "codelab-data.json";
  const response = await fetch(source, { cache: "no-cache" });
  if (!response.ok) throw new Error(`codelab data: ${response.status}`);
  const data = (await response.json()) as PublishedData;
  const { tokens, scheme } = codelabTokens(data.design ?? "");
  const print = new URLSearchParams(window.location.search).get("print") === "1";
  document.body.style.background = tokens["--bg"] ?? "";
  createRoot(root).render(
    <CodelabPlayer
      codelab={data.codelab}
      steps={data.steps}
      tokens={tokens}
      scheme={scheme}
      assetUrl={relativeAsset}
      downloads={data.downloads}
      feedbackUrl={data.feedbackUrl ?? undefined}
      badge={!!data.badge && !print}
      locale={data.locale}
      storageKey={`forge-codelab:${window.location.host}${window.location.pathname}`}
      mode={print ? "print" : "interactive"}
    />,
  );
  if (print) {
    await document.fonts?.ready;
    // Shiki loads grammars on demand; give highlighted blocks time to settle.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    document.body.setAttribute("data-codelab-ready", "");
  }
}

void main().catch((error: unknown) => {
  const root = document.getElementById("codelab-root");
  if (root) root.textContent = "Ce codelab n'a pas pu être chargé.";
  console.error(error);
});

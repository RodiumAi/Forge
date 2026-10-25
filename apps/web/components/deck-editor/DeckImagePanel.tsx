"use client";

/**
 * The image panel of the deck editor (plan 4.3), same three tabs as the
 * builder's: Free (Pixabay, default, no credit), Import (upload or a project
 * image) and AI (model choice, billed by RodiumAi, "not enough credits" said
 * at once). The picked image is handed back as a project path.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Sparkles, Upload, X } from "lucide-react";
import type { AssetUrl } from "@/components/deck-player";
import { ApiError } from "@/lib/api";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { joinSpoken, useSpeechInput } from "@/lib/speech-input";
import { VoiceButton, VoiceStatus } from "@/components/composer/VoiceInput";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { getSessionSnapshot } from "@/lib/session-cache";
import { isInsufficientCredits, type ImageClient, type PickedImage, type StockPage } from "./images-client";
import type { ImageTarget } from "./PropertiesPanel";
import type { DeckT } from "./strings";

type Tab = "free" | "import" | "ai";
type StockType = "photo" | "illustration" | "vector";

const TABS: { id: Tab; labelKey: MessageKey }[] = [
  { id: "free", labelKey: "imageTabFree" },
  { id: "import", labelKey: "imageTabImport" },
  { id: "ai", labelKey: "imageTabAi" },
];
const STOCK_TYPES: { id: StockType; labelKey: MessageKey }[] = [
  { id: "photo", labelKey: "imageTypePhoto" },
  { id: "illustration", labelKey: "imageTypeIllustration" },
  { id: "vector", labelKey: "imageTypeVector" },
];
const ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;

/** Aspect offered first for the AI tab: the one closest to the frame being filled. */
export function closestAspect(w: number, h: number): (typeof ASPECTS)[number] {
  if (!(w > 0 && h > 0)) return "16:9";
  const ratio = w / h;
  const values: Record<(typeof ASPECTS)[number], number> = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "3:4": 3 / 4, "9:16": 9 / 16 };
  return (Object.entries(values) as [(typeof ASPECTS)[number], number][]).reduce((best, cur) =>
    Math.abs(Math.log(cur[1] / ratio)) < Math.abs(Math.log(values[best] / ratio)) ? cur[0] : best,
  "16:9" as (typeof ASPECTS)[number]);
}

export function DeckImagePanel({
  client,
  target,
  frame,
  query: initialQuery,
  styleHint,
  assetUrl,
  onPick,
  onClose,
  t,
}: {
  client: ImageClient | null;
  target: ImageTarget;
  /** Size of the frame being filled, for the AI format. */
  frame: { w: number; h: number };
  query?: string;
  /** Design system style added to AI prompts. */
  styleHint?: string;
  assetUrl: AssetUrl;
  onPick: (image: PickedImage) => void;
  onClose: () => void;
  t: DeckT;
}) {
  const { t: tApp, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("free");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(initialQuery ?? "");
  const [stockType, setStockType] = useState<StockType>("photo");
  const [stock, setStock] = useState<StockPage | null>(null);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const [projectImages, setProjectImages] = useState<string[] | null>(null);
  const sizes = useRef(new Map<string, { width: number; height: number }>());

  const [prompt, setPrompt] = useState(styleHint ? `\n\n${styleHint}` : "");
  const voice = useSpeechInput({
    value: prompt,
    onChange: setPrompt,
    locale,
    maxLength: 4000,
    // The description goes before the style line the panel starts with.
    join: (base, spoken) => {
      const at = styleHint ? base.lastIndexOf(`

${styleHint}`) : -1;
      return at < 0 ? joinSpoken(base, spoken) : joinSpoken(base.slice(0, at), spoken) + base.slice(at);
    },
  });
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>(() => closestAspect(frame.w, frame.h));
  const [noCredits, setNoCredits] = useState(false);

  useEffect(() => {
    if (!client || tab !== "import" || projectImages) return;
    client
      .projectImages()
      .then(setProjectImages)
      .catch(() => setProjectImages([]));
  }, [client, tab, projectImages]);

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : tApp("errorGeneric"));

  async function wrap(task: () => Promise<PickedImage>) {
    setBusy(true);
    setError(null);
    setNoCredits(false);
    try {
      onPick(await task());
    } catch (err) {
      if (isInsufficientCredits(err)) setNoCredits(true);
      else fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function runSearch(page: number) {
    if (!client || !query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const next = await client.search(query.trim(), stockType, locale, page);
      setStock((prev) => (page > 1 && prev ? { ...next, hits: [...prev.hits, ...next.hits] } : next));
    } catch (err) {
      if (err instanceof ApiError && err.code === "IMAGE_SEARCH_UNAVAILABLE") setUnavailable(true);
      else fail(err);
    } finally {
      setSearching(false);
    }
  }

  const heading = target.kind === "background" ? t("imageForBackground") : target.kind === "new" ? t("imageNew") : t("imageForElement");

  return (
    <aside className="de-image-panel" aria-label={t("imagePanel")}>
      <header className="de-image-head">
        <div>
          <h3>{t("imagePanel")}</h3>
          <p>{heading}</p>
        </div>
        <button type="button" className="de-icon-button" onClick={onClose} aria-label={t("cancel")} title={t("cancel")}>
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="image-panel-tabs" role="tablist" aria-label={tApp("imageTabsAria")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`image-panel-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {tApp(item.labelKey)}
          </button>
        ))}
      </div>
      {!client ? <p className="de-hint">{t("readOnly")}</p> : null}
      {error ? (
        <p className="builder-pane-error" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "free" && client ? (
        <div role="tabpanel">
          {unavailable ? (
            <p className="comments-empty">{tApp("imageSearchUnavailable")}</p>
          ) : (
            <>
              <form
                className="image-panel-search"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void runSearch(1);
                }}
              >
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tApp("imageSearchPlaceholder")} aria-label={tApp("imageSearchPlaceholder")} maxLength={100} />
                <select value={stockType} onChange={(e) => setStockType(e.target.value as StockType)} aria-label={tApp("imageSearch")}>
                  {STOCK_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {tApp(item.labelKey)}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn" disabled={searching || !query.trim()} title={tApp("imageSearch")} aria-label={tApp("imageSearch")}>
                  <Search size={14} aria-hidden />
                </button>
              </form>
              {stock && stock.hits.length === 0 ? <p className="comments-empty">{tApp("imageSearchEmpty")}</p> : null}
              {stock && stock.hits.length > 0 ? (
                <ul className="image-panel-stock-grid">
                  {stock.hits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="image-panel-stock"
                        disabled={busy}
                        title={hit.author ? `${hit.tags ?? ""} (${hit.author})` : hit.tags}
                        onClick={() => void wrap(() => client.importStock(hit))}
                      >
                        <img src={hit.previewUrl} alt={hit.tags ?? ""} loading="lazy" referrerPolicy="no-referrer" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {stock?.hasMore ? (
                <div className="image-panel-actions">
                  <button type="button" className="btn" disabled={searching} onClick={() => void runSearch(stock.page + 1)}>
                    {tApp("imageLoadMore")}
                  </button>
                </div>
              ) : null}
              <p className="image-panel-credit">
                <a href="https://pixabay.com/" target="_blank" rel="noreferrer">
                  {tApp("imageCreditPixabay")}
                </a>
              </p>
            </>
          )}
        </div>
      ) : null}

      {tab === "import" && client ? (
        <div role="tabpanel">
          <div className="image-panel-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void wrap(() => client.upload(file));
              }}
            />
            <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload size={14} aria-hidden /> {busy ? t("imageUploading") : tApp("imageImport")}
            </button>
          </div>
          <p className="image-panel-section-label">{t("imageProjectFiles")}</p>
          <ul className="image-panel-grid">
            {projectImages && projectImages.length === 0 ? <li className="comments-empty">{tApp("filesEmpty")}</li> : null}
            {(projectImages ?? []).map((path) => (
              <li key={path}>
                <button
                  type="button"
                  className="image-panel-thumb"
                  disabled={busy}
                  title={path}
                  onClick={() => {
                    const size = sizes.current.get(path) ?? { width: 1600, height: 900 };
                    onPick({ path, ...size });
                  }}
                >
                  <img
                    src={assetUrl(path)}
                    alt={path}
                    onLoad={(e) => sizes.current.set(path, { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
                  />
                  <span>{path.replace(/^public\/images\//, "")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "ai" && client ? (
        <form
          role="tabpanel"
          className="image-panel-ai"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (prompt.trim()) void wrap(() => client.generate(null, prompt.trim(), aspect, target.kind === "element" || target.kind === "fill" ? target.id : target.kind));
          }}
        >
          <label>
            <span>{tApp("imageAiPrompt")}</span>
            <span className="f-voice-field">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={4000} readOnly={voice.listening} />
              <VoiceButton voice={voice} className="f-mic" size="sm" />
            </span>
          </label>
          <VoiceStatus voice={voice} compact surface />
          <label>
            <span>{tApp("imageAiAspect")}</span>
            <select value={aspect} onChange={(e) => setAspect(e.target.value as (typeof ASPECTS)[number])}>
              {ASPECTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {noCredits ? (
            <p className="builder-pane-error" role="alert">
              {tApp("imageAiInsufficient")}{" "}
              <a href={rodiumRechargeUrl(getSessionSnapshot()?.profile?.rodium_sub)} target="_blank" rel="noreferrer">
                {tApp("rechargeRodi")}
              </a>
            </p>
          ) : null}
          <button type="submit" className="btn" disabled={busy || !prompt.trim()}>
            <Sparkles size={14} aria-hidden /> {busy ? tApp("imageAiGenerating") : tApp("imageAiGenerate")}
          </button>
          <p className="image-panel-credit">{tApp("imageAiBilled")}</p>
        </form>
      ) : null}
    </aside>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Sparkles, Upload, X } from "lucide-react";
import { api, apiBase, ApiError, getToken } from "@/lib/api";
import { assetContentUrl, projectPublicUrl } from "@/lib/asset-url";
import { rodiumRechargeUrl } from "@/lib/constants/rodium-links";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { fetchProjectAssets, type ProjectAsset } from "@/lib/prompt-upload";
import { getSessionSnapshot } from "@/lib/session-cache";
import type { ImageSelection } from "./types";

type Props = {
  projectId: string;
  selection: ImageSelection | null;
  onClose: () => void;
  onReplaced: () => void;
};

type Tab = "free" | "import" | "ai";
type StockType = "photo" | "illustration" | "vector";

export type StockImage = {
  id: string;
  previewUrl: string;
  width: number;
  height: number;
  author: string;
  pageUrl: string;
  tags?: string;
  source: "pixabay";
};

type StockPage = { hits: StockImage[]; total: number; page: number; hasMore: boolean };

/** A file the API just wrote into the project (import or generation). */
export type ProjectImage = { path: string; public_path: string; width: number; height: number };

type ImageModel = { slug: string; label: string; default: boolean };

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
const ASPECTS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
type Aspect = (typeof ASPECTS)[number];

/**
 * Replace the selected preview image from one of three sources: free images
 * (Pixabay, the default tab, no credit spent), the project's own files and
 * uploads, or an AI image billed by RodiumAi.
 */
export function ImageEditPanel({ projectId, selection, onClose, onReplaced }: Props) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Tab>("free");
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(() => selection?.alt?.trim() ?? "");
  const [stockType, setStockType] = useState<StockType>("photo");
  const [stock, setStock] = useState<StockPage | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchUnavailable, setSearchUnavailable] = useState(false);

  const [models, setModels] = useState<ImageModel[] | null>(null);
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [noCredits, setNoCredits] = useState(false);

  const load = useCallback(async () => {
    try {
      setAssets(await fetchProjectAssets(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab !== "ai" || models) return;
    let alive = true;
    api<ImageModel[]>("/images/models")
      .then((rows) => {
        if (!alive) return;
        setModels(rows);
        setModel((current) => current || rows.find((row) => row.default)?.slug || rows[0]?.slug || "");
      })
      .catch(() => {
        if (alive) setModels([]);
      });
    return () => {
      alive = false;
    };
  }, [tab, models]);

  async function applyUrl(publicUrl: string, objectId?: string) {
    if (!selection?.src) {
      setError(t("imagePickHint"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/visual-image`, {
        method: "POST",
        body: JSON.stringify({
          old_src: selection.src,
          new_public_path: publicUrl,
          // With the id, the API copies the bytes into the project's public/
          // and writes a relative /images/... src. The raw object-store URL
          // points at a private bucket: 403 in the preview, broken at
          // publish/export.
          object_id: objectId ?? null,
        }),
      });
      onReplaced();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      headers.set(
        "Accept-Language",
        localStorage.getItem("forge_locale") === "en" ? "en" : "fr",
      );
      const res = await fetch(`${apiBase()}/projects/${projectId}/files/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);
      }
      const data = (await res.json()) as { public_url?: string; object_id?: string };
      await load();
      if (selection?.src && data.public_url) {
        await applyUrl(data.public_url, data.object_id);
      } else {
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setBusy(false);
    }
  }

  async function runSearch(page: number) {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, type: stockType, lang: locale, page: String(page) });
      const next = await api<StockPage>(`/images/search?${params.toString()}`);
      setStock((prev) => (page > 1 && prev ? { ...next, hits: [...prev.hits, ...next.hits] } : next));
    } catch (err) {
      if (err instanceof ApiError && err.code === "IMAGE_SEARCH_UNAVAILABLE") setSearchUnavailable(true);
      else setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setSearching(false);
    }
  }

  function onSearch(event: FormEvent) {
    event.preventDefault();
    void runSearch(1);
  }

  async function pickStock(hit: StockImage) {
    if (!selection?.src) {
      setError(t("imagePickHint"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Pixabay forbids hotlinking: the API copies the image into the project first.
      const imported = await api<ProjectImage>(`/projects/${projectId}/images/import`, {
        method: "POST",
        body: JSON.stringify({ source: hit.source, id: hit.id }),
      });
      await applyUrl(imported.public_path);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setBusy(false);
    }
  }

  async function onGenerate(event: FormEvent) {
    event.preventDefault();
    if (!selection?.src) {
      setError(t("imagePickHint"));
      return;
    }
    if (!prompt.trim()) return;
    setBusy(true);
    setError(null);
    setNoCredits(false);
    try {
      const generated = await api<ProjectImage>(`/projects/${projectId}/images/generate`, {
        method: "POST",
        body: JSON.stringify({ model: model || null, prompt: prompt.trim(), aspect, target: selection.src }),
        // Image models can take a couple of minutes.
        timeoutMs: 200_000,
      });
      await applyUrl(generated.public_path);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "INSUFFICIENT_CREDITS" || err.code === "INSUFFICIENT_RODI")) {
        setNoCredits(true);
      } else {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
      setBusy(false);
    }
  }

  return (
    <aside className="preview-side-panel" aria-label={t("imagePanelTitle")}>
      <header className="preview-side-panel-head">
        <h3>{t("imagePanelTitle")}</h3>
        <button type="button" className="preview-side-panel-close" onClick={onClose} title={t("close")}>
          <Icon icon={X} className="ui-icon-sm" />
        </button>
      </header>
      {selection ? (
        <div className="image-panel-current">
          <p className="comments-anchor">
            {t("imageSelected")} <code>{selection.selector || "img"}</code>
          </p>
          <img
            // Root-path srcs live in the project's public/ — unreachable from
            // the builder origin without the authenticated endpoint. Never use
            // raw forge-uploads URLs: that bucket is private (AccessDenied).
            src={
              selection.src.startsWith("/")
                ? (projectPublicUrl(projectId, selection.src) ?? selection.src)
                : selection.src.includes("/forge-uploads/")
                  ? ""
                  : selection.src
            }
            alt={selection.alt || ""}
            className="image-panel-preview"
          />
        </div>
      ) : (
        <p className="comments-anchor muted">{t("imagePickHint")}</p>
      )}
      <div className="image-panel-tabs" role="tablist" aria-label={t("imageTabsAria")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`image-panel-tab${tab === item.id ? " active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      {error && <p className="builder-pane-error">{error}</p>}

      {tab === "free" && (
        <div role="tabpanel">
          {searchUnavailable ? (
            <p className="comments-empty">{t("imageSearchUnavailable")}</p>
          ) : (
            <>
              <form className="image-panel-search" onSubmit={onSearch}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("imageSearchPlaceholder")}
                  aria-label={t("imageSearchPlaceholder")}
                  maxLength={100}
                />
                <select
                  value={stockType}
                  onChange={(e) => setStockType(e.target.value as StockType)}
                  aria-label={t("imageSearch")}
                >
                  {STOCK_TYPES.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(item.labelKey)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="btn"
                  disabled={searching || !query.trim()}
                  title={t("imageSearch")}
                  aria-label={t("imageSearch")}
                >
                  <Icon icon={Search} className="ui-icon-sm" />
                </button>
              </form>
              {stock && stock.hits.length === 0 && <p className="comments-empty">{t("imageSearchEmpty")}</p>}
              {stock && stock.hits.length > 0 && (
                <ul className="image-panel-stock-grid">
                  {stock.hits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="image-panel-stock"
                        disabled={busy || !selection}
                        title={hit.author ? `${hit.tags ?? ""} (${hit.author})` : hit.tags}
                        onClick={() => void pickStock(hit)}
                      >
                        <img src={hit.previewUrl} alt={hit.tags ?? ""} loading="lazy" referrerPolicy="no-referrer" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {stock?.hasMore && (
                <div className="image-panel-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={searching}
                    onClick={() => void runSearch(stock.page + 1)}
                  >
                    {t("imageLoadMore")}
                  </button>
                </div>
              )}
              <p className="image-panel-credit">
                <a href="https://pixabay.com/" target="_blank" rel="noreferrer">
                  {t("imageCreditPixabay")}
                </a>
              </p>
            </>
          )}
        </div>
      )}

      {tab === "import" && (
        <div role="tabpanel">
          <div className="image-panel-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.ico,image/x-icon,image/vnd.microsoft.icon"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Icon icon={Upload} className="ui-icon-sm" />
              {t("imageImport")}
            </button>
          </div>
          <p className="image-panel-section-label">{t("imageFromFiles")}</p>
          <ul className="image-panel-grid">
            {assets.length === 0 ? (
              <li className="comments-empty">{t("filesEmpty")}</li>
            ) : (
              assets.map((asset) => {
                // Prefer the authenticated proxy: public_url hits a private bucket.
                const thumbUrl = assetContentUrl(projectId, asset.id);
                return (
                  <li key={asset.id}>
                    <button
                      type="button"
                      className="image-panel-thumb"
                      disabled={busy || !selection || !thumbUrl}
                      title={asset.name}
                      onClick={() => void applyUrl(asset.public_url, asset.id)}
                    >
                      {thumbUrl ? <img src={thumbUrl} alt={asset.name} /> : null}
                      <span>{asset.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {tab === "ai" && (
        <form role="tabpanel" className="image-panel-ai" onSubmit={onGenerate}>
          <label>
            <span>{t("imageAiModel")}</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!models?.length}>
              {(models ?? []).map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("imageAiPrompt")}</span>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={4000} />
          </label>
          <label>
            <span>{t("imageAiAspect")}</span>
            <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)}>
              {ASPECTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {noCredits && (
            <p className="builder-pane-error" role="alert">
              {t("imageAiInsufficient")}{" "}
              <a
                href={rodiumRechargeUrl(getSessionSnapshot()?.profile?.rodium_sub)}
                target="_blank"
                rel="noreferrer"
              >
                {t("rechargeRodi")}
              </a>
            </p>
          )}
          <button type="submit" className="btn" disabled={busy || !selection || !prompt.trim()}>
            <Icon icon={Sparkles} className="ui-icon-sm" />
            {busy ? t("imageAiGenerating") : t("imageAiGenerate")}
          </button>
          <p className="image-panel-credit">{t("imageAiBilled")}</p>
        </form>
      )}
    </aside>
  );
}

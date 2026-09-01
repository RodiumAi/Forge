"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save, Sparkles, Upload } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { SeoCropModal } from "@/components/builder/SeoCropModal";

export type SeoMeta = {
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  robots: string;
  favicon_path: string | null;
  apple_touch_path: string | null;
  og_image_path: string | null;
  og_title: string;
  og_description: string;
  og_type: string;
  twitter_card: string;
  twitter_title: string;
  twitter_description: string;
  twitter_image_path: string | null;
};

type Props = {
  projectId: string;
  onOk: (msg: string) => void;
  onError: (msg: string) => void;
};

const EMPTY: SeoMeta = {
  title: "",
  description: "",
  keywords: "",
  canonical: "",
  robots: "index, follow",
  favicon_path: null,
  apple_touch_path: null,
  og_image_path: null,
  og_title: "",
  og_description: "",
  og_type: "website",
  twitter_card: "summary_large_image",
  twitter_title: "",
  twitter_description: "",
  twitter_image_path: null,
};

function assetUrl(projectId: string, path: string | null | undefined, bust: number): string | null {
  return projectPublicUrl(projectId, path, bust);
}

export function SeoOptionsSection({ projectId, onOk, onError }: Props) {
  const { t, locale } = useI18n();
  const [meta, setMeta] = useState<SeoMeta>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imageBrief, setImageBrief] = useState("");
  const [bust, setBust] = useState(Date.now());
  const [cropKind, setCropKind] = useState<"favicon" | "og" | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const favInputRef = useRef<HTMLInputElement>(null);
  const ogInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api<SeoMeta>(`/projects/${projectId}/seo`)
      .then((res) => {
        if (!cancelled) {
          setMeta({ ...EMPTY, ...res });
          setBust(Date.now());
        }
      })
      .catch((err) => {
        if (!cancelled) onError(err instanceof Error ? err.message : t("errorGeneric"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per project
  }, [projectId]);

  function patch<K extends keyof SeoMeta>(key: K, value: SeoMeta[K]) {
    setMeta((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const saved = await api<SeoMeta>(`/projects/${projectId}/seo`, {
        method: "PUT",
        body: JSON.stringify(meta),
      });
      setMeta({ ...EMPTY, ...saved });
      setBust(Date.now());
      onOk(t("optionsSeoSaved"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function fillWithAi() {
    setAiBusy(true);
    try {
      const filled = await api<SeoMeta>(`/projects/${projectId}/seo/generate-copy`, {
        method: "POST",
        body: JSON.stringify({ locale }),
      });
      setMeta((prev) => ({
        ...prev,
        title: filled.title || prev.title,
        description: filled.description || prev.description,
        keywords: filled.keywords || prev.keywords,
        robots: filled.robots || prev.robots,
        og_title: filled.og_title || prev.og_title,
        og_description: filled.og_description || prev.og_description,
        twitter_title: filled.twitter_title || prev.twitter_title,
        twitter_description: filled.twitter_description || prev.twitter_description,
      }));
      onOk(t("optionsSeoAiFilled"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setAiBusy(false);
    }
  }

  async function generateOgImage() {
    setImgBusy(true);
    try {
      const res = await api<{
        meta?: SeoMeta;
        og_image_path?: string | null;
        twitter_image_path?: string | null;
      }>(`/projects/${projectId}/seo/generate-image`, {
        method: "POST",
        body: JSON.stringify({ prompt: imageBrief.trim() || null }),
      });
      if (res.meta) {
        setMeta({ ...EMPTY, ...res.meta });
      } else {
        setMeta((prev) => ({
          ...prev,
          og_image_path: res.og_image_path ?? prev.og_image_path,
          twitter_image_path: res.twitter_image_path ?? prev.twitter_image_path,
        }));
      }
      setBust(Date.now());
      onOk(t("optionsSeoImageGenerated"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setImgBusy(false);
    }
  }

  function onPickFile(kind: "favicon" | "og", file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropKind(kind);
    setCropSrc(url);
  }

  async function uploadCropped(blob: Blob) {
    if (!cropKind) return;
    const form = new FormData();
    form.append("kind", cropKind);
    form.append("file", blob, cropKind === "favicon" ? "favicon.png" : "og-image.png");
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept-Language", locale === "en" ? "en" : "fr");
    try {
      const res = await fetch(`${apiBase()}/projects/${projectId}/seo/assets`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);
      }
      const data = (await res.json()) as {
        meta?: SeoMeta;
        favicon_path?: string;
        apple_touch_path?: string;
        og_image_path?: string;
        twitter_image_path?: string;
      };
      if (data.meta) setMeta({ ...EMPTY, ...data.meta });
      else {
        setMeta((prev) => ({
          ...prev,
          ...(data.favicon_path ? { favicon_path: data.favicon_path } : {}),
          ...(data.apple_touch_path ? { apple_touch_path: data.apple_touch_path } : {}),
          ...(data.og_image_path ? { og_image_path: data.og_image_path } : {}),
          ...(data.twitter_image_path ? { twitter_image_path: data.twitter_image_path } : {}),
        }));
      }
      setBust(Date.now());
      onOk(t("optionsSeoAssetUploaded"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
      setCropKind(null);
    }
  }

  const favUrl = assetUrl(projectId, meta.favicon_path, bust);
  const appleUrl = assetUrl(projectId, meta.apple_touch_path, bust);
  const ogUrl = assetUrl(projectId, meta.og_image_path || meta.twitter_image_path, bust);

  if (loading) {
    return <p className="options-help">{t("loading")}</p>;
  }

  return (
    <>
      <form className="options-card options-stack options-seo" onSubmit={(e) => void save(e)}>
        <div className="options-seo-actions-top">
          <button
            type="button"
            className="btn"
            disabled={aiBusy || busy}
            onClick={() => void fillWithAi()}
          >
            <Icon icon={aiBusy ? Loader2 : Sparkles} className={`ui-icon-sm ${aiBusy ? "agent-spin" : ""}`} />
            {aiBusy ? t("optionsSeoAiFilling") : t("optionsSeoFillAi")}
          </button>
        </div>

        <div className="options-field">
          <label htmlFor="seo-title">{t("optionsSeoTitle")}</label>
          <input
            id="seo-title"
            value={meta.title}
            onChange={(e) => patch("title", e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="options-field">
          <label htmlFor="seo-description">{t("optionsSeoDescription")}</label>
          <textarea
            id="seo-description"
            className="options-seo-textarea"
            value={meta.description}
            onChange={(e) => patch("description", e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
        <div className="options-field">
          <label htmlFor="seo-keywords">{t("optionsSeoKeywords")}</label>
          <input
            id="seo-keywords"
            value={meta.keywords}
            onChange={(e) => patch("keywords", e.target.value)}
            placeholder={t("optionsSeoKeywordsPh")}
          />
        </div>
        <div className="options-field">
          <label htmlFor="seo-canonical">{t("optionsSeoCanonical")}</label>
          <input
            id="seo-canonical"
            value={meta.canonical}
            onChange={(e) => patch("canonical", e.target.value)}
            placeholder="https://"
          />
        </div>
        <div className="options-field">
          <label htmlFor="seo-robots">{t("optionsSeoRobots")}</label>
          <select
            id="seo-robots"
            value={meta.robots}
            onChange={(e) => patch("robots", e.target.value)}
          >
            <option value="index, follow">index, follow</option>
            <option value="noindex, follow">noindex, follow</option>
            <option value="index, nofollow">index, nofollow</option>
            <option value="noindex, nofollow">noindex, nofollow</option>
          </select>
        </div>

        <div className="options-seo-block">
          <h4>{t("optionsSeoFavicon")}</h4>
          <p className="options-help">{t("optionsSeoFaviconHelp")}</p>
          <div className="options-seo-fav-previews">
            {favUrl ? <img src={favUrl} alt="" width={32} height={32} className="seo-fav-32" /> : null}
            {appleUrl ? (
              <img src={appleUrl} alt="" width={64} height={64} className="seo-fav-180" />
            ) : null}
            {!favUrl && !appleUrl ? <span className="muted">{t("optionsSeoNoImage")}</span> : null}
          </div>
          <input
            ref={favInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              onPickFile("favicon", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => favInputRef.current?.click()}
          >
            <Icon icon={Upload} className="ui-icon-sm" />
            {t("optionsSeoUploadFavicon")}
          </button>
        </div>

        <div className="options-seo-block">
          <h4>{t("optionsSeoSocial")}</h4>
          <div className="options-field">
            <label htmlFor="seo-og-title">{t("optionsSeoOgTitle")}</label>
            <input
              id="seo-og-title"
              value={meta.og_title}
              onChange={(e) => patch("og_title", e.target.value)}
              placeholder={meta.title || t("optionsSeoFromTitle")}
            />
          </div>
          <div className="options-field">
            <label htmlFor="seo-og-desc">{t("optionsSeoOgDescription")}</label>
            <textarea
              id="seo-og-desc"
              className="options-seo-textarea"
              value={meta.og_description}
              onChange={(e) => patch("og_description", e.target.value)}
              rows={2}
              placeholder={meta.description || t("optionsSeoFromDescription")}
            />
          </div>
          <div className="options-field">
            <label htmlFor="seo-tw-card">{t("optionsSeoTwitterCard")}</label>
            <select
              id="seo-tw-card"
              value={meta.twitter_card}
              onChange={(e) => patch("twitter_card", e.target.value)}
            >
              <option value="summary_large_image">summary_large_image</option>
              <option value="summary">summary</option>
            </select>
          </div>
          <div className="options-field">
            <label htmlFor="seo-tw-title">{t("optionsSeoTwitterTitle")}</label>
            <input
              id="seo-tw-title"
              value={meta.twitter_title}
              onChange={(e) => patch("twitter_title", e.target.value)}
            />
          </div>
          <div className="options-field">
            <label htmlFor="seo-tw-desc">{t("optionsSeoTwitterDescription")}</label>
            <textarea
              id="seo-tw-desc"
              className="options-seo-textarea"
              value={meta.twitter_description}
              onChange={(e) => patch("twitter_description", e.target.value)}
              rows={2}
            />
          </div>

          <p className="options-help">{t("optionsSeoOgImageHelp")}</p>
          <div className="options-seo-og-preview">
            {ogUrl ? <img src={ogUrl} alt="" /> : <span className="muted">{t("optionsSeoNoImage")}</span>}
          </div>
          <input
            ref={ogInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => {
              onPickFile("og", e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="options-actions options-seo-og-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => ogInputRef.current?.click()}
            >
              <Icon icon={Upload} className="ui-icon-sm" />
              {t("optionsSeoUploadOg")}
            </button>
          </div>
          <div className="options-field">
            <label htmlFor="seo-img-brief">{t("optionsSeoImageBrief")}</label>
            <input
              id="seo-img-brief"
              value={imageBrief}
              onChange={(e) => setImageBrief(e.target.value)}
              placeholder={t("optionsSeoImageBriefPh")}
            />
          </div>
          <button
            type="button"
            className="btn"
            disabled={imgBusy || busy}
            onClick={() => void generateOgImage()}
          >
            <Icon icon={imgBusy ? Loader2 : ImagePlus} className={`ui-icon-sm ${imgBusy ? "agent-spin" : ""}`} />
            {imgBusy ? t("optionsSeoGeneratingImage") : t("optionsSeoGenerateImage")}
          </button>
        </div>

        <div className="options-actions">
          <button type="submit" className="btn" disabled={busy}>
            <Icon icon={Save} className="ui-icon-sm" />
            {t("save")}
          </button>
        </div>
      </form>

      {cropSrc && cropKind && (
        <SeoCropModal
          open
          imageSrc={cropSrc}
          aspect={cropKind === "favicon" ? 1 : 1200 / 630}
          title={cropKind === "favicon" ? t("optionsSeoCropFavicon") : t("optionsSeoCropOg")}
          onCancel={() => {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
            setCropKind(null);
          }}
          onConfirm={(blob) => void uploadCropped(blob)}
        />
      )}
    </>
  );
}

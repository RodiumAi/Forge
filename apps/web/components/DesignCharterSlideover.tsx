"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { ImagePlus, Palette, X } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { getMediaToken } from "@/lib/media-token";
import {
  hexForColorInput,
  mergePalettes,
  parseCharterPalette,
  parseCharterTone,
  type CharterPalette,
} from "@/lib/design-charter";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  /** Soft-refresh preview after CSS tokens change. */
  onColorsApplied?: () => void;
};

type CharterOut = {
  path: string;
  markdown: string | null;
  brief: string | null;
  exists: boolean;
  logo_path?: string | null;
  palette?: CharterPalette[];
};

type UploadResponse = {
  object_id: string;
  public_url: string;
  content_type: string;
  name: string;
};

type ColorPatchResponse = {
  markdown: string;
  css_updated: boolean;
  palette: CharterPalette[];
};

const LOGO_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";
const LOGO_MAX_BYTES = 8 * 1024 * 1024;

function persistedLogoUrl(projectId: string, logoPath: string | null, bust: number): string | null {
  if (!logoPath) return null;
  const token = getMediaToken();
  if (!token) return null;
  return `${apiBase()}/projects/${projectId}/design-charter/logo?access_token=${encodeURIComponent(token)}&v=${bust}`;
}

export function DesignCharterSlideover({ projectId, open, onClose, onColorsApplied }: Props) {
  const { t, locale } = useI18n();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [brief, setBrief] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [existingLogoPath, setExistingLogoPath] = useState<string | null>(null);
  const [logoBust, setLogoBust] = useState(0);
  const [markdown, setMarkdown] = useState("");
  const [paletteOverride, setPaletteOverride] = useState<CharterPalette[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [colorBusy, setColorBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [colorSaved, setColorSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaved(false);
    setColorSaved(false);
    setLogoFile(null);
    setPaletteOverride(null);
    void api<CharterOut>(`/projects/${projectId}/design-charter`)
      .then((data) => {
        setBrief(data.brief || "");
        setMarkdown(data.markdown || "");
        setExistingLogoPath(data.logo_path || null);
        if (data.palette?.length) setPaletteOverride(data.palette);
        if (data.logo_path) setLogoBust(Date.now());
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("errorGeneric")));
  }, [open, projectId, t]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    };
  }, [open, onClose]);

  const existingLogoPreview = useMemo(
    () => persistedLogoUrl(projectId, existingLogoPath, logoBust),
    [projectId, existingLogoPath, logoBust],
  );
  const parsedPalette = useMemo(() => parseCharterPalette(markdown), [markdown]);
  const palette = paletteOverride ?? parsedPalette;
  const tone = useMemo(() => parseCharterTone(markdown), [markdown]);

  if (!open) return null;

  function onPickLogo(file: File | null) {
    setError(null);
    if (!file) {
      setLogoFile(null);
      return;
    }
    const lower = file.name.toLowerCase();
    const okType =
      file.type === "image/png" ||
      file.type === "image/jpeg" ||
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg");
    if (!okType) {
      setError(t("designLogoInvalidType"));
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      setError(t("designLogoTooLarge"));
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setLogoFile(file);
  }

  async function uploadLogo(file: File): Promise<UploadResponse> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${apiBase()}/projects/${projectId}/files/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Accept-Language": locale,
      },
      body: fd,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(detail || t("designLogoUploadFailed"));
    }
    return (await res.json()) as UploadResponse;
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const hasLogo = Boolean(logoFile || existingLogoPath);
    const hasBrief = brief.trim().length >= 8;
    if (!hasLogo && !hasBrief) {
      setError(t("designGenerateNeedInput"));
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let logo_object_id: string | null = null;
      if (logoFile) {
        const uploaded = await uploadLogo(logoFile);
        logo_object_id = uploaded.object_id;
      }
      const res = await api<{ markdown: string; brief: string; logo_path?: string | null }>(
        `/projects/${projectId}/design-charter`,
        {
          method: "POST",
          body: JSON.stringify({
            brief: brief.trim() || "Generate a complete graphic charter from the brand logo.",
            logo_object_id,
            logo_path: existingLogoPath,
          }),
        },
      );
      setMarkdown(res.markdown);
      setPaletteOverride(null);
      if (res.brief) setBrief(res.brief);
      if (res.logo_path) {
        setExistingLogoPath(res.logo_path);
        setLogoBust(Date.now());
      }
      setLogoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  async function onSaveMarkdown() {
    if (!markdown.trim() || busy) return;
    if (markdown.trim().length < 20) {
      setError(t("designContentTooShort"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/design-charter`, {
        method: "PUT",
        body: JSON.stringify({
          markdown: markdown.trim(),
          brief: brief.trim() || "Manual DESIGN.md paste",
        }),
      });
      setPaletteOverride(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function queueColorChange(name: string, hex: string) {
    const nextHex = hexForColorInput(hex);
    setPaletteOverride((prev) => {
      const base = prev ?? parseCharterPalette(markdown);
      return mergePalettes(
        base.map((c) => (c.name === name ? { ...c, hex: nextHex } : c)),
        [],
      );
    });
    setColorSaved(false);
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => {
      void commitColorChange(name, nextHex);
    }, 280);
  }

  async function commitColorChange(name: string, hex: string) {
    setColorBusy(name);
    setError(null);
    try {
      const res = await api<ColorPatchResponse>(`/projects/${projectId}/design-charter/colors`, {
        method: "PATCH",
        body: JSON.stringify({ name, hex }),
      });
      setMarkdown(res.markdown);
      if (res.palette?.length) setPaletteOverride(res.palette);
      setColorSaved(true);
      onColorsApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("designColorFailed"));
    } finally {
      setColorBusy(null);
    }
  }

  const canGenerate =
    !busy && (Boolean(logoFile || existingLogoPath) || brief.trim().length >= 8);
  const canSave = !busy && markdown.trim().length >= 20;
  const displayPreview = logoPreviewUrl || existingLogoPreview;

  return (
    <div className="design-slideover-root">
      <button
        type="button"
        className="design-slideover-backdrop"
        aria-label={t("close")}
        onClick={onClose}
      />
      <aside
        className="design-slideover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-slideover-title"
      >
        <header className="design-slideover-head">
          <div className="design-slideover-title-row">
            <span className="design-slideover-icon" aria-hidden>
              <Icon icon={Palette} className="ui-icon-sm" />
            </span>
            <div>
              <h2 id="design-slideover-title">{t("designTitle")}</h2>
              <p>{t("designSub")}</p>
            </div>
          </div>
          <button
            type="button"
            className="builder-toolbar-btn builder-toolbar-btn-icon"
            onClick={onClose}
            aria-label={t("close")}
          >
            <Icon icon={X} className="ui-icon-md" />
          </button>
        </header>

        <div className="design-slideover-body">
          {error && (
            <div className="builder-error" role="alert">
              {error}
            </div>
          )}
          {saved && <p className="design-saved">{t("designSaved")}</p>}
          {colorSaved && !saved ? (
            <p className="design-saved">{t("designColorUpdated")}</p>
          ) : null}

          <form className="design-form" onSubmit={onGenerate}>
            <div className="design-label">
              <span>{t("designLogoFile")}</span>
              <p className="design-logo-hint">{t("designLogoHint")}</p>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                accept={LOGO_ACCEPT}
                className="design-logo-input"
                disabled={busy}
                onChange={(e) => onPickLogo(e.target.files?.[0] ?? null)}
              />
              <label htmlFor={fileInputId} className="design-logo-drop">
                {displayPreview ? (
                  <>
                    <img src={displayPreview} alt="" className="design-logo-preview" />
                    <span className="design-logo-filename">
                      {logoFile?.name || existingLogoPath || t("designLogoChoose")}
                    </span>
                  </>
                ) : (
                  <span className="design-logo-drop-inner">
                    <Icon icon={ImagePlus} className="ui-icon-md" />
                    <span>
                      {existingLogoPath ? t("designLogoReplace") : t("designLogoChoose")}
                    </span>
                    {existingLogoPath ? (
                      <span className="design-logo-existing">{existingLogoPath}</span>
                    ) : null}
                  </span>
                )}
              </label>
              {logoFile ? (
                <button
                  type="button"
                  className="btn btn-ghost design-logo-clear"
                  disabled={busy}
                  onClick={() => {
                    setLogoFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  {t("designLogoClear")}
                </button>
              ) : null}
            </div>

            <label className="design-label">
              {t("designBrief")}
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder={t("designBriefPlaceholder")}
                disabled={busy}
              />
            </label>

            <button type="submit" className="btn" disabled={!canGenerate}>
              {busy ? t("designGenerating") : t("designGenerate")}
            </button>
          </form>

          <div className="design-preview">
            {palette.length > 0 && (
              <div className="design-palette-block">
                <p className="design-logo-hint">{t("designPaletteHint")}</p>
                <div className="design-palette" aria-label={t("designPalette")}>
                  {palette.map((c) => {
                    const inputHex = hexForColorInput(c.hex);
                    const updating = colorBusy === c.name;
                    return (
                      <label
                        key={c.name}
                        className={`design-swatch design-swatch-editable${updating ? " is-busy" : ""}`}
                        title={`--${c.name}: ${c.hex}`}
                      >
                        <span className="design-swatch-picker-wrap">
                          <input
                            type="color"
                            className="design-swatch-picker"
                            value={inputHex}
                            disabled={busy || Boolean(colorBusy)}
                            aria-label={`--${c.name}`}
                            onChange={(e) => queueColorChange(c.name, e.target.value)}
                          />
                          <i style={{ background: c.hex }} aria-hidden />
                        </span>
                        <small>
                          {c.name} · {updating ? t("designColorUpdating") : c.hex}
                        </small>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            {tone && <p className="design-tone">{tone}</p>}
            <label className="design-label">
              {t("designContent")}
              <p className="design-logo-hint">{t("designContentHint")}</p>
              <textarea
                value={markdown}
                onChange={(e) => {
                  setMarkdown(e.target.value);
                  setPaletteOverride(null);
                  setSaved(false);
                }}
                rows={14}
                placeholder={t("designContentPlaceholder")}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void onSaveMarkdown()}
              disabled={!canSave}
            >
              {t("designSaveMd")}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** @deprecated Prefer DesignCharterSlideover */
export const DesignCharterModal = DesignCharterSlideover;

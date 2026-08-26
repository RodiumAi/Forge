"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { assetContentUrl } from "@/lib/asset-url";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { fetchProjectAssets, type ProjectAsset } from "@/lib/prompt-upload";
import type { ImageSelection } from "./types";

type Props = {
  projectId: string;
  selection: ImageSelection | null;
  onClose: () => void;
  onReplaced: () => void;
};

export function ImageEditPanel({ projectId, selection, onClose, onReplaced }: Props) {
  const { t } = useI18n();
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      setAssets(await fetchProjectAssets(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function applyUrl(publicUrl: string) {
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
      const data = (await res.json()) as { public_url?: string };
      await load();
      if (selection?.src && data.public_url) {
        await applyUrl(data.public_url);
      } else {
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
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
          { }
          <img src={selection.src} alt={selection.alt || ""} className="image-panel-preview" />
        </div>
      ) : (
        <p className="comments-anchor muted">{t("imagePickHint")}</p>
      )}
      {error && <p className="builder-pane-error">{error}</p>}
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
            const thumbUrl = assetContentUrl(projectId, asset.id) ?? asset.public_url;
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  className="image-panel-thumb"
                  disabled={busy || !selection}
                  title={asset.name}
                  onClick={() => void applyUrl(asset.public_url)}
                >
                  { }
                  <img src={thumbUrl} alt={asset.name} />
                  <span>{asset.name}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}

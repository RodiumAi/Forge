"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { collectPublicImages, type FileNode, type ImageSelection } from "./types";

type Props = {
  projectId: string;
  selection: ImageSelection | null;
  onClose: () => void;
  onReplaced: () => void;
};

export function ImageEditPanel({ projectId, selection, onClose, onReplaced }: Props) {
  const { t } = useI18n();
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const tree = await api<FileNode[]>(`/projects/${projectId}/files`);
      setImages(collectPublicImages(tree));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function applyPath(publicPath: string) {
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
          new_public_path: publicPath,
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
      const data = (await res.json()) as { path: string };
      await load();
      if (selection?.src && data.path) {
        await applyPath(data.path);
      } else {
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
      setBusy(false);
    }
  }

  const thumb = (path: string) => {
    const rel = path.replace(/^public\//i, "");
    return `${apiBase()}/preview/${projectId}/${rel}`;
  };

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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
          accept="image/*"
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
        {images.length === 0 ? (
          <li className="comments-empty">{t("filesEmpty")}</li>
        ) : (
          images.map((path) => (
            <li key={path}>
              <button
                type="button"
                className="image-panel-thumb"
                disabled={busy || !selection}
                title={path}
                onClick={() => void applyPath(path)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(path)} alt={path} />
                <span>{path.replace(/^public\//i, "")}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}

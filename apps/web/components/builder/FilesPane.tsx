"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FileTypeIcon } from "./file-icons";
import { collectPublicImages, type FileNode } from "./types";

type Props = {
  projectId: string;
  onChanged?: () => void;
};

export function FilesPane({ projectId, onChanged }: Props) {
  const { t } = useI18n();
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const tree = await api<FileNode[]>(`/projects/${projectId}/files`);
      setImages(collectPublicImages(tree));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const headers = new Headers();
      headers.set("Authorization", `Bearer ${getToken()}`);
      headers.set("Accept-Language", localStorage.getItem("forge_locale") === "en" ? "en" : "fr");
      const res = await fetch(`${apiBase()}/projects/${projectId}/files/upload`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : res.statusText);
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="builder-files-pane builder-main-pane">
      <header className="builder-pane-head">
        <h2>{t("builderModeFiles")}</h2>
        <label className="btn builder-upload-btn">
          {busy ? <Icon icon={Loader2} className="ui-icon-sm agent-spin" /> : <Icon icon={ImagePlus} className="ui-icon-sm" />}
          {t("filesImportImage")}
          <input type="file" accept="image/*" hidden onChange={(e) => void onUpload(e)} disabled={busy} />
        </label>
      </header>
      {error && <p className="builder-pane-error">{error}</p>}
      {images.length === 0 ? (
        <p className="builder-empty">{t("filesEmpty")}</p>
      ) : (
        <ul className="builder-files-grid">
          {images.map((path) => {
            const publicPath = "/" + path.replace(/^public\//i, "");
            return (
              <li key={path} className="builder-file-card">
                <div className="builder-file-thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${apiBase()}/preview/${projectId}${publicPath}`} alt={path} />
                </div>
                <div className="builder-file-meta">
                  <FileTypeIcon path={path} size="md" />
                  <code>{publicPath}</code>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { api, apiBase, getToken } from "@/lib/api";
import { assetContentUrl } from "@/lib/asset-url";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { FileTypeIcon } from "./file-icons";
import type { ProjectAsset } from "@/lib/prompt-upload";

type Props = {
  projectId: string;
  onChanged?: () => void;
};

export function FilesPane({ projectId, onChanged }: Props) {
  const { t } = useI18n();
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api<ProjectAsset[]>(`/projects/${projectId}/assets`);
      setAssets(list);
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
          <input type="file" accept="image/*,.ico,image/x-icon,image/vnd.microsoft.icon" hidden onChange={(e) => void onUpload(e)} disabled={busy} />
        </label>
      </header>
      {error && <p className="builder-pane-error">{error}</p>}
      {assets.length === 0 ? (
        <p className="builder-empty">{t("filesEmpty")}</p>
      ) : (
        <ul className="builder-files-grid">
          {assets.map((asset) => {
            const viewUrl = assetContentUrl(projectId, asset.id) ?? asset.public_url;
            return (
              <li key={asset.id} className="builder-file-card">
                <a
                  className="builder-file-thumb"
                  href={viewUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={asset.name}
                >
                  {asset.content_type.startsWith("image/") ? (
                     
                    <img src={viewUrl} alt={asset.name} />
                  ) : (
                    <FileTypeIcon path={asset.name} size="md" />
                  )}
                </a>
                <div className="builder-file-meta">
                  <FileTypeIcon path={asset.name} size="md" />
                  <code title={asset.name}>{asset.name}</code>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

/**
 * Project files of a codelab: starter code, solution and images. Upload,
 * delete, download, insert in the current step or offer as a download.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FilePlus2, ImagePlus, Loader2, Package, Trash2 } from "lucide-react";
import { formatBytes } from "../codelab-player";
import { deleteFile, downloadFrom, listFiles, uploadFile, type CodelabFile } from "./api";
import type { Translate } from "./strings";

export const UPLOAD_FOLDERS = [
  { value: "files/starter", key: "folderStarter" },
  { value: "files/solution", key: "folderSolution" },
  { value: "public/images", key: "folderImages" },
] as const;

export function isImage(path: string): boolean {
  return /^public\/.+\.(png|jpe?g|webp|gif|svg|avif)$/i.test(path);
}

export type FilesPanelProps = {
  projectId: string;
  readOnly?: boolean;
  /** Insert Markdown in the selected step (null when no step is open). */
  onInsert: ((markdown: string) => void) | null;
  /** Declare a `files/` path (file or folder) as a download, then insert its block. */
  onOfferDownload: (path: string, zip: boolean) => void;
  /** Bumped by the editor when the AI wrote files. */
  refreshKey: number;
  t: Translate;
  locale: "fr" | "en";
  onError: (message: string) => void;
};

export function FilesPanel({ projectId, readOnly, onInsert, onOfferDownload, refreshKey, t, locale, onError }: FilesPanelProps) {
  const [files, setFiles] = useState<CodelabFile[] | null>(null);
  const [folder, setFolder] = useState<string>(UPLOAD_FOLDERS[0].value);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listFiles(projectId));
    } catch (error) {
      setFiles([]);
      onError(error instanceof Error ? error.message : String(error));
    }
  }, [projectId, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) await uploadFile(projectId, file, folder);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      void refresh();
    }
  };

  const remove = async (path: string) => {
    if (!window.confirm(t("deleteFileConfirm", { path }))) return;
    try {
      await deleteFile(projectId, path);
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
    void refresh();
  };

  const folders = Array.from(
    new Set((files ?? []).filter((f) => f.path.startsWith("files/")).map((f) => f.path.split("/").slice(0, 2).join("/"))),
  );

  return (
    <div className="cle-files">
      {!readOnly ? (
        <div className="cle-files-upload">
          <label>
            {t("folder")}
            <select value={folder} onChange={(e) => setFolder(e.target.value)}>
              {UPLOAD_FOLDERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {t(f.key)}
                </option>
              ))}
            </select>
          </label>
          <input ref={inputRef} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} data-testid="codelab-upload" />
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 size={14} className="cle-spin" /> : <FilePlus2 size={14} />}
            {uploading ? t("uploading") : t("upload")}
          </button>
        </div>
      ) : null}

      {folders.length && !readOnly ? (
        <div className="cle-files-folders">
          {folders.map((path) => (
            <button key={path} type="button" onClick={() => onOfferDownload(path, true)} title={t("addAsDownload")}>
              <Package size={14} /> {path}.zip
            </button>
          ))}
        </div>
      ) : null}

      {files === null ? (
        <p className="cle-hint">
          <Loader2 size={14} className="cle-spin" />
        </p>
      ) : files.length === 0 ? (
        <p className="cle-hint">{t("noFiles")}</p>
      ) : (
        <ul className="cle-file-list">
          {files.map((file) => (
            <li key={file.path}>
              <span className="cle-file-path" title={file.path}>
                {file.path}
              </span>
              <span className="cle-hint">{formatBytes(file.size, locale)}</span>
              <span className="cle-file-actions">
                {onInsert && isImage(file.path) && !readOnly ? (
                  <button type="button" title={t("insertInStep")} aria-label={t("insertInStep")} onClick={() => onInsert(`![](${file.path})\n`)}>
                    <ImagePlus size={14} />
                  </button>
                ) : null}
                {file.path.startsWith("files/") && !readOnly ? (
                  <button type="button" title={t("addAsDownload")} aria-label={t("addAsDownload")} onClick={() => onOfferDownload(file.path, false)}>
                    <Package size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  title={t("downloadFile")}
                  aria-label={t("downloadFile")}
                  onClick={() =>
                    void downloadFrom(`/projects/${projectId}/codelab/files/raw?path=${encodeURIComponent(file.path)}`, file.path.split("/").pop() || "file").catch(
                      (error) => onError(error instanceof Error ? error.message : String(error)),
                    )
                  }
                >
                  <Download size={14} />
                </button>
                {!readOnly ? (
                  <button type="button" title={t("deleteFile")} aria-label={t("deleteFile")} onClick={() => void remove(file.path)}>
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

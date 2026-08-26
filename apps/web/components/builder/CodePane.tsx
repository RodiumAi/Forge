"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, RotateCcw, Save } from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { CodeEditor } from "./CodeEditor";
import { FileTypeIcon } from "./file-icons";
import type { FileNode } from "./types";

type Props = {
  projectId: string;
  onSaved?: (path: string) => void;
  /** File to open on mount / when it changes (deep-link from the chat). */
  openPath?: string | null;
  /** Bumped by the parent whenever the agent writes files, to refresh the tree. */
  filesRevision?: number;
  /** Lets the parent block navigation while the buffer is unsaved. */
  onDirtyChange?: (dirty: boolean) => void;
};

type FileContent = { path: string; content: string; version?: string };

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const name = node.path.split("/").pop() || node.path;

  if (node.type === "dir") {
    return (
      <li role="none">
        <button
          type="button"
          role="treeitem"
          aria-expanded={open}
          aria-level={depth + 1}
          className="code-tree-dir"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon icon={open ? ChevronDown : ChevronRight} className="ui-icon-sm code-tree-chevron" />
          <FileTypeIcon path={node.path} isDir open={open} />
          <span className="code-tree-label">{name}</span>
        </button>
        {open && (
          <ul role="group">
            {(node.children || []).map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li role="none">
      <button
        type="button"
        role="treeitem"
        aria-level={depth + 1}
        aria-selected={selected === node.path}
        className={`code-tree-file${selected === node.path ? " active" : ""}`}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => onSelect(node.path)}
      >
        <span className="code-tree-chevron-spacer" />
        <FileTypeIcon path={node.path} />
        <span className="code-tree-label">{name}</span>
      </button>
    </li>
  );
}

export function CodePane({
  projectId,
  onSaved,
  openPath,
  filesRevision = 0,
  onDirtyChange,
}: Props) {
  const { t } = useI18n();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const dirty = content !== baseline;

  const contentRef = useRef(content);
  const baselineRef = useRef(baseline);
  const selectedRef = useRef(selected);
  const versionRef = useRef(version);
  const dirtyRef = useRef(dirty);
  contentRef.current = content;
  baselineRef.current = baseline;
  selectedRef.current = selected;
  versionRef.current = version;
  dirtyRef.current = dirty;

  /** Guards against out-of-order responses when files are clicked quickly. */
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadTree = useCallback(async () => {
    try {
      const nodes = await api<FileNode[]>(`/projects/${projectId}/files`);
      setTree(nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setTreeLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  // The agent creates and deletes files while this pane is open; without this
  // the tree stayed frozen on its mount-time snapshot.
  useEffect(() => {
    if (filesRevision > 0) void loadTree();
  }, [filesRevision, loadTree]);

  const openFile = useCallback(
    async (path: string, opts?: { force?: boolean }) => {
      if (!opts?.force && dirtyRef.current && selectedRef.current && selectedRef.current !== path) {
        if (!window.confirm(t("codeUnsavedConfirm"))) return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeq.current;

      setError(null);
      setConflict(false);
      setFileLoading(true);
      try {
        const file = await api<FileContent>(
          `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
          { signal: controller.signal },
        );
        // A slower earlier request must never overwrite a newer selection.
        if (seq !== requestSeq.current) return;
        setSelected(path);
        setContent(file.content);
        setBaseline(file.content);
        setVersion(file.version || "");
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        // `selected` is intentionally left untouched: pointing the header at a
        // file we failed to load let a save write the previous file's content
        // into it.
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      } finally {
        if (seq === requestSeq.current) setFileLoading(false);
      }
    },
    [projectId, t],
  );

  // Deep-link from the chat. Re-opening the same path is allowed (the previous
  // ref-based guard made a second click on the same file op a no-op).
  useEffect(() => {
    if (openPath) void openFile(openPath);
  }, [openPath, openFile]);

  const save = useCallback(
    async (opts?: { force?: boolean }) => {
      const path = selectedRef.current;
      const next = contentRef.current;
      if (!path || next === baselineRef.current) return;
      setBusy(true);
      setError(null);
      try {
        const saved = await api<FileContent>(`/projects/${projectId}/files/content`, {
          method: "PUT",
          body: JSON.stringify({
            path,
            content: next,
            version: opts?.force ? "" : versionRef.current,
          }),
        });
        setBaseline(next);
        setVersion(saved.version || "");
        setConflict(false);
        onSaved?.(path);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setConflict(true);
          setError(err.message);
        } else {
          setError(err instanceof Error ? err.message : t("errorGeneric"));
        }
      } finally {
        setBusy(false);
      }
    },
    [onSaved, projectId, t],
  );

  // Closing the tab or navigating away used to drop unsaved edits silently.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  return (
    <section className="builder-code-pane builder-main-pane">
      <aside className="code-tree">
        <header className="builder-pane-head">
          <h2>{t("builderModeCode")}</h2>
        </header>
        {treeLoading ? (
          <ul className="code-tree-skeleton" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} />
            ))}
          </ul>
        ) : tree.length === 0 ? (
          <p className="builder-empty">{t("codeTreeEmpty")}</p>
        ) : (
          <ul className="code-tree-list" role="tree" aria-label={t("builderModeCode")}>
            {tree.map((n) => (
              <TreeItem
                key={n.path}
                node={n}
                depth={0}
                selected={selected}
                onSelect={(p) => void openFile(p)}
              />
            ))}
          </ul>
        )}
      </aside>

      <div className="code-editor">
        <header className="builder-pane-head">
          <div className="code-editor-path">
            {selected ? (
              <>
                <FileTypeIcon path={selected} size="md" />
                <code>{selected}</code>
                {dirty && (
                  <span className="code-dirty-dot" role="status" aria-label={t("codeDirty")} />
                )}
              </>
            ) : (
              <span>{t("codeSelectFile")}</span>
            )}
          </div>
          <button
            type="button"
            className="btn"
            disabled={!dirty || busy || !selected || fileLoading}
            onClick={() => void save()}
          >
            <Icon icon={Save} className="ui-icon-sm" />
            {busy ? t("settingsSaving") : t("codeSave")}
          </button>
        </header>

        {conflict && selected ? (
          <div className="code-conflict" role="alert">
            <p>{error}</p>
            <div className="code-conflict-actions">
              <button type="button" onClick={() => void openFile(selected, { force: true })}>
                <Icon icon={RotateCcw} className="ui-icon-sm" />
                {t("codeConflictReload")}
              </button>
              <button type="button" onClick={() => void save({ force: true })}>
                {t("codeConflictOverwrite")}
              </button>
            </div>
          </div>
        ) : error ? (
          <p className="builder-pane-error" role="alert">
            {error}
          </p>
        ) : null}

        {fileLoading ? (
          <p className="builder-empty">{t("loading")}</p>
        ) : selected ? (
          <CodeEditor
            path={selected}
            value={content}
            onChange={setContent}
            onSave={() => void save()}
          />
        ) : (
          <p className="builder-empty">{t("codeSelectFile")}</p>
        )}
      </div>
    </section>
  );
}

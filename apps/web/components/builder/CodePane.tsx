"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus2,
  Pencil,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { projectPublicUrl } from "@/lib/asset-url";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { CodeEditor } from "./CodeEditor";
import { FileTypeIcon } from "./file-icons";
import { QuickOpen } from "./QuickOpen";
import type { FileNode } from "./types";

// SVG stays out: it is text and belongs in the editor.
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|ico)$/i;

function isImagePath(path: string): boolean {
  return IMAGE_EXT_RE.test(path);
}

type Props = {
  projectId: string;
  onSaved?: (path: string) => void;
  /** File to open on mount / when it changes (deep-link from the chat). */
  openPath?: string | null;
  /** Bumped by the parent whenever the agent writes files, to refresh the tree. */
  filesRevision?: number;
  /** Lets the parent block navigation while a buffer is unsaved. */
  onDirtyChange?: (dirty: boolean) => void;
};

type FileContent = { path: string; content: string; version?: string };

/** One open tab. `content` diverging from `baseline` means unsaved. */
type Tab = {
  path: string;
  content: string;
  baseline: string;
  version: string;
};

const MAX_TABS = 8;

/** Flatten the tree into file paths, for quick-open and for rename targets. */
function flattenFiles(nodes: FileNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.type === "dir") flattenFiles(node.children || [], acc);
    else acc.push(node.path);
  }
  return acc;
}

function TreeItem({
  node,
  depth,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  node: FileNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);
  const name = node.path.split("/").pop() || node.path;

  if (node.type === "dir") {
    return (
      <li role="none">
        <div className="code-tree-row">
        <button
          type="button"
          role="treeitem"
          aria-expanded={open}
          aria-selected={false}
          aria-level={depth + 1}
          className="code-tree-dir"
            style={{ paddingLeft: 8 + depth * 12 }}
            onClick={() => setOpen((v) => !v)}
          >
            <Icon
              icon={open ? ChevronDown : ChevronRight}
              className="ui-icon-sm code-tree-chevron"
            />
            <FileTypeIcon path={node.path} isDir open={open} />
            <span className="code-tree-label">{name}</span>
          </button>
          <TreeActions path={node.path} onRename={onRename} onDelete={onDelete} />
        </div>
        {open && (
          <ul role="group">
            {(node.children || []).map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li role="none">
      <div className="code-tree-row">
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
        <TreeActions path={node.path} onRename={onRename} onDelete={onDelete} />
      </div>
    </li>
  );
}

function TreeActions({
  path,
  onRename,
  onDelete,
}: {
  path: string;
  onRename: (p: string) => void;
  onDelete: (p: string) => void;
}) {
  const { t } = useI18n();
  return (
    <span className="code-tree-actions">
      <button type="button" title={t("codeRename")} aria-label={t("codeRename")} onClick={() => onRename(path)}>
        <Icon icon={Pencil} size={12} />
      </button>
      <button type="button" title={t("delete")} aria-label={t("delete")} onClick={() => onDelete(path)}>
        <Icon icon={Trash2} size={12} />
      </button>
    </span>
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const activeTab = tabs.find((tab) => tab.path === active) || null;
  const dirty = Boolean(activeTab && activeTab.content !== activeTab.baseline);
  const anyDirty = tabs.some((tab) => tab.content !== tab.baseline);

  const tabsRef = useRef(tabs);
  const activeRef = useRef(active);
  const anyDirtyRef = useRef(anyDirty);
  tabsRef.current = tabs;
  activeRef.current = active;
  anyDirtyRef.current = anyDirty;

  /** Guards against out-of-order responses when files are clicked quickly. */
  const requestSeq = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Binary images can't ride the text-content endpoint ("this file is not
  // text"); they get a viewer through the authenticated project-public route.
  const [imageView, setImageView] = useState<string | null>(null);

  const allFiles = useMemo(() => flattenFiles(tree), [tree]);

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
    async (path: string, opts?: { reload?: boolean }) => {
      if (isImagePath(path)) {
        setImageView(path);
        setActive(null);
        setError(null);
        setConflict(false);
        return;
      }
      setImageView(null);
      // Already open and clean: just focus the tab, no refetch.
      const existing = tabsRef.current.find((tab) => tab.path === path);
      if (existing && !opts?.reload) {
        setActive(path);
        setError(null);
        setConflict(false);
        return;
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
        const tab: Tab = {
          path,
          content: file.content,
          baseline: file.content,
          version: file.version || "",
        };
        setTabs((prev) => {
          const without = prev.filter((x) => x.path !== path);
          // Drop the oldest clean tab when the strip is full.
          const trimmed =
            without.length >= MAX_TABS
              ? without.filter((x, i) => i !== without.findIndex((y) => y.content === y.baseline))
              : without;
          return [...trimmed, tab];
        });
        setActive(path);
      } catch (err) {
        if (controller.signal.aborted || seq !== requestSeq.current) return;
        // The active tab is intentionally left untouched: switching the header
        // to a file we failed to load let a save write the previous file's
        // content into it.
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      } finally {
        if (seq === requestSeq.current) setFileLoading(false);
      }
    },
    [projectId, t],
  );

  // Deep-link from the chat.
  useEffect(() => {
    if (openPath) void openFile(openPath);
  }, [openPath, openFile]);

  const closeTab = useCallback(
    (path: string) => {
      const tab = tabsRef.current.find((x) => x.path === path);
      if (tab && tab.content !== tab.baseline && !window.confirm(t("codeUnsavedConfirm"))) return;
      setTabs((prev) => {
        const next = prev.filter((x) => x.path !== path);
        if (activeRef.current === path) {
          setActive(next.length ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [t],
  );

  const updateContent = useCallback((value: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.path === activeRef.current ? { ...tab, content: value } : tab)),
    );
  }, []);

  const save = useCallback(
    async (opts?: { force?: boolean }) => {
      const path = activeRef.current;
      const tab = tabsRef.current.find((x) => x.path === path);
      if (!path || !tab || tab.content === tab.baseline) return;
      setBusy(true);
      setError(null);
      try {
        const saved = await api<FileContent>(`/projects/${projectId}/files/content`, {
          method: "PUT",
          body: JSON.stringify({
            path,
            content: tab.content,
            version: opts?.force ? "" : tab.version,
          }),
        });
        setTabs((prev) =>
          prev.map((x) =>
            x.path === path ? { ...x, baseline: x.content, version: saved.version || "" } : x,
          ),
        );
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

  const createFile = useCallback(async () => {
    const raw = window.prompt(t("codeNewFilePrompt"), "src/components/");
    const path = (raw || "").trim().replace(/^\/+/, "");
    if (!path || path.endsWith("/")) return;
    if (allFiles.includes(path)) {
      setError(t("codeFileExists"));
      return;
    }
    try {
      await api(`/projects/${projectId}/files/content`, {
        method: "PUT",
        body: JSON.stringify({ path, content: "" }),
      });
      await loadTree();
      await openFile(path, { reload: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }, [allFiles, loadTree, openFile, projectId, t]);

  const renameFile = useCallback(
    async (from: string) => {
      const raw = window.prompt(t("codeRenamePrompt"), from);
      const to = (raw || "").trim().replace(/^\/+/, "");
      if (!to || to === from) return;
      try {
        await api(`/projects/${projectId}/files/rename`, {
          method: "POST",
          body: JSON.stringify({ from_path: from, to_path: to }),
        });
        setTabs((prev) => prev.map((x) => (x.path === from ? { ...x, path: to } : x)));
        setActive((cur) => (cur === from ? to : cur));
        await loadTree();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    },
    [loadTree, projectId, t],
  );

  const deleteFile = useCallback(
    async (path: string) => {
      if (!window.confirm(t("codeDeleteConfirm").replace("{path}", path))) return;
      try {
        await api(`/projects/${projectId}/files?path=${encodeURIComponent(path)}`, {
          method: "DELETE",
        });
        setTabs((prev) => {
          const next = prev.filter((x) => x.path !== path);
          if (activeRef.current === path) setActive(next.length ? next[next.length - 1].path : null);
          return next;
        });
        await loadTree();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errorGeneric"));
      }
    },
    [loadTree, projectId, t],
  );

  // Closing the tab or navigating away used to drop unsaved edits silently.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!anyDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // Ctrl/Cmd+P anywhere in the pane, not just inside Monaco.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setQuickOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="builder-code-pane builder-main-pane">
      <aside className="code-tree">
        <header className="builder-pane-head">
          <h2>{t("builderModeCode")}</h2>
          <span className="code-tree-tools">
            <button
              type="button"
              title={t("codeQuickOpen")}
              aria-label={t("codeQuickOpen")}
              onClick={() => setQuickOpen(true)}
            >
              <Icon icon={Search} size={14} />
            </button>
            <button
              type="button"
              title={t("codeNewFile")}
              aria-label={t("codeNewFile")}
              onClick={() => void createFile()}
            >
              <Icon icon={FilePlus2} size={14} />
            </button>
          </span>
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
                selected={active}
                onSelect={(p) => void openFile(p)}
                onRename={(p) => void renameFile(p)}
                onDelete={(p) => void deleteFile(p)}
              />
            ))}
          </ul>
        )}
      </aside>

      <div className="code-editor">
        {tabs.length > 0 && (
          <div className="code-tabs" role="tablist" aria-label={t("builderModeCode")}>
            {tabs.map((tab) => {
              const tabDirty = tab.content !== tab.baseline;
              const name = tab.path.split("/").pop() || tab.path;
              return (
                <div
                  key={tab.path}
                  className={`code-tab${tab.path === active ? " active" : ""}`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab.path === active}
                    title={tab.path}
                    onClick={() => void openFile(tab.path)}
                  >
                    <FileTypeIcon path={tab.path} />
                    <span>{name}</span>
                    {tabDirty ? <span className="code-tab-dot" aria-hidden="true" /> : null}
                  </button>
                  <button
                    type="button"
                    className="code-tab-close"
                    aria-label={t("close")}
                    onClick={() => closeTab(tab.path)}
                  >
                    <Icon icon={X} size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <header className="builder-pane-head">
          <div className="code-editor-path">
            {imageView ? (
              <>
                <FileTypeIcon path={imageView} size="md" />
                <code>{imageView}</code>
              </>
            ) : active ? (
              <>
                <FileTypeIcon path={active} size="md" />
                <code>{active}</code>
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
            disabled={!dirty || busy || !active || fileLoading}
            onClick={() => void save()}
          >
            <Icon icon={Save} className="ui-icon-sm" />
            {busy ? t("settingsSaving") : t("codeSave")}
          </button>
        </header>

        {conflict && active ? (
          <div className="code-conflict" role="alert">
            <p>{error}</p>
            <div className="code-conflict-actions">
              <button type="button" onClick={() => void openFile(active, { reload: true })}>
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
        ) : imageView ? (
          <div className="code-image-view">
            { }
            <img
              src={projectPublicUrl(projectId, imageView, filesRevision) ?? undefined}
              alt={imageView}
            />
            <span className="code-image-name">{imageView.split("/").pop()}</span>
          </div>
        ) : activeTab ? (
          <CodeEditor
            path={activeTab.path}
            value={activeTab.content}
            onChange={updateContent}
            onSave={() => void save()}
          />
        ) : (
          <p className="builder-empty">{t("codeSelectFile")}</p>
        )}
      </div>

      <QuickOpen
        open={quickOpen}
        files={allFiles}
        onClose={() => setQuickOpen(false)}
        onPick={(p) => {
          setQuickOpen(false);
          void openFile(p);
        }}
      />
    </section>
  );
}

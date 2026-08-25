"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Save } from "lucide-react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { CodeEditor } from "./CodeEditor";
import { FileTypeIcon } from "./file-icons";
import type { FileNode } from "./types";

type Props = {
  projectId: string;
  onSaved?: (path: string) => void;
};

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
      <li>
        <button
          type="button"
          className="code-tree-dir"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => setOpen((v) => !v)}
        >
          <Icon icon={open ? ChevronDown : ChevronRight} className="ui-icon-sm code-tree-chevron" />
          <FileTypeIcon path={node.path} isDir open={open} />
          <span className="code-tree-label">{name}</span>
        </button>
        {open && (
          <ul>
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
    <li>
      <button
        type="button"
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

export function CodePane({ projectId, onSaved }: Props) {
  const { t } = useI18n();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = content !== baseline;
  const contentRef = useRef(content);
  const baselineRef = useRef(baseline);
  const selectedRef = useRef(selected);
  contentRef.current = content;
  baselineRef.current = baseline;
  selectedRef.current = selected;

  const loadTree = useCallback(async () => {
    try {
      const nodes = await api<FileNode[]>(`/projects/${projectId}/files`);
      setTree(nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }, [projectId, t]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  async function openFile(path: string) {
    if (dirty && selected && !window.confirm(t("codeUnsavedConfirm"))) {
      return;
    }
    setSelected(path);
    setError(null);
    try {
      const file = await api<{ path: string; content: string }>(
        `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
      );
      setContent(file.content);
      setBaseline(file.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }

  const save = useCallback(async () => {
    const path = selectedRef.current;
    const next = contentRef.current;
    if (!path || next === baselineRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/projects/${projectId}/files/content`, {
        method: "PUT",
        body: JSON.stringify({ path, content: next }),
      });
      setBaseline(next);
      onSaved?.(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  }, [onSaved, projectId, t]);

  return (
    <section className="builder-code-pane builder-main-pane">
      <aside className="code-tree">
        <header className="builder-pane-head">
          <h2>{t("builderModeCode")}</h2>
        </header>
        <ul className="code-tree-list">
          {tree.map((n) => (
            <TreeItem key={n.path} node={n} depth={0} selected={selected} onSelect={(p) => void openFile(p)} />
          ))}
        </ul>
      </aside>
      <div className="code-editor">
        <header className="builder-pane-head">
          <div className="code-editor-path">
            {selected ? (
              <>
                <FileTypeIcon path={selected} size="md" />
                <code>{selected}</code>
                {dirty && <span className="code-dirty-dot" title={t("codeDirty")} />}
              </>
            ) : (
              <span>{t("codeSelectFile")}</span>
            )}
          </div>
          <button type="button" className="btn" disabled={!dirty || busy || !selected} onClick={() => void save()}>
            <Icon icon={Save} className="ui-icon-sm" />
            {t("codeSave")}
          </button>
        </header>
        {error && <p className="builder-pane-error">{error}</p>}
        {selected ? (
          <CodeEditor path={selected} value={content} onChange={setContent} onSave={() => void save()} />
        ) : (
          <p className="builder-empty">{t("codeSelectFile")}</p>
        )}
      </div>
    </section>
  );
}

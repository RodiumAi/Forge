"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assetContentUrl } from "@/lib/asset-url";
import { fetchProjectAssets, type ProjectAsset } from "@/lib/prompt-upload";
import { createProjectRefAttachment, type PromptAttachment } from "@/lib/prompt-attachments";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Props = {
  projectId: string | null;
  open: boolean;
  query: string;
  onSelect: (attachment: PromptAttachment, mention: string) => void;
  onClose: () => void;
};

export function PromptAssetMention({ projectId, open, query, onSelect, onClose }: Props) {
  const { t } = useI18n();
  const [assets, setAssets] = useState<ProjectAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const pickRef = useRef<(asset: ProjectAsset) => void>(() => undefined);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    setLoading(true);
    void fetchProjectAssets(projectId)
      .then((list) => {
        if (!cancelled) setAssets(list);
      })
      .catch(() => {
        if (!cancelled) setAssets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => a.name.toLowerCase().includes(q));
  }, [assets, query]);

  useEffect(() => {
    setActive(0);
  }, [query, filtered.length]);

  function pick(asset: ProjectAsset) {
    const att = createProjectRefAttachment(asset);
    onSelect(att, `@${asset.name}`);
    onClose();
  }
  pickRef.current = pick;

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (!open) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        onClose();
        return;
      }
      if (!filtered.length) return;
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        ev.stopPropagation();
        setActive((i) => (i + 1) % filtered.length);
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        ev.stopPropagation();
        setActive((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        ev.stopPropagation();
        const item = filtered[active];
        if (item) pickRef.current(item);
      }
    }
    // Capture so we beat the textarea Enter→send handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, filtered, active, onClose]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  if (!projectId) {
    return (
      <div className="prompt-mention-menu" role="listbox">
        <p className="prompt-mention-empty">{t("promptMentionNeedProject")}</p>
      </div>
    );
  }

  return (
    <div className="prompt-mention-menu" role="listbox" aria-label={t("builderModeFiles")}>
      {loading ? <p className="prompt-mention-empty">{t("promptMentionLoading")}</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="prompt-mention-empty">{t("promptMentionEmpty")}</p>
      ) : null}
      {!loading && filtered.length > 0 ? (
        <ul ref={listRef} className="prompt-mention-list">
          {filtered.map((asset, idx) => (
            <li key={asset.id}>
              <button
                type="button"
                className={`prompt-mention-item${idx === active ? " active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(asset);
                }}
              >
                {asset.content_type.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={
                      (projectId && assetContentUrl(projectId, asset.id)) ||
                      asset.public_url
                    }
                    alt=""
                    className="prompt-mention-thumb"
                  />
                ) : (
                  <span className="prompt-mention-doc">
                    {asset.name.split(".").pop()?.toUpperCase()}
                  </span>
                )}
                <span className="prompt-mention-name">{asset.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

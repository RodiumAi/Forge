"use client";

import { Ellipsis, ExternalLink, Pencil, Share2, Trash2, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

type Item = { id: string; label: string; icon: LucideIcon; danger?: boolean; run: () => void };

type Props = {
  projectName: string;
  onOpen: () => void;
  /** Owner-only actions: left out (hidden) for a shared project. */
  onRename?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
};

/** The "..." menu of a project row or card (menu button pattern, arrow keys, Escape). */
export function ProjectMenu({ projectName, onOpen, onRename, onShare, onDelete }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  const items: Item[] = [{ id: "open", label: t("homeMenuOpen"), icon: ExternalLink, run: onOpen }];
  if (onRename) items.push({ id: "rename", label: t("homeMenuRename"), icon: Pencil, run: onRename });
  if (onShare) items.push({ id: "share", label: t("homeMenuShare"), icon: Share2, run: onShare });
  if (onDelete) items.push({ id: "delete", label: t("homeMenuDelete"), icon: Trash2, danger: true, run: onDelete });

  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function onMenuKey(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(items.length - 1);
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="fdh-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="fdh-icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t("homeMenu").replace("{name}", projectName)}
        onClick={(event) => {
          event.stopPropagation();
          setActive(0);
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(event.key === "ArrowUp" ? items.length - 1 : 0);
            setOpen(true);
          }
        }}
      >
        <Icon icon={Ellipsis} className="ui-icon-sm" />
      </button>
      {open ? (
        <div className="fdh-menu-list" role="menu" id={menuId} aria-label={projectName} onKeyDown={onMenuKey}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === active ? 0 : -1}
              className={`fdh-menu-item${item.danger ? " is-danger" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                close(false);
                item.run();
              }}
            >
              <Icon icon={item.icon} className="ui-icon-sm" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

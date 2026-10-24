"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

import { Dialog } from "@/components/ui/Dialog";
import { Glyph, type GlyphName } from "@/components/ui/glyph";
import { SearchInput } from "@/components/ui/Input";
import { KindIcon } from "@/components/ui/KindBadge";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { kindStyle } from "@/lib/kind-style";
import { editorHref, normalizeKind, type ProjectKindId } from "@/lib/kinds";
import { ensureProjects, getCachedProjects, type CachedProject } from "@/lib/lists-cache";

import { APP_NAV } from "./nav";

type Row = {
  key: string;
  href: string;
  title: string;
  sub: string;
  kind?: ProjectKindId;
  glyph?: GlyphName;
};

/**
 * Ctrl K / Cmd K search over the user's projects and the app pages. Arrow keys
 * move, Enter opens. Projects come from the shared list cache (no extra fetch
 * when the overview already loaded them).
 */
export function CommandPalette({ open, onClose, showTeam }: { open: boolean; onClose: () => void; showTeam: boolean }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState<CachedProject[]>(() => getCachedProjects(locale) ?? []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    let alive = true;
    void ensureProjects(locale)
      .then((list) => alive && setProjects(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, locale]);

  const rows = useMemo<Row[]>(() => {
    const projectRows: Row[] = projects.map((p) => {
      const kind = normalizeKind(p.platform);
      return { key: `p-${p.id}`, href: editorHref(p.id, kind), title: p.name, sub: t(kindStyle(kind).labelKey), kind };
    });
    const pageRows: Row[] = APP_NAV.flatMap((g) => g.links)
      .filter((l) => !l.teamOnly || showTeam)
      .map((l) => ({ key: `n-${l.id}`, href: l.href, title: t(l.labelKey), sub: t("uiPalettePage"), glyph: l.glyph }));
    const needle = query.trim().toLowerCase();
    const all = [...projectRows, ...pageRows];
    return (needle ? all.filter((r) => `${r.title} ${r.sub}`.toLowerCase().includes(needle)) : all).slice(0, 12);
  }, [projects, query, showTeam, t]);

  function go(row: Row | undefined) {
    if (!row) return;
    onClose();
    router.push(row.href);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => (rows.length ? (a + 1) % rows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(rows[active]);
    }
  }

  const listId = "f-palette-list";
  return (
    <Dialog open={open} onClose={onClose} title={t("uiPaletteTitle")} hideTitle placement="top" className="f-palette" closeLabel={t("uiClose")}>
      <SearchInput
        label={t("uiPaletteTitle")}
        placeholder={t("uiPalettePlaceholder")}
        value={query}
        data-autofocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={rows[active] ? `f-pal-${rows[active].key}` : undefined}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKey}
      />
      <div className="f-palette-list" id={listId} role="listbox" aria-label={t("uiPaletteTitle")}>
        {rows.length ? (
          rows.map((row, i) => (
            <a
              key={row.key}
              id={`f-pal-${row.key}`}
              role="option"
              aria-selected={i === active}
              href={row.href}
              className={i === active ? "f-menu-item f-palette-row is-active" : "f-menu-item f-palette-row"}
              onMouseMove={() => i !== active && setActive(i)}
              onClick={(event) => {
                event.preventDefault();
                go(row);
              }}
            >
              {row.kind ? (
                <KindIcon kind={row.kind} size="sm" />
              ) : (
                <span className="f-pal-ico" aria-hidden>
                  <Glyph name={row.glyph ?? "file"} size="sm" />
                </span>
              )}
              <span>{row.title}</span>
              <span className="f-menu-meta">{row.sub}</span>
            </a>
          ))
        ) : (
          <p className="f-palette-empty">{t("uiPaletteEmpty")}</p>
        )}
      </div>
    </Dialog>
  );
}

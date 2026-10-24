"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";

import { visibleTiles, type HomeTile, type HomeTileId } from "@/components/home/home-kinds";
import { useHomeSetting } from "@/components/home/use-home-prefs";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProjectKindId } from "@/lib/kinds";

type Props = {
  enabledKinds: readonly ProjectKindId[];
  selected: HomeTileId | null;
  onSelect: (tile: HomeTile) => void;
  disabled?: boolean;
};

/**
 * "Choisir un type": one tile per enabled kind plus Blank, then shortcuts to
 * useful sub-types. Collapsible, open by default, the choice is remembered.
 */
export function KindGrid({ enabledKinds, selected, onSelect, disabled }: Props) {
  const { t } = useI18n();
  const [openState, setOpenState] = useHomeSetting("kinds_open", "1", ["1", "0"] as const);
  const open = openState === "1";
  const panelId = useId();
  const tiles = visibleTiles(enabledKinds);
  const main = tiles.filter((tile) => !tile.shortcut);
  const shortcuts = tiles.filter((tile) => tile.shortcut);

  function renderTile(tile: HomeTile) {
    const isOn = selected === tile.id;
    return (
      <li key={tile.id}>
        <button
          type="button"
          className={`fdh-tile fdh-tone-${tile.kind ?? "blank"}${isOn ? " is-selected" : ""}`}
          aria-pressed={isOn}
          data-tile={tile.id}
          disabled={disabled}
          onClick={() => onSelect(tile)}
        >
          <span className="fdh-tile-icon">
            <Icon icon={tile.icon} className="ui-icon" />
          </span>
          <span className="fdh-tile-text">
            <span className="fdh-tile-label">{t(tile.labelKey)}</span>
            {tile.hintKey ? <span className="fdh-tile-hint">{t(tile.hintKey)}</span> : null}
          </span>
        </button>
      </li>
    );
  }

  return (
    <section className="fdh-kinds" aria-labelledby={`${panelId}-title`}>
      <h2 className="fdh-kinds-head" id={`${panelId}-title`}>
        <button
          type="button"
          className="fdh-kinds-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpenState(open ? "0" : "1")}
        >
          <span>{t("homeKindsTitle")}</span>
          <Icon icon={ChevronDown} className={`ui-icon-sm fdh-chevron${open ? " is-open" : ""}`} />
        </button>
      </h2>
      <div id={panelId} hidden={!open}>
        <ul className="fdh-tiles" aria-label={t("homeKindsTitle")}>
          {main.map(renderTile)}
        </ul>
        {shortcuts.length ? (
          <>
            <h3 className="fdh-kinds-sub">{t("homeShortcutsLabel")}</h3>
            <ul className="fdh-tiles fdh-tiles-shortcuts" aria-label={t("homeShortcutsLabel")}>
              {shortcuts.map(renderTile)}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import { Star } from "lucide-react";

import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function FavoriteButton({ name, active, onToggle }: { name: string; active: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  const label = (active ? t("homeUnstar") : t("homeStar")).replace("{name}", name);
  return (
    <button
      type="button"
      className={`fdh-icon-btn fdh-star${active ? " is-on" : ""}`}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <Icon icon={Star} className="ui-icon-sm" />
    </button>
  );
}

"use client";

import { BookOpen, Monitor, Palette, Presentation, Smartphone, type LucideIcon } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getKind, useEnabledKinds, type ProjectKindId } from "@/lib/kinds";

export type ProjectPlatform = ProjectKindId;

const KIND_ICONS: Record<ProjectKindId, LucideIcon> = {
  web: Monitor,
  mobile: Smartphone,
  slides: Presentation,
  codelab: BookOpen,
  design_system: Palette,
};

type Props = {
  value: ProjectPlatform;
  onChange: (v: ProjectPlatform) => void;
  disabled?: boolean;
  className?: string;
};

/** One button per kind this instance offers (web and mobile until `GET /kinds` says more). */
export function PlatformToggle({ value, onChange, disabled, className }: Props) {
  const { t } = useI18n();
  const kinds = useEnabledKinds();
  return (
    <div
      className={`platform-toggle${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("platformToggleAria")}
    >
      {kinds.map((id) => (
        <button
          key={id}
          type="button"
          className={value === id ? "active" : undefined}
          aria-pressed={value === id}
          disabled={disabled}
          onClick={() => onChange(id)}
        >
          <Icon icon={KIND_ICONS[id]} className="ui-icon-sm" />
          <span>{t(getKind(id).labelKey)}</span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { Monitor, Smartphone } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type ProjectPlatform = "web" | "mobile";

type Props = {
  value: ProjectPlatform;
  onChange: (v: ProjectPlatform) => void;
  disabled?: boolean;
  className?: string;
};

export function PlatformToggle({ value, onChange, disabled, className }: Props) {
  const { t } = useI18n();
  return (
    <div
      className={`platform-toggle${className ? ` ${className}` : ""}`}
      role="group"
      aria-label={t("platformToggleAria")}
    >
      <button
        type="button"
        className={value === "web" ? "active" : undefined}
        aria-pressed={value === "web"}
        disabled={disabled}
        onClick={() => onChange("web")}
      >
        <Icon icon={Monitor} className="ui-icon-sm" />
        <span>{t("platformWeb")}</span>
      </button>
      <button
        type="button"
        className={value === "mobile" ? "active" : undefined}
        aria-pressed={value === "mobile"}
        disabled={disabled}
        onClick={() => onChange("mobile")}
      >
        <Icon icon={Smartphone} className="ui-icon-sm" />
        <span>{t("platformApp")}</span>
      </button>
    </div>
  );
}

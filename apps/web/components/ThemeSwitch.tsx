"use client";

import { Moon, Sun } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme } from "@/lib/theme/ThemeProvider";

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const next = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? t("settingsThemeLight") : t("settingsThemeDark");

  return (
    <button
      type="button"
      className={`theme-icon-btn ${className}`.trim()}
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      <Icon icon={theme === "dark" ? Sun : Moon} className="ui-icon-sm" />
    </button>
  );
}

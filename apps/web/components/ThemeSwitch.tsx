"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useTheme, type ThemePreference } from "@/lib/theme/ThemeProvider";

/* Compact control: one click cycles. The full three-way picker lives in
   Settings — here we only have room for a single button. */
const CYCLE: ThemePreference[] = ["system", "light", "dark"];

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

const LABEL_KEYS = {
  system: "settingsThemeSystem",
  light: "settingsThemeLight",
  dark: "settingsThemeDark",
} as const;

export function ThemeSwitch({ className = "" }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();

  const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length];
  // Shows the CURRENT preference rather than the next one: with "System" in the
  // rotation, a user otherwise has no way to tell which of the three is active.
  const label = `${t("settingsThemeLabel")}: ${t(LABEL_KEYS[preference])}`;

  return (
    <button
      type="button"
      className={`theme-icon-btn ${className}`.trim()}
      onClick={() => setPreference(next)}
      aria-label={label}
      title={label}
    >
      <Icon icon={ICONS[preference]} className="ui-icon-sm" />
    </button>
  );
}

"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Lock,
  Palette,
  Search,
  User,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";

export type SettingsSection = "account" | "appearance" | "security";

type NavItem = {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: string;
};

type SettingsShellProps = {
  active: SettingsSection;
  onActiveChange: (section: SettingsSection) => void;
  children: ReactNode;
};

export function SettingsShell({ active, onActiveChange, children }: SettingsShellProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");

  const items: NavItem[] = useMemo(
    () => [
      { id: "account", label: t("settingsTabAccount"), icon: User, group: t("settingsGroupAccount") },
      { id: "security", label: t("settingsTabSecurity"), icon: Lock, group: t("settingsGroupAccount") },
      {
        id: "appearance",
        label: t("settingsTabAppearance"),
        icon: Palette,
        group: t("settingsGroupPreferences"),
      },
    ],
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.id.includes(q),
    );
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const item of filtered) {
      const list = map.get(item.group) || [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="settings-shell">
      <aside className="settings-shell-nav" aria-label={t("settingsTitle")}>
        <Link href="/dashboard" className="settings-shell-back">
          <Icon icon={ArrowLeft} className="ui-icon-sm" />
          {t("settingsBack")}
        </Link>

        <label className="settings-shell-search">
          <Icon icon={Search} className="ui-icon-sm" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settingsSearchPlaceholder")}
          />
        </label>

        <nav className="settings-shell-groups">
          {groups.map(([group, groupItems]) => (
            <div key={group} className="settings-shell-group">
              <p className="settings-shell-group-label">{group}</p>
              {groupItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-shell-item ${active === item.id ? "active" : ""}`}
                  onClick={() => onActiveChange(item.id)}
                >
                  <span className="settings-shell-item-icon" aria-hidden>
                    <Icon icon={item.icon} className="ui-icon-sm" />
                  </span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="settings-shell-main">{children}</div>
    </div>
  );
}

export function SettingsPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-panel">
      <header className="settings-panel-head">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </header>
      <div className="settings-panel-body">{children}</div>
    </section>
  );
}

export function SettingsBlock({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <article className="settings-block">
      <header className="settings-block-head">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="settings-block-content">{children}</div>
    </article>
  );
}

export function SettingsRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row-copy">
        <strong>{title}</strong>
        {hint && <span>{hint}</span>}
      </div>
      <div className="settings-row-action">{children}</div>
    </div>
  );
}

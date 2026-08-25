"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import {
  dictionaries,
  resolveLocale,
  type Locale,
  type MessageKey,
} from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "forge_locale";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "fr") {
      setLocaleState(stored);
    } else {
      setLocaleState(resolveLocale(navigator.language));
    }
    setHydrated(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next;
  }, []);

  useEffect(() => {
    if (hydrated) document.documentElement.lang = locale;
  }, [hydrated, locale]);

  const effectiveLocale: Locale = hydrated ? locale : "fr";

  const value = useMemo<I18nContextValue>(
    () => ({
      locale: effectiveLocale,
      setLocale,
      t: (key) => dictionaries[effectiveLocale][key],
    }),
    [effectiveLocale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LocaleSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div className={`locale-dropdown ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="locale-dropdown-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t("language")}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{locale === "en" ? t("langEn") : t("langFr")}</span>
        <Icon icon={ChevronDown} className="ui-icon-sm" />
      </button>
      {open && (
        <div className="locale-dropdown-menu" role="listbox" aria-label={t("language")}>
          <button
            type="button"
            role="option"
            aria-selected={locale === "en"}
            className={locale === "en" ? "active" : ""}
            onClick={() => {
              setLocale("en");
              setOpen(false);
            }}
          >
            {t("langEn")}
          </button>
          <button
            type="button"
            role="option"
            aria-selected={locale === "fr"}
            className={locale === "fr" ? "active" : ""}
            onClick={() => {
              setLocale("fr");
              setOpen(false);
            }}
          >
            {t("langFr")}
          </button>
        </div>
      )}
    </div>
  );
}

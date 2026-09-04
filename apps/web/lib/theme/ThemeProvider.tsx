"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** What the user picked. `system` defers to the OS setting. */
export type ThemePreference = "system" | "light" | "dark";

/** What actually gets painted — `system` is always resolved before use. */
export type ResolvedTheme = "light" | "dark";

/** Kept so existing call sites that import `Theme` keep compiling. */
export type Theme = ResolvedTheme;

const STORAGE_KEY = "forge_theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Alias of `resolvedTheme` — several components still read `theme`. */
  theme: ResolvedTheme;
  /** Alias of `setPreference`, which also accepts the old two values. */
  setTheme: (preference: ThemePreference) => void;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * `system` is stored as the ABSENCE of a key, so only an explicit light/dark
 * choice is persisted. Reading is defensive: localStorage throws outright in
 * some privacy modes rather than returning null.
 */
function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  try {
    return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
  } catch {
    return "dark";
  }
}

function resolvePreference(preference: ThemePreference): ResolvedTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  // Matches the server-rendered markup; corrected on hydration below. The
  // blocking script in the document head has already painted the right theme.
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readPreference();
    const next = resolvePreference(stored);
    setPreferenceState(stored);
    setResolvedTheme(next);
    applyTheme(next);
    setHydrated(true);
  }, []);

  // While the preference is `system`, follow the OS live: a user flipping their
  // OS theme with the app open should see it switch without a reload.
  useEffect(() => {
    if (preference !== "system") return;
    let query: MediaQueryList;
    try {
      query = window.matchMedia(DARK_QUERY);
    } catch {
      return;
    }
    const onChange = () => {
      const next = systemTheme();
      setResolvedTheme(next);
      applyTheme(next);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    const resolved = resolvePreference(next);
    setPreferenceState(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — the theme still applies for this session */
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = hydrated ? resolvedTheme : "dark";
    return {
      preference,
      resolvedTheme: theme,
      setPreference,
      theme,
      setTheme: setPreference,
      hydrated,
    };
  }, [hydrated, preference, resolvedTheme, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

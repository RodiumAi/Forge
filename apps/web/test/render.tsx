import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";

/**
 * Render a component inside the providers it expects.
 *
 * The locale is pinned through localStorage — the provider otherwise falls back
 * to `navigator.language`, which is `en-US` under jsdom and would make text
 * assertions depend on the environment.
 */
function Wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { locale?: "fr" | "en" },
) {
  const { locale = "fr", ...renderOptions } = options ?? {};
  localStorage.setItem("forge_locale", locale);
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export * from "@testing-library/react";

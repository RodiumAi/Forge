import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { ForgeEmailPreferences, type EmailPreferences } from "@/components/settings/ForgeEmailPreferences";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    api: (...args: unknown[]) => apiMock(...args),
    ApiError,
  };
});

const ALL_ON: EmailPreferences = {
  forge_billing: true,
  forge_credits: true,
  forge_team: true,
  forge_product: true,
  forge_projects: true,
};

/** GET answers with `read` (the provider may load twice while the locale settles); PATCH with `write`. */
function route(read: () => unknown, write?: () => unknown) {
  apiMock.mockImplementation((_path: string, options: { method?: string } = {}) =>
    options.method === "PATCH" ? (write ? write() : Promise.reject(new Error("unexpected"))) : read(),
  );
}

function switchFor(name: string) {
  return screen.getByRole("switch", { name });
}

describe("ForgeEmailPreferences", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("shows the five switches and the receipts note", async () => {
    route(() => Promise.resolve({ available: true, preferences: { ...ALL_ON, forge_product: false } }));
    renderWithProviders(<ForgeEmailPreferences />, { locale: "en" });

    await screen.findByText("Payment receipts are always sent.");
    expect(screen.getAllByRole("switch")).toHaveLength(5);
    expect(switchFor("Subscription and payment reminders")).toHaveAttribute("aria-checked", "true");
    expect(switchFor("Tips and offers")).toHaveAttribute("aria-checked", "false");
    expect(apiMock).toHaveBeenCalledWith("/settings/email-preferences", {}, "en");
  });

  it("saves a toggle and confirms with a toast", async () => {
    route(
      () => Promise.resolve({ available: true, preferences: ALL_ON }),
      () => Promise.resolve({ available: true, preferences: { ...ALL_ON, forge_team: false } }),
    );
    const { user } = renderWithProviders(<ForgeEmailPreferences />, { locale: "en" });

    await user.click(await screen.findByRole("switch", { name: "Team changes" }));

    expect(switchFor("Team changes")).toHaveAttribute("aria-checked", "false");
    await screen.findByText("Email preferences saved");
    expect(apiMock).toHaveBeenLastCalledWith(
      "/settings/email-preferences",
      { method: "PATCH", body: JSON.stringify({ forge_team: false }) },
      "en",
    );
  });

  it("rolls back and shows the error when the save fails", async () => {
    const { ApiError } = (await import("@/lib/api")) as unknown as {
      ApiError: new (message: string, status: number) => Error;
    };
    let reject: (err: unknown) => void = () => undefined;
    route(
      () => Promise.resolve({ available: true, preferences: ALL_ON }),
      () => new Promise((_res, rej) => (reject = rej)),
    );
    const { user } = renderWithProviders(<ForgeEmailPreferences />, { locale: "en" });

    await user.click(await screen.findByRole("switch", { name: "New FRODI credit" }));
    // Optimistic: off right away.
    expect(switchFor("New FRODI credit")).toHaveAttribute("aria-checked", "false");

    reject(new ApiError("Email preferences could not be loaded.", 503));
    await waitFor(() => expect(switchFor("New FRODI credit")).toHaveAttribute("aria-checked", "true"));
    await screen.findByText("Email preferences could not be loaded.");
  });

  it("explains when the account has no preferences yet", async () => {
    route(() =>
      Promise.resolve({
        available: false,
        reason: "not_available",
        message: "Email preferences are not available for this account yet.",
        preferences: null,
      }),
    );
    renderWithProviders(<ForgeEmailPreferences />, { locale: "en" });

    await screen.findByText("Email preferences are not available for this account yet.");
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("falls back to the default message when the request fails", async () => {
    route(() => Promise.reject(new Error("boom")));
    renderWithProviders(<ForgeEmailPreferences />, { locale: "fr" });

    await screen.findByText("Les préférences d'e-mail ne sont pas encore disponibles pour ce compte.");
  });
});

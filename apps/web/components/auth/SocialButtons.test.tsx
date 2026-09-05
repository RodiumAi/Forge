import { describe, expect, it, vi, beforeEach } from "vitest";

import { renderWithProviders, screen, fireEvent, waitFor } from "@/test/render";

import { SocialButtons } from "./SocialButtons";

const state = vi.hoisted(() => ({ enabled: true }));

vi.mock("@/lib/firebase", () => ({
  get firebaseEnabled() {
    return state.enabled;
  },
  signInWithProvider: vi.fn(async () => "id-token"),
  socialErrorKey: (error: unknown) =>
    (error as { code?: string })?.code === "auth/popup-closed-by-user"
      ? null
      : "authSocialFailed",
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: vi.fn(), setToken: vi.fn() };
});

const firebase = await import("@/lib/firebase");
const apiModule = await import("@/lib/api");

beforeEach(() => {
  state.enabled = true;
  vi.mocked(apiModule.api).mockResolvedValue({ access_token: "jwt" });
  vi.mocked(firebase.signInWithProvider).mockResolvedValue("id-token");
});

describe("SocialButtons", () => {
  it("renders nothing when Firebase is not configured", () => {
    // The guarantee for a fresh clone: no button that the API answers 503.
    state.enabled = false;
    const { container } = renderWithProviders(
      <SocialButtons onSuccess={vi.fn()} onError={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers Google and GitHub once configured", () => {
    renderWithProviders(<SocialButtons onSuccess={vi.fn()} onError={vi.fn()} />);
    expect(screen.getByText(/google/i)).toBeInTheDocument();
    expect(screen.getByText(/github/i)).toBeInTheDocument();
  });

  it("exchanges the ID token and stores the session", async () => {
    const onSuccess = vi.fn();
    renderWithProviders(<SocialButtons onSuccess={onSuccess} onError={vi.fn()} />);

    fireEvent.click(screen.getByText(/google/i));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(apiModule.api).toHaveBeenCalledWith(
      "/auth/oauth/firebase",
      expect.objectContaining({ body: JSON.stringify({ id_token: "id-token" }) }),
    );
    expect(apiModule.setToken).toHaveBeenCalledWith("jwt");
  });

  it("stays silent when the user just closes the popup", async () => {
    const onError = vi.fn();
    vi.mocked(firebase.signInWithProvider).mockRejectedValue({
      code: "auth/popup-closed-by-user",
    });

    renderWithProviders(<SocialButtons onSuccess={vi.fn()} onError={onError} />);
    fireEvent.click(screen.getByText(/github/i));

    await waitFor(() => expect(firebase.signInWithProvider).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
  });

  it("surfaces the server's message over its own generic copy", async () => {
    const onError = vi.fn();
    const apiError = Object.assign(
      new Error("Sign in with your password first, then link this provider."),
      { status: 409 },
    );
    vi.mocked(apiModule.api).mockRejectedValue(apiError);

    renderWithProviders(<SocialButtons onSuccess={vi.fn()} onError={onError} />);
    fireEvent.click(screen.getByText(/google/i));

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        "Sign in with your password first, then link this provider.",
      ),
    );
  });
});

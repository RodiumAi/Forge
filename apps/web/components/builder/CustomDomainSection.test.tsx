import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { CustomDomainSection, type DomainState } from "@/components/builder/CustomDomainSection";

const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
}));

function domainState(overrides: Partial<DomainState> = {}): DomainState {
  return {
    hostname: "www.client.com",
    status: "pending_dns",
    cname_target: "sites.forge.rodiumai.io",
    dns_records: [
      {
        purpose: "routing",
        type: "CNAME",
        name: "www",
        full_name: "www.client.com",
        value: "sites.forge.rodiumai.io",
      },
      {
        purpose: "acm_validation",
        type: "CNAME",
        name: "_t.www",
        full_name: "_t.www.client.com",
        value: "_v.acm-validations.aws.",
      },
    ],
    public_url: null,
    last_error: null,
    verified_at: null,
    ...overrides,
  };
}

function renderSection() {
  return renderWithProviders(
    <CustomDomainSection projectId="p1" onOk={() => undefined} onError={() => undefined} />,
    { locale: "fr" },
  );
}

beforeEach(() => {
  apiMock.mockReset();
});

describe("CustomDomainSection", () => {
  it("shows the add form when no domain exists", async () => {
    apiMock.mockResolvedValueOnce(null);
    renderSection();
    expect(await screen.findByPlaceholderText("www.monentreprise.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ajouter le domaine/ })).toBeDisabled();
  });

  it("renders both DNS records in pending_dns", async () => {
    apiMock.mockResolvedValueOnce(domainState());
    renderSection();
    expect(await screen.findByText("www.client.com")).toBeInTheDocument();
    expect(screen.getByText("Routage")).toBeInTheDocument();
    expect(screen.getByText("Validation SSL")).toBeInTheDocument();
    expect(screen.getByText("sites.forge.rodiumai.io")).toBeInTheDocument();
    expect(screen.getByText("_t.www")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vérifier/ })).toBeInTheDocument();
  });

  it("shows the validated badge and public URL", async () => {
    apiMock.mockResolvedValueOnce(
      domainState({ status: "validated", public_url: "https://www.client.com" }),
    );
    renderSection();
    expect(await screen.findByText("Validé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://www.client.com" })).toHaveAttribute(
      "href",
      "https://www.client.com",
    );
    expect(screen.queryByText("Routage")).not.toBeInTheDocument();
  });

  it("shows a retry button and the mapped error when failed", async () => {
    apiMock.mockResolvedValueOnce(
      domainState({ status: "failed", last_error: "routing_cname_missing" }),
    );
    renderSection();
    expect(await screen.findByText("Échec")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/ })).toBeInTheDocument();
    expect(screen.getByText(/CNAME de routage/)).toBeInTheDocument();
  });

  it("verify transitions pending_dns to processing", async () => {
    apiMock.mockResolvedValueOnce(domainState());
    const { user } = renderSection();
    await screen.findByText("www.client.com");
    apiMock.mockResolvedValueOnce(domainState({ status: "processing" }));
    await user.click(screen.getByRole("button", { name: /Vérifier/ }));
    await waitFor(() => expect(screen.getByText("Vérification…")).toBeInTheDocument());
    expect(apiMock).toHaveBeenLastCalledWith(
      "/projects/p1/domain/verify",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/render";
import { ImageEditPanel } from "@/components/builder/ImageEditPanel";
import { ApiError } from "@/lib/api";

const apiMock = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: (...args: unknown[]) => apiMock(...args),
}));
vi.mock("@/lib/prompt-upload", () => ({ fetchProjectAssets: async () => [] }));

const selection = { src: "/images/old.webp", alt: "plage", selector: "img.hero" };

function route(handlers: Record<string, (init?: RequestInit) => unknown>) {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    const key = Object.keys(handlers).find((prefix) => path.startsWith(prefix));
    if (!key) throw new Error(`unexpected ${path}`);
    return handlers[key](init);
  });
}

const HITS = {
  hits: [
    {
      id: "11",
      previewUrl: "https://pixabay.com/get/a_640.jpg",
      width: 4000,
      height: 3000,
      author: "Jane",
      pageUrl: "https://pixabay.com/photos/a-11/",
      tags: "beach, sea",
      source: "pixabay",
    },
  ],
  total: 1,
  page: 1,
  hasMore: false,
  source: "pixabay",
};

describe("ImageEditPanel", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("opens on free images, searches Pixabay and imports before replacing", async () => {
    const onReplaced = vi.fn();
    route({
      "/images/search": () => HITS,
      "/projects/p1/images/import": () => ({ path: "public/images/pixabay-11.webp", public_path: "/images/pixabay-11.webp" }),
      "/projects/p1/visual-image": () => ({ ok: true }),
    });
    const { user } = renderWithProviders(
      <ImageEditPanel projectId="p1" selection={selection} onClose={() => {}} onReplaced={onReplaced} />,
    );
    expect(screen.getByRole("tab", { name: "Libres" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Images : Pixabay")).toBeInTheDocument();
    // The selected image's alt text pre-fills the search.
    expect(screen.getByLabelText("Rechercher des images libres")).toHaveValue("plage");
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    const hit = await screen.findByRole("button", { name: "beach, sea" });
    expect(apiMock.mock.calls[0][0]).toContain("q=plage");
    await user.click(hit);
    await waitFor(() => expect(onReplaced).toHaveBeenCalled());
    const importCall = apiMock.mock.calls.find(([path]) => path === "/projects/p1/images/import");
    expect(JSON.parse(importCall![1].body)).toEqual({ source: "pixabay", id: "11" });
    const replaceCall = apiMock.mock.calls.find(([path]) => path === "/projects/p1/visual-image");
    expect(JSON.parse(replaceCall![1].body)).toMatchObject({
      old_src: "/images/old.webp",
      new_public_path: "/images/pixabay-11.webp",
      object_id: null,
    });
  });

  it("says so when the instance has no image bank", async () => {
    route({
      "/images/search": () => {
        throw new ApiError("off", 503, "IMAGE_SEARCH_UNAVAILABLE");
      },
    });
    const { user } = renderWithProviders(
      <ImageEditPanel projectId="p1" selection={selection} onClose={() => {}} onReplaced={() => {}} />,
    );
    await user.click(screen.getByRole("button", { name: "Rechercher" }));
    expect(await screen.findByText(/pas disponible sur cette instance/)).toBeInTheDocument();
  });

  it("keeps the import tab as before", async () => {
    const { user } = renderWithProviders(
      <ImageEditPanel projectId="p1" selection={selection} onClose={() => {}} onReplaced={() => {}} />,
    );
    await user.click(screen.getByRole("tab", { name: "Importer" }));
    expect(screen.getByRole("button", { name: /Importer une image/ })).toBeInTheDocument();
    expect(screen.getByText("Depuis les fichiers du projet")).toBeInTheDocument();
  });

  it("shows the insufficient credits message on the AI tab", async () => {
    route({
      "/images/models": () => [
        { slug: "openai/gpt-image-2", label: "Gpt image 2", default: true },
        { slug: "google/imagen-5", label: "Imagen 5", default: false },
      ],
      "/projects/p1/images/generate": () => {
        throw new ApiError("no credit", 402, "INSUFFICIENT_CREDITS", ["upgrade", "recharge"]);
      },
    });
    const { user } = renderWithProviders(
      <ImageEditPanel projectId="p1" selection={selection} onClose={() => {}} onReplaced={() => {}} />,
    );
    await user.click(screen.getByRole("tab", { name: "IA" }));
    await screen.findByRole("option", { name: "Imagen 5" });
    await user.selectOptions(screen.getByLabelText("Modèle"), "google/imagen-5");
    await user.type(screen.getByLabelText("Décrivez l’image"), "Un phare au crépuscule");
    await user.selectOptions(screen.getByLabelText("Format"), "16:9");
    await user.click(screen.getByRole("button", { name: "Générer" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Crédits insuffisants");
    const call = apiMock.mock.calls.find(([path]) => path === "/projects/p1/images/generate");
    expect(JSON.parse(call![1].body)).toEqual({
      model: "google/imagen-5",
      prompt: "Un phare au crépuscule",
      aspect: "16:9",
      target: "/images/old.webp",
    });
  });
});

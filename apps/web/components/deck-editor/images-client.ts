/**
 * Image sources of the deck image panel (plan 4.3): free images (Pixabay,
 * copied into the project), uploads and existing project images, and AI
 * generation billed by RodiumAi. Every image ends up as a project path
 * (`public/images/x.webp`) that a slide can reference.
 */

import { api, apiBase, ApiError, getToken, readApiError } from "@/lib/api";
import type { ImageCredit } from "./ops";

export type StockImage = { id: string; previewUrl: string; width: number; height: number; author: string; pageUrl: string; tags?: string; source: "pixabay" };
export type StockPage = { hits: StockImage[]; total: number; page: number; hasMore: boolean };
export type ImageModel = { slug: string; label: string; default: boolean };
type ApiImage = { path: string; public_path: string; width: number; height: number; credit?: { source: string; author?: string; pageUrl?: string } | null };

/** An image ready to put on a slide. */
export type PickedImage = { path: string; width: number; height: number; credit?: ImageCredit; alt?: string };

export type ImageClient = {
  search(query: string, type: "photo" | "illustration" | "vector", lang: string, page: number): Promise<StockPage>;
  importStock(hit: StockImage): Promise<PickedImage>;
  upload(file: File): Promise<PickedImage>;
  projectImages(): Promise<string[]>;
  models(): Promise<ImageModel[]>;
  generate(model: string | null, prompt: string, aspect: string, target: string | null): Promise<PickedImage>;
};

const SOURCES = new Set(["pixabay", "openverse", "upload", "generated", "other"]);

export function toPicked(image: ApiImage, alt?: string): PickedImage {
  const picked: PickedImage = { path: image.path, width: image.width, height: image.height };
  const credit = image.credit;
  if (credit && SOURCES.has(credit.source)) {
    const out: ImageCredit = { source: credit.source as ImageCredit["source"] };
    if (credit.author) out.author = credit.author.slice(0, 200);
    if (credit.pageUrl && /^https:\/\//.test(credit.pageUrl)) out.url = credit.pageUrl.slice(0, 2000);
    picked.credit = out;
  }
  if (alt) picked.alt = alt.slice(0, 300);
  return picked;
}

const IMAGE_EXT = /\.(webp|png|jpe?g|gif|avif)$/i;
// Variants written next to each image (name-640.webp...) are not offered on their own.
const VARIANT = /-\d{3,4}\.webp$/i;

type FileNode = { path: string; type: string; children?: FileNode[] | null };

export function imagePaths(tree: FileNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === "dir") walk(node.children ?? []);
      else if (node.path.startsWith("public/") && IMAGE_EXT.test(node.path) && !VARIANT.test(node.path) && !node.path.includes("__visual__")) {
        out.push(node.path);
      }
    }
  };
  walk(tree);
  return out;
}

export function apiImageClient(projectId: string): ImageClient {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  return {
    search: (query, type, lang, page) => {
      const params = new URLSearchParams({ q: query, type, lang, page: String(page) });
      return api<StockPage>(`/images/search?${params.toString()}`);
    },
    importStock: async (hit) => {
      const image = await api<ApiImage>(`${base}/images/import`, { method: "POST", body: JSON.stringify({ source: hit.source, id: hit.id }) });
      return toPicked(image, hit.tags?.replace(/\s+/g, " ").trim());
    },
    upload: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const headers = new Headers();
      const token = getToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const res = await fetch(`${apiBase()}${base}/files/upload`, { method: "POST", headers, body: form });
      if (!res.ok) throw await readApiError(res);
      const uploaded = (await res.json()) as { object_id?: string };
      if (!uploaded.object_id) throw new ApiError("Upload failed", 500);
      const image = await api<ApiImage>(`${base}/images/from-upload`, { method: "POST", body: JSON.stringify({ object_id: uploaded.object_id }) });
      return toPicked(image, file.name.replace(/\.[a-z0-9]+$/i, ""));
    },
    projectImages: async () => imagePaths(await api<FileNode[]>(`${base}/files`)),
    models: () => api<ImageModel[]>("/images/models"),
    generate: async (model, prompt, aspect, target) => {
      const image = await api<ApiImage>(`${base}/images/generate`, {
        method: "POST",
        body: JSON.stringify({ model, prompt, aspect, target }),
        timeoutMs: 200_000,
      });
      return toPicked(image, prompt);
    },
  };
}

export function isInsufficientCredits(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "INSUFFICIENT_CREDITS" || error.code === "INSUFFICIENT_RODI" || error.status === 402);
}

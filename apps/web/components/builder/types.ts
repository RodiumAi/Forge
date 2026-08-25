export type BuilderMode = "preview" | "files" | "code" | "options";
export type ViewportMode = "desktop" | "tablet" | "phone";
export type PreviewTool = "select" | "text" | "comment" | "image";

export type ElementSelection = {
  tag: string;
  id: string | null;
  className: string | null;
  selector: string;
  text: string;
};

export type ImageSelection = {
  src: string;
  alt: string;
  selector: string;
};

export type FileNode = {
  path: string;
  type: "file" | "dir" | string;
  children?: FileNode[] | null;
};

export type ProjectInfo = {
  id: string;
  name: string;
  slug?: string;
  preview_running: boolean;
  preview_port: number | null;
  sites_url?: string | null;
  published_at?: string | null;
};

export function flattenFiles(nodes: FileNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.type === "dir") flattenFiles(n.children || [], acc);
    else acc.push(n.path);
  }
  return acc;
}

/** Heuristic routes for multi-page preview bar. */
export function detectRoutes(nodes: FileNode[]): string[] {
  const files = flattenFiles(nodes);
  const routes = new Set<string>(["/"]);
  for (const path of files) {
    const norm = path.replace(/\\/g, "/");
    if (/^src\/pages\//i.test(norm) && /\.(tsx|jsx|ts|js)$/i.test(norm)) {
      let route = norm
        .replace(/^src\/pages/i, "")
        .replace(/\.(tsx|jsx|ts|js)$/i, "")
        .replace(/\/index$/i, "");
      if (!route || route === "/") routes.add("/");
      else routes.add(route.startsWith("/") ? route : `/${route}`);
    }
    if (/^public\/.+\.html$/i.test(norm)) {
      const name = norm.replace(/^public\//i, "");
      if (name.toLowerCase() !== "index.html") {
        routes.add(`/${name}`);
      }
    }
  }
  return Array.from(routes).sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
}

export function collectPublicImages(nodes: FileNode[]): string[] {
  return flattenFiles(nodes).filter((p) => {
    const n = p.replace(/\\/g, "/");
    return /^public\//i.test(n) && /\.(png|jpe?g|webp|gif|svg)$/i.test(n);
  });
}

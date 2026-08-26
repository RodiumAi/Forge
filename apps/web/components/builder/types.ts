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

const ROUTE_PATH_RE =
  /<Route[^>]*\spath\s*=\s*["']([^"']+)["']|path\s*:\s*["']([^"']+)["']/gi;
const NAV_LINK_RE = /(?:to|href)\s*=\s*["'](\/(?!\/)[^"'#?]*)["']/gi;
const STATE_PAGE_RE =
  /(?:setCurrentPage\s*\(\s*['"](\w+)['"]|currentPage\s*===\s*['"](\w+)['"]|navigateTo(\w+))/gi;

function normalizeRoute(raw: string): string | null {
  let path = raw.trim();
  if (!path || path === "*" || path.includes("*") || path.includes(":")) return null;
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "") || "/";
  if (/\.(png|jpe?g|webp|gif|svg|css|js|tsx|jsx|html|pdf)$/i.test(path)) return null;
  return path;
}

/** Parse React Router paths and in-app Link/href targets from source text. */
export function parseRoutesFromSource(content: string): string[] {
  const routes = new Set<string>();
  for (const match of content.matchAll(ROUTE_PATH_RE)) {
    const normalized = normalizeRoute(match[1] || match[2] || "");
    if (normalized) routes.add(normalized);
  }
  for (const match of content.matchAll(NAV_LINK_RE)) {
    const normalized = normalizeRoute(match[1] || "");
    if (normalized) routes.add(normalized);
  }
  for (const match of content.matchAll(STATE_PAGE_RE)) {
    const page = (match[1] || match[2] || match[3] || "").toLowerCase();
    if (!page || page === "home") routes.add("/");
    else routes.add(`/${page}`);
  }
  return Array.from(routes);
}

export function routeSourceFiles(files: string[]): string[] {
  const out = new Set<string>();
  for (const path of files) {
    const norm = path.replace(/\\/g, "/");
    if (/^src\/(App|main|routes|router)\.(tsx|jsx|ts|js)$/i.test(norm)) out.add(path);
    if (/^src\/pages\/.+\.(tsx|jsx|ts|js)$/i.test(norm)) out.add(path);
    if (/^src\/components\/(Navbar|Header|Nav|Navigation|AboutPage).*\.(tsx|jsx)$/i.test(norm)) {
      out.add(path);
    }
  }
  return Array.from(out).slice(0, 20);
}

export function formatRouteLabel(path: string, homeLabel: string): string {
  if (path === "/") return homeLabel;
  const segment = path.replace(/^\//, "").split("/").filter(Boolean)[0] || path;
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Heuristic routes for multi-page preview bar. */
export function detectRoutes(
  nodes: FileNode[],
  sources: Record<string, string> = {},
): string[] {
  const files = flattenFiles(nodes);
  const routes = new Set<string>(["/"]);
  for (const path of files) {
    const norm = path.replace(/\\/g, "/");
    if (/^src\/pages\//i.test(norm) && /\.(tsx|jsx|ts|js)$/i.test(norm)) {
      const route = norm
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
  for (const content of Object.values(sources)) {
    for (const route of parseRoutesFromSource(content)) routes.add(route);
  }
  return Array.from(routes).sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)));
}

export function collectPublicImages(nodes: FileNode[]): string[] {
  return flattenFiles(nodes).filter((p) => {
    const n = p.replace(/\\/g, "/");
    return /^public\//i.test(n) && /\.(png|jpe?g|webp|gif|svg)$/i.test(n);
  });
}

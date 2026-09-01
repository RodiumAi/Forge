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
  /(?:set(?:Current|Active|Selected)?Page\s*\(\s*['"](\w+)['"]|(?:current|active|selected)Page\s*===\s*['"](\w+)['"]|navigateTo(\w+))/gi;
const PAGE_TYPE_UNION_RE =
  /(?:type|interface)\s+\w*(?:Page|View)\w*\s*=\s*([^;]+)/gi;
const QUOTED_LITERAL_RE = /['"](\w+)['"]/g;

function normalizeRoute(raw: string): string | null {
  let path = raw.trim();
  if (!path || path === "*" || path.includes("*") || path.includes(":")) return null;
  if (!path.startsWith("/")) path = `/${path}`;
  path = path.replace(/\/+$/, "") || "/";
  if (/\.(png|jpe?g|webp|gif|svg|css|js|tsx|jsx|html|pdf)$/i.test(path)) return null;
  return path;
}

function addStatePageRoute(routes: Set<string>, raw: string) {
  const page = raw.toLowerCase();
  if (!page || page === "home") routes.add("/");
  else routes.add(`/${page}`);
}

function componentPageSlug(path: string): string | null {
  const norm = path.replace(/\\/g, "/");
  const match = norm.match(/^src\/components\/(\w+)Page\.(tsx|jsx)$/i);
  if (!match) return null;
  const slug = match[1].toLowerCase();
  return slug === "home" ? null : slug;
}

function collectSectionIds(sources: Record<string, string>): Set<string> {
  const ids = new Set<string>();
  const re = /\bid\s*=\s*["']([a-z][\w-]*)["']/gi;
  for (const content of Object.values(sources)) {
    for (const match of content.matchAll(re)) ids.add(match[1].toLowerCase());
  }
  return ids;
}

function collectStandalonePageSlugs(
  files: string[],
  sources: Record<string, string>,
): Set<string> {
  const slugs = new Set<string>();
  for (const path of files) {
    const slug = componentPageSlug(path);
    if (slug) slugs.add(slug);
    const norm = path.replace(/\\/g, "/");
    if (/^src\/pages\//i.test(norm) && /\.(tsx|jsx|ts|js)$/i.test(norm)) {
      const route = norm
        .replace(/^src\/pages/i, "")
        .replace(/\.(tsx|jsx|ts|js)$/i, "")
        .replace(/\/index$/i, "")
        .replace(/^\//, "")
        .toLowerCase();
      if (route && route !== "home") slugs.add(route);
    }
  }
  for (const content of Object.values(sources)) {
    for (const match of content.matchAll(PAGE_TYPE_UNION_RE)) {
      for (const literal of (match[1] || "").matchAll(QUOTED_LITERAL_RE)) {
        const page = literal[1].toLowerCase();
        if (page && page !== "home") slugs.add(page);
      }
    }
    for (const match of content.matchAll(
      /(?:active|current|selected)Page\s*===\s*['"](\w+)['"]\s*\?\s*<\w+Page/gi,
    )) {
      slugs.add(match[1].toLowerCase());
    }
  }
  return slugs;
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
    addStatePageRoute(routes, match[1] || match[2] || match[3] || "");
  }
  for (const match of content.matchAll(PAGE_TYPE_UNION_RE)) {
    const body = match[1] || "";
    for (const literal of body.matchAll(QUOTED_LITERAL_RE)) {
      addStatePageRoute(routes, literal[1] || "");
    }
  }
  return Array.from(routes);
}

export function routeSourceFiles(files: string[]): string[] {
  const out = new Set<string>();
  for (const path of files) {
    const norm = path.replace(/\\/g, "/");
    if (/^src\/(App|main|routes|router)\.(tsx|jsx|ts|js)$/i.test(norm)) out.add(path);
    if (/^src\/pages\/.+\.(tsx|jsx|ts|js)$/i.test(norm)) out.add(path);
    if (
      /^src\/components\/(Navbar|Header|Nav|Navigation|\w+Page).*\.(tsx|jsx)$/i.test(norm)
    ) {
      out.add(path);
    }
    if (/^src\/context\/.*\.(tsx|jsx|ts)$/i.test(norm)) out.add(path);
    if (/^src\/types\/.*\.(tsx|ts)$/i.test(norm)) out.add(path);
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
  const standalone = collectStandalonePageSlugs(files, sources);
  const sectionIds = collectSectionIds(sources);
  const routes = new Set<string>(["/"]);

  for (const slug of standalone) {
    // A slug that is only an in-page section anchor (e.g. id="contact") is not a route.
    if (sectionIds.has(slug) && !files.some((f) => componentPageSlug(f) === slug)) continue;
    routes.add(`/${slug}`);
  }

  for (const path of files) {
    const norm = path.replace(/\\/g, "/");
    if (/^public\/.+\.html$/i.test(norm)) {
      const name = norm.replace(/^public\//i, "");
      if (name.toLowerCase() !== "index.html") {
        routes.add(`/${name}`);
      }
    }
  }

  for (const [path, content] of Object.entries(sources)) {
    const norm = path.replace(/\\/g, "/");
    if (!/^src\/(App|main|routes|router)\.(tsx|jsx|ts|js)$/i.test(norm)) continue;
    for (const route of parseRoutesFromSource(content)) {
      if (route === "/") {
        routes.add("/");
        continue;
      }
      const slug = route.replace(/^\//, "").toLowerCase();
      if (standalone.has(slug)) routes.add(route);
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

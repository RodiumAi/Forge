/**
 * Targeted chat edits for React projects (sites, mobile apps).
 *
 * The preview tags host elements with `data-forge-id="<file>:<line>:<col>"`
 * (1-based, see apps/api/runtime/transform.mjs). A chat message carries
 * `target: { route, forgeId?, filePath?, restrict? }`; with `restrict` the API
 * refuses writes outside the selection's files and reports each one as a
 * `TARGET_SCOPE` warning (`violation.widen: true`), and the builder offers to
 * resend with `restrict: false`.
 */

export type ChatTarget = {
  route?: string;
  forgeId?: string;
  filePath?: string;
  restrict?: boolean;
  /** Pages picked in the pages rail: the request applies to them (a focus, not a write limit). */
  pages?: string[];
};

export type ForgeLocation = { file: string; line: number; col: number };

export const TARGET_SCOPE_CODE = "TARGET_SCOPE";

const FORGE_ID_RE = /^(.+\.(?:tsx|jsx|ts|js)):([1-9]\d*):([1-9]\d*)$/;

export function parseForgeId(raw: unknown): ForgeLocation | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(FORGE_ID_RE);
  if (!m) return null;
  return { file: m[1], line: Number(m[2]), col: Number(m[3]) };
}

/** `Hero.tsx:12`: short source location for the selection chip. */
export function forgeIdLabel(raw: unknown): string | null {
  const loc = parseForgeId(raw);
  if (!loc) return null;
  const base = loc.file.split("/").pop() || loc.file;
  return `${base}:${loc.line}`;
}

/**
 * Target sent with a chat message. The current route always travels; the
 * element id and the restriction only with a selection. Undefined when there
 * is nothing to say (the API then treats the message as project-wide).
 */
export function buildChatTarget(input: {
  route?: string | null;
  selection?: { forgeId?: string | null } | null;
  restrict?: boolean;
  pages?: readonly string[] | null;
}): ChatTarget | undefined {
  const target: ChatTarget = {};
  const route = (input.route || "").trim();
  if (route) target.route = route.startsWith("/") ? route : `/${route}`;
  const forgeId = parseForgeId(input.selection?.forgeId) ? String(input.selection?.forgeId).trim() : "";
  if (forgeId) target.forgeId = forgeId;
  if (input.selection && input.restrict) target.restrict = true;
  const pages: string[] = [];
  for (const raw of input.pages ?? []) {
    const p = (raw || "").trim();
    if (!p) continue;
    const path = p.startsWith("/") ? p : `/${p}`;
    if (!pages.includes(path) && pages.length < 40) pages.push(path);
  }
  if (pages.length) target.pages = pages;
  return Object.keys(target).length ? target : undefined;
}

type WarningLike = { code?: string; path?: string };

/** Paths the API refused because the edit was limited to the selection. */
export function scopeRefusedPaths(warnings: readonly WarningLike[]): string[] {
  const out: string[] = [];
  for (const w of warnings) {
    if (w.code !== TARGET_SCOPE_CODE || !w.path) continue;
    if (!out.includes(w.path)) out.push(w.path);
  }
  return out;
}

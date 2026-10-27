/**
 * Integrations picked from the composer's + menu.
 *
 * They travel as a plain marker line at the top of the message,
 * "[Integrations: Google Maps Embed (google-maps)]", like the pages marker:
 * the API reads the ids to load each integration's guide into the AI context,
 * and the sent bubble shows them as tags.
 */

export type PickedIntegration = {
  id: string;
  name: string;
  /** Domains of the embed snippet ("google.com"); empty = any iframe/script/URL. */
  embedHosts?: string[];
  logoUrl?: string | null;
};

const MARKER_RE = /\[(?:Integrations|Intégrations)\s*:\s*([^\]]*)\]/i;
const MARKER_RE_GLOBAL = /\[(?:Integrations|Intégrations)\s*:\s*[^\]]*\]\s*/gi;
const ITEM_RE = /([^,(]+?)\s*\(([a-z0-9][a-z0-9-]{1,62})\)/g;

export function formatIntegrationsMarker(items: readonly PickedIntegration[], label: string): string {
  if (!items.length) return "";
  return `[${label}: ${items.map((i) => `${i.name.replace(/[[\](),]/g, " ").trim()} (${i.id})`).join(", ")}]`;
}

export function parseIntegrationsMarker(raw: string): PickedIntegration[] {
  const match = (raw || "").match(MARKER_RE);
  if (!match) return [];
  const out: PickedIntegration[] = [];
  for (const m of (match[1] || "").matchAll(ITEM_RE)) {
    if (!out.some((x) => x.id === m[2])) out.push({ id: m[2], name: m[1].trim() });
  }
  return out;
}

export function stripIntegrationsMarker(raw: string): string {
  return (raw || "").replace(MARKER_RE_GLOBAL, "");
}

const ANY_EMBED_RE = /<iframe\b|<script\b|https?:\/\/[^\s"'<>]+/i;

/**
 * Integrations whose snippet is not in the message: none of its embed domains
 * appears in a URL of the text (or, without known domains, the text has no
 * iframe, script or URL at all). The composer asks before sending those.
 */
export function integrationsMissingSnippet(text: string, items: readonly PickedIntegration[]): PickedIntegration[] {
  const urls = (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).map((u) => {
    try {
      return new URL(u).hostname.toLowerCase();
    } catch {
      return "";
    }
  });
  return items.filter((item) => {
    const hosts = (item.embedHosts || []).map((h) => h.toLowerCase());
    if (!hosts.length) return !ANY_EMBED_RE.test(text);
    return !urls.some((h) => hosts.some((d) => h === d || h.endsWith(`.${d}`)));
  });
}

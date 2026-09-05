/**
 * Helpers for turning a refused visual text edit (ambiguous match) into a
 * chat prompt the agent can apply safely across files.
 */

/** Pull source paths out of the API's "… files. a.tsx, b.tsx" detail string. */
export function extractCandidatePaths(detail: string): string[] {
  const text = (detail || "").trim();
  if (!text) return [];
  const match = text.match(
    /((?:[\w./@-]+\.(?:tsx?|jsx?|css|mdx?))(?:\s*,\s*[\w./@-]+\.(?:tsx?|jsx?|css|mdx?))*)\s*(?:\([^)]*\))?\s*$/i,
  );
  if (!match) return [];
  return match[1]
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

type PromptLabels = {
  /** Full prompt template with {old}, {new}, and optional {filesClause}. */
  template: string;
  /** Prefixed clause when paths are known, e.g. " (notamment dans {files})". */
  filesClause: string;
};

/** Build the chat prompt sent when the user clicks "Take action". */
export function buildAmbiguousEditPrompt(
  oldText: string,
  newText: string,
  paths: string[],
  labels: PromptLabels,
): string {
  const filesClause =
    paths.length > 0 ? labels.filesClause.replace("{files}", paths.join(", ")) : "";
  return labels.template
    .replace("{old}", oldText.trim())
    .replace("{new}", newText.trim())
    .replace("{filesClause}", filesClause);
}

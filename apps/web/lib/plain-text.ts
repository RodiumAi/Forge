/** Plain chat copy: no emoji, no markdown chrome. */

const EMOJI_RE =
  /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu;

function decodeEntities(raw: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("textarea");
    el.innerHTML = raw;
    return el.value;
  }
  return raw
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function toPlainChatText(raw: string | null | undefined): string {
  if (!raw) return "";
  let text = decodeEntities(String(raw));
  text = text.replace(EMOJI_RE, "");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2");
  text = text.replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2");
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "- ");
  text = text.replace(/^\s*\d+\.\s+/gm, "- ");
  text = text.replace(/\*\*/g, "").replace(/__/g, "").replace(/\*/g, "");
  text = text.replace(/[ \t]{2,}/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text
    .split("\n")
    .map((ln) => ln.trimEnd())
    .join("\n")
    .trim();
}

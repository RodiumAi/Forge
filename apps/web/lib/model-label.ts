/**
 * Readable names for gateway model slugs: "anthropic/claude-sonnet-5-5"
 * reads "Claude Sonnet 5.5", "openai/gpt-5.6-sol" reads "GPT 5.6 Sol".
 */

const UPPER = new Set(["gpt", "glm", "ai", "oss", "vl"]);
const PROVIDERS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  zai: "Z.ai",
  xai: "xAI",
  meta: "Meta",
  mistral: "Mistral",
  qwen: "Qwen",
  moonshot: "Moonshot",
};

export function modelName(slug: string): string {
  const bare = slug.includes("/") ? slug.slice(slug.indexOf("/") + 1) : slug;
  const words: string[] = [];
  for (const part of bare.split("-").filter(Boolean)) {
    const prev = words[words.length - 1];
    // "5-5" is a version: 5.5. A version already holding a dot stays apart.
    if (/^\d+$/.test(part) && prev && /^\d+$/.test(prev)) {
      words[words.length - 1] = `${prev}.${part}`;
      continue;
    }
    if (UPPER.has(part.toLowerCase())) words.push(part.toUpperCase());
    else if (/^\d/.test(part)) words.push(part);
    else words.push(part.charAt(0).toUpperCase() + part.slice(1));
  }
  return words.join(" ") || slug;
}

export function modelProvider(slug: string): string | undefined {
  if (!slug.includes("/")) return undefined;
  const key = slug.slice(0, slug.indexOf("/")).toLowerCase();
  return PROVIDERS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

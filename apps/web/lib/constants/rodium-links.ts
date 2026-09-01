/** Official RodiumAI URLs — aligned with rodiumai_user social-links + legal routes. */
export const RODIUM_SITE = "https://rodiumai.io" as const;

export const SOCIAL_LINKS = {
  discord: "https://discord.gg/Av7J9GBJAJ",
  linkedin: "https://www.linkedin.com/company/rodiuam-ai",
  github: "https://github.com/RodiumAi",
  youtube: "https://www.youtube.com/@rodium-ai",
  x: "https://x.com/rodium_ai",
} as const;

export const FORGE_REPO = "https://github.com/RodiumAi/Forge" as const;
export const FORGE_CONTRIBUTE = `${FORGE_REPO}#contributing` as const;

export const RODIUM_LEGAL = {
  help: `${RODIUM_SITE}/help`,
  privacy: `${RODIUM_SITE}/privacy`,
  terms: `${RODIUM_SITE}/terms`,
  trust: `${RODIUM_SITE}/trust`,
  cookies: `${RODIUM_SITE}/privacy#cookies`,
} as const;

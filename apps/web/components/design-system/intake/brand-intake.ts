/**
 * Brand intake of a new design system ("Créer une charte graphique"): the
 * fields, their validation and the prompt the API generation flow reads.
 *
 * The flow (`apps/api/app/services/design_system/flow.py`) reads the first
 * website URL of the message (colours, fonts, one screenshot) and the first
 * image attached to it as the logo, so the prompt keeps the URL plain and the
 * main logo is always the first attached image.
 */

export type IntakeLocale = "fr" | "en";

export const TONE_IDS = ["friendly", "expert", "playful", "premium", "direct"] as const;
export type ToneId = (typeof TONE_IDS)[number];

export const MAX_BRAND_COLORS = 3;
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp";

export type LogoSlot = "logo" | "logoDark" | "icon";

export type IntakeFields = {
  name: string;
  activity: string;
  audience: string;
  website: string;
  /** Empty: Forge picks the palette. */
  colors: string[];
  /** Empty: Forge picks the fonts. */
  fonts: string;
  tones: ToneId[];
  toneNotes: string;
  avoid: string;
  language: IntakeLocale;
  /** What was typed in the home composer when it is not just a name. */
  notes: string;
  logo: File | null;
  logoDark: File | null;
  icon: File | null;
};

export type IntakeErrorCode =
  | "name_required"
  | "website_https"
  | "website_invalid"
  | "color_invalid"
  | "logo_type"
  | "logo_size"
  | "dark_needs_logo";

export type IntakeErrors = Partial<Record<"name" | "website" | "colors" | LogoSlot, IntakeErrorCode>>;

export function emptyIntake(language: IntakeLocale): IntakeFields {
  return {
    name: "",
    activity: "",
    audience: "",
    website: "",
    colors: [],
    fonts: "",
    tones: [],
    toneNotes: "",
    avoid: "",
    language,
    notes: "",
    logo: null,
    logoDark: null,
    icon: null,
  };
}

/**
 * True when the composer text reads as a brand name rather than a brief:
 * short, a few words, no sentence punctuation, no URL.
 */
export function looksLikeName(raw: string): boolean {
  const text = raw.trim();
  if (!text || text.length > 40) return false;
  if (/https?:\/\/|www\./i.test(text)) return false;
  if (/[.!?:;,\n]/.test(text)) return false;
  return text.split(/\s+/).length <= 4;
}

/** The intake prefilled from what was typed in the composer. */
export function intakeFromText(raw: string, language: IntakeLocale): IntakeFields {
  const base = emptyIntake(language);
  const text = raw.trim();
  if (!text) return base;
  if (looksLikeName(text)) return { ...base, name: text };
  return { ...base, notes: text.slice(0, 2000) };
}

/**
 * The website as an https URL, or an error. A bare domain gets `https://`;
 * an `http://` address is refused (the API only reads https sites).
 */
export function normalizeWebsite(raw: string): { url: string | null; error?: IntakeErrorCode } {
  const text = raw.trim();
  if (!text) return { url: null };
  if (/^http:\/\//i.test(text)) return { url: null, error: "website_https" };
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { url: null, error: "website_invalid" };
  }
  if (parsed.protocol !== "https:") return { url: null, error: "website_https" };
  const host = parsed.hostname;
  if (!host.includes(".") || host.startsWith(".") || host.endsWith(".") || /\s/.test(host)) {
    return { url: null, error: "website_invalid" };
  }
  return { url: parsed.toString() };
}

/** `#abc` or `#aabbcc` (the `#` optional) as lowercase `#aabbcc`, else null. */
export function normalizeHex(raw: string): string | null {
  const text = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(text)) {
    return `#${text
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text.toLowerCase()}`;
  return null;
}

const LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const LOGO_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp"];

export function isSvgFile(file: File): boolean {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

/** Null when the file can be a logo: PNG, JPEG, SVG or WebP, 4 MB at most. */
export function checkLogoFile(file: File): IntakeErrorCode | null {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const typeOk = file.type ? LOGO_TYPES.includes(file.type.toLowerCase()) : LOGO_EXTENSIONS.includes(ext);
  if (!typeOk) return "logo_type";
  if (file.size > MAX_LOGO_BYTES) return "logo_size";
  return null;
}

export function validateIntake(fields: IntakeFields): IntakeErrors {
  const errors: IntakeErrors = {};
  if (!fields.name.trim()) errors.name = "name_required";
  const site = normalizeWebsite(fields.website);
  if (site.error) errors.website = site.error;
  if (fields.colors.some((c) => normalizeHex(c) === null)) errors.colors = "color_invalid";
  for (const slot of ["logo", "logoDark", "icon"] as const) {
    const file = fields[slot];
    const code = file ? checkLogoFile(file) : null;
    if (code) errors[slot] = code;
  }
  if (fields.logoDark && !fields.logo && !errors.logoDark) errors.logoDark = "dark_needs_logo";
  return errors;
}

export function hasErrors(errors: IntakeErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** File names given to the uploads, so the prompt and the attachments agree. */
export const ATTACHMENT_NAMES = { logo: "brand-logo", icon: "brand-icon" } as const;

const TONE_LABELS: Record<IntakeLocale, Record<ToneId, string>> = {
  fr: { friendly: "chaleureux", expert: "expert", playful: "ludique", premium: "premium", direct: "direct" },
  en: { friendly: "friendly", expert: "expert", playful: "playful", premium: "premium", direct: "direct" },
};

const PROMPT_COPY: Record<
  IntakeLocale,
  {
    intro: (name: string) => string;
    name: string;
    activity: string;
    audience: string;
    website: string;
    websiteNote: string;
    colors: string;
    fonts: string;
    forgeChooses: string;
    tone: string;
    avoid: string;
    logo: string;
    logoAttached: string;
    logoNone: string;
    logoFromIcon: string;
    logoDark: string;
    logoDarkProvided: string;
    icon: string;
    iconAttached: (file: string) => string;
    language: string;
    languageName: Record<IntakeLocale, string>;
    notes: string;
  }
> = {
  fr: {
    intro: (name) => `Crée la charte graphique de la marque « ${name} » à partir des informations ci-dessous.`,
    name: "Nom de la marque",
    activity: "Activité",
    audience: "Public visé",
    website: "Site web",
    websiteNote: "Lis ce site pour reprendre ses couleurs et ses polices.",
    colors: "Couleurs de la marque",
    fonts: "Polices",
    forgeChooses: "au choix de Forge",
    tone: "Ton de voix",
    avoid: "À éviter",
    logo: "Logo",
    logoAttached: "image jointe, à utiliser comme logo principal (fonds clairs)",
    logoNone: "aucun, propose un logotype à partir du nom",
    logoFromIcon: "pas de logo principal, pars de l'icône jointe",
    logoDark: "Logo pour fonds sombres",
    logoDarkProvided: "fourni, il sera ajouté à la charte",
    icon: "Icône carrée",
    iconAttached: (file) => `image jointe « ${file} », pour l'avatar et le favicon`,
    language: "Langue de la charte",
    languageName: { fr: "français", en: "anglais" },
    notes: "Précisions",
  },
  en: {
    intro: (name) => `Create the brand guidelines of "${name}" from the details below.`,
    name: "Brand name",
    activity: "What the brand does",
    audience: "Audience",
    website: "Website",
    websiteNote: "Read this site to pick up its colours and fonts.",
    colors: "Brand colours",
    fonts: "Fonts",
    forgeChooses: "Forge chooses",
    tone: "Tone of voice",
    avoid: "Avoid",
    logo: "Logo",
    logoAttached: "attached image, use it as the main logo (light backgrounds)",
    logoNone: "none, suggest a wordmark from the name",
    logoFromIcon: "no main logo, start from the attached icon",
    logoDark: "Logo for dark backgrounds",
    logoDarkProvided: "provided, it will be added to the guidelines",
    icon: "Square icon",
    iconAttached: (file) => `attached image "${file}", for the avatar and the favicon`,
    language: "Language of the guidelines",
    languageName: { fr: "French", en: "English" },
    notes: "More details",
  },
};

function oneLine(value: string, max = 300): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * The first message of the design system chat, written in the guide's
 * language: one labelled line per field. The website stays a plain URL on its
 * own line so the API flow finds it.
 */
export function buildIntakePrompt(fields: IntakeFields, iconFileName?: string | null): string {
  const copy = PROMPT_COPY[fields.language];
  const name = oneLine(fields.name, 120);
  const lines: string[] = [copy.intro(name), ""];
  // French typography puts a space before the colon, English does not.
  const sep = fields.language === "fr" ? " : " : ": ";
  const add = (label: string, value: string) => lines.push(`${label}${sep}${value}`);

  add(copy.name, name);
  if (fields.activity.trim()) add(copy.activity, oneLine(fields.activity));
  if (fields.audience.trim()) add(copy.audience, oneLine(fields.audience));

  const site = normalizeWebsite(fields.website).url;
  if (site) {
    add(copy.website, site);
    lines.push(copy.websiteNote);
  }

  const colors = fields.colors.map(normalizeHex).filter((c): c is string => Boolean(c));
  add(copy.colors, colors.length ? colors.join(", ") : copy.forgeChooses);
  add(copy.fonts, fields.fonts.trim() ? oneLine(fields.fonts, 160) : copy.forgeChooses);

  const tones = fields.tones.map((id) => TONE_LABELS[fields.language][id]);
  const toneText = [tones.join(", "), oneLine(fields.toneNotes)].filter(Boolean).join(". ");
  if (toneText) add(copy.tone, toneText);
  if (fields.avoid.trim()) add(copy.avoid, oneLine(fields.avoid));

  add(copy.logo, fields.logo ? copy.logoAttached : fields.icon ? copy.logoFromIcon : copy.logoNone);
  if (fields.logoDark) add(copy.logoDark, copy.logoDarkProvided);
  if (fields.icon) add(copy.icon, copy.iconAttached(iconFileName || `${ATTACHMENT_NAMES.icon}.png`));

  add(copy.language, copy.languageName[fields.language]);

  const notes = fields.notes.trim();
  if (notes) {
    lines.push("", `${copy.notes}${sep.trimEnd()}`, notes.slice(0, 2000));
  }
  return lines.join("\n");
}

// ── assets kept for the editor ─────────────────────────────────────────────

/**
 * Brand files the generation would not keep (the dark logo: the flow resets
 * `logo.darkSrc` when it writes the main logo; the square icon, which only the
 * icon variant of the logo endpoint stores as `logo.iconSrc`). The editor uploads them through
 * the logo endpoint once the first generation is done. In memory only: the
 * home page hands over to the editor by client navigation; after a reload the
 * file is gone and the user uploads it from the Logo section.
 */
export type PendingBrandAssets = { logoDark?: File; icon?: File };

const pendingAssets = new Map<string, PendingBrandAssets>();

export function setPendingBrandAssets(projectId: string, assets: PendingBrandAssets): void {
  if (assets.logoDark || assets.icon) pendingAssets.set(projectId, assets);
}

export function takePendingBrandAssets(projectId: string): PendingBrandAssets | null {
  const assets = pendingAssets.get(projectId) ?? null;
  pendingAssets.delete(projectId);
  return assets;
}

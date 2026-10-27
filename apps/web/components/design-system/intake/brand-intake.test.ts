import { describe, expect, it } from "vitest";

import {
  buildIntakePrompt,
  checkLogoFile,
  emptyIntake,
  intakeFromText,
  looksLikeName,
  normalizeHex,
  normalizeWebsite,
  setPendingBrandAssets,
  takePendingBrandAssets,
  validateIntake,
  type IntakeFields,
} from "./brand-intake";

function file(name: string, type: string, size = 1000): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

function filled(over: Partial<IntakeFields> = {}): IntakeFields {
  return {
    ...emptyIntake("fr"),
    name: "Nova",
    activity: "Application de paiement pour les petits commerces",
    audience: "Commerçants",
    website: "nova-pay.fr",
    colors: ["#EB6118", "1c1f26"],
    fonts: "Open Sauce Sans",
    tones: ["friendly", "expert"],
    toneNotes: "Phrases courtes",
    avoid: "Couleurs fluo",
    ...over,
  };
}

describe("brand intake validation", () => {
  it("requires the brand name only", () => {
    expect(validateIntake(emptyIntake("fr"))).toEqual({ name: "name_required" });
    expect(validateIntake({ ...emptyIntake("fr"), name: "  " }).name).toBe("name_required");
    expect(validateIntake({ ...emptyIntake("fr"), name: "Nova" })).toEqual({});
  });

  it("accepts https websites and bare domains, refuses http and garbage", () => {
    expect(normalizeWebsite("https://nova.fr/about").url).toBe("https://nova.fr/about");
    expect(normalizeWebsite("nova.fr").url).toBe("https://nova.fr/");
    expect(normalizeWebsite("http://nova.fr").error).toBe("website_https");
    expect(normalizeWebsite("ftp://nova.fr").error).toBe("website_https");
    expect(normalizeWebsite("not a site").error).toBe("website_invalid");
    expect(normalizeWebsite("localhost").error).toBe("website_invalid");
    expect(normalizeWebsite("").url).toBeNull();
    expect(validateIntake({ ...emptyIntake("fr"), name: "Nova", website: "http://nova.fr" }).website).toBe("website_https");
  });

  it("checks the logo type and size", () => {
    expect(checkLogoFile(file("logo.png", "image/png"))).toBeNull();
    expect(checkLogoFile(file("logo.svg", "image/svg+xml"))).toBeNull();
    expect(checkLogoFile(file("logo.webp", "image/webp"))).toBeNull();
    expect(checkLogoFile(file("logo.jpg", "image/jpeg"))).toBeNull();
    expect(checkLogoFile(file("logo.gif", "image/gif"))).toBe("logo_type");
    expect(checkLogoFile(file("logo.pdf", "application/pdf"))).toBe("logo_type");
    expect(checkLogoFile(file("logo.png", "image/png", 4 * 1024 * 1024 + 1))).toBe("logo_size");
    expect(checkLogoFile(file("logo.png", "image/png", 4 * 1024 * 1024))).toBeNull();
    const errors = validateIntake({ ...emptyIntake("fr"), name: "Nova", icon: file("i.gif", "image/gif") });
    expect(errors.icon).toBe("logo_type");
  });

  it("needs the main logo before a dark version", () => {
    const dark = file("dark.png", "image/png");
    expect(validateIntake({ ...emptyIntake("fr"), name: "Nova", logoDark: dark }).logoDark).toBe("dark_needs_logo");
    expect(validateIntake({ ...emptyIntake("fr"), name: "Nova", logo: file("l.png", "image/png"), logoDark: dark })).toEqual({});
  });

  it("validates hex colours", () => {
    expect(normalizeHex("#EB6118")).toBe("#eb6118");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex("#12345")).toBeNull();
    expect(validateIntake({ ...emptyIntake("fr"), name: "Nova", colors: ["#zzzzzz"] }).colors).toBe("color_invalid");
  });

  it("prefills the name from a short text and the details from a brief", () => {
    expect(looksLikeName("Nova Pay")).toBe(true);
    expect(looksLikeName("Une charte pour une fintech, bleu et vert.")).toBe(false);
    expect(intakeFromText("Nova Pay", "fr").name).toBe("Nova Pay");
    const brief = intakeFromText("Une charte pour une fintech, bleu et vert.", "en");
    expect(brief.name).toBe("");
    expect(brief.notes).toBe("Une charte pour une fintech, bleu et vert.");
    expect(brief.language).toBe("en");
  });
});

describe("brand intake prompt", () => {
  it("writes one labelled line per field, the website as a plain URL", () => {
    const prompt = buildIntakePrompt(
      filled({ logo: file("logo.png", "image/png"), logoDark: file("d.png", "image/png"), icon: file("i.png", "image/png") }),
      "brand-icon.png",
    );
    expect(prompt).toBe(
      [
        "Crée la charte graphique de la marque « Nova » à partir des informations ci-dessous.",
        "",
        "Nom de la marque : Nova",
        "Activité : Application de paiement pour les petits commerces",
        "Public visé : Commerçants",
        "Site web : https://nova-pay.fr/",
        "Lis ce site pour reprendre ses couleurs et ses polices.",
        "Couleurs de la marque : #eb6118, #1c1f26",
        "Polices : Open Sauce Sans",
        "Ton de voix : chaleureux, expert. Phrases courtes",
        "À éviter : Couleurs fluo",
        "Logo : image jointe, à utiliser comme logo principal (fonds clairs)",
        "Logo pour fonds sombres : fourni, il sera ajouté à la charte",
        "Icône carrée : image jointe « brand-icon.png », pour l'avatar et le favicon",
        "Langue de la charte : français",
      ].join("\n"),
    );
    expect(prompt).not.toContain(String.fromCharCode(0x2014));
  });

  it("lets Forge choose when nothing is given, in English", () => {
    const prompt = buildIntakePrompt({ ...emptyIntake("en"), name: "Nova", notes: "A calm bank." });
    expect(prompt).toContain('Create the brand guidelines of "Nova"');
    expect(prompt).toContain("Brand colours: Forge chooses");
    expect(prompt).toContain("Fonts: Forge chooses");
    expect(prompt).toContain("Logo: none, suggest a wordmark from the name");
    expect(prompt).toContain("Language of the guidelines: English");
    expect(prompt).toMatch(/More details:\nA calm bank\.$/);
    expect(prompt).not.toContain("Website");
  });
});

describe("pending brand assets", () => {
  it("are taken once", () => {
    const dark = file("d.png", "image/png");
    setPendingBrandAssets("p1", { logoDark: dark });
    expect(takePendingBrandAssets("p1")?.logoDark).toBe(dark);
    expect(takePendingBrandAssets("p1")).toBeNull();
  });
});

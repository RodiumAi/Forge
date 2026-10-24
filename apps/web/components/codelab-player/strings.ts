/**
 * Player strings, French and English. The player is bundled alone for the
 * published page, so it carries its own table instead of the web dictionary.
 */

export type CodelabLocale = "fr" | "en";

const fr = {
  copy: "Copier",
  copied: "Copié",
  copyFailed: "Échec",
  download: "Télécharger",
  downloadFile: "Télécharger ce fichier",
  showMore: "Afficher plus ({n} lignes)",
  showLess: "Afficher moins",
  terminal: "Terminal",
  tree: "Arborescence",
  calloutInfo: "Info",
  calloutTip: "Astuce",
  calloutWarning: "Attention",
  calloutDanger: "Danger",
  downloads: "Téléchargements",
  downloadMissing: "Fichier introuvable : {name}",
  zip: "ZIP",
  home: "Accueil",
  start: "Commencer",
  resume: "Reprendre à l'étape {n}",
  restart: "Recommencer",
  previous: "Précédent",
  next: "Suivant",
  finish: "Terminer",
  end: "Fin",
  steps: "Étapes",
  stepOf: "Étape {n} sur {total}",
  minutes: "{n} min",
  duration: "Durée",
  level: "Niveau",
  levelBeginner: "Débutant",
  levelIntermediate: "Intermédiaire",
  levelAdvanced: "Avancé",
  prerequisites: "Prérequis",
  learn: "Ce que vous apprendrez",
  author: "Auteur",
  openRepo: "Ouvrir dans un dépôt",
  search: "Rechercher dans le codelab",
  searchEmpty: "Aucun résultat",
  searchResults: "{n} résultat(s)",
  print: "Imprimer ou PDF",
  menu: "Menu des étapes",
  closeMenu: "Fermer le menu",
  progress: "Progression : {n} %",
  doneTitle: "Bravo, vous avez terminé !",
  doneLead: "Récapitulatif de ce que vous avez parcouru :",
  feedback: "Donner votre avis",
  backToStart: "Retour au début",
  shortcuts: "Raccourcis : ← → pour naviguer, / pour chercher",
  madeWith: "Made with Forge",
  empty: "Cette étape est vide.",
};

export type StringKey = keyof typeof fr;

const en: Record<StringKey, string> = {
  copy: "Copy",
  copied: "Copied",
  copyFailed: "Failed",
  download: "Download",
  downloadFile: "Download this file",
  showMore: "Show more ({n} lines)",
  showLess: "Show less",
  terminal: "Terminal",
  tree: "File tree",
  calloutInfo: "Info",
  calloutTip: "Tip",
  calloutWarning: "Warning",
  calloutDanger: "Danger",
  downloads: "Downloads",
  downloadMissing: "File not found: {name}",
  zip: "ZIP",
  home: "Home",
  start: "Start",
  resume: "Resume at step {n}",
  restart: "Start over",
  previous: "Previous",
  next: "Next",
  finish: "Finish",
  end: "End",
  steps: "Steps",
  stepOf: "Step {n} of {total}",
  minutes: "{n} min",
  duration: "Duration",
  level: "Level",
  levelBeginner: "Beginner",
  levelIntermediate: "Intermediate",
  levelAdvanced: "Advanced",
  prerequisites: "Prerequisites",
  learn: "What you will learn",
  author: "Author",
  openRepo: "Open in a repository",
  search: "Search the codelab",
  searchEmpty: "No results",
  searchResults: "{n} result(s)",
  print: "Print or PDF",
  menu: "Steps menu",
  closeMenu: "Close the menu",
  progress: "Progress: {n}%",
  doneTitle: "Well done, you finished!",
  doneLead: "Here is what you went through:",
  feedback: "Give feedback",
  backToStart: "Back to the start",
  shortcuts: "Shortcuts: ← → to navigate, / to search",
  madeWith: "Made with Forge",
  empty: "This step is empty.",
};

const TABLES: Record<CodelabLocale, Record<StringKey, string>> = { fr, en };

export type Translate = (key: StringKey, vars?: Record<string, string | number>) => string;

export function translator(locale: CodelabLocale): Translate {
  const table = TABLES[locale] ?? fr;
  return (key, vars) => {
    let text = table[key] ?? fr[key] ?? key;
    if (vars) for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
    return text;
  };
}

export function resolveCodelabLocale(raw: unknown): CodelabLocale {
  return typeof raw === "string" && raw.toLowerCase().startsWith("en") ? "en" : "fr";
}

/**
 * Player strings. The player is bundled on its own for published decks, so it
 * carries its two languages instead of using the app i18n provider.
 */

import type { PlayerLocale } from "./types";

const LABELS = {
  fr: {
    previous: "Précédent",
    next: "Suivant",
    fullscreen: "Plein écran",
    exitFullscreen: "Quitter le plein écran",
    presenter: "Vue présentateur",
    goTo: "Aller à la slide",
    madeWith: "Fait avec Forge",
    notes: "Notes",
    noNotes: "Pas de notes pour cette slide.",
    nextSlide: "Slide suivante",
    endOfDeck: "Fin de la présentation",
    current: "Slide actuelle",
    elapsed: "Temps écoulé",
    pause: "Pause",
    resume: "Reprendre",
    reset: "Remettre à zéro",
    clock: "Heure",
    waiting: "En attente de la fenêtre du public...",
    blackScreen: "Écran noir",
    whiteScreen: "Écran blanc",
    step: "Étape",
  },
  en: {
    previous: "Previous",
    next: "Next",
    fullscreen: "Full screen",
    exitFullscreen: "Exit full screen",
    presenter: "Presenter view",
    goTo: "Go to slide",
    madeWith: "Made with Forge",
    notes: "Notes",
    noNotes: "No notes for this slide.",
    nextSlide: "Next slide",
    endOfDeck: "End of the presentation",
    current: "Current slide",
    elapsed: "Elapsed",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    clock: "Time",
    waiting: "Waiting for the audience window...",
    blackScreen: "Black screen",
    whiteScreen: "White screen",
    step: "Step",
  },
} as const;

export type PlayerLabels = { [K in keyof (typeof LABELS)["fr"]]: string };

export function detectLocale(): PlayerLocale {
  if (typeof navigator === "undefined") return "fr";
  return (navigator.language || "fr").toLowerCase().startsWith("en") ? "en" : "fr";
}

export function playerLabels(locale: PlayerLocale | undefined): PlayerLabels {
  return LABELS[locale ?? detectLocale()] ?? LABELS.fr;
}

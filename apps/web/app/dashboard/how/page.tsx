"use client";

import { HomeLayout } from "@/components/HomeLayout";
import { useI18n } from "@/lib/i18n/I18nProvider";
import Link from "next/link";

type Step = { title: string; body: string };
type Card = { kicker: string; title: string; body: string };
type Copy = {
  kicker: string;
  title: string;
  lead: string;
  stepsTitle: string;
  steps: Step[];
  poolsTitle: string;
  pools: Card[];
  weekTitle: string;
  weekBody: string;
  monthTitle: string;
  monthBody: string;
  upgradeTitle: string;
  upgradeLead: string;
  upgrade: Card[];
  byokTitle: string;
  byokBody: string;
  plansTitle: string;
  plans: Card[];
  cta: string;
};

const COPY: Record<"en" | "fr", Copy> = {
  en: {
    kicker: "Forge Cloud",
    title: "How it works",
    lead: "You build in Forge. The credits that pay for generation live on your RodiumAI account, which is created with this one.",
    stepsTitle: "From sign-up to the next month",
    steps: [
      {
        title: "Create your Forge account",
        body: "Confirm your email. That creates the matching RodiumAI account, puts you on Free, and starts you with 500 FRODI for the month.",
      },
      {
        title: "Send the first prompt",
        body: "Forge builds the project and spends FRODI first. When that credit is gone, the same request continues on your RODI wallet.",
      },
      {
        title: "Move to a paid plan",
        body: "The plan is paid once a month. Each week you receive a new FRODI credit. That weekly number is usage credit, not a second bill.",
      },
      {
        title: "The week ends at midnight",
        body: "A week is seven calendar days. Subscribe Monday at 17:00 and that credit ends the following Monday at midnight. Unused FRODI are not carried over.",
      },
      {
        title: "Renew with one click",
        body: "There is no automatic debit. When the month is due, you pay again in one click. After the due date the plan is past due and new weekly credits stop.",
      },
    ],
    poolsTitle: "Two credits, one order",
    pools: [
      {
        kicker: "Spent first",
        title: "FRODI",
        body: "Forge Cloud credit. Free includes 500 FRODI a month. A paid plan includes a weekly credit. It expires. It does not roll into the next period.",
      },
      {
        kicker: "Spent after",
        title: "RODI",
        body: "Your RodiumAI wallet. It stays until you use it. Forge only touches it after the FRODI for the current period is finished. Top up from Use your RODI balance.",
      },
    ],
    byokTitle: "You can also bring your own key",
    byokBody:
      "In Generation settings, paste a RodiumAI API key. Forge then bills that key. Those generations do not use a Forge plan or FRODI. An open-source clone of Forge works the same way: your key, not a subscription.",
    weekTitle: "The week, in plain terms",
    weekBody:
      "Day 1 is the day you subscribe or the day a new week starts. Day 7 ends at midnight UTC, which is midnight in Lomé and Accra. The next grant arrives then, if the subscription is still active.",
    monthTitle: "The month",
    monthBody:
      "A paid subscription lasts one calendar month from the payment. You are not charged every week. Adding a team seat is prorated and paid immediately. Removing a seat is not refunded. Each team seat receives the same weekly FRODI as the matching individual plan.",
    upgradeTitle: "Changing plan",
    upgradeLead:
      "You can move up at any time. Moving down waits until your current plan ends. The price is always worked out by Forge at checkout, never carried in a link.",
    upgrade: [
      {
        kicker: "Upgrade",
        title: "You only pay the difference",
        body: "Forge subtracts the whole weeks you already paid on your current plan from the new plan's price, a refund of time you had left. Example: on Starter (2,500) with 3 weeks left, that's about 1,875 off, so moving to Builder (6,000) costs ~4,125. Your month then restarts.",
      },
      {
        kicker: "Upgrade",
        title: "You keep your FRODI",
        body: "Your remaining FRODI are not lost: they are added on top of the new plan's weekly credit, and everything now expires on the same day, the end of the new week. Starter's 1,800 left + Builder's 5,000 = 6,800, all together.",
      },
      {
        kicker: "Downgrade",
        title: "After the month, not during",
        body: "You can't switch to a smaller plan mid-month. When your plan ends you go back to Free (500 FRODI a month, Free features) but you still see and use every project you built. From there you can choose a smaller plan, paid as a fresh start.",
      },
      {
        kicker: "Fair use",
        title: "One change per week",
        body: "To keep credits honest, you can change plan once per weekly cycle. The price and everything else is computed on Forge's side, so nothing depends on your device.",
      },
    ],
    plansTitle: "What a plan changes",
    plans: [
      {
        kicker: "Free",
        title: "Start here",
        body: "500 FRODI a month, a small project limit, and limited history: the last 5 checkpoints.",
      },
      {
        kicker: "Paid",
        title: "Starter to Scale",
        body: "A weekly FRODI credit, more projects, and a fuller history. Scale is the top individual plan.",
      },
      {
        kicker: "BYOK",
        title: "Your own key",
        body: "Paste a RodiumAI API key in Generation. Forge bills that key, not a Forge plan.",
      },
    ],
    cta: "See the plans",
  },
  fr: {
    kicker: "Forge Cloud",
    title: "Comment ça marche",
    lead: "Tu construis dans Forge. Les crédits qui paient la génération sont sur le compte RodiumAI, créé en même temps que celui-ci.",
    stepsTitle: "De l’inscription au mois suivant",
    steps: [
      {
        title: "Tu crées ton compte Forge",
        body: "Tu confirmes l’email. Cela crée le compte RodiumAI, te place sur Free, et t’attribue 500 FRODI pour le mois.",
      },
      {
        title: "Tu envoies le premier prompt",
        body: "Forge construit le projet et dépense d’abord les FRODI. Quand ce crédit est fini, la même requête continue sur le portefeuille RODI.",
      },
      {
        title: "Tu passes sur un plan payant",
        body: "Le plan se paie une fois par mois. Chaque semaine tu reçois un nouveau crédit FRODI. Ce chiffre hebdomadaire est un crédit d’usage, pas une deuxième facture.",
      },
      {
        title: "La semaine s’arrête à minuit",
        body: "Une semaine, ce sont sept jours calendaires. Abonnement lundi à 17h, ce crédit finit le lundi suivant à minuit. Les FRODI non utilisés ne sont pas reportés.",
      },
      {
        title: "Tu renouvelles en un clic",
        body: "Il n’y a pas de prélèvement automatique. À l’échéance du mois, tu paies à nouveau en un clic. Après cette date le plan est en retard et les nouveaux crédits hebdomadaires s’arrêtent.",
      },
    ],
    poolsTitle: "Deux crédits, un ordre",
    pools: [
      {
        kicker: "Dépensé d’abord",
        title: "FRODI",
        body: "Le crédit Forge Cloud. Free inclut 500 FRODI par mois. Un plan payant inclut un crédit chaque semaine. Il expire. Il ne passe pas à la période suivante.",
      },
      {
        kicker: "Dépensé ensuite",
        title: "RODI",
        body: "Le portefeuille RodiumAI. Il reste jusqu’à ce que tu l’utilises. Forge n’y touche qu’une fois les FRODI de la période en cours terminés. La recharge se fait depuis Utiliser votre solde RODI.",
      },
    ],
    byokTitle: "Tu peux aussi apporter ta propre clé",
    byokBody:
      "Dans Réglages, onglet Génération, colle une clé API RodiumAI. Forge débite alors cette clé. Ces générations n’utilisent ni un plan Forge ni des FRODI. Un clone open source de Forge fonctionne pareil : ta clé, pas un abonnement.",
    weekTitle: "La semaine, simplement",
    weekBody:
      "Le jour 1 est le jour de l’abonnement, ou le jour où une nouvelle semaine commence. Le jour 7 finit à minuit UTC, c’est-à-dire minuit à Lomé et à Accra. Le crédit suivant arrive à ce moment, si l’abonnement est toujours actif.",
    monthTitle: "Le mois",
    monthBody:
      "Un abonnement payant dure un mois calendaire à partir du paiement. Tu n’es pas facturé chaque semaine. Ajouter un siège d’équipe est proratisé et payé tout de suite. Retirer un siège n’est pas remboursé. Chaque siège reçoit les mêmes FRODI hebdomadaires que le plan individuel correspondant.",
    upgradeTitle: "Changer de plan",
    upgradeLead:
      "Tu peux monter de plan à tout moment. Descendre attend la fin du plan en cours. Le prix est toujours calculé par Forge au moment du paiement, jamais transporté dans un lien.",
    upgrade: [
      {
        kicker: "Upgrade",
        title: "Tu ne paies que la différence",
        body: "Forge déduit du prix du nouveau plan les semaines entières déjà payées sur ton plan actuel, un remboursement du temps qu’il te restait. Exemple : sur Starter (2 500) avec 3 semaines restantes, ça fait environ 1 875 de moins, donc passer à Builder (6 000) coûte ~4 125. Ton mois repart alors à zéro.",
      },
      {
        kicker: "Upgrade",
        title: "Tu gardes tes FRODI",
        body: "Tes FRODI restants ne sont pas perdus : ils s’ajoutent au crédit hebdomadaire du nouveau plan, et tout expire désormais le même jour, la fin de la nouvelle semaine. Les 1 800 restants de Starter + les 5 000 de Builder = 6 800, ensemble.",
      },
      {
        kicker: "Downgrade",
        title: "Après le mois, pas pendant",
        body: "Tu ne peux pas passer à un plan plus petit en cours de mois. À la fin de ton plan, tu reviens sur Free (500 FRODI par mois, avantages Free) mais tu vois et utilises toujours tous les projets que tu as créés. De là, tu peux choisir un plan plus petit, payé comme un nouveau départ.",
      },
      {
        kicker: "Usage équitable",
        title: "Un changement par semaine",
        body: "Pour garder les crédits honnêtes, tu peux changer de plan une fois par cycle hebdomadaire. Le prix et tout le reste sont calculés côté Forge, donc rien ne dépend de ton appareil.",
      },
    ],
    plansTitle: "Ce qu’un plan change",
    plans: [
      {
        kicker: "Free",
        title: "Le départ",
        body: "500 FRODI par mois, une limite de projets, et un historique limité : les 5 derniers points de restauration.",
      },
      {
        kicker: "Payant",
        title: "Starter jusqu’à Scale",
        body: "Un crédit FRODI chaque semaine, plus de projets, et un historique plus complet. Scale est le plus haut plan individuel.",
      },
      {
        kicker: "BYOK",
        title: "Ta propre clé",
        body: "Colle une clé API RodiumAI dans Génération. Forge débite cette clé, pas un plan Forge.",
      },
    ],
    cta: "Voir les plans",
  },
};

export default function HowItWorksPage() {
  const { locale } = useI18n();
  const copy = COPY[locale === "fr" ? "fr" : "en"];

  return (
    <HomeLayout activeNav="how">
      <article className="how-page">
        <header className="how-hero">
          <p className="how-kicker">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="how-lead">{copy.lead}</p>
        </header>

        <section>
          <h2>{copy.stepsTitle}</h2>
          <ol className="how-steps">
            {copy.steps.map((step, index) => (
              <li key={step.title}>
                <span>{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2>{copy.poolsTitle}</h2>
          <div className="how-pools">
            {copy.pools.map((pool) => (
              <article key={pool.title} className={pool.title === "FRODI" ? "is-frodi" : ""}>
                <p>{pool.kicker}</p>
                <h3>{pool.title}</h3>
                <p>{pool.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="how-note">
          <h2>{copy.byokTitle}</h2>
          <p>{copy.byokBody}</p>
        </section>

        <section className="how-note">
          <h2>{copy.weekTitle}</h2>
          <p>{copy.weekBody}</p>
        </section>

        <section className="how-note">
          <h2>{copy.monthTitle}</h2>
          <p>{copy.monthBody}</p>
        </section>

        <section>
          <h2>{copy.upgradeTitle}</h2>
          <p className="how-lead">{copy.upgradeLead}</p>
          <div className="how-plans">
            {copy.upgrade.map((item) => (
              <article key={item.title}>
                <p>{item.kicker}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>{copy.plansTitle}</h2>
          <div className="how-plans">
            {copy.plans.map((plan) => (
              <article key={plan.title}>
                <p>{plan.kicker}</p>
                <h3>{plan.title}</h3>
                <p>{plan.body}</p>
              </article>
            ))}
          </div>
          <Link className="how-cta" href="/dashboard/pricing">
            {copy.cta}
          </Link>
        </section>
      </article>
    </HomeLayout>
  );
}

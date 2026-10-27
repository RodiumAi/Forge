"use client";

/**
 * Public landing of Forge (redesign): nav, hero with the composer and the
 * template ribbon, "What Forge builds", the template gallery on the paper
 * band, monthly pricing, FAQ, final call to action and footer.
 */

import { LandingHero } from "@/components/landing/LandingHero";
import {
  LandingCapabilities,
  LandingCta,
  LandingFaq,
  LandingPricing,
  LandingTemplates,
} from "@/components/landing/LandingSections";
import { PublicFooter, PublicNav, useSignedIn } from "@/components/landing/PublicChrome";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { usePublicTemplates } from "@/lib/public-templates";

export default function LandingPage() {
  const { t, locale } = useI18n();
  const authed = useSignedIn();
  const { templates, error } = usePublicTemplates(locale);
  const list = templates ?? [];

  return (
    <div className="f-scope f-lp">
      <a className="f-lp-skip" href="#create">
        {t("lndSkip")}
      </a>
      <PublicNav onLanding />
      <main>
        <LandingHero templates={list} />
        <LandingCapabilities templates={list} />
        <LandingTemplates templates={templates} error={error} />
        <LandingPricing />
        <LandingFaq />
        <LandingCta authed={authed} />
      </main>
      <PublicFooter />
    </div>
  );
}

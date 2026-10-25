"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { invalidateThumbCache } from "@/components/SiteThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { ApiError } from "@/lib/api";
import { ensureCanGenerate, fetchProjectQuota, forkProjectFromTemplate } from "@/lib/create-project";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { prependProject } from "@/lib/lists-cache";
import { refusedPlan, TEMPLATE_PLAN_NAMES, type TemplatePlan } from "@/lib/template-access";

/**
 * "Use this template": the create gates (RodiumAi key, RODI, plan project
 * cap), then the fork, then the builder. Errors come back as text.
 */
export function useForkTemplate() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Set when the API refused the kit for the plan: the error then offers the upgrade. */
  const [needPlan, setNeedPlan] = useState<TemplatePlan | null>(null);

  async function fork(tpl: GalleryTemplate) {
    if (busyId) return;
    setBusyId(tpl.id);
    setError(null);
    setNeedPlan(null);
    try {
      const gate = await ensureCanGenerate();
      if (gate !== "ok") {
        setError(gate === "no_key" ? t("createNeedsKey") : t("createNeedsRodi"));
        setBusyId(null);
        return;
      }
      const quota = await fetchProjectQuota();
      if (!quota.can_create) {
        setError(t("projectQuotaReached"));
        setBusyId(null);
        return;
      }
      const project = await forkProjectFromTemplate(tpl);
      prependProject(locale, project);
      invalidateThumbCache(project.id);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      const plan = refusedPlan(err);
      if (plan) {
        setNeedPlan(plan);
        setError(t("apTplLockedTitle").replace("{plan}", TEMPLATE_PLAN_NAMES[plan]));
      } else if (err instanceof ApiError && err.code === "project_quota_exceeded") setError(t("projectQuotaReached"));
      else if (err instanceof ApiError && err.code === "INSUFFICIENT_RODI") setError(t("createNeedsRodi"));
      else setError(err instanceof Error ? err.message : t("errorGeneric"));
      setBusyId(null);
    }
  }

  return { fork, busyId, error, needPlan, clearError: () => { setError(null); setNeedPlan(null); } };
}

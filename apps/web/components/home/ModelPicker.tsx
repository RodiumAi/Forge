"use client";

import { Cpu } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";

/** Same storage as the builder composer: the first run of the new project uses it. */
export const CHAT_MODEL_KEY = "forge.chatModel";

type ModelChoice = { slug: string; label: string };

/**
 * The builder's model choice, offered from the home. Hidden unless the plan
 * has `model_selection` and the gateway lists models (the allowed tiers are
 * applied server-side by `/auth/forge/models`).
 */
export function ModelPicker({ disabled }: { disabled?: boolean }) {
  const { t } = useI18n();
  const forge = useForgeStatus();
  const canPick = Boolean(forge?.entitlements?.model_selection);
  const [models, setModels] = useState<ModelChoice[]>([]);
  const [value, setValue] = useState("auto");
  const id = useId();

  useEffect(() => {
    try {
      setValue(localStorage.getItem(CHAT_MODEL_KEY) || "auto");
    } catch {
      /* storage denied: stay on auto */
    }
  }, []);

  useEffect(() => {
    if (!canPick) return;
    let cancelled = false;
    void api<{ selectable?: boolean; models?: ModelChoice[] }>("/auth/forge/models")
      .then((body) => {
        if (cancelled) return;
        const list = body.models || [];
        setModels(list);
        setValue((current) => (current !== "auto" && !list.some((m) => m.slug === current) ? "auto" : current));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canPick]);

  if (!canPick || models.length === 0) return null;

  function choose(slug: string) {
    setValue(slug);
    try {
      localStorage.setItem(CHAT_MODEL_KEY, slug);
    } catch {
      /* the choice still applies to this page */
    }
  }

  return (
    <label className="fdh-pill fdh-model" htmlFor={id}>
      <Icon icon={Cpu} className="ui-icon-sm" />
      <span className="sr-only">{t("homeModelAria")}</span>
      <select id={id} value={value} disabled={disabled} onChange={(e) => choose(e.target.value)}>
        <option value="auto">{t("modelAuto")}</option>
        {models.map((model) => (
          <option key={model.slug} value={model.slug}>
            {model.label}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";

import { CHAT_MODEL_KEY } from "@/components/home/ModelPicker";
import { Badge } from "@/components/ui/Badge";
import { Glyph } from "@/components/ui/glyph";
import { MenuItem, MenuLabel, MenuNote, Popover } from "@/components/ui/Popover";
import { api, getToken } from "@/lib/api";
import { useForgeStatus } from "@/lib/forge-status";
import { useI18n } from "@/lib/i18n/I18nProvider";

type ModelChoice = { slug: string; label: string; provider?: string | null };

/** Same models list as the builder (`/auth/forge/models`), once per page load. */
let modelsFlight: Promise<ModelChoice[]> | null = null;
function loadModels(): Promise<ModelChoice[]> {
  if (!modelsFlight) {
    modelsFlight = api<{ models?: ModelChoice[] }>("/auth/forge/models", { retries: 0 })
      .then((body) => body.models || [])
      .catch(() => {
        modelsFlight = null;
        return [];
      });
  }
  return modelsFlight;
}

function readStoredModel(): string {
  try {
    return localStorage.getItem(CHAT_MODEL_KEY) || "auto";
  } catch {
    return "auto";
  }
}

/**
 * The composer's model button: Auto by default. Picking a model is a Pro and
 * Scale feature (`entitlements.model_selection`); other plans see Auto with a
 * note and a link to the plans. The choice is stored under the builder's key
 * so the first run of the new project uses it.
 */
export function ModelMenu({ disabled, upgradeHref = "/dashboard/pricing" }: { disabled?: boolean; upgradeHref?: string }) {
  const { t } = useI18n();
  const forge = useForgeStatus();
  const entitlements = forge?.entitlements ?? null;
  // Unknown entitlements (off Forge Cloud, first fetch pending) never hide a feature.
  const canPick = entitlements ? Boolean(entitlements.model_selection) : true;
  const locked = Boolean(entitlements) && !entitlements?.model_selection;
  const [models, setModels] = useState<ModelChoice[]>([]);
  const [value, setValue] = useState("auto");

  useEffect(() => setValue(readStoredModel()), []);

  useEffect(() => {
    // Signed out (the landing): nothing to ask, and a 401 would sign the page out.
    if (!canPick || !getToken()) return;
    let alive = true;
    void loadModels().then((list) => {
      if (!alive) return;
      setModels(list);
      setValue((current) => (current !== "auto" && !list.some((m) => m.slug === current) ? "auto" : current));
    });
    return () => {
      alive = false;
    };
  }, [canPick]);

  function choose(slug: string) {
    setValue(slug);
    try {
      localStorage.setItem(CHAT_MODEL_KEY, slug);
    } catch {
      /* the choice still applies to this page */
    }
  }

  const current = value === "auto" || locked ? null : models.find((m) => m.slug === value) ?? null;
  const currentLabel = current ? current.label : t("uiModelAuto");

  return (
    <Popover
      tone="dark"
      role="listbox"
      side="top"
      align="end"
      label={t("uiModel")}
      width={300}
      trigger={
        <button type="button" className="f-c-btn" disabled={disabled} aria-label={`${t("uiModel")}: ${currentLabel}`}>
          <span className="f-model-dot" aria-hidden />
          <span>{currentLabel}</span>
          <Glyph name="chevron-down" className="f-caret" />
        </button>
      }
    >
      {(close) => (
        <>
          <MenuLabel>{t("uiModel")}</MenuLabel>
          <MenuItem
            role="option"
            icon="sparkles"
            selected={!current}
            hint={t("uiModelAutoHint")}
            meta={<Badge tone="free">Free</Badge>}
            onClick={() => {
              choose("auto");
              close();
            }}
          >
            {t("uiModelAuto")}
          </MenuItem>
          {canPick
            ? models.map((m) => (
                <MenuItem
                  key={m.slug}
                  role="option"
                  icon="cpu"
                  selected={current?.slug === m.slug}
                  hint={m.provider || undefined}
                  meta={<Badge tone="pro">Pro</Badge>}
                  onClick={() => {
                    choose(m.slug);
                    close();
                  }}
                >
                  {m.label}
                </MenuItem>
              ))
            : null}
          {locked ? (
            <MenuNote>
              {t("uiModelPlanNote")}{" "}
              <a href={upgradeHref} style={{ color: "#FFB48A", fontWeight: 600 }}>
                {t("uiModelUpgrade")}
              </a>
            </MenuNote>
          ) : null}
        </>
      )}
    </Popover>
  );
}

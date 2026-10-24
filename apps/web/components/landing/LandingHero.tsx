"use client";

/**
 * Landing hero: news pill, "Say it. Forge builds it.", the shared composer,
 * the open source line and the ribbon of real templates.
 *
 * The composer does not create here: it stores the request the way the
 * sign-in hop always has (prompt, kind, options, files) and opens the
 * dashboard, whose boot creates the project with the usual gates. Signed out,
 * the sign-in page lands on the dashboard afterwards.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Composer, type ComposerDesignSystem } from "@/components/composer/Composer";
import { listDesignSystems } from "@/components/design-system/api";
import { buildCreateRequest, getTile, type HomeTileId } from "@/components/home/home-kinds";
import { GITHUB_URL } from "@/components/shell/nav";
import { SiteThumb } from "@/components/SiteThumb";
import { DeckThumb } from "@/components/templates/DeckThumb";
import type { GalleryTemplate } from "@/components/TemplateGallery";
import { Glyph } from "@/components/ui/glyph";
import { getToken } from "@/lib/api";
import {
  PENDING_PROMPT_KEY,
  stashPendingCreateOptions,
  stashPendingFiles,
  stashPendingPlatform,
  type DeckRatio,
} from "@/lib/create-project";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useEnabledKinds } from "@/lib/kinds";
import {
  mergePromptAttachments,
  revokePromptAttachment,
  type LocalPromptAttachment,
  type PromptAttachment,
} from "@/lib/prompt-attachments";
import { galleryHref, kindOf } from "@/lib/public-templates";

const STEPS_PATH = "M0 0H1000V1000H740V785H525V735H475V525H260V475H215V260H0Z";

/** The mockup's ribbon picks, in order; missing ids are skipped. */
const RIBBON_IDS = [
  "slides-product-launch",
  "nova-bank",
  "aurora-ai",
  "slides-travel",
  "design-system-luxe",
  "slides-annual-report",
  "glacier-travel",
  "codelab-rodiumai-sdk",
  "slides-fundraising",
  "echo-music",
  "lumen-architecture",
  "slides-dev-keynote",
];

function RibbonItem({ tpl, index, hidden }: { tpl: GalleryTemplate; index: number; hidden: boolean }) {
  const deck = kindOf(tpl) === "slides";
  const [missing, setMissing] = useState(false);
  return (
    <Link
      className="f-lp-ribbon-item"
      href={galleryHref(tpl.id)}
      style={{ ["--rot" as string]: `${index % 2 ? 1.5 : -1.5}deg` }}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      aria-label={hidden ? undefined : tpl.title}
    >
      {deck && !missing ? (
        <DeckThumb templateId={tpl.id} playing={false} onMissing={() => setMissing(true)} />
      ) : (
        <SiteThumb
          src={tpl.preview_url || `/templates/${tpl.id}/preview`}
          viewportWidth={480}
          viewportHeight={270}
          title={tpl.title}
          className="f-thumb-site"
        />
      )}
    </Link>
  );
}

export function LandingRibbon({ templates }: { templates: GalleryTemplate[] }) {
  const { t } = useI18n();
  const items = useMemo(() => {
    const picked = RIBBON_IDS.map((id) => templates.find((tpl) => tpl.id === id)).filter(Boolean) as GalleryTemplate[];
    return picked.length >= 6 ? picked : templates.slice(0, 12);
  }, [templates]);
  if (!items.length) return null;
  return (
    <div className="f-lp-ribbon" role="region" aria-label={t("lndRibbonLabel")}>
      <div className="f-lp-ribbon-track">
        {[...items, ...items].map((tpl, i) => (
          <RibbonItem key={`${tpl.id}-${i}`} tpl={tpl} index={i} hidden={i >= items.length} />
        ))}
      </div>
    </div>
  );
}

export function LandingHero({ templates }: { templates: GalleryTemplate[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const enabledKinds = useEnabledKinds();
  const [prompt, setPrompt] = useState("");
  const [tileId, setTileId] = useState<HomeTileId>("blank");
  const [deckFormat, setDeckFormat] = useState<DeckRatio | undefined>(undefined);
  const [files, setFiles] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [designSystems, setDesignSystems] = useState<ComposerDesignSystem[]>([]);
  const [designSystemId, setDesignSystemId] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const signed = Boolean(getToken());
    setAuthed(signed);
    if (!signed || !enabledKinds.includes("design_system")) return;
    let alive = true;
    void listDesignSystems()
      .then((list) => {
        if (!alive) return;
        setDesignSystems(list.items.map((item) => ({ id: item.id, name: item.name, scope: item.scope, preview: item.preview })));
        if (list.default_id) setDesignSystemId((cur) => cur ?? list.default_id);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabledKinds]);

  useEffect(
    () => () => {
      files.forEach(revokePromptAttachment);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
    [],
  );

  async function submit() {
    if (busy) return;
    const tile = getTile(tileId);
    const request = buildCreateRequest({
      tile: deckFormat && tile.kind === "slides" ? { ...tile, format: deckFormat } : tile,
      text: prompt,
      enabled: enabledKinds,
      designSystemId: authed ? designSystemId : null,
      shortcutLabel: t(tile.labelKey),
      shortcutTemplate: t("homeShortcutPrompt"),
    });
    if (!request.prompt.trim()) return;
    setBusy(true);
    try {
      sessionStorage.setItem(PENDING_PROMPT_KEY, request.prompt);
      stashPendingPlatform(request.platform);
      stashPendingCreateOptions(request.options);
      const local = files.filter((f): f is LocalPromptAttachment => f.source === "local").map((f) => f.file);
      if (local.length) await stashPendingFiles(local);
    } catch {
      /* storage denied: the dashboard opens without the prompt */
    }
    router.push(authed ? "/dashboard" : "/login");
  }

  function addFiles(list: FileList) {
    setFiles((prev) => {
      const { next, rejected } = mergePromptAttachments(prev, list);
      setFileError(rejected.length ? t("promptFileTypeError") : null);
      return next;
    });
  }

  function removeFile(id: string) {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePromptAttachment(target);
      return prev.filter((item) => item.id !== id);
    });
    setFileError(null);
  }

  return (
    <section className="f-lp-hero" id="create" tabIndex={-1}>
      <div className="f-lp-hero-bg" aria-hidden>
        <div className="grid" />
        <div className="glow" />
        <svg className="steps" viewBox="0 0 1000 1000">
          <path fill="currentColor" d={STEPS_PATH} />
        </svg>
        <svg className="steps left" viewBox="0 0 1000 1000">
          <path fill="currentColor" d={STEPS_PATH} />
        </svg>
      </div>
      <div className="f-wrap">
        <div className="f-lp-hero-top">
          <a className="f-lp-news" href="#whats-new">
            <b>{t("lndNewsTag")}</b>
            <span>{t("lndNewsText")}</span>
            <Glyph name="chevron-right" size="sm" />
          </a>
          <h1>
            <span>{t("lndHeroTitle1")}</span> <span className="line2">{t("lndHeroTitle2")}</span>
          </h1>
          <p className="f-lp-hero-sub">{t("lndHeroSub")}</p>
        </div>

        <div className="f-lp-composer">
          <Composer
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => void submit()}
            files={files}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            tileId={tileId}
            onTileChange={(next) => {
              setTileId(next);
              setDeckFormat(undefined);
            }}
            enabledKinds={enabledKinds}
            deckFormat={deckFormat}
            onDeckFormatChange={setDeckFormat}
            designSystems={designSystems}
            designSystemId={designSystemId}
            onDesignSystemChange={setDesignSystemId}
            showDesignSystems={authed && enabledKinds.includes("design_system")}
            manageDesignSystemsHref="/dashboard?tab=design-systems"
            upgradeHref="/#pricing"
            busy={busy}
            alerts={fileError ? <p>{fileError}</p> : undefined}
            hintRight={t("lndHintFree")}
            variant="hero"
          />
        </div>
        <p className="f-lp-oss">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Glyph name="github" size="sm" />
            <span>{t("lndOssLine")}</span>
            <b>RodiumAi/Forge</b>
          </a>
        </p>
      </div>
      <LandingRibbon templates={templates} />
    </section>
  );
}

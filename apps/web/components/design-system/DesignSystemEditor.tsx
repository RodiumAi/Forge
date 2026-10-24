"use client";

import { Download, ExternalLink, Globe, Share2, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { WorkspaceBar } from "@/components/builder/WorkspaceBar";
import { Icon } from "@/components/ui/icon";
import { designSystemSchema } from "@/lib/contracts/forge-design";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import {
  downloadExport,
  errorCode,
  getDesignSystemItem,
  loadDocument,
  publish,
  saveDocument,
  setDefault,
  share,
  unshare,
  type DesignSystemItem,
  type ExportFormat,
} from "./api";
import { DesignSystemChat, type DesignSystemChatHandle } from "./DesignSystemChat";
import {
  ColorsSection,
  ComponentsSection,
  GuidanceSection,
  IconographySection,
  LogoSection,
  SpacingSection,
  TypographySection,
} from "./sections";
import { SECTIONS, fontFamily, googleFontsHref, type DesignSystemDoc, type SectionId } from "./tokens";

const SAVE_DELAY_MS = 700;
const EXPORTS: ExportFormat[] = ["tokens", "css", "tailwind", "md", "pdf"];

type SaveState = "idle" | "saving" | "saved" | "error" | "conflict" | "invalid";

function errorKey(error: unknown): MessageKey {
  const code = errorCode(error);
  if (code === "FEATURE_NOT_IN_PLAN" || code === "EXPORT_NOT_IN_PLAN") return "dsErrorPlan";
  if (code === "NO_TEAM") return "dsErrorNoTeam";
  return "dsErrorGeneric";
}

/** The design_system kind editor: sections, live showcase, AI chat, sharing, exports. */
export function DesignSystemEditor({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const [doc, setDoc] = useState<DesignSystemDoc | null>(null);
  const [item, setItem] = useState<DesignSystemItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("colors");
  const [save, setSave] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [menu, setMenu] = useState<"share" | "export" | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<DesignSystemDoc | null>(null);
  const editCount = useRef(0);
  const chatRef = useRef<DesignSystemChatHandle>(null);

  const reload = useCallback(async () => {
    const loaded = await loadDocument(projectId);
    etag.current = loaded.etag;
    setDoc(loaded.doc);
  }, [projectId]);

  useEffect(() => {
    void reload().catch((err) => setLoadError(err instanceof Error ? err.message : String(err)));
    void getDesignSystemItem(projectId)
      .then(setItem)
      .catch(() => setItem(null));
  }, [projectId, reload]);

  const flush = useCallback(async () => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    if (!designSystemSchema.safeParse(next).success) {
      setSave("invalid");
      return;
    }
    const startedAt = editCount.current;
    setSave("saving");
    try {
      const saved = await saveDocument(projectId, next, etag.current);
      etag.current = saved.etag;
      // Keep local edits made while the request was in flight.
      if (editCount.current === startedAt) setDoc(saved.doc);
      setSave("saved");
    } catch (err) {
      if (errorCode(err) === "DOCUMENT_CHANGED") {
        setSave("conflict");
        await reload();
      } else setSave("error");
    }
  }, [projectId, reload]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  const onChange = useCallback(
    (next: DesignSystemDoc) => {
      editCount.current += 1;
      setDoc(next);
      pending.current = next;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  /** A document written by the server (AI, logo upload): adopt it and its ETag. */
  const onServerDocument = useCallback(
    (next: DesignSystemDoc) => {
      pending.current = null;
      setDoc(next);
      void reload();
    },
    [reload],
  );

  async function run(action: () => Promise<unknown>, done?: MessageKey) {
    setNotice(null);
    try {
      await action();
      if (done) setNotice(t(done));
    } catch (err) {
      setNotice(t(errorKey(err)));
    }
  }

  if (loadError) return <div className="dse-page dse-error">{loadError}</div>;
  if (!doc) return <div className="dse-page dse-muted">{t("dsLoading")}</div>;

  const readOnly = item ? !item.can_edit : false;
  const fontsHref = googleFontsHref([fontFamily(doc, "display"), fontFamily(doc, "body"), fontFamily(doc, "mono")]);
  const sectionBody = (() => {
    const props = { doc, onChange, readOnly };
    switch (section) {
      case "colors":
        return <ColorsSection {...props} />;
      case "typography":
        return <TypographySection {...props} />;
      case "spacing":
        return <SpacingSection {...props} />;
      case "logo":
        return (
          <LogoSection
            {...props}
            projectId={projectId}
            onDocument={onServerDocument}
            onAsk={(prompt) => chatRef.current?.ask(prompt)}
          />
        );
      case "iconography":
        return <IconographySection {...props} />;
      case "components":
        return <ComponentsSection {...props} />;
      default:
        return <GuidanceSection {...props} field={section} />;
    }
  })();

  return (
    <div className="dse-page">
      {fontsHref ? <link rel="stylesheet" href={fontsHref} /> : null}
      <WorkspaceBar
        kind="design_system"
        name={doc.name}
        backHref="/dashboard?tab=design_systems"
        className="dse-top"
        onRename={
          readOnly
            ? undefined
            : async (next) => {
                onChange({ ...doc, name: next.slice(0, 120) });
                return next.slice(0, 120);
              }
        }
        saveStatus={
          <span className={`dse-save is-${save}`} role="status">
            {save === "idle" ? "" : t(`dsSave_${save}` as MessageKey)}
          </span>
        }
        actions={
        <div className="dse-actions">
          <div className="dse-menu">
            <button type="button" className="f-btn f-btn-ghost f-btn-sm" aria-expanded={menu === "share"} onClick={() => setMenu(menu === "share" ? null : "share")}>
              <Icon icon={Share2} className="ui-icon-sm" /> <span className="f-bd-lbl">{t("dsShare")}</span>
            </button>
            {menu === "share" && item ? (
              <div className="dse-pop" role="menu">
                {item.owner.mine ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void run(async () => setItem(await setDefault(projectId, "user", !item.is_default_user)))}
                  >
                    <Icon icon={Star} className="ui-icon-sm" />{" "}
                    {item.is_default_user ? t("dsDefaultUserOff") : t("dsDefaultUserOn")}
                  </button>
                ) : null}
                {item.can_share ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      void run(
                        async () => setItem(await (item.visibility === "team" ? unshare(projectId) : share(projectId))),
                        item.visibility === "team" ? "dsUnshared" : "dsShared",
                      )
                    }
                  >
                    <Icon icon={Share2} className="ui-icon-sm" />{" "}
                    {item.visibility === "team" ? t("dsUnshare") : t("dsShareTeam")}
                  </button>
                ) : null}
                {item.can_set_team_default ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void run(async () => setItem(await setDefault(projectId, "team", !item.is_default_team)))}
                  >
                    <Icon icon={Star} className="ui-icon-sm" />{" "}
                    {item.is_default_team ? t("dsDefaultTeamOff") : t("dsDefaultTeamOn")}
                  </button>
                ) : null}
                <p className="dse-muted">{item.visibility === "team" ? t("dsVisibilityTeam") : t("dsVisibilityPrivate")}</p>
              </div>
            ) : null}
          </div>
          <div className="dse-menu">
            <button type="button" className="f-btn f-btn-ghost f-btn-sm" aria-expanded={menu === "export"} onClick={() => setMenu(menu === "export" ? null : "export")}>
              <Icon icon={Download} className="ui-icon-sm" /> <span className="f-bd-lbl">{t("dsExport")}</span>
            </button>
            {menu === "export" ? (
              <div className="dse-pop" role="menu">
                {EXPORTS.map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="menuitem"
                    onClick={() => void run(() => downloadExport(projectId, format))}
                  >
                    {t(`dsExport_${format}` as MessageKey)}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {item?.owner.mine ? (
            <button
              type="button"
              className="f-btn f-btn-primary f-btn-sm"
              onClick={() =>
                void run(async () => setPublishedUrl((await publish(projectId)).public_url), "dsPublished")
              }
            >
              <Icon icon={Globe} className="ui-icon-sm" /> <span className="f-bd-lbl">{t("dsPublish")}</span>
            </button>
          ) : null}
          {publishedUrl ? (
            <a className="f-icon-btn f-icon-btn-sm" href={publishedUrl} target="_blank" rel="noopener noreferrer" aria-label={t("dsOpenSite")}>
              <Icon icon={ExternalLink} />
            </a>
          ) : null}
        </div>
        }
      />
      {notice ? (
        <p className="dse-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="dse-body">
        <nav className="dse-nav" aria-label={t("dsSections")}>
          {SECTIONS.map((id) => (
            <button
              key={id}
              type="button"
              aria-current={section === id ? "page" : undefined}
              className={section === id ? "is-active" : undefined}
              onClick={() => setSection(id)}
            >
              {t(`dsSection_${id}` as MessageKey)}
            </button>
          ))}
        </nav>
        <main className="dse-main">
          <h2 className="dse-h2">{t(`dsSection_${section}` as MessageKey)}</h2>
          {readOnly ? <p className="dse-muted">{t("dsReadOnly")}</p> : null}
          {sectionBody}
        </main>
        <DesignSystemChat
          ref={chatRef}
          projectId={projectId}
          section={section}
          disabled={readOnly}
          onDocument={onServerDocument}
        />
      </div>
    </div>
  );
}

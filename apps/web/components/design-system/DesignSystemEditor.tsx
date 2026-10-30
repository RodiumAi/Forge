"use client";

import { FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ShareButton } from "@/components/builder/ShareButton";
import { WorkspaceBar } from "@/components/builder/WorkspaceBar";
import { Icon } from "@/components/ui/icon";
import { ContextMenu, copyText, useContextMenu, useMenuTrigger } from "@/components/ui/ContextMenu";
import { designSystemSchema } from "@/lib/contracts/forge-design";
import { clearBootPrompt, peekBootPrompt } from "@/lib/create-project";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import {
  downloadExport,
  errorCode,
  getDesignSystemItem,
  loadDocument,
  saveDocument,
  uploadLogo,
  type DesignSystemItem,
} from "./api";
import { DesignSystemChat, type DesignSystemChatHandle } from "./DesignSystemChat";
import { DesignSystemPreview } from "./DesignSystemPreview";
import { DesignSystemShareHub } from "./DesignSystemShareHub";
import { takePendingBrandAssets } from "./intake/brand-intake";
import {
  ColorsSection,
  ComponentsSection,
  GuidanceSection,
  IconographySection,
  LogoSection,
  SpacingSection,
  TypographySection,
} from "./sections";
import { SECTIONS, cssVars, fontFamily, googleFontsHref, type DesignSystemDoc, type SectionId } from "./tokens";

const SAVE_DELAY_MS = 700;

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
  // The document view (what the PDF and the published page show) instead of a section.
  const [previewing, setPreviewing] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);
  const [save, setSave] = useState<SaveState>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const etag = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const pending = useRef<DesignSystemDoc | null>(null);
  const editCount = useRef(0);
  const chatRef = useRef<DesignSystemChatHandle>(null);
  // The prompt built on the home page (brand intake), sent by the chat on arrival.
  const [bootPrompt] = useState(() => (typeof window === "undefined" ? null : peekBootPrompt(projectId)));

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
      setSavedVersion((v) => v + 1);
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

  /** After the first generation, the brand files it does not keep (dark logo, square icon). */
  const onBootDone = useCallback(
    (ok: boolean) => {
      const assets = takePendingBrandAssets(projectId);
      if (!ok || !assets) return;
      void (async () => {
        // One after the other: each upload rewrites the document.
        for (const [file, variant] of [
          [assets.logoDark, "dark"],
          [assets.icon, "icon"],
        ] as const) {
          if (!file) continue;
          try {
            onServerDocument(await uploadLogo(projectId, file, variant));
          } catch {
            /* the file can still be uploaded from the Logo section */
          }
        }
      })();
    },
    [projectId, onServerDocument],
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

  // The owner invites people to edit or view, as on sites and decks.
  const [inviteRequest, setInviteRequest] = useState(0);

  // Right click, long press or the Menu key on a section of the nav.
  const sectionMenu = useContextMenu();
  const navMenu = useMenuTrigger<SectionId>((id, at) => {
    sectionMenu.open(
      at,
      [
        { id: "open", label: t("dsMenuOpenSection"), onSelect: () => setSection(id) },
        {
          id: "copy-vars",
          label: t("dsMenuCopyAllVars"),
          disabled: !doc,
          onSelect: () => {
            if (!doc) return;
            const lines = Object.entries(cssVars(doc)).map(([key, value]) => `  ${key}: ${value};`);
            copyText(`:root {\n${lines.join("\n")}\n}`);
          },
        },
      ],
      t("dsMenuSection"),
    );
  });

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
          <DesignSystemShareHub
            projectId={projectId}
            doc={doc}
            item={item}
            onItem={setItem}
            run={run}
            onInvite={() => setInviteRequest((n) => n + 1)}
            onDownload={(format) => void run(() => downloadExport(projectId, format))}
            beforePublish={async () => {
              if (timer.current) window.clearTimeout(timer.current);
              await flush();
            }}
          />
        }
      />
      {item?.owner.mine ? <ShareButton projectId={projectId} projectName={doc.name} request={inviteRequest} hideButton /> : null}
      {notice ? (
        <p className="dse-notice" role="status">
          {notice}
        </p>
      ) : null}
      <div className="dse-body">
        <nav className="dse-nav" aria-label={t("dsSections")}>
          <button
            type="button"
            aria-current={previewing ? "page" : undefined}
            className={`dse-nav-preview${previewing ? " is-active" : ""}`}
            onClick={() => setPreviewing(true)}
          >
            <Icon icon={FileText} className="ui-icon-sm" /> {t("dsPreview")}
          </button>
          {SECTIONS.map((id) => (
            <button
              key={id}
              type="button"
              aria-current={!previewing && section === id ? "page" : undefined}
              className={!previewing && section === id ? "is-active" : undefined}
              {...navMenu.bind(id)}
              onClick={() => {
                setPreviewing(false);
                setSection(id);
              }}
            >
              {t(`dsSection_${id}` as MessageKey)}
            </button>
          ))}
        </nav>
        <ContextMenu request={sectionMenu.request} onClose={sectionMenu.close} />
        <main className={`dse-main${previewing ? " is-preview" : ""}`}>
          {previewing ? (
            <>
              <h2 className="dse-h2">{t("dsPreview")}</h2>
              <DesignSystemPreview
                projectId={projectId}
                version={savedVersion}
                beforeLoad={async () => {
                  if (timer.current) window.clearTimeout(timer.current);
                  await flush();
                }}
              />
            </>
          ) : (
            <>
              <h2 className="dse-h2">{t(`dsSection_${section}` as MessageKey)}</h2>
              {readOnly ? <p className="dse-muted">{t("dsReadOnly")}</p> : null}
              {sectionBody}
            </>
          )}
        </main>
        <DesignSystemChat
          ref={chatRef}
          projectId={projectId}
          section={section}
          disabled={readOnly}
          onDocument={onServerDocument}
          initialPrompt={bootPrompt}
          onInitialPromptUsed={() => clearBootPrompt(projectId)}
          onInitialPromptDone={onBootDone}
        />
      </div>
    </div>
  );
}

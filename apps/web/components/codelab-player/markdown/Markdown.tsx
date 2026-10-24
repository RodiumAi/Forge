"use client";

import { AlertTriangle, Download, FileArchive, Info, Lightbulb, OctagonAlert } from "lucide-react";
import { useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatBytes, useRenderEnv, type DownloadInfo } from "../context";
import { parseBlocks, type Block, type CalloutKind } from "./blocks";
import { CodeBlock } from "./CodeBlock";
import { parseFenceInfo } from "./fence";
import { onTabChoice, readTabChoice, writeTabChoice } from "./tabs-memory";
import { TerminalBlock } from "./Terminal";
import { TreeBlock } from "./Tree";

const CALLOUT_ICONS: Record<CalloutKind, typeof Info> = {
  info: Info,
  tip: Lightbulb,
  warning: AlertTriangle,
  danger: OctagonAlert,
};

const CALLOUT_LABELS = {
  info: "calloutInfo",
  tip: "calloutTip",
  warning: "calloutWarning",
  danger: "calloutDanger",
} as const;

/** Relative project paths go through `assetUrl`; anything else keeps the safe default. */
function isProjectPath(url: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith("//") && !url.startsWith("#");
}

function Prose({ text }: { text: string }) {
  const { assetUrl } = useRenderEnv();
  const components = useMemo<Components>(
    () => ({
      img: ({ src, alt, title }) => {
        const url = typeof src === "string" ? src : "";
        return <img src={url && isProjectPath(url) ? assetUrl(url.replace(/^\.?\//, "")) : url} alt={alt ?? ""} title={title} loading="lazy" />;
      },
      a: ({ href, children, title }) => {
        const url = typeof href === "string" ? href : "";
        const external = /^https?:\/\//i.test(url);
        const target = url && isProjectPath(url) && url.startsWith("files/") ? assetUrl(url) : url;
        return (
          <a href={target} title={title} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {children}
          </a>
        );
      },
      // Fences nested in lists or quotes reach react-markdown: same renderer.
      pre: ({ node }) => {
        const codeNode = node?.children?.[0] as
          | { tagName?: string; properties?: { className?: unknown }; data?: { meta?: string }; children?: { value?: string }[] }
          | undefined;
        const classes = Array.isArray(codeNode?.properties?.className) ? (codeNode!.properties!.className as string[]) : [];
        const lang = classes.find((c) => c.startsWith("language-"))?.slice(9) ?? "";
        const code = (codeNode?.children ?? []).map((child) => child.value ?? "").join("").replace(/\n$/, "");
        return <CodeBlock fence={parseFenceInfo(`${lang} ${codeNode?.data?.meta ?? ""}`)} code={code} />;
      },
      table: ({ children }: ComponentProps<"table">) => (
        <div className="fcl-table-wrap">
          <table>{children}</table>
        </div>
      ),
    }),
    [assetUrl],
  );
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={defaultUrlTransform} components={components}>
      {text}
    </ReactMarkdown>
  );
}

function Callout({ kind, title, children }: { kind: CalloutKind; title?: string; children: ReactNode }) {
  const { t } = useRenderEnv();
  const Icon = CALLOUT_ICONS[kind];
  return (
    <aside className="fcl-callout" data-kind={kind} role="note">
      <p className="fcl-callout-title">
        <Icon size={16} aria-hidden />
        <span>{title || t(CALLOUT_LABELS[kind])}</span>
      </p>
      <div className="fcl-callout-body">{children}</div>
    </aside>
  );
}

function TabGroup({ block }: { block: Extract<Block, { type: "tabs" }> }) {
  const { storageKey } = useRenderEnv();
  const labels = block.tabs.map((tab) => tab.label);
  const [selected, setSelected] = useState(labels[0] ?? "");
  const baseId = useId();
  useEffect(() => {
    const remembered = readTabChoice(storageKey, block.group);
    if (remembered && labels.includes(remembered)) setSelected(remembered);
    return onTabChoice(storageKey, block.group, (label) => {
      if (labels.includes(label)) setSelected(label);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels derive from the block
  }, [storageKey, block]);
  const current = labels.includes(selected) ? selected : labels[0];
  return (
    <div className="fcl-tabs">
      <div className="fcl-tablist" role="tablist">
        {block.tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            id={`${baseId}-tab-${index}`}
            aria-controls={`${baseId}-panel-${index}`}
            aria-selected={tab.label === current}
            tabIndex={tab.label === current ? 0 : -1}
            className="fcl-tab"
            onClick={() => {
              setSelected(tab.label);
              writeTabChoice(storageKey, block.group, tab.label);
            }}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const step = event.key === "ArrowRight" ? 1 : -1;
              const next = block.tabs[(index + step + block.tabs.length) % block.tabs.length];
              setSelected(next.label);
              writeTabChoice(storageKey, block.group, next.label);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {block.tabs.map((tab, index) => (
        <div
          key={tab.label}
          role="tabpanel"
          id={`${baseId}-panel-${index}`}
          aria-labelledby={`${baseId}-tab-${index}`}
          hidden={tab.label !== current}
          className="fcl-tabpanel"
        >
          <Blocks blocks={tab.blocks} />
        </div>
      ))}
    </div>
  );
}

function resolveDownload(item: string, downloads: DownloadInfo[], assetUrl: (p: string) => string): DownloadInfo {
  const declared = downloads.find((d) => d.id === item || d.path === item);
  if (declared) return declared;
  const path = item.startsWith("files/") ? item : `files/${item.replace(/^\/+/, "")}`;
  return { id: item, label: path.split("/").pop() || path, path, url: assetUrl(path) };
}

export function DownloadCards({ items }: { items: DownloadInfo[] }) {
  const { t, locale, assetUrl } = useRenderEnv();
  if (!items.length) return null;
  return (
    <div className="fcl-downloads">
      {items.map((item) => {
        const url = item.url ?? (item.zip ? undefined : assetUrl(item.path));
        const name = item.name ?? (item.zip ? `${item.id}.zip` : item.path.split("/").pop());
        const Icon = item.zip ? FileArchive : Download;
        const meta = [item.zip ? t("zip") : null, name, formatBytes(item.size, locale)].filter(Boolean).join(" · ");
        return url ? (
          <a key={item.id} className="fcl-download" href={url} download={name}>
            <Icon size={18} aria-hidden />
            <span className="fcl-download-text">
              <span className="fcl-download-label">{item.label}</span>
              <span className="fcl-download-meta">{meta}</span>
            </span>
          </a>
        ) : (
          <span key={item.id} className="fcl-download" data-pending>
            <Icon size={18} aria-hidden />
            <span className="fcl-download-text">
              <span className="fcl-download-label">{item.label}</span>
              <span className="fcl-download-meta">{meta}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  const { downloads, assetUrl } = useRenderEnv();
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "markdown":
            return <Prose key={index} text={block.text} />;
          case "code":
            return <CodeBlock key={index} fence={block.fence} code={block.code} />;
          case "terminal":
            return <TerminalBlock key={index} fence={block.fence} code={block.code} />;
          case "tree":
            return <TreeBlock key={index} fence={block.fence} code={block.code} />;
          case "download":
            return (
              <DownloadCards key={index} items={block.items.map((item) => resolveDownload(item, downloads, assetUrl))} />
            );
          case "callout":
            return (
              <Callout key={index} kind={block.kind} title={block.title}>
                <Blocks blocks={block.blocks} />
              </Callout>
            );
          case "tabs":
            return <TabGroup key={index} block={block} />;
          default:
            return null;
        }
      })}
    </>
  );
}

/** One step of extended Markdown. */
export function CodelabMarkdown({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  return (
    <div className="fcl-md">
      <Blocks blocks={blocks} />
    </div>
  );
}

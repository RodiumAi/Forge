"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ListTodo, Pencil, Plus, Square } from "lucide-react";
import { api, apiBase, getToken, logoutToHome } from "@/lib/api";
import {
  bootPromptKey,
  clearBootPrompt,
  peekBootPrompt,
} from "@/lib/create-project";
import { refreshRodiumWallet } from "@/lib/session-cache";
import { topProgressDone, topProgressStart } from "@/lib/top-progress";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  AgentActivityPanel,
  type AgentStep,
  type FileOp,
} from "@/components/AgentActivityPanel";
import { ClarifyCard, type ClarifyQuestion } from "@/components/ClarifyCard";
import { DesignCharterSlideover } from "@/components/DesignCharterSlideover";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AssistantBody } from "@/components/chat/AssistantBody";
import { ScrollToBottom } from "@/components/chat/ScrollToBottom";
import { PlanPanel, type PlanTask } from "@/components/PlanPanel";
import { PromptFileChips } from "@/components/PromptFileChips";
import { PromptAssetMention } from "@/components/PromptAssetMention";
import { BuilderTopbar } from "@/components/builder/BuilderTopbar";
import { CodePane } from "@/components/builder/CodePane";
import { CommentsPanel } from "@/components/builder/CommentsPanel";
import { FilesPane } from "@/components/builder/FilesPane";
import { ImageEditPanel } from "@/components/builder/ImageEditPanel";
import { OptionsPane } from "@/components/builder/OptionsPane";
import { PreviewPane } from "@/components/builder/PreviewPane";
import {
  detectRoutes,
  flattenFiles,
  routeSourceFiles,
  type BuilderMode,
  type ElementSelection,
  type FileNode,
  type ImageSelection,
  type PreviewTool,
  type ViewportMode,
} from "@/components/builder/types";
import {
  PROMPT_FILE_ACCEPT,
  type MessageAttachment,
  type PromptAttachment,
  attachmentName,
  attachmentPreviewUrl,
  attachmentPublicUrl,
  buildPromptWithAttachments,
  formatElementSelectionMarker,
  insertMentionInTextarea,
  mergePromptAttachments,
  parseUserMessageContent,
  revokePromptAttachment,
} from "@/lib/prompt-attachments";
import { uploadPromptAttachments } from "@/lib/prompt-upload";
import { UserMessageBody } from "@/components/UserMessageBody";
import {
  builderStateFromUi,
  builderUrlFromState,
  isOptionsSubview,
  parseBuilderUrlState,
  type OptionsSubview,
  viewToMode,
} from "@/lib/builder-url-state";
import {
  subscribeFiles,
  subscribePreview,
  subscribeRun,
  type PreviewLive,
  type RunLive,
} from "@/lib/firebase/live";
import { firebaseEnabled } from "@/lib/firebase/client";

type Project = {
  id: string;
  name: string;
  slug?: string;
  preview_running: boolean;
  preview_port: number | null;
  sites_url?: string | null;
  published_at?: string | null;
};

type Chat = { id: string; title: string | null };

type Message = {
  id: string;
  role: string;
  content: string;
  thinking_text?: string | null;
  steps_json?: string | null;
  file_ops_json?: string | null;
  plan_json?: string | null;
  effort_label?: string | null;
  attachments?: MessageAttachment[] | null;
  kind?: "error";
  retryable?: boolean;
};

type SendOpts = {
  bootKey?: string;
  skipUserBubble?: boolean;
};

type ChatRetryAction =
  | { kind: "boot"; prompt: string }
  | { kind: "send"; content: string; attachments: PromptAttachment[]; opts: SendOpts }
  | { kind: "plan" }
  | { kind: "clarify"; answers: Record<string, string> }
  | { kind: "subscribe"; runId: string };

type AgentMode = "agent" | "plan";

/** Survive React Strict Mode remounts for a given project boot. */
const bootInFlight = new Set<string>();

function displayContent(raw: string) {
  return raw
    .replace(/<forge-write[\s\S]*?<\/forge-write>/gi, "")
    .replace(/<forge-delete[^>]*\/?>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Collapse consecutive identical user turns (boot-loop leftovers). */
function dedupeMessages(msgs: Message[]): Message[] {
  const out: Message[] = [];
  for (const m of msgs) {
    if (m.role === "user" && !m.content.trim()) continue;
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.role === "user" &&
      m.role === "user" &&
      prev.content.trim() === m.content.trim()
    ) {
      continue;
    }
    out.push(m);
  }
  return out;
}

async function readSseStream(
  res: Response,
  onEvent: (payload: Record<string, unknown>) => void | Promise<void>,
) {
  if (!res.body) throw new Error("No stream body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      let payloadEvent: Record<string, unknown>;
      try {
        payloadEvent = JSON.parse(line.slice(6)) as Record<string, unknown>;
      } catch {
        continue;
      }
      await onEvent(payloadEvent);
    }
  }
}

function friendlyStreamError(err: unknown, fallback: string, rodiumExpired: string): string {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  if (
    /failed to fetch|networkerror|network request failed|load failed|network error|incomplete chunked|peer closed connection|connection reset|timed out|timeout/i.test(
      raw,
    )
  ) {
    return fallback;
  }
  if (
    /rodiumai session expired|sign in with rodiumai again|invalid_grant|refresh token is invalid|session rodiumai expir/i.test(
      raw,
    )
  ) {
    return rodiumExpired;
  }
  if (/invalid or unauthorized rodiumai key|clé rodiumai invalide/i.test(raw)) {
    return rodiumExpired;
  }
  // Surface Rodium network codes as the friendly stream message.
  if (/rodiumai error \(network\)/i.test(raw)) {
    return fallback;
  }
  return raw || fallback;
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();

  const initialUrl = parseBuilderUrlState(searchParams);

  const initialBoot =
    typeof window !== "undefined" ? peekBootPrompt(projectId)?.trim() || null : null;

  const [project, setProject] = useState<Project | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>(() =>
    initialBoot ? [{ id: "boot-user", role: "user", content: initialBoot }] : [],
  );
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<string | null>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [streaming, setStreaming] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamSteps, setStreamSteps] = useState<AgentStep[]>(() =>
    initialBoot ? [{ id: "boot", label: "…", status: "running" }] : [],
  );
  const [streamOps, setStreamOps] = useState<FileOp[]>([]);
  const [streamEffort, setStreamEffort] = useState<string | null>(null);
  const [streamSummary, setStreamSummary] = useState("");
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [busy, setBusy] = useState(() => Boolean(initialBoot));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatRetry, setChatRetry] = useState<ChatRetryAction | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [previewLiveStatus, setPreviewLiveStatus] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"chat" | "workspace">(
    initialUrl.pane ?? "chat",
  );
  const [mainMode, setMainMode] = useState<BuilderMode>(() => viewToMode(initialUrl.view));
  const [viewport, setViewport] = useState<ViewportMode>(initialUrl.viewport ?? "desktop");
  const [previewTool, setPreviewTool] = useState<PreviewTool | null>(initialUrl.tool);
  const [elementSelection, setElementSelection] = useState<ElementSelection | null>(null);
  const [commentAnchor, setCommentAnchor] = useState<ElementSelection | null>(null);
  const [imageSelection, setImageSelection] = useState<ImageSelection | null>(null);
  const [previewPath, setPreviewPath] = useState(
    initialUrl.page ?? (initialUrl.subview && initialUrl.view === "preview" ? `/${initialUrl.subview.replace(/^\//, "")}` : "/"),
  );
  const [pages, setPages] = useState<string[]>(["/"]);
  const [designOpen, setDesignOpen] = useState(initialUrl.design);
  const [optionsSection, setOptionsSection] = useState<OptionsSubview>(
    initialUrl.view === "more" && isOptionsSubview(initialUrl.subview)
      ? initialUrl.subview
      : "general",
  );
  const [bootRetryPrompt, setBootRetryPrompt] = useState<string | null>(null);
  const [planMode, setPlanMode] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
  const [planTasks, setPlanTasks] = useState<PlanTask[]>([]);
  const [planNeedsConfirm, setPlanNeedsConfirm] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const streamAbortRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const restoredBgRunRef = useRef<string | null>(null);
  /** Runs the user explicitly stopped — ignore Firestore "running" echoes for these. */
  const ignoredRunIdsRef = useRef<Set<string>>(new Set());
  const streamingRunIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoPreviewRef = useRef(false);
  const bootSentRef = useRef(false);
  const bootPromptRef = useRef<string | null>(initialBoot);
  const previewRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUpdatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatRetryRef = useRef<ChatRetryAction | null>(null);

  const previewSrc = useMemo(() => {
    if (!previewUrl) return null;
    const absolute = previewUrl.startsWith("http")
      ? previewUrl
      : `${apiBase()}${previewUrl.startsWith("/") ? previewUrl : `/${previewUrl}`}`;
    const join = absolute.includes("?") ? "&" : "?";
    return `${absolute}${join}t=${previewKey}`;
  }, [previewUrl, previewKey]);

  const syncBuilderUrl = useCallback(
    (overrides?: Partial<{
      mainMode: BuilderMode;
      optionsSection: OptionsSubview;
      mobilePane: "chat" | "workspace";
      viewport: ViewportMode;
      previewPath: string;
      previewTool: PreviewTool | null;
      designOpen: boolean;
    }>) => {
      router.replace(
        builderUrlFromState(
          pathname,
          builderStateFromUi({
            mainMode: overrides?.mainMode ?? mainMode,
            optionsSection: overrides?.optionsSection ?? optionsSection,
            mobilePane: overrides?.mobilePane ?? mobilePane,
            viewport: overrides?.viewport ?? viewport,
            previewPath: overrides?.previewPath ?? previewPath,
            previewTool: overrides?.previewTool ?? previewTool,
            designOpen: overrides?.designOpen ?? designOpen,
          }),
        ),
        { scroll: false },
      );
    },
    [
      designOpen,
      mainMode,
      mobilePane,
      optionsSection,
      pathname,
      previewPath,
      previewTool,
      router,
      viewport,
    ],
  );

  useEffect(() => {
    const parsed = parseBuilderUrlState(searchParams);
    setMainMode(viewToMode(parsed.view));
    setMobilePane(parsed.pane ?? "chat");
    setViewport(parsed.viewport ?? "desktop");
    setPreviewTool(parsed.view === "preview" ? parsed.tool : null);
    setDesignOpen(parsed.design);
    if (parsed.view === "more" && isOptionsSubview(parsed.subview)) {
      setOptionsSection(parsed.subview);
    }
    if (parsed.page) {
      setPreviewPath(parsed.page);
    } else if (parsed.view === "preview" && parsed.subview) {
      setPreviewPath(`/${parsed.subview.replace(/^\//, "")}`);
    }
  }, [searchParams]);

  const refreshRoutes = useCallback(async () => {
    try {
      const tree = await api<FileNode[]>(`/projects/${projectId}/files`);
      const candidates = routeSourceFiles(flattenFiles(tree));
      const sources: Record<string, string> = {};
      await Promise.all(
        candidates.map(async (path) => {
          try {
            const res = await api<{ content: string }>(
              `/projects/${projectId}/files/content?path=${encodeURIComponent(path)}`,
            );
            sources[path] = res.content;
          } catch {
            /* optional */
          }
        }),
      );
      const routes = detectRoutes(tree, sources);
      setPages(routes);
      setPreviewPath((prev) => (routes.includes(prev) ? prev : "/"));
    } catch {
      setPages(["/"]);
    }
  }, [projectId]);

  const awaitingHitl = clarifyQuestions.length > 0 || planNeedsConfirm;
  const composerInputLocked = busy || awaitingHitl;

  useEffect(() => {
    activeRunIdRef.current = activeRunId;
  }, [activeRunId]);

  useEffect(() => {
    if (!bootPromptRef.current) return;
    setStreamSteps((prev) =>
      prev.some((s) => s.id === "boot")
        ? prev.map((s) => (s.id === "boot" ? { ...s, label: t("bootStarting") } : s))
        : [{ id: "boot", label: t("bootStarting"), status: "running" }],
    );
  }, [t]);

  useEffect(() => {
    return () => {
      attachments.forEach(revokePromptAttachment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revoke only on unmount
  }, []);

  const load = useCallback(async () => {
    const p = await api<Project>(`/projects/${projectId}`);
    setProject(p);
    const chats = await api<Chat[]>(`/projects/${projectId}/chats`);
    const main = chats[0];
    if (!main) throw new Error(t("noChat"));
    setChatId(main.id);
    const msgs = await api<Message[]>(`/projects/${projectId}/chats/${main.id}/messages`);
    const boot = bootPromptRef.current || peekBootPrompt(projectId)?.trim() || null;
    if (msgs.length > 0) {
      setMessages(dedupeMessages(msgs));
      bootPromptRef.current = null;
      clearBootPrompt(projectId);
      bootSentRef.current = true;
      setBusy(false);
      setStreamSteps([]);
    } else if (boot) {
      bootPromptRef.current = boot;
      setMessages([{ id: "boot-user", role: "user", content: boot }]);
      setBusy(true);
      setStreamSteps([{ id: "boot", label: t("bootStarting"), status: "running" }]);
    } else {
      setMessages([]);
    }

    // Restore HITL plan / clarify after refresh.
    try {
      const active = await api<{
        id: string;
        status: string;
        mode: string;
        plan: PlanTask[];
        clarify: ClarifyQuestion[];
      } | null>(`/projects/${projectId}/chats/${main.id}/runs/active`);
      if (active?.id) {
        setActiveRunId(active.id);
        if (active.status === "awaiting_clarify" && Array.isArray(active.clarify) && active.clarify.length) {
          setClarifyQuestions(active.clarify);
          setPlanNeedsConfirm(false);
          setPlanTasks([]);
          setBusy(false);
        } else if (
          (active.status === "awaiting_plan_confirm" || active.status === "error") &&
          Array.isArray(active.plan) &&
          active.plan.length
        ) {
          setPlanTasks(
            active.plan.map((task, i) => ({
              id: task.id || `task_${i + 1}`,
              title: task.title || `Task ${i + 1}`,
              status: task.status === "running" ? "pending" : task.status || "pending",
            })),
          );
          setPlanNeedsConfirm(true);
          setClarifyQuestions([]);
          setBusy(false);
          setPlanMode(active.mode === "plan");
        } else if (active.status === "running" && Array.isArray(active.plan) && active.plan.length) {
          setPlanTasks(
            active.plan.map((task, i) => ({
              id: task.id || `task_${i + 1}`,
              title: task.title || `Task ${i + 1}`,
              status: task.status || "pending",
            })),
          );
          setPlanNeedsConfirm(false);
          setBusy(true);
          restoredBgRunRef.current = active.id;
        }
      }
    } catch {
      /* no active run */
    }

    const status = await api<{ running: boolean; url: string | null }>(
      `/projects/${projectId}/preview`,
    );
    if (status.running && status.url) setPreviewUrl(status.url);
    void refreshRoutes();
  }, [projectId, t, refreshRoutes]);

  const pushChatError = useCallback(
    (message: string, retry: ChatRetryAction | null = null) => {
      const text = message.trim() || t("streamError");
      chatRetryRef.current = retry;
      setChatRetry(retry);
      setError(null);
      setMessages((prev) => {
        const withoutStale = prev.filter((m) => m.kind !== "error");
        return [
          ...withoutStale,
          {
            id: `local-error-${Date.now()}`,
            role: "assistant",
            kind: "error",
            content: text,
            retryable: Boolean(retry),
          },
        ];
      });
      stickToBottomRef.current = true;
    },
    [t],
  );

  const startPreview = useCallback(async () => {
    setPreviewBusy(true);
    setError(null);
    try {
      const status = await api<{
        running: boolean;
        url: string | null;
        mode?: string;
        runner_url?: string | null;
      }>(`/projects/${projectId}/preview/start`, { method: "POST" });
      setPreviewUrl(status.runner_url || status.url);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      pushChatError(err instanceof Error ? err.message : t("previewFailed"), null);
    } finally {
      setPreviewBusy(false);
    }
  }, [projectId, pushChatError, t]);

  const forcePreviewRefresh = useCallback(
    async (opts?: { softStart?: boolean; remount?: boolean; restart?: boolean }) => {
      const remount = opts?.remount !== false;
      setPreviewUpdating(true);
      if (previewUpdatingTimer.current) clearTimeout(previewUpdatingTimer.current);
      if (previewRefreshTimer.current) {
        clearTimeout(previewRefreshTimer.current);
        previewRefreshTimer.current = null;
      }

      if (opts?.restart) {
        // Clean restart (kill orphans + clear Vite cache) then remount iframe.
        try {
          const status = await api<{ running: boolean; url: string | null }>(
            `/projects/${projectId}/preview/restart`,
            { method: "POST" },
          );
          if (status.url) setPreviewUrl(status.url);
          if (remount) setPreviewKey((k) => k + 1);
        } catch (err) {
          // Fallback to plain start if restart endpoint unavailable.
          await startPreview();
          if (remount) setPreviewKey((k) => k + 1);
          pushChatError(err instanceof Error ? err.message : t("previewFailed"), null);
        }
      } else if (opts?.softStart) {
        try {
          const status = await api<{ running: boolean; url: string | null }>(
            `/projects/${projectId}/preview`,
          );
          if (!status.running || !status.url) {
            await startPreview();
          } else {
            setPreviewUrl(status.url);
            if (remount) setPreviewKey((k) => k + 1);
          }
        } catch {
          await startPreview();
        }
      } else if (remount) {
        setPreviewKey((k) => k + 1);
      }

      previewUpdatingTimer.current = setTimeout(() => {
        setPreviewUpdating(false);
        previewUpdatingTimer.current = null;
      }, 1600);
    },
    [projectId, pushChatError, startPreview, t],
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    topProgressStart("project-load");
    load()
      .catch((err) => {
        if (err instanceof Error && /invalid token|not authenticated|unauthorized/i.test(err.message)) {
          return;
        }
        pushChatError(err.message, null);
      })
      .finally(() => {
        setLoading(false);
        topProgressDone("project-load");
      });
  }, [load, pushChatError, router]);

  useEffect(() => {
    if (previewBusy || previewUpdating) topProgressStart("preview");
    else topProgressDone("preview");
  }, [previewBusy, previewUpdating]);

  useEffect(() => {
    if (busy) topProgressStart("generation");
    else topProgressDone("generation");
  }, [busy]);

  useEffect(() => {
    if (loading || previewUrl || previewBusy || autoPreviewRef.current) return;
    autoPreviewRef.current = true;
    void startPreview();
  }, [loading, previewBusy, previewUrl, startPreview]);

  // Firestore live: preview status (primary UI signal when emulator/prod is on).
  useEffect(() => {
    if (!projectId || !firebaseEnabled()) return;
    let lastStatus = "";
    return subscribePreview(projectId, (live: PreviewLive | null) => {
      if (!live?.status) return;
      setPreviewLiveStatus(live.status);
      if (live.status === "starting") {
        setPreviewBusy(true);
      } else if (live.status === "ready") {
        if (live.url) setPreviewUrl(live.url);
        setPreviewBusy(false);
        if (lastStatus && lastStatus !== "ready") {
          setPreviewKey((k) => k + 1);
        }
      } else if (live.status === "dead" || live.status === "error") {
        setPreviewBusy(false);
        setPreviewUrl(null);
        if (live.status === "error" && live.error) {
          pushChatError(live.error, null);
        }
      } else if (live.status === "stopped") {
        setPreviewBusy(false);
      }
      lastStatus = live.status;
    });
  }, [projectId, pushChatError]);
  useEffect(() => {
    if (!projectId || !firebaseEnabled()) return;
    let lastRev = -1;
    return subscribeFiles(projectId, (live) => {
      const rev = typeof live?.rev === "number" ? live.rev : -1;
      if (rev < 0 || rev === lastRev) return;
      lastRev = rev;
      void refreshRoutes();
      void forcePreviewRefresh({ softStart: true, remount: true });
    });
  }, [projectId, refreshRoutes, forcePreviewRefresh]);

  // Firestore live: run metadata (SSE still streams tokens).
  useEffect(() => {
    if (!projectId || !firebaseEnabled()) return;
    return subscribeRun(projectId, (live: RunLive | null) => {
      if (!live) return;
      const runId = live.run_id || null;
      if (runId && ignoredRunIdsRef.current.has(runId)) {
        if (live.status === "cancelled" || live.status === "done" || live.status === "error") {
          ignoredRunIdsRef.current.delete(runId);
        }
        return;
      }
      if (runId) setActiveRunId(runId);
      if (live.status === "running" || live.status === "awaiting_clarify" || live.status === "awaiting_plan_confirm") {
        // Only lock the composer from Firestore when we own an SSE for this run,
        // or when restoring an awaiting HITL state (clarify/plan).
        if (
          live.status === "awaiting_clarify" ||
          live.status === "awaiting_plan_confirm" ||
          (runId && streamingRunIdRef.current === runId) ||
          Boolean(streamAbortRef.current)
        ) {
          setBusy(true);
        }
      } else if (live.status === "done" || live.status === "error" || live.status === "cancelled") {
        if (!runId || streamingRunIdRef.current === runId || !streamAbortRef.current) {
          setBusy(false);
        }
      }
      if (live.step_id && live.step_label) {
        setStreamSteps((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.id === live.step_id);
          const row = {
            id: live.step_id!,
            label: live.step_label!,
            status: (live.status === "running" ? "running" : "done") as AgentStep["status"],
          };
          if (idx >= 0) next[idx] = { ...next[idx], ...row };
          else next.push(row);
          return next;
        });
      }
    });
  }, [projectId]);

  const schedulePreviewRefresh = useCallback(() => {
    if (previewRefreshTimer.current) clearTimeout(previewRefreshTimer.current);
    previewRefreshTimer.current = setTimeout(() => {
      previewRefreshTimer.current = null;
      void forcePreviewRefresh({ restart: true });
    }, 900);
  }, [forcePreviewRefresh]);

  useEffect(() => {
    return () => {
      if (previewRefreshTimer.current) clearTimeout(previewRefreshTimer.current);
      if (previewUpdatingTimer.current) clearTimeout(previewUpdatingTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 180)}px`;
  }, [input]);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      // Only keep auto-following while the user is near the bottom.
      const atBottom = distanceFromBottom < 80;
      stickToBottomRef.current = atBottom;
      setShowJumpToBottom(!atBottom);
      if (atBottom) setHasUnread(false);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    if (!stickToBottomRef.current) {
      // Detached view: signal that something new landed instead of yanking
      // the user back down mid-read.
      setHasUnread(true);
      return;
    }
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [
    messages,
    streaming,
    streamSteps,
    streamThinking,
    streamOps,
    clarifyQuestions,
    planTasks,
    streamSummary,
  ]);

  const jumpToBottom = useCallback(() => {
    const container = messagesRef.current;
    if (!container) return;
    stickToBottomRef.current = true;
    setHasUnread(false);
    setShowJumpToBottom(false);
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  // New user message → pin back to bottom so the reply is visible.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    stickToBottomRef.current = true;
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);
  const addFiles = useCallback(
    (list: FileList | File[]) => {
      if (!list?.length) return;
      setAttachments((prev) => {
        const result = mergePromptAttachments(prev, list);
        const added = result.next.length - prev.length;
        if (added > 0) {
          setFileError(null);
          setFileNotice(t("promptFilesAttached").replace("{count}", String(added)));
          window.setTimeout(() => setFileNotice(null), 3200);
        } else if (result.rejected.length > 0) {
          setFileNotice(null);
          setFileError(t("promptFileTypeError"));
        }
        return result.next;
      });
    },
    [t],
  );

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    // Always clear so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!list?.length) return;
    addFiles(list);
  }

  function openFilePicker() {
    const input = fileInputRef.current;
    if (!input || composerInputLocked) return;
    input.value = "";
    input.click();
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePromptAttachment(target);
      return prev.filter((item) => item.id !== id);
    });
    setFileError(null);
    setFileNotice(null);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (composerInputLocked) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  const handleStreamEvent = useCallback(
    (
      payloadEvent: Record<string, unknown>,
      ctx: {
        assistantRef: { value: string };
        thinkingRef: { value: string };
        ops: FileOp[];
        stepsSnapshot: AgentStep[];
        effortRef: { value: string | null };
        appliedRef: { value: boolean };
        userPayload: string;
        clearBootOnce: () => void;
      },
    ) => {
      const type = String(payloadEvent.type || "");
      if (
        type === "user_message" ||
        type === "step" ||
        type === "token" ||
        type === "route" ||
        type === "clarify" ||
        type === "plan"
      ) {
        ctx.clearBootOnce();
      }
      if (type === "user_message" && typeof payloadEvent.run_id === "string") {
        setActiveRunId(payloadEvent.run_id);
        streamingRunIdRef.current = payloadEvent.run_id;
        ignoredRunIdsRef.current.delete(payloadEvent.run_id);
      }
      if (type === "token") {
        ctx.assistantRef.value += String(payloadEvent.content || "");
        setStreaming(ctx.assistantRef.value);
      } else if (type === "thinking") {
        ctx.thinkingRef.value += String(payloadEvent.delta || "");
        setStreamThinking(ctx.thinkingRef.value);
      } else if (type === "step") {
        const step = {
          id: String(payloadEvent.id),
          label: String(payloadEvent.label || ""),
          status: String(payloadEvent.status || "running"),
        } as AgentStep;
        const idx = ctx.stepsSnapshot.findIndex((s) => s.id === step.id);
        if (idx === -1) ctx.stepsSnapshot.push(step);
        else ctx.stepsSnapshot[idx] = step;
        setStreamSteps((prev) => {
          const withoutBoot = prev.filter((s) => s.id !== "boot");
          const i = withoutBoot.findIndex((s) => s.id === step.id);
          if (i === -1) return [...withoutBoot, step];
          const next = [...withoutBoot];
          next[i] = step;
          return next;
        });
        // Keep plan checklist in sync when dispatcher emits task:* steps.
        if (step.id.startsWith("task:")) {
          const tid = step.id.slice("task:".length);
          setPlanTasks((prev) =>
            prev.map((task) =>
              String(task.id) === tid
                ? { ...task, status: step.status, title: step.label || task.title }
                : task,
            ),
          );
        }
      } else if (type === "route") {
        ctx.effortRef.value = (payloadEvent.effort_label as string) || null;
        setStreamEffort(ctx.effortRef.value);
      } else if (type === "clarify") {
        if (typeof payloadEvent.run_id === "string") setActiveRunId(payloadEvent.run_id);
        const questions = Array.isArray(payloadEvent.questions)
          ? (payloadEvent.questions as ClarifyQuestion[])
          : [];
        setClarifyQuestions(questions);
        setPlanNeedsConfirm(false);
        setBusy(false);
      } else if (type === "plan") {
        if (typeof payloadEvent.run_id === "string") setActiveRunId(payloadEvent.run_id);
        const tasks = Array.isArray(payloadEvent.tasks)
          ? (payloadEvent.tasks as PlanTask[])
          : [];
        const needs = Boolean(payloadEvent.needs_confirm);
        const normalized = tasks.map((task, i) => ({
          ...task,
          id: String(task.id || `task_${i + 1}`),
          status: task.status || "pending",
        }));
        // Auto-run: show first task as running immediately so the UI is not silent.
        if (!needs && normalized.length) {
          normalized[0] = { ...normalized[0], status: "running" };
        }
        setPlanTasks(normalized);
        setPlanNeedsConfirm(needs);
        setClarifyQuestions([]);
        if (needs) setBusy(false);
      } else if (type === "plan_task") {
        const tid = String(payloadEvent.id || "");
        const status = String(payloadEvent.status || "running");
        const label = String(payloadEvent.label || "");
        setPlanTasks((prev) =>
          prev.map((task) =>
            String(task.id) === tid
              ? { ...task, status, title: label || task.title }
              : task,
          ),
        );
      } else if (type === "file_write") {
        ctx.appliedRef.value = true;
        ctx.ops.push({ op: "write", path: String(payloadEvent.path) });
        setStreamOps([...ctx.ops]);
        void refreshRoutes();
        schedulePreviewRefresh();
        if (!previewUrl && !previewBusy) void startPreview();
      } else if (type === "file_delete") {
        ctx.appliedRef.value = true;
        ctx.ops.push({ op: "delete", path: String(payloadEvent.path) });
        setStreamOps([...ctx.ops]);
        schedulePreviewRefresh();
      } else if (type === "error") {
        const message = String(payloadEvent.message || t("streamError"));
        if (message === "cancelled") {
          setPlanTasks([]);
          setPlanNeedsConfirm(false);
          setActiveRunId(null);
          return;
        }
        setPlanTasks((prev) => {
          const base = Array.isArray(payloadEvent.plan)
            ? (payloadEvent.plan as PlanTask[]).map((task, i) => ({
                ...task,
                id: String(task.id || `task_${i + 1}`),
                status: task.status || "pending",
              }))
            : prev;
          const updated = base.map((task) =>
            task.status === "running" ? { ...task, status: "error" } : task,
          );
          const canResume = updated.some(
            (task) => task.status === "pending" || task.status === "error",
          );
          setPlanNeedsConfirm(canResume);
          return updated;
        });
        throw new Error(message);
      } else if (type === "done") {
        const summary = typeof payloadEvent.summary === "string" ? payloadEvent.summary : "";
        const content =
          summary.trim() ||
          ctx.assistantRef.value.trim() ||
          (locale === "en"
            ? "Here is what was put in place."
            : "Voici ce qui a été mis en place.");
        setStreamSummary(content);
        const finalPlan = Array.isArray(payloadEvent.plan)
          ? (payloadEvent.plan as PlanTask[]).map((task) => ({
              ...task,
              status: task.status || "done",
            }))
          : [];
        setPlanNeedsConfirm(false);
        setClarifyQuestions([]);
        setPlanTasks([]);
        setActiveRunId(null);
        setMessages((m) => {
          const withoutDupUser = ctx.userPayload.trim()
            ? m.filter(
                (x) =>
                  !(x.role === "user" && x.content === ctx.userPayload && x.id !== "boot-user"),
              )
            : m;
          const withUser =
            !ctx.userPayload.trim() ||
            withoutDupUser.some((x) => x.role === "user" && x.content === ctx.userPayload)
              ? withoutDupUser
              : [
                  ...withoutDupUser,
                  { id: `local-${Date.now()}`, role: "user", content: ctx.userPayload },
                ];
          return [
            ...withUser.map((x) =>
              x.id === "boot-user" ? { ...x, id: `local-boot-${Date.now()}` } : x,
            ),
            {
              id: `asst-${Date.now()}`,
              role: "assistant",
              content,
              thinking_text: ctx.thinkingRef.value || null,
              steps_json: JSON.stringify(ctx.stepsSnapshot),
              file_ops_json: JSON.stringify(ctx.ops),
              plan_json: finalPlan.length ? JSON.stringify(finalPlan) : null,
              effort_label: ctx.effortRef.value || (payloadEvent.effort_label as string) || null,
            },
          ];
        });
        setStreaming("");
        setStreamThinking("");
        setStreamSteps([]);
        setStreamOps([]);
        setStreamEffort(null);
        setStreamSummary("");
        const appliedList = Array.isArray(payloadEvent.applied)
          ? (payloadEvent.applied as unknown[])
          : [];
        if (ctx.appliedRef.value || appliedList.length) {
          void forcePreviewRefresh({ restart: true });
          setMainMode("preview");
          setMobilePane("workspace");
          setPreviewTool(null);
          syncBuilderUrl({ mainMode: "preview", mobilePane: "workspace", previewTool: null });
        }
      }
    },
    [forcePreviewRefresh, locale, previewBusy, previewUrl, schedulePreviewRefresh, startPreview, syncBuilderUrl, t],
  );

  const subscribeRunEvents = useCallback(
    async (runId: string) => {
      if (!chatId || !runId) return;
      streamAbortRef.current?.abort();
      const abortCtrl = new AbortController();
      streamAbortRef.current = abortCtrl;
      streamingRunIdRef.current = runId;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${runId}/events`,
          {
            method: "GET",
            signal: abortCtrl.signal,
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Accept-Language": locale,
              Accept: "text/event-stream",
            },
          },
        );
        if (!res.ok || !res.body) {
          throw new Error(res.statusText || t("streamError"));
        }
        const assistantRef = { value: "" };
        const thinkingRef = { value: "" };
        const effortRef = { value: streamEffort };
        const appliedRef = { value: false };
        const ops: FileOp[] = [...streamOps];
        const stepsSnapshot: AgentStep[] = [...streamSteps];
        await readSseStream(res, async (payloadEvent) => {
          if (
            String(payloadEvent.type || "") === "error" &&
            String(payloadEvent.message || "") === "run_detached"
          ) {
            setPlanNeedsConfirm(true);
            setBusy(false);
            return;
          }
          handleStreamEvent(payloadEvent, {
            assistantRef,
            thinkingRef,
            ops,
            stepsSnapshot,
            effortRef,
            appliedRef,
            userPayload: "",
            clearBootOnce: () => undefined,
          });
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        pushChatError(friendlyStreamError(err, t("streamError"), t("rodiumSessionExpired")), {
          kind: "subscribe",
          runId,
        });
        setPlanNeedsConfirm(true);
      } finally {
        if (streamAbortRef.current === abortCtrl) streamAbortRef.current = null;
        if (streamingRunIdRef.current === runId) streamingRunIdRef.current = null;
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [chatId, handleStreamEvent, locale, projectId, pushChatError, streamEffort, streamOps, streamSteps, t],
  );

  useEffect(() => {
    const rid = restoredBgRunRef.current;
    if (!rid || rid !== activeRunId || !chatId) return;
    restoredBgRunRef.current = null;
    void subscribeRunEvents(rid);
  }, [activeRunId, chatId, subscribeRunEvents]);

  const startEditMessage = useCallback(
    (messageId: string, content: string) => {
      if (busy) return;
      if (messageId.startsWith("local") || messageId === "boot-user") return;
      const parsed = parseUserMessageContent(content);
      setInput(parsed.text);
      setEditingMessageId(messageId);
      setAttachments([]);
      setError(null);
      textareaRef.current?.focus();
    },
    [busy],
  );

  const dismissPlan = useCallback(async () => {
    const runId = activeRunId;
    if (runId && chatId) {
      try {
        await fetch(
          `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${runId}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Accept-Language": locale,
            },
          },
        );
      } catch {
        /* ignore */
      }
    }
    setPlanTasks([]);
    setPlanNeedsConfirm(false);
    setClarifyQuestions([]);
    setActiveRunId(null);
    setBusy(false);
    setError(null);
  }, [activeRunId, chatId, locale, projectId]);

  const stopGeneration = useCallback(async () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    const localRunId = activeRunIdRef.current || streamingRunIdRef.current;
    if (localRunId) ignoredRunIdsRef.current.add(localRunId);
    streamingRunIdRef.current = null;

    const cancelOne = async (runId: string) => {
      ignoredRunIdsRef.current.add(runId);
      if (!chatId) return;
      try {
        await fetch(
          `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${runId}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${getToken()}`,
              "Accept-Language": locale,
            },
          },
        );
      } catch {
        /* ignore */
      }
    };

    if (localRunId) await cancelOne(localRunId);
    // Also cancel whatever the API still considers active (stale local id).
    if (chatId) {
      try {
        const active = await api<{ id: string; status: string } | null>(
          `/projects/${projectId}/chats/${chatId}/runs/active`,
        );
        if (active?.id && active.id !== localRunId) {
          await cancelOne(active.id);
        }
      } catch {
        /* ignore */
      }
    }

    setBusy(false);
    setStreaming("");
    setStreamThinking("");
    setStreamSteps([]);
    setStreamOps([]);
    setStreamEffort(null);
    setPlanTasks((prev) =>
      prev.map((task) => (task.status === "running" ? { ...task, status: "pending" } : task)),
    );
    setActiveRunId(null);
    void refreshRodiumWallet();
  }, [chatId, locale, projectId]);

  const sendMessage = useCallback(
    async (content: string, attached: PromptAttachment[] = [], opts: SendOpts = {}) => {
      if (!chatId) return;
      // Block only when a real SSE stream is in flight — ignore Firestore ghost busy.
      if (busy && !opts.skipUserBubble && streamAbortRef.current) return;

      let uploaded = attached;
      try {
        if (attached.some((a) => a.source === "local" && a.kind === "image")) {
          uploaded = await uploadPromptAttachments(projectId, attached, locale);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Drop failed local images so the composer + picker stay usable.
        setAttachments((prev) => {
          for (const item of prev) {
            if (item.source === "local" && item.kind === "image") {
              revokePromptAttachment(item);
            }
          }
          return prev.filter((a) => !(a.source === "local" && a.kind === "image"));
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
        pushChatError(msg, null);
        return;
      }

      const withSelection = elementSelection
        ? `${formatElementSelectionMarker(elementSelection, t("selectionMarker"))}\n\n${content}`.trim()
        : content;
      const built = await buildPromptWithAttachments(withSelection, uploaded, {
        importFiles: t("importFiles"),
        imageAttached: t("promptImageAttached"),
        mdSection: t("promptMdSection"),
        txtSection: t("promptTxtSection"),
        pdfSection: t("promptPdfSection"),
        pdfEmpty: t("promptPdfEmpty"),
      });
      const payload = built.trim();
      if (!payload.trim()) return;
      setElementSelection(null);

      const displayAtts: MessageAttachment[] = uploaded.map((a) => ({
        name: attachmentName(a),
        kind: a.kind,
        previewUrl: attachmentPreviewUrl(a),
        publicUrl: attachmentPublicUrl(a),
        publicPath: attachmentPublicUrl(a),
        objectId: a.objectId || null,
      }));

      const mode: AgentMode = planMode ? "plan" : "agent";
      const branchFromId = editingMessageId;
      const isBranch = Boolean(
        branchFromId &&
          !branchFromId.startsWith("local") &&
          branchFromId !== "boot-user",
      );

      setBusy(true);
      setError(null);
      setBootRetryPrompt(null);
      setMessages((prev) => prev.filter((m) => m.kind !== "error"));
      chatRetryRef.current = null;
      setChatRetry(null);
      setStreaming("");
      setStreamThinking("");
      setStreamSummary("");
      setClarifyQuestions([]);
      if (!isBranch) {
        setPlanTasks([]);
        setPlanNeedsConfirm(false);
        setActiveRunId(null);
      }
      setStreamSteps(
        opts.skipUserBubble
          ? [{ id: "boot", label: t("bootStarting"), status: "running" }]
          : [],
      );
      setStreamOps([]);
      setStreamEffort(null);
      setMessages((m) => {
        if (isBranch) {
          const idx = m.findIndex((x) => x.id === branchFromId);
          if (idx === -1) return m;
          return m.slice(0, idx + 1).map((x) =>
            x.id === branchFromId
              ? { ...x, content: payload, attachments: displayAtts }
              : x,
          );
        }
        if (opts.skipUserBubble) {
          if (m.some((x) => x.id === "boot-user")) {
            return m.map((x) =>
              x.id === "boot-user"
                ? { ...x, content: payload, attachments: displayAtts }
                : x,
            );
          }
          const last = m[m.length - 1];
          if (last?.role === "user" && last.content === payload) return m;
          return [
            {
              id: "boot-user",
              role: "user",
              content: payload,
              attachments: displayAtts,
            },
            ...m.filter((x) => x.role !== "user"),
          ];
        }
        return [
          ...m,
          {
            id: `local-${Date.now()}`,
            role: "user",
            content: payload,
            attachments: displayAtts,
          },
        ];
      });
      if (isBranch) setEditingMessageId(null);
      // Keep blob URLs on the message bubble — do not revoke here.
      setAttachments([]);

      streamAbortRef.current?.abort();
      const abortCtrl = new AbortController();
      streamAbortRef.current = abortCtrl;

      try {
        const endpoint = isBranch
          ? `${apiBase()}/projects/${projectId}/chats/${chatId}/messages/branch`
          : `${apiBase()}/projects/${projectId}/chats/${chatId}/messages`;
        const res = await fetch(endpoint, {
          method: "POST",
          signal: abortCtrl.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
            "Accept-Language": locale,
          },
          body: JSON.stringify(
            isBranch
              ? { from_message_id: branchFromId, content: payload, mode }
              : { content: payload, mode },
          ),
        });
        if (!res.ok || !res.body) {
          let detail = res.statusText;
          try {
            const data = await res.json();
            detail = typeof data.detail === "string" ? data.detail : detail;
          } catch {
            const text = await res.text().catch(() => "");
            if (text) detail = text;
          }
          if (res.status === 401) {
            logoutToHome("expired");
            return;
          }
          if (res.status === 403 && /rodiumai session expired|sign in with rodiumai/i.test(detail)) {
            throw new Error(detail);
          }
          throw new Error(detail || res.statusText);
        }

        const assistantRef = { value: "" };
        const thinkingRef = { value: "" };
        const effortRef = { value: null as string | null };
        const appliedRef = { value: false };
        const ops: FileOp[] = [];
        const stepsSnapshot: AgentStep[] = [];
        let bootCleared = false;
        const clearBootOnce = () => {
          if (bootCleared || !opts.bootKey) return;
          clearBootPrompt(projectId);
          bootPromptRef.current = null;
          bootCleared = true;
        };

        await readSseStream(res, async (payloadEvent) => {
          handleStreamEvent(payloadEvent, {
            assistantRef,
            thinkingRef,
            ops,
            stepsSnapshot,
            effortRef,
            appliedRef,
            userPayload: payload,
            clearBootOnce,
          });
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        if (opts.bootKey) {
          setBootRetryPrompt(payload);
        }
        const retry: ChatRetryAction = opts.bootKey
          ? { kind: "boot", prompt: payload }
          : {
              kind: "send",
              content,
              attachments: uploaded,
              opts: { ...opts, skipUserBubble: true },
            };
        pushChatError(
          friendlyStreamError(err, t("streamError"), t("rodiumSessionExpired")),
          retry,
        );
        setStreaming("");
        setStreamThinking("");
        setStreamSteps([]);
        setStreamOps([]);
        setStreamEffort(null);
        setClarifyQuestions([]);
      } finally {
        streamAbortRef.current = null;
        streamingRunIdRef.current = null;
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [busy, chatId, editingMessageId, elementSelection, handleStreamEvent, locale, planMode, projectId, pushChatError, t],
  );

  const submitClarify = useCallback(
    async (answers: Record<string, string>) => {
      if (!chatId || !activeRunId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${activeRunId}/clarify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
              "Accept-Language": locale,
            },
            body: JSON.stringify({ answers }),
          },
        );
        if (!res.ok || !res.body) {
          throw new Error(res.statusText);
        }
        const assistantRef = { value: "" };
        const thinkingRef = { value: "" };
        const effortRef = { value: streamEffort };
        const appliedRef = { value: false };
        const ops: FileOp[] = [...streamOps];
        const stepsSnapshot: AgentStep[] = [...streamSteps];
        await readSseStream(res, async (payloadEvent) => {
          handleStreamEvent(payloadEvent, {
            assistantRef,
            thinkingRef,
            ops,
            stepsSnapshot,
            effortRef,
            appliedRef,
            userPayload: "",
            clearBootOnce: () => undefined,
          });
        });
      } catch (err) {
        pushChatError(friendlyStreamError(err, t("streamError"), t("rodiumSessionExpired")), {
          kind: "clarify",
          answers,
        });
      } finally {
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [activeRunId, chatId, handleStreamEvent, locale, projectId, pushChatError, streamEffort, streamOps, streamSteps, t],
  );

  const executePlan = useCallback(async () => {
    if (!chatId || !activeRunId) return;
    setBusy(true);
    setPlanNeedsConfirm(false);
    setError(null);
    setPlanTasks((prev) => {
      if (!prev.length) return prev;
      const next = prev.map((task) =>
        task.status === "done" ? task : { ...task, status: "pending" },
      );
      const firstPending = next.findIndex((task) => task.status === "pending");
      if (firstPending >= 0) {
        next[firstPending] = { ...next[firstPending], status: "running" };
      }
      return next;
    });
    setStreamSteps((prev) => [
      ...prev.filter((s) => s.id !== "plan-exec"),
      { id: "plan-exec", label: t("planStatusStarting"), status: "running" },
    ]);
    try {
      streamAbortRef.current?.abort();
      const abortCtrl = new AbortController();
      streamAbortRef.current = abortCtrl;
      const res = await fetch(
        `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${activeRunId}/confirm-plan`,
        {
          method: "POST",
          signal: abortCtrl.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
            "Accept-Language": locale,
          },
          body: JSON.stringify({ plan: planTasks }),
        },
      );
      if (!res.ok || !res.body) {
        let detail = res.statusText;
        try {
          const data = (await res.json()) as { detail?: string };
          detail = typeof data.detail === "string" ? data.detail : detail;
        } catch {
          /* ignore */
        }
        if (res.status === 400) {
          setPlanTasks([]);
          setPlanNeedsConfirm(false);
          setActiveRunId(null);
          throw new Error(t("planInvalid"));
        }
        throw new Error(detail);
      }
      const assistantRef = { value: "" };
      const thinkingRef = { value: "" };
      const effortRef = { value: streamEffort };
      const appliedRef = { value: false };
      const ops: FileOp[] = [];
      const stepsSnapshot: AgentStep[] = [...streamSteps];
      await readSseStream(res, async (payloadEvent) => {
        handleStreamEvent(payloadEvent, {
          assistantRef,
          thinkingRef,
          ops,
          stepsSnapshot,
          effortRef,
          appliedRef,
          userPayload: "",
          clearBootOnce: () => undefined,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      pushChatError(friendlyStreamError(err, t("streamError"), t("rodiumSessionExpired")), {
        kind: "plan",
      });
      if (err instanceof Error && err.message === t("planInvalid")) {
        setPlanNeedsConfirm(false);
        setPlanTasks([]);
        setActiveRunId(null);
      } else {
        setPlanNeedsConfirm(true);
        setPlanTasks((prev) =>
          prev.map((task) =>
            task.status === "running" ? { ...task, status: "pending" } : task,
          ),
        );
      }
    } finally {
      streamAbortRef.current = null;
      setBusy(false);
      void refreshRodiumWallet();
    }
  }, [activeRunId, chatId, handleStreamEvent, locale, planTasks, projectId, pushChatError, streamEffort, streamSteps, t]);

  useEffect(() => {
    if (!chatId || loading || bootSentRef.current || bootInFlight.has(projectId)) return;
    const pending = bootPromptRef.current || peekBootPrompt(projectId)?.trim() || null;
    if (!pending) return;

    // Real server/local turns (not the optimistic boot-user bubble).
    const hasRealUser = messages.some(
      (m) => m.role === "user" && m.id !== "boot-user",
    );
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (hasRealUser || hasAssistant) {
      bootSentRef.current = true;
      bootPromptRef.current = null;
      clearBootPrompt(projectId);
      setBusy(false);
      setStreamSteps((prev) => prev.filter((s) => s.id !== "boot"));
      return;
    }

    bootSentRef.current = true;
    bootInFlight.add(projectId);
    void sendMessage(pending, [], {
      bootKey: bootPromptKey(projectId),
      skipUserBubble: true,
    }).finally(() => {
      bootInFlight.delete(projectId);
    });
  }, [chatId, loading, messages, projectId, sendMessage]);

  async function submitComposer() {
    if (composerInputLocked) return;
    const text = input.trim();
    const files = attachments;
    if (!text && files.length === 0 && !elementSelection) return;
    setInput("");
    setFileError(null);
    // Attachments cleared inside sendMessage after bubble owns blob URLs.
    await sendMessage(text, files);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    await submitComposer();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Mention picker owns Arrow/Enter/Escape while open.
    if (mentionOpen && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitComposer();
    }
  }

  async function retryChatAction() {
    const action = chatRetryRef.current || chatRetry;
    if (!action || busy) return;
    setMessages((prev) => prev.filter((m) => m.kind !== "error"));
    chatRetryRef.current = null;
    setChatRetry(null);
    setError(null);
    if (action.kind === "boot") {
      bootSentRef.current = true;
      setBootRetryPrompt(action.prompt);
      await sendMessage(action.prompt, [], {
        bootKey: bootPromptKey(projectId),
        skipUserBubble: true,
      });
      return;
    }
    if (action.kind === "send") {
      await sendMessage(action.content, action.attachments, {
        ...action.opts,
        skipUserBubble: true,
      });
      return;
    }
    if (action.kind === "plan") {
      await executePlan();
      return;
    }
    if (action.kind === "clarify") {
      await submitClarify(action.answers);
      return;
    }
    if (action.kind === "subscribe") {
      await subscribeRunEvents(action.runId);
    }
  }

  const canSend =
    Boolean(input.trim() || attachments.length || elementSelection) && !composerInputLocked;
  const showLivePanel =
    busy ||
    Boolean(streaming) ||
    clarifyQuestions.length > 0 ||
    planTasks.length > 0 ||
    streamSteps.length > 0;

  return (
    <div className="builder">
      <BuilderTopbar
        projectName={project?.name || ""}
        projectId={projectId}
        slug={project?.slug}
        sitesUrl={project?.sites_url}
        publishedAt={project?.published_at}
        onNameSaved={(meta) =>
          setProject((p) =>
            p
              ? {
                  ...p,
                  name: meta.name,
                  slug: meta.slug ?? p.slug,
                  sites_url: meta.sites_url ?? p.sites_url,
                }
              : p,
          )
        }
        onPublishMetaChange={(meta) =>
          setProject((p) =>
            p
              ? {
                  ...p,
                  slug: meta.slug,
                  sites_url: meta.sites_url,
                  published_at: meta.published_at ?? p.published_at,
                }
              : p,
          )
        }
        mainMode={mainMode}
        onModeChange={(mode) => {
          setMainMode(mode);
          setMobilePane("workspace");
          const nextTool = mode !== "preview" ? null : previewTool;
          if (mode !== "preview") setPreviewTool(null);
          syncBuilderUrl({ mainMode: mode, mobilePane: "workspace", previewTool: nextTool });
          if (mode === "preview") {
            void forcePreviewRefresh({ softStart: true, remount: false });
          }
        }}
        viewport={viewport}
        onViewportChange={(next) => {
          setViewport(next);
          syncBuilderUrl({ viewport: next });
        }}
        pages={pages}
        previewPath={previewPath}
        onPreviewPathChange={(path) => {
          setPreviewPath(path);
          syncBuilderUrl({ previewPath: path });
        }}
        previewLive={Boolean(previewSrc)}
        previewUpdating={previewUpdating}
        previewBusy={previewBusy}
        onRefreshPreview={() => {
          void forcePreviewRefresh({ restart: true });
        }}
        onOpenDesign={() => {
          setDesignOpen(true);
          syncBuilderUrl({ designOpen: true });
        }}
        onOpenDraftExternal={async () => {
          await forcePreviewRefresh({ softStart: true, remount: false });
          window.open(
            `${apiBase()}/preview/${projectId}/`,
            "_blank",
            "noopener,noreferrer",
          );
        }}
      />

      <div className="builder-mobile-tabs" role="tablist" aria-label={t("builderPreview")}>
        <button
          type="button"
          role="tab"
          className={mobilePane === "chat" ? "active" : ""}
          aria-selected={mobilePane === "chat"}
          onClick={() => {
            setMobilePane("chat");
            syncBuilderUrl({ mobilePane: "chat" });
          }}
        >
          {t("builderTabChat")}
        </button>
        <button
          type="button"
          role="tab"
          className={mobilePane === "workspace" ? "active" : ""}
          aria-selected={mobilePane === "workspace"}
          onClick={() => {
            setMobilePane("workspace");
            syncBuilderUrl({ mobilePane: "workspace" });
          }}
        >
          {t("builderTabWorkspace")}
        </button>
      </div>

      {error && !messages.some((m) => m.kind === "error") ? (
        <div className="builder-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className={`builder-body builder-body-${mobilePane}`}>
        <aside className="builder-sidebar">
          <div
            className="builder-messages"
            ref={messagesRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label={t("chatLogLabel")}
          >
            {loading && !messages.length && <p className="builder-empty">{t("loading")}</p>}

            {!loading && messages.length === 0 && !showLivePanel && (
              <p className="builder-empty">{t("builderEmptyChat")}</p>
            )}

            {messages.map((m) => {
              if (m.kind === "error") {
                return (
                  <article
                    key={m.id}
                    className="builder-msg builder-msg-assistant builder-msg-error"
                  >
                    <header className="builder-msg-head">{t("roleAssistant")}</header>
                    <div className="builder-msg-error-body">
                      <p className="builder-msg-error-text">{m.content}</p>
                      {m.retryable ? (
                        <div className="builder-msg-error-actions">
                          <button
                            type="button"
                            className="builder-msg-error-retry"
                            disabled={busy}
                            onClick={() => void retryChatAction()}
                          >
                            {t("retryAction")}
                          </button>
                          {bootRetryPrompt ? (
                            <Link href="/settings?tab=generation" className="builder-msg-error-link">
                              {t("openSettings")}
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              }
              if (m.role === "user" && !m.content.trim()) return null;
              const text =
                m.role === "assistant"
                  ? displayContent(m.content) || m.content
                  : m.content.trim();
              const steps = parseJsonArray<AgentStep>(m.steps_json);
              const ops = parseJsonArray<FileOp>(m.file_ops_json);
              const msgPlan = parseJsonArray<PlanTask>(m.plan_json);
              if (
                m.role === "assistant" &&
                !text &&
                !steps.length &&
                !ops.length &&
                !msgPlan.length &&
                !m.thinking_text
              ) {
                return null;
              }
              return (
                <article
                  key={m.id}
                  className={`builder-msg ${m.role === "user" ? "builder-msg-user" : "builder-msg-assistant"}`}
                >
                  <header className="builder-msg-head">
                    {m.role === "user" ? t("roleUser") : t("roleAssistant")}
                  </header>
                  {m.role === "assistant" && (
                    <AgentActivityPanel
                      steps={steps}
                      thinking={m.thinking_text || ""}
                      fileOps={ops}
                      effortLabel={m.effort_label}
                    />
                  )}
                  {m.role === "assistant" && msgPlan.length > 0 ? (
                    <PlanPanel tasks={msgPlan} needsConfirm={false} busy={false} executing={false} />
                  ) : null}
                  {m.role === "user" ? (
                    <div className="builder-msg-user-wrap">
                      {!busy &&
                      !m.id.startsWith("local") &&
                      m.id !== "boot-user" ? (
                        <button
                          type="button"
                          className="builder-msg-edit"
                          title={t("editMessage")}
                          aria-label={t("editMessage")}
                          onClick={() => startEditMessage(m.id, m.content)}
                        >
                          <Icon icon={Pencil} className="ui-icon-sm" />
                        </button>
                      ) : null}
                      <UserMessageBody
                        content={m.content}
                        attachments={m.attachments}
                        previewBase={previewUrl}
                        projectId={projectId}
                      />
                    </div>
                  ) : (
                    <AssistantBody content={text} />
                  )}
                </article>
              );
            })}

            {showLivePanel && (
              <article className="builder-msg builder-msg-assistant builder-msg-streaming">
                <header className="builder-msg-head">{t("roleAssistantStreaming")}</header>
                <AgentActivityPanel
                  steps={streamSteps}
                  thinking={streamThinking}
                  fileOps={streamOps}
                  effortLabel={streamEffort}
                  streaming={busy && !awaitingHitl}
                />
                {planTasks.length > 0 && (
                  <PlanPanel
                    tasks={planTasks}
                    needsConfirm={planNeedsConfirm}
                    busy={busy}
                    executing={
                      busy &&
                      !planNeedsConfirm &&
                      !clarifyQuestions.length &&
                      planTasks.some((task) => task.status === "running" || task.status === "pending")
                    }
                    onExecute={() => void executePlan()}
                    onDismiss={() => void dismissPlan()}
                  />
                )}
                {clarifyQuestions.length > 0 && (
                  <ClarifyCard
                    questions={clarifyQuestions}
                    busy={busy}
                    onSubmit={(answers) => void submitClarify(answers)}
                  />
                )}
                <AssistantBody
                  content={streamSummary || streaming}
                  streaming={busy && !awaitingHitl}
                />
              </article>
            )}

            <div ref={bottomRef} />
          </div>

          <ScrollToBottom
            visible={showJumpToBottom}
            unread={hasUnread}
            onClick={jumpToBottom}
            label={t("chatJumpToLatest")}
          />

          <form className="builder-composer" onSubmit={onSend}>
            <div
              className={`builder-composer-box${attachments.length ? " has-attachments" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              {attachments.length > 0 ? (
                <div className="builder-composer-attachments">
                  <PromptFileChips
                    items={attachments}
                    onRemove={removeAttachment}
                    projectId={projectId}
                  />
                </div>
              ) : null}
              <PromptAssetMention
                projectId={projectId}
                open={mentionOpen}
                query={mentionQuery}
                onClose={() => {
                  setMentionOpen(false);
                  setMentionQuery("");
                }}
                onSelect={(att, mention) => {
                  setAttachments((prev) => {
                    if (prev.some((x) => x.id === att.id)) return prev;
                    if (prev.length >= 5) return prev;
                    return [...prev, att];
                  });
                  setInput((prev) => insertMentionInTextarea(textareaRef.current, prev, mention));
                  setMentionOpen(false);
                  setMentionQuery("");
                }}
              />
              {elementSelection ? (
                <div className="landing-files">
                  <button
                    type="button"
                    className="landing-file-chip selection-chip"
                    onClick={() => setElementSelection(null)}
                    title={t("selectionClear")}
                  >
                    <span className="selection-chip-count">1</span>
                    <span>
                      {t("selectionBadge")}
                      {elementSelection.selector
                        ? ` · ${elementSelection.selector}`
                        : elementSelection.tag
                          ? ` · ${elementSelection.tag}`
                          : ""}
                    </span>
                    <span aria-hidden>×</span>
                  </button>
                </div>
              ) : null}
              {fileNotice && <p className="landing-file-notice">{fileNotice}</p>}
              {fileError && <p className="landing-file-error">{fileError}</p>}
              {editingMessageId ? (
                <p className="builder-editing-hint">{t("editingMessage")}</p>
              ) : null}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  const v = e.target.value;
                  setInput(v);
                  const caret = e.target.selectionStart ?? v.length;
                  const before = v.slice(0, caret);
                  const atMatch = before.match(/@([^\s@]*)$/);
                  if (atMatch) {
                    setMentionOpen(true);
                    setMentionQuery(atMatch[1]);
                  } else {
                    setMentionOpen(false);
                    setMentionQuery("");
                  }
                }}
                onKeyDown={onKeyDown}
                placeholder={t("builderPlaceholder")}
                rows={3}
                disabled={composerInputLocked}
              />
              <div className="builder-composer-actions">
                <button
                  type="button"
                  className={`builder-mode-toggle${planMode ? " active" : ""}`}
                  title={t("planModeHint")}
                  aria-pressed={planMode}
                  onClick={() => setPlanMode((v) => !v)}
                  disabled={busy}
                >
                  <Icon icon={ListTodo} className="ui-icon-sm" />
                  {t("planMode")}
                </button>
                <div className="builder-composer-actions-end">
                  <button
                    type="button"
                    className="builder-plus-label"
                    title={t("importHint")}
                    aria-label={t("importAria")}
                    disabled={composerInputLocked}
                    onClick={openFilePicker}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="landing-import-input"
                      multiple
                      accept={PROMPT_FILE_ACCEPT}
                      onChange={onFilesSelected}
                      tabIndex={-1}
                      aria-hidden
                    />
                    <span className="builder-plus">
                      <Icon icon={Plus} className="ui-icon-md" />
                      {attachments.length > 0 ? (
                        <span className="builder-plus-badge" aria-hidden>
                          {attachments.length}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {busy ? (
                    <button
                      type="button"
                      className="builder-send builder-send-stop"
                      aria-label={t("stopGeneration")}
                      onClick={() => void stopGeneration()}
                    >
                      <Icon icon={Square} className="ui-icon-md" />
                    </button>
                  ) : (
                    <button type="submit" className="builder-send" disabled={!canSend}>
                      <Icon icon={ArrowUp} className="ui-icon-md" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </aside>

        {mainMode === "preview" && (
          <ErrorBoundary label="Preview" resetKey={previewKey}>
          <PreviewPane
            previewSrc={previewSrc}
            previewPath={previewPath}
            previewLiveStatus={previewLiveStatus}
            viewport={viewport}
            previewUpdating={previewUpdating}
            previewBusy={previewBusy}
            previewTool={previewTool}
            projectId={projectId}
            remountKey={previewKey}
            onPreviewToolChange={(tool) => {
              setPreviewTool(tool);
              syncBuilderUrl({ previewTool: tool });
              if (tool !== "image") setImageSelection(null);
              if (tool !== "comment") setCommentAnchor(null);
            }}
            onStartPreview={() => void startPreview()}
            onRefreshPreview={() => {
              void forcePreviewRefresh({ restart: true });
            }}
            onElementSelect={(sel) => {
              setElementSelection(sel);
              setMobilePane("chat");
            }}
            onCommentAnchor={(sel) => setCommentAnchor(sel)}
            onImageSelect={(sel) => setImageSelection(sel)}
            onVisualEdit={async (oldText, newText) => {
              try {
                const res = await api<{ path: string }>(
                  `/projects/${projectId}/visual-edit`,
                  {
                    method: "POST",
                    body: JSON.stringify({ old_text: oldText, new_text: newText }),
                  },
                );
                setError(null);
                void forcePreviewRefresh({ softStart: true, remount: true });
                if (res?.path) {
                  setPreviewUpdating(true);
                  setTimeout(() => setPreviewUpdating(false), 1200);
                }
              } catch (err) {
                pushChatError(
                  err instanceof Error ? err.message : t("visualEditFailed"),
                  null,
                );
              }
            }}
            sidePanel={
              previewTool === "comment" ? (
                <CommentsPanel
                  projectId={projectId}
                  draftAnchor={commentAnchor}
                  onClearDraft={() => setCommentAnchor(null)}
                  onClose={() => setPreviewTool(null)}
                />
              ) : previewTool === "image" ? (
                <ImageEditPanel
                  projectId={projectId}
                  selection={imageSelection}
                  onClose={() => {
                    setPreviewTool(null);
                    setImageSelection(null);
                  }}
                  onReplaced={() => {
                    void forcePreviewRefresh({ softStart: true, remount: true });
                    setPreviewUpdating(true);
                    setTimeout(() => setPreviewUpdating(false), 1200);
                  }}
                />
              ) : null
            }
          />
          </ErrorBoundary>
        )}
        {mainMode === "code" && (
          <ErrorBoundary label="Code editor" resetKey={projectId}>
          <CodePane
            projectId={projectId}
            onSaved={() => {
              void refreshRoutes();
              void forcePreviewRefresh({ restart: true });
            }}
          />
          </ErrorBoundary>
        )}
        {mainMode === "files" && (
          <ErrorBoundary label="Files" resetKey={projectId}>
          <FilesPane
            projectId={projectId}
            onChanged={() => {
              void refreshRoutes();
              void forcePreviewRefresh({ restart: true });
            }}
          />
          </ErrorBoundary>
        )}
        {mainMode === "options" && (
          <ErrorBoundary label="Options" resetKey={optionsSection}>
          <OptionsPane
            projectId={projectId}
            projectName={project?.name || ""}
            projectSlug={project?.slug || ""}
            sitesUrl={project?.sites_url ?? null}
            publishedAt={project?.published_at ?? null}
            section={optionsSection}
            onSectionChange={(section) => {
              setOptionsSection(section);
              syncBuilderUrl({ optionsSection: section });
            }}
            onNameSaved={(meta) =>
              setProject((p) =>
                p
                  ? {
                      ...p,
                      name: meta.name,
                      slug: meta.slug ?? p.slug,
                      sites_url: meta.sites_url ?? p.sites_url,
                    }
                  : p,
              )
            }
            onOpenDesign={() => {
              setDesignOpen(true);
              syncBuilderUrl({ designOpen: true });
            }}
          />
          </ErrorBoundary>
        )}
      </div>

      <DesignCharterSlideover
        projectId={projectId}
        open={designOpen}
        onClose={() => {
          setDesignOpen(false);
          syncBuilderUrl({ designOpen: false });
        }}
      />
    </div>
  );
}

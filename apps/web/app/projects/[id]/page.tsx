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
import { HistoryPanel } from "@/components/builder/HistoryPanel";
import { AssistantBody } from "@/components/chat/AssistantBody";
import { ScrollToBottom } from "@/components/chat/ScrollToBottom";
import { PlanPanel, type PlanMeta, type PlanTask } from "@/components/PlanPanel";
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
  MAX_PROMPT_FILES,
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
import { readSseStream } from "@/lib/sse";
import { usePreviewControl } from "@/components/builder/usePreviewControl";
import {
  initialStreamState,
  reduceStreamEvent,
  type ChatStreamState,
} from "@/lib/chat-stream";

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
  plan_meta_json?: string | null;
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

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parsePlanMeta(raw: string | null | undefined): PlanMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const meta = parsed as PlanMeta;
      return meta.title || meta.summary ? meta : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isPlanComplete(tasks: PlanTask[]): boolean {
  return tasks.length > 0 && tasks.every((task) => task.status === "done");
}

function latestPersistedPlan(msgs: Message[]): PlanTask[] {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "assistant") continue;
    const plan = parseJsonArray<PlanTask>(m.plan_json);
    if (plan.length) return plan;
  }
  return [];
}

function mapActivePlanTasks(plan: PlanTask[]): PlanTask[] {
  return plan.map((task, i) => ({
    id: task.id || `task_${i + 1}`,
    title: task.title || `Task ${i + 1}`,
    status: task.status === "running" ? "pending" : task.status || "pending",
  }));
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


function friendlyStreamError(
  err: unknown,
  fallback: string,
  rodiumExpired: string,
  opts?: { imageTooLarge?: string; serviceError?: string },
): string {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  if (
    /failed to fetch|networkerror|network request failed|load failed|network error|incomplete chunked|peer closed connection|connection reset|timed out|timeout/i.test(
      raw,
    )
  ) {
    return fallback;
  }
  if (
    /rodiumai session expired|sign in with rodiumai again|account is not linked|invalid_grant|refresh token is invalid|session rodiumai expir/i.test(
      raw,
    )
  ) {
    return rodiumExpired;
  }
  if (/invalid or unauthorized rodiumai key|clé rodiumai invalide/i.test(raw)) {
    return rodiumExpired;
  }
  if (
    /entity too large|payload_too_large|payloadtoolarge|too large to send|trop volumineuse/i.test(
      raw,
    )
  ) {
    return opts?.imageTooLarge ?? fallback;
  }
  if (
    /rodiumai error \(500\)|internal_error|unexpected error occurred|erreur rodiumai \(500\)/i.test(
      raw,
    )
  ) {
    return opts?.serviceError ?? fallback;
  }
  if (/^rodiumai error \(\d+\):\s*\{/i.test(raw)) {
    return opts?.serviceError ?? fallback;
  }
  // Surface Rodium network codes as the friendly stream message.
  if (/rodiumai error \(network\)/i.test(raw)) {
    return fallback;
  }
  return raw || fallback;
}

type StreamErrorKey =
  | "streamError"
  | "rodiumSessionExpired"
  | "imageTooLargeForAi"
  | "generationServiceError";

function streamErrorLabels(t: (key: StreamErrorKey) => string) {
  return {
    fallback: t("streamError"),
    rodiumExpired: t("rodiumSessionExpired"),
    imageTooLarge: t("imageTooLargeForAi"),
    serviceError: t("generationServiceError"),
  };
}

function formatStreamError(err: unknown, labels: ReturnType<typeof streamErrorLabels>): string {
  return friendlyStreamError(err, labels.fallback, labels.rodiumExpired, {
    imageTooLarge: labels.imageTooLarge,
    serviceError: labels.serviceError,
  });
}

/** Network-level stream failure (drop, reset, proxy timeout) — worth an
 *  automatic reconnect to the run's buffered event stream instead of an
 *  error bubble that resets the whole plan UI. */
function isNetworkStreamError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || "");
  return /failed to fetch|networkerror|network request failed|load failed|timed out|timeout|incomplete chunked|peer closed connection|connection reset|err_network|aborted/i.test(
    raw,
  );
}

/** Human label for the selection chip — never the raw CSS selector path.
 *  Prefers #id, then tag + a short text excerpt (e.g. `nav · “PromptVault”`). */
function selectionChipLabel(sel: ElementSelection): string {
  if (sel.id) return `#${sel.id}`;
  const tag = (sel.tag || "element").toLowerCase();
  const text = (sel.text || "").trim().replace(/\s+/g, " ");
  if (!text) return tag;
  const excerpt = text.length > 28 ? `${text.slice(0, 28)}…` : text;
  return `${tag} · “${excerpt}”`;
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const streamErrLabels = useMemo(() => streamErrorLabels(t), [t]);

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
  const [codeOpenPath, setCodeOpenPath] = useState<string | null>(null);
  const [filesRevision, setFilesRevision] = useState(0);
  const codeDirtyRef = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const dragDepth = useRef(0);
  const [hasUnread, setHasUnread] = useState(false);
  const [busy, setBusy] = useState(() => Boolean(initialBoot));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatRetry, setChatRetry] = useState<ChatRetryAction | null>(null);
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
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [streamInlineError, setStreamInlineError] = useState<string | null>(null);
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
  /** Late-bound handle: the poll effect is declared before subscribeRunEvents. */
  const subscribeRunEventsRef = useRef<((runId: string) => Promise<void>) | null>(null);
  /** Run ids whose auto-reattach failed recently — cool-down before retrying. */
  const failedSubscribesRef = useRef<Map<string, number>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bootSentRef = useRef(false);
  const bootPromptRef = useRef<string | null>(initialBoot);
  const chatRetryRef = useRef<ChatRetryAction | null>(null);

  /** True while an SSE stream is open, whichever path opened it. */
  const [streamActive, setStreamActive] = useState(false);

  /**
   * Live mirror of the stream-related state.
   *
   * A stream must resume from what the UI currently shows, not from values
   * captured when its callback was created — seeding from stale closures wiped
   * the plan checklist as soon as execution started.
   */
  const liveRef = useRef({
    steps: [] as AgentStep[],
    ops: [] as FileOp[],
    effort: null as string | null,
    planTasks: [] as PlanTask[],
    planNeedsConfirm: false,
    clarify: [] as ClarifyQuestion[],
  });
  liveRef.current = {
    steps: streamSteps,
    ops: streamOps,
    effort: streamEffort,
    planTasks,
    planNeedsConfirm,
    clarify: clarifyQuestions,
  };

  /** Seed a fresh stream state from what is currently on screen. */
  const seedStreamState = useCallback(
    (overrides?: Partial<ChatStreamState>): { current: ChatStreamState } => ({
      current: {
        ...initialStreamState(),
        steps: [...liveRef.current.steps],
        ops: [...liveRef.current.ops],
        effort: liveRef.current.effort,
        planTasks: [...liveRef.current.planTasks],
        planNeedsConfirm: liveRef.current.planNeedsConfirm,
        clarify: [...liveRef.current.clarify],
        ...overrides,
      },
    }),
    [],
  );

  // `pushChatError` is declared further down but the preview hook needs it now;
  // this indirection keeps the callback identity stable.
  const chatErrorRef = useRef<(message: string) => void>(() => {});
  const reportPreviewError = useCallback((message: string) => chatErrorRef.current(message), []);

  const {
    previewUrl,
    setPreviewUrl,
    previewSrc,
    previewKey,
    previewBusy,
    previewUpdating,
    previewLiveStatus,
    startPreview,
    forcePreviewRefresh,
    schedulePreviewRefresh,
    repushPreview,
    renderNonce,
  } = usePreviewControl({
    projectId,
    loading,
    onError: reportPreviewError,
    previewFailedLabel: t("previewFailed"),
  });

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
  // `busy` alone was not enough: a mid-run `plan` event releases it while the
  // server keeps writing files, and the composer offered "send" during work.
  // An open SSE connection is the honest signal that a run is in flight.
  const working = busy || streamActive;
  const composerInputLocked = working || awaitingHitl;

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
      const persistedPlan = latestPersistedPlan(msgs);
      const persistedComplete = isPlanComplete(persistedPlan);
      const active = await api<{
        id: string;
        status: string;
        mode: string;
        plan: PlanTask[];
        plan_meta?: PlanMeta | null;
        clarify: ClarifyQuestion[];
      } | null>(`/projects/${projectId}/chats/${main.id}/runs/active`);
      if (active?.id) {
        const activeMeta =
          active.plan_meta && (active.plan_meta.title || active.plan_meta.summary)
            ? active.plan_meta
            : null;
        if (persistedComplete) {
          setActiveRunId(null);
          setPlanTasks([]);
          setPlanMeta(null);
          setPlanNeedsConfirm(false);
          setClarifyQuestions([]);
          setBusy(false);
        } else if (active.status === "awaiting_clarify" && Array.isArray(active.clarify) && active.clarify.length) {
          setActiveRunId(active.id);
          setClarifyQuestions(active.clarify);
          setPlanNeedsConfirm(false);
          setPlanTasks([]);
          setPlanMeta(null);
          setBusy(false);
        } else if (
          (active.status === "awaiting_plan_confirm" || active.status === "error") &&
          Array.isArray(active.plan) &&
          active.plan.length
        ) {
          setActiveRunId(active.id);
          const mapped = mapActivePlanTasks(active.plan);
          const doneCount = mapped.filter((task) => task.status === "done").length;
          const partialProgress = doneCount > 0 && doneCount < mapped.length;
          setPlanTasks(mapped);
          setPlanMeta(activeMeta);
          setPlanNeedsConfirm(active.status === "awaiting_plan_confirm" && !partialProgress);
          setClarifyQuestions([]);
          setBusy(false);
          setPlanMode(active.mode === "plan");
        } else if (active.status === "running" && Array.isArray(active.plan) && active.plan.length) {
          setActiveRunId(active.id);
          setPlanTasks(mapActivePlanTasks(active.plan));
          setPlanMeta(activeMeta);
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
  }, [projectId, t, refreshRoutes, setPreviewUrl]);

  const pushChatError = useCallback(
    (message: string, retry: ChatRetryAction | null = null) => {
      const text = message.trim() || t("streamError");
      const inline =
        busy ||
        liveRef.current.planTasks.length > 0 ||
        liveRef.current.steps.length > 0 ||
        liveRef.current.clarify.length > 0;
      chatRetryRef.current = retry;
      setChatRetry(retry);
      setError(null);
      if (inline) {
        setStreamInlineError(text);
        stickToBottomRef.current = true;
        return;
      }
      setStreamInlineError(null);
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
    [busy, t],
  );

  // Wire the preview hook's error channel now that pushChatError exists.
  chatErrorRef.current = (message: string) => pushChatError(message, null);


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
    if (busy) topProgressStart("generation");
    else topProgressDone("generation");
  }, [busy]);

  // Cross-tab resync without Firestore: poll the active run while the tab is
  // visible and no local SSE stream is attached. Detects a run started in
  // another tab (reattach SSE via activeRunId) and refreshes files/preview
  // when that remote run finishes.
  useEffect(() => {
    if (!projectId || !chatId) return;
    let stopped = false;
    let sawRemoteRun = false;

    async function tick() {
      if (stopped || document.visibilityState !== "visible") return;
      // Our own stream already keeps everything in sync.
      if (streamAbortRef.current) return;
      try {
        const active = await api<{ id: string; status: string } | null>(
          `/projects/${projectId}/chats/${chatId}/runs/active`,
        );
        if (stopped) return;
        if (active?.id && !ignoredRunIdsRef.current.has(active.id)) {
          sawRemoteRun = true;
          setActiveRunId(active.id);
          // A run is EXECUTING but no local stream is attached (dropped SSE,
          // other tab): reattach immediately. Without this the composer stayed
          // editable and the panel showed "Resume plan" while the plan ran —
          // and clicking Resume hit a 400 (run_invalid_state) that wiped the
          // plan, flickering the whole panel.
          const failedAt = failedSubscribesRef.current.get(active.id) || 0;
          if (
            active.status === "running" &&
            // Re-check AFTER the await above: a local stream may have started
            // while /runs/active was in flight. Subscribing here would abort
            // it and desync busy/streamActive (flickering panel + unlocked
            // composer while the plan runs).
            !streamAbortRef.current &&
            !streamingRunIdRef.current &&
            Date.now() - failedAt > 60_000
          ) {
            void subscribeRunEventsRef.current?.(active.id);
          }
        } else if (sawRemoteRun) {
          // A run seen on a previous tick ended elsewhere: pick up its writes.
          sawRemoteRun = false;
          setFilesRevision((rev) => rev + 1);
          void refreshRoutes();
          void forcePreviewRefresh({ softStart: true, remount: true, quiet: true });
        }
      } catch {
        /* transient — next tick retries */
      }
    }

    const interval = window.setInterval(() => void tick(), 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [projectId, chatId, refreshRoutes, forcePreviewRefresh]);


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

  /** Open a file touched by the agent in the code editor. */
  const openFileInEditor = useCallback(
    (path: string) => {
      setCodeOpenPath(path);
      setMainMode("code");
      setMobilePane("workspace");
      syncBuilderUrl({ mainMode: "code", mobilePane: "workspace" });
    },
    [syncBuilderUrl],
  );

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
        }
        // Silent drops were the worst offender here: files over the cap or of
        // the wrong type simply disappeared with zero feedback.
        if (result.overflow.length > 0) {
          setFileNotice(null);
          setFileError(
            t("promptFilesTooMany").replace("{max}", String(MAX_PROMPT_FILES)),
          );
        } else if (added === 0 && result.rejected.length > 0) {
          setFileNotice(null);
          setFileError(t("promptFileTypeError"));
        }
        return result.next;
      });
    },
    [t],
  );

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    if (composerInputLocked) return;
    if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  }

  /** Paste an image straight from the clipboard (screenshots). */
  function onComposerPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (composerInputLocked) return;
    const files = Array.from(e.clipboardData?.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
  }

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    // Snapshot before clearing — FileList is live; resetting the input first
    // empties it in Chromium (picker works, drag & drop unaffected).
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
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
    dragDepth.current = 0;
    setDragActive(false);
    if (composerInputLocked) return;
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  /**
   * Per-stream accumulator. The pure transitions live in `lib/chat-stream.ts`
   * (covered by tests); this only performs the side effects the reducer asks
   * for and mirrors the result into React state.
   */
  const handleStreamEvent = useCallback(
    (
      payloadEvent: Record<string, unknown>,
      session: {
        stateRef: { current: ChatStreamState };
        userPayload: string;
        clearBootOnce: () => void;
      },
    ) => {
      const before = session.stateRef.current;
      const { state, effects } = reduceStreamEvent(before, payloadEvent, {
        streamErrorLabel: t("streamError"),
        emptySummaryLabel:
          locale === "en" ? "Here is what was put in place." : "Voici ce qui a été mis en place.",
      });
      session.stateRef.current = state;

      if (state !== before) {
        setStreaming(state.streaming);
        setStreamThinking(state.thinking);
        setStreamSteps(state.steps);
        setStreamOps(state.ops);
        // Repair-loop warnings (css orphans, brand lock...) are internal
        // machinery: the agent fixes them itself, end users only see progress.
        if (state.warnings.length > before.warnings.length) {
          console.debug("[forge] agent warning:", state.warnings.at(-1));
        }
        setStreamEffort(state.effort);
        setPlanTasks(state.planTasks);
        setPlanMeta(state.planMeta);
        setPlanNeedsConfirm(state.planNeedsConfirm);
        setClarifyQuestions(state.clarify);
        if (state.activeRunId !== before.activeRunId) setActiveRunId(state.activeRunId);
        // The stream only ever releases the composer (clarify / plan awaiting
        // confirmation); `busy` is otherwise owned by the callers.
        if (before.busy && !state.busy) setBusy(false);
      }

      let failure: string | null = null;

      for (const effect of effects) {
        switch (effect.kind) {
          case "clear-boot":
            session.clearBootOnce();
            break;
          case "run-started":
            streamingRunIdRef.current = effect.runId;
            ignoredRunIdsRef.current.delete(effect.runId);
            break;
          case "refresh-routes":
            void refreshRoutes();
            break;
          case "schedule-preview-refresh":
            schedulePreviewRefresh();
            break;
          case "ensure-preview-started":
            if (!previewUrl && !previewBusy) void startPreview({ quiet: true });
            break;
          case "cancelled":
            break;
          case "error":
            failure = effect.message;
            break;
          case "finalize": {
            const { content, plan, planMeta: finalMeta, thinking, steps, ops, effort, applied } =
              effect.payload;
            setStreamSummary(content);
            setMessages((m) => {
              const withoutDupUser = session.userPayload.trim()
                ? m.filter(
                    (x) =>
                      !(
                        x.role === "user" &&
                        x.content === session.userPayload &&
                        x.id !== "boot-user"
                      ),
                  )
                : m;
              const withUser =
                !session.userPayload.trim() ||
                withoutDupUser.some((x) => x.role === "user" && x.content === session.userPayload)
                  ? withoutDupUser
                  : [
                      ...withoutDupUser,
                      { id: `local-${Date.now()}`, role: "user", content: session.userPayload },
                    ];
              return [
                ...withUser.map((x) =>
                  x.id === "boot-user" ? { ...x, id: `local-boot-${Date.now()}` } : x,
                ),
                {
                  id: `asst-${Date.now()}`,
                  role: "assistant",
                  content,
                  thinking_text: thinking || null,
                  steps_json: JSON.stringify(steps),
                  file_ops_json: JSON.stringify(ops),
                  plan_json: plan.length ? JSON.stringify(plan) : null,
                  plan_meta_json: plan.length && finalMeta ? JSON.stringify(finalMeta) : null,
                  effort_label: effort,
                },
              ];
            });
            setStreamSummary("");
            if (applied) {
              void forcePreviewRefresh({ restart: true, quiet: true });
              setMainMode("preview");
              setMobilePane("workspace");
              setPreviewTool(null);
              syncBuilderUrl({
                mainMode: "preview",
                mobilePane: "workspace",
                previewTool: null,
              });
            }
            break;
          }
        }
      }

      // Thrown after the state sync so the plan checklist shows the failure,
      // then caught by the caller which renders the retryable error bubble.
      if (failure) throw new Error(failure);
    },
    [
      forcePreviewRefresh,
      locale,
      previewBusy,
      previewUrl,
      refreshRoutes,
      schedulePreviewRefresh,
      startPreview,
      syncBuilderUrl,
      t,
    ],
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
      // Reconnect support: the backend buffers run events and replays them
      // from `?after=N`. On a network drop we resume from the cursor instead
      // of surfacing an error and resetting the plan UI.
      let seen = 0;
      let attempts = 0;
      let sawTerminal = false;
      let detached = false;
      try {
        const stateRef = seedStreamState();
        setStreamActive(true);
        while (!sawTerminal && !detached) {
          try {
            const res = await fetch(
              `${apiBase()}/projects/${projectId}/chats/${chatId}/runs/${runId}/events?after=${seen}`,
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
            await readSseStream(res, async (payloadEvent) => {
              const type = String(payloadEvent.type || "");
              if (type === "error" && String(payloadEvent.message || "") === "run_detached") {
                // Synthetic marker from the server poll loop — not a buffered
                // run event, so it must NOT advance the cursor.
                detached = true;
                try {
                  const active = await api<{
                    id: string;
                    status: string;
                    plan: PlanTask[];
                  } | null>(`/projects/${projectId}/chats/${chatId}/runs/active`);
                  if (!active?.id || !Array.isArray(active.plan) || !active.plan.length) {
                    setPlanTasks([]);
                    setPlanNeedsConfirm(false);
                    setBusy(false);
                    return;
                  }
                  const mapped = mapActivePlanTasks(active.plan);
                  const doneCount = mapped.filter((task) => task.status === "done").length;
                  const partialProgress = doneCount > 0 && doneCount < mapped.length;
                  setPlanTasks(mapped);
                  setPlanNeedsConfirm(active.status === "awaiting_plan_confirm" && !partialProgress);
                  setBusy(active.status === "running");
                } catch {
                  setPlanNeedsConfirm(true);
                  setBusy(false);
                }
                return;
              }
              seen += 1;
              attempts = 0;
              if (type === "done" || type === "error") sawTerminal = true;
              handleStreamEvent(payloadEvent, {
                stateRef,
                userPayload: "",
                clearBootOnce: () => undefined,
              });
            });
            // Stream closed cleanly without a terminal event (proxy idle
            // cut...): reconnect from the cursor like a network error.
            if (!sawTerminal && !detached) throw new Error("stream ended early");
          } catch (err) {
            if (abortCtrl.signal.aborted || (err instanceof Error && err.name === "AbortError")) {
              return;
            }
            attempts += 1;
            if (attempts > 5) throw err;
            await new Promise((resolve) => setTimeout(resolve, Math.min(8_000, 500 * 2 ** attempts)));
            if (abortCtrl.signal.aborted) return;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        failedSubscribesRef.current.set(runId, Date.now());
        pushChatError(formatStreamError(err, streamErrLabels), {
          kind: "subscribe",
          runId,
        });
        setPlanNeedsConfirm(true);
      } finally {
        // Ownership guard — a newer stream may have replaced this one.
        if (streamAbortRef.current === abortCtrl) {
          streamAbortRef.current = null;
          setStreamActive(false);
          setBusy(false);
        }
        if (streamingRunIdRef.current === runId && streamAbortRef.current === null) {
          streamingRunIdRef.current = null;
        }
        void refreshRodiumWallet();
      }
    },
    [chatId, handleStreamEvent, locale, projectId, pushChatError, seedStreamState, streamErrLabels, t],
  );
  subscribeRunEventsRef.current = subscribeRunEvents;

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

  const cancelEditMessage = useCallback(() => {
    setEditingMessageId(null);
    setInput("");
    setAttachments([]);
  }, []);

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
    setPlanMeta(null);
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
    setStreamInlineError(null);
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
        // Show the SERVER error verbatim when there is one (S3 denied, quota,
        // 503 object store…) — only true browser-level network failures get
        // the generic "check your connection" fallback. friendlyStreamError
        // would also swallow server messages containing "timeout".
        const raw = err instanceof Error ? err.message : String(err || "");
        const isBrowserNetworkFailure =
          /failed to fetch|network request failed|networkerror|load failed/i.test(raw) || !raw.trim();
        pushChatError(isBrowserNetworkFailure ? t("attachmentUploadFailed") : raw.slice(0, 500), null);
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
      setStreamInlineError(null);
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
        setPlanMeta(null);
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
          if (
            res.status === 403 &&
            /account is not linked|rodiumai session expired|sign in with rodiumai/i.test(detail)
          ) {
            // Dead RodiumAI link: sign out so the next login re-links cleanly,
            // instead of a signed-in UI where every prompt fails.
            logoutToHome("expired");
            return;
          }
          throw new Error(detail || res.statusText);
        }

        const stateRef = seedStreamState({ steps: [], ops: [], effort: null, planTasks: [], planNeedsConfirm: false, clarify: [] });
        let bootCleared = false;
        const clearBootOnce = () => {
          if (bootCleared || !opts.bootKey) return;
          clearBootPrompt(projectId);
          bootPromptRef.current = null;
          bootCleared = true;
        };

        setStreamActive(true);

        await readSseStream(res, async (payloadEvent) => {
          handleStreamEvent(payloadEvent, {
            stateRef,
            userPayload: payload,
            clearBootOnce,
          });
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        // Network drop mid-run: the backend keeps executing and buffers every
        // event — reattach to the run stream instead of erroring + resetting.
        const dropRunId = streamingRunIdRef.current;
        if (dropRunId && isNetworkStreamError(err)) {
          await subscribeRunEvents(dropRunId);
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
          formatStreamError(err, streamErrLabels),
          retry,
        );
        setStreaming("");
        setStreamThinking("");
        setStreamSteps([]);
        setStreamOps([]);
        setStreamEffort(null);
        setClarifyQuestions([]);
      } finally {
        // Only reset shared stream state if WE still own the stream: a
        // reattach (poll / drop-fallback) may have replaced it, and blindly
        // clearing busy/streamActive here unlocked the composer and showed
        // "Resume plan" while the run was still streaming.
        const ownsStream = streamAbortRef.current === abortCtrl;
        if (ownsStream) {
          streamAbortRef.current = null;
          streamingRunIdRef.current = null;
          setStreamActive(false);
          setBusy(false);
        }
        void refreshRodiumWallet();
      }
    },
    [busy, chatId, editingMessageId, elementSelection, handleStreamEvent, locale, planMode, projectId, pushChatError, seedStreamState, streamErrLabels, subscribeRunEvents, t],
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
        const stateRef = seedStreamState();
        setStreamActive(true);
        await readSseStream(res, async (payloadEvent) => {
          handleStreamEvent(payloadEvent, {
            stateRef,
            userPayload: "",
            clearBootOnce: () => undefined,
          });
        });
      } catch (err) {
        pushChatError(formatStreamError(err, streamErrLabels), {
          kind: "clarify",
          answers,
        });
      } finally {
        setStreamActive(false);
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [activeRunId, chatId, handleStreamEvent, locale, projectId, pushChatError, seedStreamState, t],
  );

  const executePlan = useCallback(async (stepMode = false) => {
    if (!chatId || !activeRunId) return;
    setBusy(true);
    setPlanNeedsConfirm(false);
    setError(null);
    setStreamInlineError(null);
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
    streamAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;
    try {
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
          body: JSON.stringify({ plan: planTasks, step_mode: stepMode }),
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
          // "run_invalid_state" usually means the run is STILL EXECUTING and
          // the UI simply lost its stream: reattach instead of wiping the
          // plan (which flickered the panel and re-enabled the composer).
          try {
            const active = await api<{ id: string; status: string } | null>(
              `/projects/${projectId}/chats/${chatId}/runs/active`,
            );
            if (active?.id && active.status === "running") {
              await subscribeRunEvents(active.id);
              return;
            }
          } catch {
            /* fall through to the invalid-plan reset */
          }
          setPlanTasks([]);
          setPlanMeta(null);
          setPlanNeedsConfirm(false);
          setActiveRunId(null);
          throw new Error(t("planInvalid"));
        }
        throw new Error(detail);
      }
      const stateRef = seedStreamState();
      setStreamActive(true);
      await readSseStream(res, async (payloadEvent) => {
        handleStreamEvent(payloadEvent, {
          stateRef,
          userPayload: "",
          clearBootOnce: () => undefined,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      // Network drop mid-plan: the run keeps going server-side — reattach to
      // the buffered event stream instead of flipping tasks back to pending.
      const dropRunId = streamingRunIdRef.current || activeRunId;
      if (dropRunId && isNetworkStreamError(err)) {
        await subscribeRunEvents(dropRunId);
        return;
      }
      pushChatError(formatStreamError(err, streamErrLabels), {
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
      // Ownership guard — a reattached stream may have replaced ours.
      if (streamAbortRef.current === abortCtrl) {
        streamAbortRef.current = null;
        setStreamActive(false);
        setBusy(false);
      }
      void refreshRodiumWallet();
    }
  }, [activeRunId, chatId, handleStreamEvent, locale, planTasks, projectId, pushChatError, seedStreamState, streamErrLabels, subscribeRunEvents, t]);

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
    // Keep the caret in the composer so the next message can be typed straight
    // away — the focus used to be lost for the whole generation.
    textareaRef.current?.focus();
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
    // Escape cancels an in-progress message edit.
    if (e.key === "Escape" && editingMessageId) {
      e.preventDefault();
      cancelEditMessage();
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
    streamSteps.length > 0 ||
    Boolean(streamInlineError);

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
          // Leaving the code view unmounts CodePane; without this guard the
          // unsaved buffer was dropped with no warning at all.
          if (mainMode === "code" && mode !== "code" && codeDirtyRef.current) {
            if (!window.confirm(t("codeUnsavedConfirm"))) return;
          }
          setMainMode(mode);
          setMobilePane("workspace");
          const nextTool = mode !== "preview" ? null : previewTool;
          if (mode !== "preview") setPreviewTool(null);
          syncBuilderUrl({ mainMode: mode, mobilePane: "workspace", previewTool: nextTool });
          if (mode === "preview") {
            void forcePreviewRefresh({ softStart: true, remount: false, quiet: true });
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
                onOpenHistory={() => setHistoryOpen((v) => !v)}
        onOpenDraftExternal={async () => {
          // Standalone draft page: the runner shell with the bundle embedded.
          // Opening the bare runner URL showed an empty page (it waits for a
          // builder parent to postMessage the bundle, which a new tab lacks).
          const token = getToken() || "";
          window.open(
            `${apiBase()}/projects/${projectId}/draft?access_token=${encodeURIComponent(token)}`,
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
              // AssistantBody splits forge tags into collapsible cards itself.
              const text = m.role === "assistant" ? m.content : m.content.trim();
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
                      onOpenFile={openFileInEditor}
                    />
                  )}
                  {m.role === "assistant" && msgPlan.length > 0 ? (
                    <PlanPanel
                      tasks={msgPlan}
                      meta={parsePlanMeta(m.plan_meta_json)}
                      ops={ops}
                      needsConfirm={false}
                      busy={false}
                      executing={false}
                      onOpenFile={openFileInEditor}
                    />
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
                    <AssistantBody content={text} onOpenFile={openFileInEditor} />
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
                  live
                  onOpenFile={openFileInEditor}
                />
                {planTasks.length > 0 && (
                  <PlanPanel
                    tasks={planTasks}
                    meta={planMeta}
                    needsConfirm={planNeedsConfirm}
                    busy={busy}
                    ops={streamOps}
                    onOpenFile={openFileInEditor}
                    executing={
                      busy &&
                      !planNeedsConfirm &&
                      !clarifyQuestions.length &&
                      planTasks.some((task) => task.status === "running" || task.status === "pending")
                    }
                    onExecute={() => void executePlan()}
                    onExecuteStep={() => void executePlan(true)}
                    onDismiss={() => void dismissPlan()}
                    onStop={() => void stopGeneration()}
                  />
                )}
                {streamInlineError ? (
                  <div className="builder-msg-error-body">
                    <p className="builder-msg-error-text">{streamInlineError}</p>
                    {chatRetry ? (
                      <div className="builder-msg-error-actions">
                        <button
                          type="button"
                          className="builder-msg-error-retry"
                          disabled={busy}
                          onClick={() => void retryChatAction()}
                        >
                          {t("retryAction")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                  onOpenFile={openFileInEditor}
                />
              </article>
            )}

            <ScrollToBottom
              visible={showJumpToBottom}
              unread={hasUnread}
              onClick={jumpToBottom}
              label={t("chatJumpToLatest")}
            />
            <div ref={bottomRef} />
          </div>

          <form className="builder-composer" onSubmit={onSend}>
            <div
              className={`builder-composer-box${attachments.length ? " has-attachments" : ""}${dragActive ? " is-dragging" : ""}`}
              onDragEnter={onDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              {dragActive ? (
                <div className="composer-dropzone" aria-hidden="true">
                  <span>{t("promptDropHere")}</span>
                </div>
              ) : null}
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
                    if (prev.length >= MAX_PROMPT_FILES) {
                      setFileError(
                        t("promptFilesTooMany").replace("{max}", String(MAX_PROMPT_FILES)),
                      );
                      return prev;
                    }
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
                    title={`${t("selectionClear")}${elementSelection.selector ? ` — ${elementSelection.selector}` : ""}`}
                  >
                    <span className="selection-chip-count">1</span>
                    <span>
                      {t("selectionBadge")}
                      {` · ${selectionChipLabel(elementSelection)}`}
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
                  // The `@` must start a token: `(^|\s)` prevents the picker
                  // from popping up inside an email address like nom@domaine.
                  const atMatch = before.match(/(?:^|\s)@([^\s@]*)$/);
                  if (atMatch) {
                    setMentionOpen(true);
                    setMentionQuery(atMatch[1]);
                  } else {
                    setMentionOpen(false);
                    setMentionQuery("");
                  }
                }}
                onKeyDown={onKeyDown}
                onPaste={onComposerPaste}
                placeholder={t("builderPlaceholder")}
                aria-label={t("builderPlaceholder")}
                role="combobox"
                aria-expanded={mentionOpen}
                aria-controls="prompt-mention-listbox"
                aria-autocomplete="list"
                rows={3}
                readOnly={composerInputLocked}
                aria-busy={busy}
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
                  {/* The file input must NOT live inside the button: nested
                      interactive controls are invalid HTML and the change
                      event gets swallowed in some browsers (picker opened but
                      files never arrived — drag & drop worked fine). */}
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
                  <button
                    type="button"
                    className="builder-plus-label"
                    title={t("importHint")}
                    aria-label={t("importAria")}
                    disabled={composerInputLocked}
                    onClick={openFilePicker}
                  >
                    <span className="builder-plus">
                      <Icon icon={Plus} className="ui-icon-md" />
                      {attachments.length > 0 ? (
                        <span className="builder-plus-badge" aria-hidden>
                          {attachments.length}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  {working ? (
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
            pages={pages}
            previewLiveStatus={previewLiveStatus}
            viewport={viewport}
            previewUpdating={previewUpdating}
            previewBusy={previewBusy}
            previewTool={previewTool}
            projectId={projectId}
            remountKey={previewKey}
            renderNonce={renderNonce}
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
            onPreviewPathChange={(path) => {
              setPreviewPath(path);
              setPages((prev) => (prev.includes(path) ? prev : [...prev, path].sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))));
              syncBuilderUrl({ previewPath: path });
            }}
            onVisualEdit={async (oldText, newText) => {
              try {
                await api<{ path: string }>(
                  `/projects/${projectId}/visual-edit`,
                  {
                    method: "POST",
                    body: JSON.stringify({ old_text: oldText, new_text: newText }),
                  },
                );
                setError(null);
                // The bridge already patched the text in place; a soft bundle
                // re-push keeps code and DOM in sync without the hard iframe
                // reload that flashed blank and lit the global loader.
                repushPreview();
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
                    repushPreview();
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
            openPath={codeOpenPath}
            filesRevision={filesRevision}
            onDirtyChange={(d) => {
              codeDirtyRef.current = d;
            }}
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

      <HistoryPanel
        projectId={projectId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={() => {
          void refreshRoutes();
          void forcePreviewRefresh({ restart: true, remount: true });
          void load();
        }}
      />
    </div>
  );
}

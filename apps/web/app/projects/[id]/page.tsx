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
import { useParams, useRouter } from "next/navigation";
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
import { GenerationCollapse } from "@/components/GenerationCollapse";
import { PlanPanel, type PlanTask } from "@/components/PlanPanel";
import { PromptFileChips } from "@/components/PromptFileChips";
import { BuilderTopbar } from "@/components/builder/BuilderTopbar";
import { CodePane } from "@/components/builder/CodePane";
import { CommentsPanel } from "@/components/builder/CommentsPanel";
import { FilesPane } from "@/components/builder/FilesPane";
import { ImageEditPanel } from "@/components/builder/ImageEditPanel";
import { OptionsPane } from "@/components/builder/OptionsPane";
import { PreviewPane } from "@/components/builder/PreviewPane";
import {
  detectRoutes,
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
  buildPromptWithAttachments,
  formatElementSelectionMarker,
  mergePromptAttachments,
  parseUserMessageContent,
  revokePromptAttachment,
} from "@/lib/prompt-attachments";
import { toPlainChatText } from "@/lib/plain-text";
import { UserMessageBody } from "@/components/UserMessageBody";

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
  effort_label?: string | null;
  attachments?: MessageAttachment[] | null;
};

type SendOpts = {
  bootKey?: string;
  skipUserBubble?: boolean;
};

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

function friendlyStreamError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  if (/failed to fetch|networkerror|network request failed|load failed|network error/i.test(raw)) {
    return fallback;
  }
  return raw || fallback;
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();
  const { t, locale } = useI18n();

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
  const [streaming, setStreaming] = useState("");
  const [streamThinking, setStreamThinking] = useState("");
  const [streamSteps, setStreamSteps] = useState<AgentStep[]>(() =>
    initialBoot ? [{ id: "boot", label: "…", status: "running" }] : [],
  );
  const [streamOps, setStreamOps] = useState<FileOp[]>([]);
  const [streamEffort, setStreamEffort] = useState<string | null>(null);
  const [streamSummary, setStreamSummary] = useState("");
  const [busy, setBusy] = useState(() => Boolean(initialBoot));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUpdating, setPreviewUpdating] = useState(false);
  const [mobilePane, setMobilePane] = useState<"chat" | "workspace">("chat");
  const [mainMode, setMainMode] = useState<BuilderMode>("preview");
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [previewTool, setPreviewTool] = useState<PreviewTool | null>(null);
  const [elementSelection, setElementSelection] = useState<ElementSelection | null>(null);
  const [commentAnchor, setCommentAnchor] = useState<ElementSelection | null>(null);
  const [imageSelection, setImageSelection] = useState<ImageSelection | null>(null);
  const [previewPath, setPreviewPath] = useState("/");
  const [pages, setPages] = useState<string[]>(["/"]);
  const [designOpen, setDesignOpen] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoPreviewRef = useRef(false);
  const bootSentRef = useRef(false);
  const bootPromptRef = useRef<string | null>(initialBoot);
  const previewRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewUpdatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const previewSrc = useMemo(() => {
    if (!previewUrl) return null;
    // Always load the SPA entry under /preview/{id}/ — route changes are client-side.
    const base = previewUrl.endsWith("/") ? previewUrl : `${previewUrl}/`;
    const path =
      previewPath && previewPath !== "/"
        ? previewPath.replace(/^\//, "")
        : "";
    const url = `${apiBase()}${base}${path}`;
    const params = new URLSearchParams();
    params.set("t", String(previewKey));
    return `${url}?${params.toString()}`;
  }, [previewUrl, previewKey, previewPath]);

  const refreshRoutes = useCallback(async () => {
    try {
      const tree = await api<FileNode[]>(`/projects/${projectId}/files`);
      const routes = detectRoutes(tree);
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
          active.status === "awaiting_plan_confirm" &&
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

  const startPreview = useCallback(async () => {
    setPreviewBusy(true);
    setError(null);
    try {
      const status = await api<{ running: boolean; url: string | null }>(
        `/projects/${projectId}/preview/start`,
        { method: "POST" },
      );
      setPreviewUrl(status.url);
      setPreviewKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("previewFailed"));
    } finally {
      setPreviewBusy(false);
    }
  }, [projectId, t]);

  const forcePreviewRefresh = useCallback(
    async (opts?: { softStart?: boolean; remount?: boolean }) => {
      const remount = opts?.remount !== false;
      setPreviewUpdating(true);
      if (previewUpdatingTimer.current) clearTimeout(previewUpdatingTimer.current);
      if (previewRefreshTimer.current) {
        clearTimeout(previewRefreshTimer.current);
        previewRefreshTimer.current = null;
      }

      if (opts?.softStart) {
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
    [projectId, startPreview],
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
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
        topProgressDone("project-load");
      });
  }, [load, router]);

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

  const schedulePreviewRefresh = useCallback(() => {
    if (previewRefreshTimer.current) clearTimeout(previewRefreshTimer.current);
    previewRefreshTimer.current = setTimeout(() => {
      previewRefreshTimer.current = null;
      void forcePreviewRefresh();
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
      stickToBottomRef.current = distanceFromBottom < 80;
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const container = messagesRef.current;
    if (!container || !stickToBottomRef.current) return;
    container.scrollTop = container.scrollHeight;
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
      setAttachments((prev) => {
        const { next, rejected } = mergePromptAttachments(prev, list);
        setFileError(rejected.length ? t("promptFileTypeError") : null);
        return next;
      });
    },
    [t],
  );

  function onFilesSelected(e: ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list?.length) return;
    addFiles(list);
    e.target.value = "";
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) revokePromptAttachment(target);
      return prev.filter((item) => item.id !== id);
    });
    setFileError(null);
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
        setPlanTasks((prev) =>
          prev.map((task) =>
            task.status === "running" ? { ...task, status: "error" } : task,
          ),
        );
        setPlanNeedsConfirm(false);
        throw new Error(message);
      } else if (type === "done") {
        const summary = toPlainChatText(
          typeof payloadEvent.summary === "string" ? payloadEvent.summary : "",
        );
        // Never surface LLM marketing prose (emoji / markdown) as the chat bubble.
        const content =
          summary ||
          (locale === "en"
            ? "Here is what was put in place."
            : "Voici ce qui a été mis en place.");
        setStreamSummary(content);
        if (Array.isArray(payloadEvent.plan)) {
          setPlanTasks(
            (payloadEvent.plan as PlanTask[]).map((task) => ({
              ...task,
              status: task.status || "done",
            })),
          );
        }
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
          void forcePreviewRefresh({ softStart: true });
          setMainMode("preview");
          setMobilePane("workspace");
        }
      }
    },
    [forcePreviewRefresh, locale, previewBusy, previewUrl, schedulePreviewRefresh, startPreview, t],
  );

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
    const runId = activeRunIdRef.current;
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
      if (busy && !opts.skipUserBubble) return;

      let uploaded = attached;
      try {
        if (attached.some((a) => a.kind === "image")) {
          uploaded = [];
          for (const item of attached) {
            if (item.kind !== "image") {
              uploaded.push(item);
              continue;
            }
            const fd = new FormData();
            fd.append("file", item.file);
            const up = await fetch(`${apiBase()}/projects/${projectId}/files/upload`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${getToken()}`,
                "Accept-Language": locale,
              },
              body: fd,
            });
            if (!up.ok) {
              const detail = await up.text().catch(() => up.statusText);
              throw new Error(detail || "Upload failed");
            }
            const data = (await up.json()) as { public_path?: string; path?: string };
            uploaded.push({
              ...item,
              publicPath: data.public_path || (data.path ? `/${data.path.replace(/^public\//, "")}` : null),
            });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }

      const withSelection = elementSelection
        ? `${formatElementSelectionMarker(elementSelection, t("selectionMarker"))}\n\n${content}`.trim()
        : content;
      const payload = await buildPromptWithAttachments(withSelection, uploaded, {
        importFiles: t("importFiles"),
        imageAttached: t("promptImageAttached"),
        mdSection: t("promptMdSection"),
        txtSection: t("promptTxtSection"),
        pdfSection: t("promptPdfSection"),
        pdfEmpty: t("promptPdfEmpty"),
      });
      if (!payload.trim()) return;
      setElementSelection(null);

      const displayAtts: MessageAttachment[] = uploaded.map((a) => ({
        name: a.file.name,
        kind: a.kind,
        previewUrl: a.previewUrl,
        publicPath: a.publicPath || null,
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
        setError(friendlyStreamError(err, t("streamError")));
        setStreaming("");
        setStreamThinking("");
        setStreamSteps([]);
        setStreamOps([]);
        setStreamEffort(null);
        setClarifyQuestions([]);
        setPlanNeedsConfirm(false);
      } finally {
        streamAbortRef.current = null;
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [busy, chatId, editingMessageId, elementSelection, handleStreamEvent, locale, planMode, projectId, t],
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
        setError(friendlyStreamError(err, t("streamError")));
      } finally {
        setBusy(false);
        void refreshRodiumWallet();
      }
    },
    [activeRunId, chatId, handleStreamEvent, locale, projectId, streamEffort, streamOps, streamSteps, t],
  );

  const executePlan = useCallback(async () => {
    if (!chatId || !activeRunId) return;
    setBusy(true);
    setPlanNeedsConfirm(false);
    setError(null);
    setPlanTasks((prev) => {
      if (!prev.length) return prev;
      const next = prev.map((task) => ({ ...task, status: "pending" }));
      next[0] = { ...next[0], status: "running" };
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
      setError(friendlyStreamError(err, t("streamError")));
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
  }, [activeRunId, chatId, handleStreamEvent, locale, planTasks, projectId, streamEffort, streamSteps, t]);

  useEffect(() => {
    if (!chatId || loading || bootSentRef.current || bootInFlight.has(projectId)) return;
    const pending = bootPromptRef.current || peekBootPrompt(projectId)?.trim() || null;
    if (!pending) return;

    const hasUser = messages.some((m) => m.role === "user");
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (hasUser || hasAssistant) {
      if (messages.some((m) => m.id !== "boot-user" && m.role === "user")) {
        bootSentRef.current = true;
        bootPromptRef.current = null;
        clearBootPrompt(projectId);
      }
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitComposer();
    }
  }

  async function retryBoot() {
    const pending = bootRetryPrompt || peekBootPrompt(projectId)?.trim();
    if (!pending || busy) return;
    bootSentRef.current = true;
    setMessages([{ id: "boot-user", role: "user", content: pending }]);
    await sendMessage(pending, [], {
      bootKey: bootPromptKey(projectId),
      skipUserBubble: true,
    });
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
          if (mode !== "preview") setPreviewTool(null);
          if (mode === "preview") {
            // Ensure Vite is alive; remount only after a restart (startPreview bumps key).
            void forcePreviewRefresh({ softStart: true, remount: false });
          }
        }}
        viewport={viewport}
        onViewportChange={setViewport}
        pages={pages}
        previewPath={previewPath}
        onPreviewPathChange={setPreviewPath}
        previewLive={Boolean(previewSrc)}
        previewUpdating={previewUpdating}
        previewBusy={previewBusy}
        onRefreshPreview={() => {
          void forcePreviewRefresh({ softStart: true });
        }}
        onOpenDesign={() => setDesignOpen(true)}
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
          onClick={() => setMobilePane("chat")}
        >
          {t("builderTabChat")}
        </button>
        <button
          type="button"
          role="tab"
          className={mobilePane === "workspace" ? "active" : ""}
          aria-selected={mobilePane === "workspace"}
          onClick={() => setMobilePane("workspace")}
        >
          {t("builderTabWorkspace")}
        </button>
      </div>

      {error && (
        <div className="builder-error" role="alert">
          {error}
          {bootRetryPrompt ? (
            <>
              {" "}
              <button type="button" className="btn" onClick={() => void retryBoot()}>
                {t("bootRetry")}
              </button>
              <Link href="/connectors/rodiumai"> {t("openSettings")}</Link>
            </>
          ) : null}
        </div>
      )}

      <div className={`builder-body builder-body-${mobilePane}`}>
        <aside className="builder-sidebar">
          <div className="builder-messages" ref={messagesRef}>
            {loading && !messages.length && <p className="builder-empty">{t("loading")}</p>}

            {!loading && messages.length === 0 && !showLivePanel && (
              <p className="builder-empty">{t("builderEmptyChat")}</p>
            )}

            {messages.map((m) => {
              if (m.role === "user" && !m.content.trim()) return null;
              const text =
                m.role === "assistant"
                  ? toPlainChatText(displayContent(m.content) || m.content)
                  : m.content.trim();
              const steps = parseJsonArray<AgentStep>(m.steps_json);
              const ops = parseJsonArray<FileOp>(m.file_ops_json);
              if (
                m.role === "assistant" &&
                !text &&
                !steps.length &&
                !ops.length &&
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
                      />
                    </div>
                  ) : (
                    <GenerationCollapse
                      summary={text}
                      code=""
                      fileCount={ops.length}
                      streaming={false}
                    />
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
                <GenerationCollapse
                  summary={toPlainChatText(streamSummary)}
                  code=""
                  fileCount={streamOps.length}
                  streaming={busy && !awaitingHitl}
                />
              </article>
            )}

            <div ref={bottomRef} />
          </div>

          <form className="builder-composer" onSubmit={onSend}>
            <div
              className="builder-composer-box"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
            >
              <PromptFileChips items={attachments} onRemove={removeAttachment} />
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
              {fileError && <p className="landing-file-error">{fileError}</p>}
              {editingMessageId ? (
                <p className="builder-editing-hint">{t("editingMessage")}</p>
              ) : null}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="landing-import-input"
                    multiple
                    accept={PROMPT_FILE_ACCEPT}
                    onChange={onFilesSelected}
                  />
                  <button
                    type="button"
                    className="builder-plus"
                    aria-label={t("importAria")}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={composerInputLocked}
                  >
                    <Icon icon={Plus} className="ui-icon-md" />
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
          <PreviewPane
            previewSrc={previewSrc}
            viewport={viewport}
            previewUpdating={previewUpdating}
            previewBusy={previewBusy}
            previewTool={previewTool}
            onPreviewToolChange={(tool) => {
              setPreviewTool(tool);
              if (tool !== "image") setImageSelection(null);
              if (tool !== "comment") setCommentAnchor(null);
              if (tool !== "select") {
                /* keep selection badge until cleared / sent */
              }
            }}
            onStartPreview={() => void startPreview()}
            onRefreshPreview={() => {
              void forcePreviewRefresh({ softStart: true });
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
                void forcePreviewRefresh({ softStart: true, remount: false });
                if (res?.path) {
                  setPreviewUpdating(true);
                  setTimeout(() => setPreviewUpdating(false), 900);
                }
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : t("visualEditFailed"),
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
                    void forcePreviewRefresh({ softStart: true, remount: false });
                    setPreviewUpdating(true);
                    setTimeout(() => setPreviewUpdating(false), 900);
                  }}
                />
              ) : null
            }
          />
        )}
        {mainMode === "code" && (
          <CodePane
            projectId={projectId}
            onSaved={() => {
              void refreshRoutes();
              // Immediate remount so saved edits apply to preview without waiting on HMR.
              void forcePreviewRefresh({ softStart: true });
            }}
          />
        )}
        {mainMode === "files" && (
          <FilesPane
            projectId={projectId}
            onChanged={() => {
              void refreshRoutes();
              void forcePreviewRefresh({ softStart: true });
            }}
          />
        )}
        {mainMode === "options" && (
          <OptionsPane
            projectId={projectId}
            projectName={project?.name || ""}
            projectSlug={project?.slug || ""}
            sitesUrl={project?.sites_url ?? null}
            publishedAt={project?.published_at ?? null}
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
            onOpenDesign={() => setDesignOpen(true)}
          />
        )}
      </div>

      <DesignCharterSlideover
        projectId={projectId}
        open={designOpen}
        onClose={() => setDesignOpen(false)}
      />
    </div>
  );
}

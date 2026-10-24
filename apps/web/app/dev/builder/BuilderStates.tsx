"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { ClarifyCard } from "@/components/ClarifyCard";
import { FrodiUsageBanner } from "@/components/FrodiUsageBanner";
import { PlanPanel } from "@/components/PlanPanel";
import { DoneCard, EmptyChat, FollowUps, ForgeWho, OutOfFrodiCard } from "@/components/builder/ChatCards";
import { BuildCanvas, EmptyStage, PreviewBar } from "@/components/builder/Stage";
import { SaveStatus, WorkspaceBar, type WorkspaceState } from "@/components/builder/WorkspaceBar";
import { AssistantBody } from "@/components/chat/AssistantBody";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Glyph } from "@/components/ui/glyph";
import { Tabs } from "@/components/ui/Tabs";
import { initialStreamState, reduceStreamEvents } from "@/lib/chat-stream";
import type { ForgeStatus } from "@/lib/forge-status";
import type { ProjectKindId } from "@/lib/kinds";

type DevState = "empty" | "clarify" | "generating" | "done" | "error";

const OPTS = { streamErrorLabel: "Erreur", emptySummaryLabel: "Terminé." };

const PROMPT =
  "Le site vitrine de la boulangerie Kodjo : la carte du jour, les horaires, et un bouton pour commander sur WhatsApp.";

const TASKS = [
  { id: "t1", title: "Analyser la demande et choisir la structure" },
  { id: "t2", title: "Accueil et navigation" },
  { id: "t3", title: "Sections Carte et Horaires" },
  { id: "t4", title: "Bouton de commande WhatsApp" },
  { id: "t5", title: "Adaptation au mobile" },
  { id: "t6", title: "Vérifier l'aperçu" },
];

const FILES = [
  ["t1", "src/App.tsx"],
  ["t2", "src/sections/Hero.tsx"],
  ["t2", "src/components/Navbar.tsx"],
  ["t3", "src/sections/Carte.tsx"],
  ["t3", "src/sections/Horaires.tsx"],
  ["t4", "src/components/WhatsAppButton.tsx"],
  ["t5", "src/styles/theme.css"],
  ["t6", "src/pages/Contact.tsx"],
] as const;

/** A recorded run, in the shape of the API's SSE events. */
function recordedRun(): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [
    { type: "user_message", run_id: "run-dev" },
    { type: "route", effort_label: "Auto · Sonnet 5" },
    { type: "step", id: "read", label: "Lecture de la demande", status: "running" },
    { type: "step", id: "read", label: "Lecture de la demande", status: "done" },
    { type: "plan", needs_confirm: false, run_id: "run-dev", tasks: TASKS },
  ];
  for (const task of TASKS) {
    events.push({ type: "step", id: `task:${task.id}`, label: task.title, status: "running" });
    for (const [tid, path] of FILES) if (tid === task.id) events.push({ type: "file_write", path });
    events.push({ type: "step", id: `task:${task.id}`, label: task.title, status: "done" });
  }
  events.push({ type: "token", content: "C'est prêt : accueil, carte du jour, horaires et bouton WhatsApp. Voulez-vous que j'ajoute une page de commande ?" });
  return events;
}

/** Index in the recorded run where the FRODI ran out (task 4 of 6 running). */
function stopIndex(events: Record<string, unknown>[]): number {
  return events.findIndex((e) => e.type === "step" && e.id === "task:t4" && e.status === "running") + 2;
}

function status(remaining: number): ForgeStatus {
  return {
    frodi: remaining,
    rodi: null,
    frodi_grant: 10000,
    frodi_resets_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    plan: "pro",
    entitlements: null,
  };
}

export function BuilderStates() {
  const params = useSearchParams();
  const state = (["empty", "clarify", "generating", "done", "error"].includes(params.get("state") || "")
    ? params.get("state")
    : "generating") as DevState;
  const kind = (params.get("kind") === "mobile" ? "mobile" : "web") as ProjectKindId;
  const events = useMemo(recordedRun, []);
  const [cursor, setCursor] = useState(state === "generating" ? 6 : events.length);

  // Generating: replay the recorded run one event at a time, then start over.
  useEffect(() => {
    if (state !== "generating") return;
    const id = window.setInterval(() => setCursor((c) => (c >= events.length ? 6 : c + 1)), 700);
    return () => window.clearInterval(id);
  }, [state, events.length]);

  const end = state === "error" ? stopIndex(events) : state === "generating" ? cursor : events.length;
  const replay = reduceStreamEvents(events.slice(0, end), OPTS, initialStreamState()).state;
  if (state === "error") {
    replay.planTasks = replay.planTasks.map((t) => (t.status === "running" ? { ...t, status: "error" } : t));
    replay.steps = replay.steps.map((s) => (s.status === "running" ? { ...s, status: "error" } : s));
  }
  const tasksDone = replay.planTasks.filter((t) => t.status === "done").length;

  const pill: WorkspaceState = state === "empty" ? "new" : state === "generating" || state === "clarify" ? "gen" : state === "error" ? "err" : "draft";

  const nav = (
    <nav className="f-bd-devnav" aria-label="States">
      {(["empty", "clarify", "generating", "done", "error"] as DevState[]).map((s) => (
        <Link key={s} href={`/dev/builder?state=${s}&kind=${kind}`} aria-current={s === state ? "true" : undefined}>
          {s}
        </Link>
      ))}
      <Link href={`/dev/builder?state=${state}&kind=${kind === "web" ? "mobile" : "web"}`}>{kind === "web" ? "mobile" : "web"}</Link>
    </nav>
  );

  return (
    <AppShell active={null} chrome="bare">
      <div className="f-bd">
        <WorkspaceBar
          kind={kind}
          name={state === "empty" ? "Projet sans titre" : "Vitrine boulangerie artisanale"}
          onRename={async (next) => next}
          state={pill}
          center={
            <Tabs
              className="f-bd-tabs"
              label="Vues"
              value="preview"
              onChange={() => undefined}
              items={[
                { id: "preview", label: "Aperçu", icon: "eye" },
                { id: "code", label: "Code", icon: "code" },
                { id: "history", label: "Historique", icon: "history" },
              ]}
            />
          }
          saveStatus={<SaveStatus busy={state === "generating"} />}
          actions={
            <>
              <Button variant="ghost" size="sm" icon="users" className="f-bd-hide-mob">
                Partager
              </Button>
              <Button size="sm" icon="rocket" disabled={state === "generating" || state === "empty"}>
                <span className="f-btn-label">Publier</span>
              </Button>
            </>
          }
        />
        <div className="f-bd-body">
          <aside className="f-bd-chat" aria-label="Conversation">
            <div className="f-bd-scroll">
              {state === "empty" ? (
                <EmptyChat kind={kind} firstName="Parfait" onPick={() => undefined} />
              ) : (
                <>
                  <article className="f-bd-msg f-bd-msg-user">
                    <div className="f-bd-bubble">{PROMPT}</div>
                  </article>
                  <article className="f-bd-msg f-bd-msg-ai">
                    <ForgeWho right={replay.effort || "Auto"} streaming={state === "generating"} />
                    <p className="f-bd-think">
                      Je pars sur une structure claire, une palette chaude et des textes courts.
                    </p>
                    {state === "clarify" ? (
                      <ClarifyCard
                        questions={[
                          {
                            id: "style",
                            prompt: "Style ?",
                            options: [
                              { id: "warm", label: "Chaleureux" },
                              { id: "min", label: "Minimal" },
                              { id: "bold", label: "Audacieux" },
                            ],
                          },
                          {
                            id: "pages",
                            prompt: "Pages ?",
                            type: "multiple",
                            options: [
                              { id: "menu", label: "Carte" },
                              { id: "hours", label: "Horaires" },
                              { id: "contact", label: "Contact" },
                            ],
                          },
                        ]}
                        onSubmit={() => undefined}
                      />
                    ) : (
                      <>
                        {replay.planTasks.length ? (
                          <PlanPanel
                            tasks={replay.planTasks}
                            busy={state === "generating"}
                            executing={state === "generating"}
                            onStop={() => undefined}
                            onExecute={state === "error" ? () => undefined : undefined}
                          />
                        ) : null}
                        <AgentActivityPanel
                          steps={replay.steps.filter((s) => !s.id.startsWith("task:"))}
                          fileOps={replay.ops}
                          streaming={state === "generating"}
                          live={state !== "done"}
                          onOpenFile={() => undefined}
                        />
                        {state === "done" ? (
                          <>
                            <AssistantBody content={replay.streaming} />
                            <DoneCard files={replay.ops.length} onViewChanges={() => undefined} onUndo={() => undefined} />
                            <FollowUps onPick={() => undefined} />
                          </>
                        ) : null}
                        {state === "error" ? (
                          <OutOfFrodiCard
                            step={tasksDone + 1}
                            total={replay.planTasks.length}
                            onContinue={() => undefined}
                            status={status(0)}
                          />
                        ) : null}
                      </>
                    )}
                  </article>
                </>
              )}
            </div>
            <div>
              {state === "generating" || state === "error" ? (
                <FrodiUsageBanner onOpenSettings={() => undefined} status={status(state === "error" ? 0 : 1180)} />
              ) : null}
              <form className="f-bd-foot" onSubmit={(e) => e.preventDefault()}>
                <div className="f-bd-composer">
                  <textarea
                    rows={2}
                    aria-label="Message"
                    readOnly={state === "generating"}
                    placeholder={
                      state === "error"
                        ? "Rechargez pour continuer"
                        : state === "generating"
                          ? "Ajoutez une précision pendant que Forge travaille…"
                          : state === "empty"
                            ? "Décrivez votre site web…"
                            : "Demandez une modification…"
                    }
                  />
                  <div className="f-bd-bar">
                    <button type="button" className="f-bd-cbtn icon" aria-label="Joindre">
                      <Glyph name="paperclip" size="sm" />
                    </button>
                    <div className="f-bd-mode" role="group" aria-label="Mode">
                      <button type="button" aria-pressed>
                        Agent
                      </button>
                      <button type="button" aria-pressed={false}>
                        Plan
                      </button>
                    </div>
                    <span className="sp" />
                    <span className="f-bd-cbtn">
                      <Glyph name="cpu" size="sm" />
                      Auto
                    </span>
                    {state === "generating" ? (
                      <button type="button" className="f-bd-send stop" aria-label="Arrêter">
                        <Glyph name="square" size="sm" />
                      </button>
                    ) : (
                      <button type="submit" className="f-bd-send" aria-label="Envoyer" disabled={state === "error"}>
                        <Glyph name="arrow-up" />
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </aside>
          <main className="f-bd-stage">
            <PreviewBar
              platform={kind === "mobile" ? "mobile" : "web"}
              url={kind === "mobile" ? "iPhone · 390 x 844" : "boulangerie-kodjo.forge.site"}
              pages={["/", "/carte", "/contact"]}
              previewPath="/"
              onPreviewPathChange={() => undefined}
              viewport={kind === "mobile" ? "phone" : "desktop"}
              onViewportChange={() => undefined}
              previewBusy={false}
              onRefresh={() => undefined}
              onOpenExternal={() => undefined}
              phoneUrl={kind === "mobile" ? "https://forge.rodiumai.com" : null}
              activity={
                state === "generating"
                  ? { kind: "building" }
                  : state === "error"
                    ? { kind: "paused", step: tasksDone + 1, total: replay.planTasks.length }
                    : null
              }
            />
            <div className="f-bd-stage-body">
              {state === "empty" ? (
                <EmptyStage kind={kind} />
              ) : (
                <BuildCanvas
                  phone={kind === "mobile"}
                  paused={state !== "generating"}
                  progress={state === "done" ? 1 : replay.planTasks.length ? tasksDone / replay.planTasks.length : 0}
                />
              )}
            </div>
          </main>
        </div>
        <nav className="f-bd-mtabs" aria-label="Espace de travail">
          <button type="button" aria-pressed>
            <Glyph name="msg" />
            <span>Discussion</span>
          </button>
          <button type="button" aria-pressed={false}>
            <Glyph name="eye" />
            <span>Aperçu</span>
          </button>
          <button type="button">
            <Glyph name="users" />
            <span>Partager</span>
          </button>
        </nav>
        {nav}
      </div>
    </AppShell>
  );
}

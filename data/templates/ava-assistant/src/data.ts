import { Code, GraduationCap, Lightbulb, PenLine } from "lucide-react";

export const ONBOARD_KEY = "ava_onboard_done";

export const SLIDES = [
  { kicker: "Meet Ava", title: "Your everyday AI", body: "A calm, capable assistant that lives in your pocket — ready the moment you open the app." },
  { kicker: "Ask anything", title: "Answers, in plain words", body: "Draft, summarize, explain or brainstorm. Ava replies fast and keeps the thread tidy." },
  { kicker: "Gets things done", title: "From idea to done", body: "Turn a rough thought into an email, a plan, or working code — all in one conversation." },
];

export type Tab = "chat" | "prompts" | "history" | "account";
export type Msg = { id: number; role: "assistant" | "user"; text: string };

export const TITLES: Record<Tab, string> = { chat: "Ava", prompts: "Prompts", history: "History", account: "Account" };
export const SUBS: Record<Tab, string> = { chat: "Online · GPT-grade", prompts: "Start from an idea", history: "Your conversations", account: "Maya Okonkwo" };

export const SEED: Msg[] = [
  { id: 1, role: "assistant", text: "Hey! I'm Ava. What are we working on today?" },
  { id: 2, role: "user", text: "Help me draft a short reply to a client who asked for a project update." },
  { id: 3, role: "assistant", text: "Sure. Here's a friendly draft:\n\n“Hi Lea — quick update: design is wrapped and we're testing the build. I'll share a preview link Thursday.”\n\nWant it warmer, or more formal?" },
];

export const CHIPS = ["Summarize this", "Draft a reply", "Plan my day"];

export const REPLIES = [
  "On it — here's a first pass. Tell me what to tweak.",
  "Got it. Want me to make it shorter or add more detail?",
  "Here's a clean version you can send as-is.",
  "Done. I can turn this into a checklist too, if that helps.",
];

export const PROMPTS = [
  { icon: PenLine, cat: "Write", title: "Polish an email", body: "Make my message clearer and warmer." },
  { icon: Lightbulb, cat: "Ideas", title: "Brainstorm names", body: "10 name ideas for a new project." },
  { icon: Code, cat: "Code", title: "Explain this code", body: "Walk me through a snippet, line by line." },
  { icon: GraduationCap, cat: "Learn", title: "Explain simply", body: "Break down a hard topic in plain words." },
  { icon: PenLine, cat: "Write", title: "Draft a post", body: "A short update for my socials." },
  { icon: Lightbulb, cat: "Plan", title: "Plan my week", body: "Turn my to-dos into a simple schedule." },
];

export const HISTORY = [
  { title: "Reply to client update", snippet: "Hi Lea — quick update: design is wrapped and we're…", time: "Just now" },
  { title: "Names for the reading app", snippet: "Here are 10 ideas — Margin, Dog-ear, Chapter, Lumen…", time: "2h ago" },
  { title: "Explain vector embeddings", snippet: "Think of it as turning meaning into coordinates…", time: "Yesterday" },
  { title: "Weekend trip checklist", snippet: "Packed list + a loose two-day plan for the coast.", time: "Mon" },
  { title: "Refactor the auth hook", snippet: "Split the effect and memoize the client — here's how…", time: "Sun" },
];

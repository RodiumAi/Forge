import {
  CalendarDays,
  ChefHat,
  Code,
  Dumbbell,
  FileText,
  GraduationCap,
  Languages,
  Lightbulb,
  Mail,
  PenLine,
  Plane,
  Sparkles,
  Telescope,
  type LucideIcon,
} from "lucide-react";

export const ONBOARD_KEY = "nova_onboard_done";

const img = (id: string, w = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Kwame",
  name: "Kwame Asante",
  email: "kwame@asante.studio",
  avatar: img("photo-1539571696357-5a69c17a67c6"),
};

export const SLIDES = [
  { kicker: "Meet Nova", title: "An assistant that actually listens", body: "Ask in your own words, by text or by voice. Nova remembers what matters to you, and only that." },
  { kicker: "Specialists on call", title: "A writer, a tutor, a coach, in one place", body: "Switch personas in a tap, each tuned for the job, from cover letters to calculus." },
  { kicker: "Private by default", title: "Your chats stay yours", body: "Memory you can read and erase, no training on your conversations, ever." },
];

export type Prompt = { id: string; title: string; sub: string; icon: LucideIcon; text: string };

export const PROMPTS: Prompt[] = [
  { id: "week", title: "Plan my week", sub: "Turn a messy to-do list into a calm schedule", icon: CalendarDays, text: "Plan my week: client review Tuesday, gym three times, finish the Dakar pitch deck by Friday." },
  { id: "pdf", title: "Summarize a PDF", sub: "The key points of any document, in 30 seconds", icon: FileText, text: "Summarize the PDF I uploaded: Q3 board report, 42 pages." },
  { id: "email", title: "Write an email", sub: "Polite, clear and in your own voice", icon: Mail, text: "Write an email to Mrs. Diallo asking to move our Thursday meeting to Friday morning." },
  { id: "explain", title: "Explain it simply", sub: "Any topic, at exactly your level", icon: Lightbulb, text: "Explain how interest rates affect my rent, like I'm twelve." },
];

export type Persona = { id: string; name: string; role: string; desc: string; icon: LucideIcon; tone: "aqua" | "pink" | "mint" | "slate"; group: string; chats: string };

export const PERSONAS: Persona[] = [
  { id: "nova", name: "Nova", role: "General assistant", desc: "Everyday questions, plans and ideas.", icon: Sparkles, tone: "aqua", group: "Everyday", chats: "Default" },
  { id: "writer", name: "Writer", role: "Drafts and edits", desc: "Emails, posts and cover letters that sound like you.", icon: PenLine, tone: "pink", group: "Create", chats: "48k chats" },
  { id: "tutor", name: "Tutor", role: "Learn anything", desc: "Step-by-step lessons, quizzes and patient hints.", icon: GraduationCap, tone: "aqua", group: "Learn", chats: "31k chats" },
  { id: "coach", name: "Coach", role: "Health and habits", desc: "Training plans and gentle check-ins that stick.", icon: Dumbbell, tone: "mint", group: "Everyday", chats: "22k chats" },
  { id: "translator", name: "Translator", role: "40 languages", desc: "Natural translations, with the nuance explained.", icon: Languages, tone: "slate", group: "Learn", chats: "27k chats" },
  { id: "researcher", name: "Researcher", role: "Sources and facts", desc: "Reads the long report so you get the short answer.", icon: Telescope, tone: "aqua", group: "Learn", chats: "18k chats" },
  { id: "chef", name: "Chef", role: "Cook with what you have", desc: "Recipes from your fridge, a market list for the week.", icon: ChefHat, tone: "pink", group: "Everyday", chats: "12k chats" },
  { id: "traveler", name: "Trip planner", role: "Itineraries", desc: "Day-by-day plans with budgets in your currency.", icon: Plane, tone: "mint", group: "Everyday", chats: "9k chats" },
  { id: "coder", name: "Code helper", role: "Explain and fix", desc: "Reads your error message and tells you why.", icon: Code, tone: "slate", group: "Create", chats: "15k chats" },
];

export const GROUPS = ["All", "Everyday", "Create", "Learn"];

export const personaById = (id: string) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

export type Msg = { id: string; role: "user" | "assistant"; text: string };
export type Thread = { id: string; title: string; persona: string; pinned: boolean; when: string; messages: Msg[] };

export const THREADS: Thread[] = [
  {
    id: "dakar-pitch", title: "Dakar pitch deck outline", persona: "writer", pinned: true, when: "10:42",
    messages: [
      { id: "m1", role: "user", text: "Help me outline a 10-slide pitch for a coworking space in Dakar, aimed at a bank." },
      { id: "m2", role: "assistant", text: "Here is a structure bankers like, because it answers their questions in order:\n- 1. The problem: 4 000 freelancers in Plateau with no reliable desk\n- 2. The space: 620 m2 on Rue Carnot, 140 seats\n- 3. Revenue: memberships from 45 000 FCFA a month\n- 4. Traction: 86 pre-signed members\n- 5. The ask: 38 million FCFA over 5 years\nWant me to draft the speaker notes for each slide?" },
    ],
  },
  {
    id: "spanish", title: "Spanish before the Madrid trip", persona: "tutor", pinned: true, when: "Yesterday",
    messages: [
      { id: "m1", role: "user", text: "Give me 5 phrases for ordering food in Madrid." },
      { id: "m2", role: "assistant", text: "Here are five you will really use:\n- Una mesa para dos, por favor.\n- ¿Qué me recomienda?\n- Para mí, el menú del día.\n- ¿Me trae la cuenta?\n- Está riquísimo.\nSay them out loud once, then I will quiz you tomorrow." },
    ],
  },
  {
    id: "run-plan", title: "10 km in eight weeks", persona: "coach", pinned: false, when: "Yesterday",
    messages: [
      { id: "m1", role: "user", text: "I can run 3 km. Can I do a 10 km in December?" },
      { id: "m2", role: "assistant", text: "Yes, comfortably. Three runs a week: one easy, one with short intervals, one long run that grows by 1 km each week. I have put week one in your calendar." },
    ],
  },
  {
    id: "lease", title: "What does clause 7 of my lease mean?", persona: "researcher", pinned: false, when: "Mon",
    messages: [
      { id: "m1", role: "user", text: "Clause 7 says the deposit is held 'until full restitution of the premises'. Is that normal?" },
      { id: "m2", role: "assistant", text: "It is standard wording. It means the landlord can keep the deposit until you hand back the keys and the inspection is done, usually within one to two months. Ask for the inspection date in writing." },
    ],
  },
  {
    id: "jollof", title: "Jollof for 12 people", persona: "chef", pinned: false, when: "Sat",
    messages: [
      { id: "m1", role: "user", text: "How much rice for jollof for 12?" },
      { id: "m2", role: "assistant", text: "Plan 1.5 kg of long grain rice, 1 kg of tomatoes, 4 red peppers and 3 onions. Parboil the rice first so it stays fluffy in a big pot." },
    ],
  },
  {
    id: "letter-fr", title: "Translate my cover letter", persona: "translator", pinned: false, when: "Oct 18",
    messages: [
      { id: "m1", role: "user", text: "Translate the first line to French: I am excited to bring eight years of design to your team." },
      { id: "m2", role: "assistant", text: "\"Je serais ravi de mettre mes huit années d'expérience en design au service de votre équipe.\" Ravi sounds warmer than enthousiaste in a French letter." },
    ],
  },
];

/** Scripted replies, picked by keyword (first match wins). */
export const REPLIES: { keys: string[]; text: string }[] = [
  { keys: ["week", "plan", "schedule"], text: "Here is a calm version of your week:\n- Mon: deep work on the pitch deck, 9:00 to 12:00\n- Tue: client review at 14:00, gym at 18:30\n- Wed: slides 6 to 10, short run at 7:00\n- Thu: buffer morning, rehearse the pitch\n- Fri: send the deck before noon, gym at 17:00\nShall I add these blocks to your calendar?" },
  { keys: ["pdf", "summar", "report"], text: "The short version of the Q3 report:\n- Revenue is up 14% on Q2, driven by Abidjan\n- Margins dipped 2 points because of shipping costs\n- Two risks flagged: the FX exposure and one late supplier\n- The board asks for a hiring plan by December\nWant the three numbers that matter most, as a slide?" },
  { keys: ["email", "mail", "write"], text: "Subject: Moving Thursday's meeting\n\nDear Mrs. Diallo,\n\nWould it be possible to move our Thursday meeting to Friday morning, at 10:00 or later? Something came up on my side, and I want to give our discussion the time it deserves.\n\nThank you for your understanding,\nKwame\n\nWant it shorter, or a bit warmer?" },
  { keys: ["explain", "why", "how", "what"], text: "Think of interest rates as the price of borrowing money. When the price goes up, your landlord pays more on his building loan, and he often passes part of that cost on to you in the rent. When rates go down, rents usually rise more slowly. Want a real example with numbers?" },
  { keys: ["translate", "french", "spanish"], text: "Done. Here it is, with a note on tone: I kept it formal, which is safer for a first letter. Tell me who will read it and I can adjust." },
];

export const FALLBACK_REPLY = "Good question. Here is how I would approach it: start with what you already know, list the one thing you need to decide today, and leave the rest for later. Tell me a bit more and I will make it concrete.";

export const SUGGESTIONS = ["Make it shorter", "Give me an example", "Turn it into a checklist", "Explain step by step"];

export const VOICE_LINES = [
  "Listening...",
  "Plan my Saturday around the market and a long run",
  "Sure. Dantokpa opens at seven, so let's start there before it gets hot.",
  "Then a 10 km run at five, when it's cooler by the lagoon.",
];

export const PLAN = { name: "Nova Pro", price: "6 500", currency: "FCFA", renews: "12 November" };

export const USAGE = [
  { label: "Advanced model", used: 312, total: 500, unit: "messages" },
  { label: "Voice mode", used: 86, total: 300, unit: "min" },
  { label: "File uploads", used: 18, total: 50, unit: "files" },
];

export type Tab = "home" | "chats" | "explore" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", chats: "/chats", explore: "/explore", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Nova", chats: "Chats", explore: "Explore", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}

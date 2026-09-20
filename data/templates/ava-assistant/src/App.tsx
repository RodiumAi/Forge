import { useEffect, useRef, useState } from "react";

/* ---- Inline icons (kit runs React-only: no icon packs) ---- */
function IconChat({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 4V6.5Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
    </svg>
  );
}
function IconPrompts({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.2 14 8l4.8 2-4.8 2-2 4.8-2-4.8L3.2 10 8 8l2-4.8Z"
        stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
    </svg>
  );
}
function IconHistory({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12a8 8 0 1 1 2.6 5.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
        opacity={active ? 1 : 0.9} />
      <path d="M4 17v-4h4M12 8v4.5l3 1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUser({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8"
        fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} />
      <path d="M5 19.5c1.8-3.2 4.2-4.8 7-4.8s5.2 1.6 7 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconSend() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4.5 12 20 4.5l-4 15.5-4.5-6.5L4.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity="0.12" /><path d="m11.5 13.5 4.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconSpark() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3.5 13.6 9l5.4 1.6L13.6 12 12 17.5 10.4 12 5 10.6 10.4 9 12 3.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>;
}
function IconNew() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}

/* ---- Prompt-card category glyphs ---- */
function GlyphWrite() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M5 19h14M6 15.5 15.5 6l2.5 2.5L8.5 18l-3 .5.5-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GlyphCode() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m9 8-4 4 4 4M15 8l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GlyphIdea() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M9 17h6M10 20h4M12 3a6 6 0 0 1 4 10.5c-.6.6-1 1.2-1 2H9c0-.8-.4-1.4-1-2A6 6 0 0 1 12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GlyphLearn() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5 3 9l9 4 9-4-9-4ZM7 11v4c0 1.1 2.2 2 5 2s5-.9 5-2v-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

const ONBOARD_KEY = "ava_onboard_done";
const SLIDES = [
  { kicker: "Meet Ava", title: "Your everyday AI", body: "A calm, capable assistant that lives in your pocket — ready the moment you open the app." },
  { kicker: "Ask anything", title: "Answers, in plain words", body: "Draft, summarize, explain or brainstorm. Ava replies fast and keeps the thread tidy." },
  { kicker: "Gets things done", title: "From idea to done", body: "Turn a rough thought into an email, a plan, or working code — all in one conversation." },
];

type Tab = "chat" | "prompts" | "history" | "account";
type Msg = { id: number; role: "assistant" | "user"; text: string };

const SEED: Msg[] = [
  { id: 1, role: "assistant", text: "Hey! I'm Ava. What are we working on today?" },
  { id: 2, role: "user", text: "Help me draft a short reply to a client who asked for a project update." },
  { id: 3, role: "assistant", text: "Sure. Here's a friendly draft:\n\n“Hi Lea — quick update: design is wrapped and we're testing the build. I'll share a preview link Thursday.”\n\nWant it warmer, or more formal?" },
];

const CHIPS = ["Summarize this", "Draft a reply", "Plan my day"];

const REPLIES = [
  "On it — here's a first pass. Tell me what to tweak.",
  "Got it. Want me to make it shorter or add more detail?",
  "Here's a clean version you can send as-is.",
  "Done. I can turn this into a checklist too, if that helps.",
];

const PROMPTS = [
  { icon: <GlyphWrite />, cat: "Write", title: "Polish an email", body: "Make my message clearer and warmer." },
  { icon: <GlyphIdea />, cat: "Ideas", title: "Brainstorm names", body: "10 name ideas for a new project." },
  { icon: <GlyphCode />, cat: "Code", title: "Explain this code", body: "Walk me through a snippet, line by line." },
  { icon: <GlyphLearn />, cat: "Learn", title: "Explain simply", body: "Break down a hard topic in plain words." },
  { icon: <GlyphWrite />, cat: "Write", title: "Draft a post", body: "A short update for my socials." },
  { icon: <GlyphIdea />, cat: "Plan", title: "Plan my week", body: "Turn my to-dos into a simple schedule." },
];

const HISTORY = [
  { title: "Reply to client update", snippet: "Hi Lea — quick update: design is wrapped and we're…", time: "Just now" },
  { title: "Names for the reading app", snippet: "Here are 10 ideas — Margin, Dog-ear, Chapter, Lumen…", time: "2h ago" },
  { title: "Explain vector embeddings", snippet: "Think of it as turning meaning into coordinates…", time: "Yesterday" },
  { title: "Weekend trip checklist", snippet: "Packed list + a loose two-day plan for the coast.", time: "Mon" },
  { title: "Refactor the auth hook", snippet: "Split the effect and memoize the client — here's how…", time: "Sun" },
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [tab, setTab] = useState<Tab>("chat");

  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, tab]);

  function finish() {
    try { localStorage.setItem(ONBOARD_KEY, "1"); } catch {}
    setOnboarded(true);
  }

  function send(text: string) {
    const body = text.trim();
    if (!body) return;
    setMessages((prev) => {
      const base = prev.length ? prev[prev.length - 1].id : 0;
      const reply = REPLIES[prev.length % REPLIES.length];
      return [
        ...prev,
        { id: base + 1, role: "user", text: body },
        { id: base + 2, role: "assistant", text: reply },
      ];
    });
    setDraft("");
  }

  if (!ready) return <div className="app-shell" />;

  if (!onboarded) {
    const s = SLIDES[slide];
    const last = slide === SLIDES.length - 1;
    return (
      <div className="app-shell onboard">
        <div className="onboard-art" aria-hidden>
          <span className="orb" />
          <div className="glass">
            <span className="ava-badge"><IconSpark /></span>
            <p className="bub">How can I help?</p>
            <p className="bub me">Plan my launch week ✨</p>
          </div>
        </div>
        <div className="onboard-body">
          <p className="onboard-kicker">{s.kicker}</p>
          <h2>{s.title}</h2>
          <p className="muted">{s.body}</p>
        </div>
        <div className="onboard-actions">
          <div className="dots" aria-hidden>
            {SLIDES.map((_, i) => <i key={i} className={i === slide ? "on" : ""} />)}
          </div>
          <button className="btn-primary" onClick={() => (last ? finish() : setSlide((n) => n + 1))}>
            {last ? "Start chatting" : "Continue"}
          </button>
          <button className="btn-ghost" onClick={finish}>Skip</button>
        </div>
      </div>
    );
  }

  const titles: Record<Tab, string> = { chat: "Ava", prompts: "Prompts", history: "History", account: "Account" };
  const subs: Record<Tab, string> = { chat: "Online · GPT-grade", prompts: "Start from an idea", history: "Your conversations", account: "Maya Okonkwo" };

  return (
    <div className="app-shell">
      <header className="app-navbar">
        <div className="who">
          <span className="pfp accent" aria-hidden><IconSpark /></span>
          <div>
            <h1>{titles[tab]}</h1>
            <p className="sub">{tab === "chat" ? <><i className="live" />{subs[tab]}</> : subs[tab]}</p>
          </div>
        </div>
        <button className="nav-action" aria-label="New chat" onClick={() => { setMessages(SEED); setTab("chat"); }}><IconNew /></button>
      </header>

      {tab === "chat" && (
        <>
          <div className="thread" ref={threadRef}>
            <p className="daybreak"><span>Today</span></p>
            {messages.map((m) => (
              <div className={m.role === "user" ? "msg me" : "msg"} key={m.id}>
                {m.role === "assistant" && <span className="msg-ava" aria-hidden><IconSpark /></span>}
                <div className="bubble">{m.text}</div>
              </div>
            ))}
          </div>

          <div className="composer">
            <div className="chips">
              {CHIPS.map((c) => (
                <button className="chip" key={c} onClick={() => send(c)}>{c}</button>
              ))}
            </div>
            <form
              className="inputbar"
              onSubmit={(e) => { e.preventDefault(); send(draft); }}
            >
              <input
                className="field"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Message Ava…"
                aria-label="Message Ava"
              />
              <button className="send" type="submit" aria-label="Send message"><IconSend /></button>
            </form>
          </div>
        </>
      )}

      {tab !== "chat" && (
        <main className="app-main">
          {tab === "prompts" && (
            <>
              <div className="section-head"><h2>Prompt library</h2><span className="pill">6 ideas</span></div>
              <div className="prompt-grid">
                {PROMPTS.map((p) => (
                  <button className="prompt" key={p.title} onClick={() => { setTab("chat"); send(p.body); }}>
                    <span className="cat"><span className="cat-ic">{p.icon}</span>{p.cat}</span>
                    <strong>{p.title}</strong>
                    <span className="one-line">{p.body}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "history" && (
            <section className="card list">
              {HISTORY.map((h) => (
                <button className="tx" key={h.title} onClick={() => setTab("chat")}>
                  <span className="ava" aria-hidden><IconChat /></span>
                  <span className="meta"><strong>{h.title}</strong><span>{h.snippet}</span></span>
                  <span className="when">{h.time}</span>
                </button>
              ))}
            </section>
          )}

          {tab === "account" && (
            <>
              <section className="card">
                <div className="row" style={{ marginBottom: ".2rem" }}>
                  <div><strong style={{ fontSize: ".95rem" }}>Model</strong><p className="muted" style={{ fontSize: ".8rem" }}>Balances speed and depth</p></div>
                  <span className="pill">Ava Pro 2</span>
                </div>
                <div className="tx"><span className="ava" aria-hidden><IconSpark /></span><span className="meta"><strong>Personality</strong><span>Friendly · concise</span></span><span className="link">Edit</span></div>
                <div className="tx"><span className="ava" aria-hidden>🗣</span><span className="meta"><strong>Voice</strong><span>Soft · on for replies</span></span><span className="link">Change</span></div>
              </section>

              <section className="card">
                <div className="row"><h3>Usage this month</h3><span className="pill">68%</span></div>
                <div className="usage"><span style={{ width: "68%" }} /></div>
                <p className="muted" style={{ fontSize: ".8rem", marginTop: ".55rem" }}>1,360 of 2,000 messages used · resets Oct 1</p>
              </section>

              <div className="upsell">
                <span className="upsell-ic" aria-hidden><IconSpark /></span>
                <div>
                  <strong>Upgrade to Pro</strong>
                  <p className="muted" style={{ fontSize: ".82rem" }}>Unlimited messages, faster model, priority.</p>
                </div>
                <button className="btn-primary" style={{ width: "auto", padding: ".6rem 1rem", minHeight: "auto" }}>Go Pro</button>
              </div>
            </>
          )}
        </main>
      )}

      <nav className="app-tabbar" aria-label="Primary">
        <button className={tab === "chat" ? "tab active" : "tab"} aria-current={tab === "chat" ? "page" : undefined} onClick={() => setTab("chat")}><IconChat active={tab === "chat"} /><span>Chat</span></button>
        <button className={tab === "prompts" ? "tab active" : "tab"} aria-current={tab === "prompts" ? "page" : undefined} onClick={() => setTab("prompts")}><IconPrompts active={tab === "prompts"} /><span>Prompts</span></button>
        <button className={tab === "history" ? "tab active" : "tab"} aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}><IconHistory active={tab === "history"} /><span>History</span></button>
        <button className={tab === "account" ? "tab active" : "tab"} aria-current={tab === "account" ? "page" : undefined} onClick={() => setTab("account")}><IconUser active={tab === "account"} /><span>Account</span></button>
      </nav>
    </div>
  );
}

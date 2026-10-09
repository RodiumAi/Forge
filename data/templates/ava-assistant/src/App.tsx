import { useEffect, useState } from "react";
import AppNavbar from "./components/AppNavbar";
import TabBar from "./components/TabBar";
import { ONBOARD_KEY, REPLIES, SEED, SUBS, TITLES, type Msg, type Tab } from "./data";
import AccountScreen from "./screens/AccountScreen";
import ChatScreen from "./screens/ChatScreen";
import HistoryScreen from "./screens/HistoryScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import PromptsScreen from "./screens/PromptsScreen";

export default function App() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try { setOnboarded(localStorage.getItem(ONBOARD_KEY) === "1"); } catch {}
    setReady(true);
  }, []);

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
  if (!onboarded) return <OnboardingScreen onFinish={finish} />;

  return (
    <div className="app-shell">
      <AppNavbar
        title={TITLES[tab]}
        sub={SUBS[tab]}
        live={tab === "chat"}
        onNewChat={() => { setMessages(SEED); setTab("chat"); }}
      />

      {tab === "chat" && <ChatScreen messages={messages} draft={draft} onDraft={setDraft} onSend={send} />}
      {tab === "prompts" && <PromptsScreen onPick={(body) => { setTab("chat"); send(body); }} />}
      {tab === "history" && <HistoryScreen onOpen={() => setTab("chat")} />}
      {tab === "account" && <AccountScreen />}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}

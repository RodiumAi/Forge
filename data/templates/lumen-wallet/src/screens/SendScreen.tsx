import "../styles/send.css";
import { ArrowLeft, Check, Delete } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CONTACTS, CURRENCY } from "../data";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"];

function format(raw: string) {
  return raw ? Number(raw).toLocaleString("fr-FR").replace(/\s/g, " ") : "0";
}

/** Stack screen (no tab bar): pick a contact, type an amount, send. */
export default function SendScreen() {
  const navigate = useNavigate();
  const [to, setTo] = useState(CONTACTS[0].id);
  const [raw, setRaw] = useState("");
  const [sent, setSent] = useState(false);
  const contact = CONTACTS.find((c) => c.id === to) ?? CONTACTS[0];

  function back() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/", { replace: true });
  }

  function press(key: string) {
    if (key === "del") return setRaw((v) => v.slice(0, -1));
    setRaw((v) => (v + key).replace(/^0+/, "").slice(0, 8));
  }

  if (sent) {
    return (
      <div className="app-shell send-screen done">
        <div className="done-mark"><Check size={40} strokeWidth={2.6} aria-hidden /></div>
        <h2>{format(raw)} {CURRENCY} sent</h2>
        <p className="muted">{contact.name} will see it in a second.</p>
        <button className="btn-primary" onClick={() => navigate("/", { replace: true })}>Back to home</button>
      </div>
    );
  }

  return (
    <div className="app-shell send-screen">
      <header className="send-bar">
        <button className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={20} strokeWidth={2} aria-hidden /></button>
        <h1>Send money</h1>
        <span className="bar-space" aria-hidden />
      </header>

      <div className="recipients" role="radiogroup" aria-label="Recipient">
        {CONTACTS.map((c) => (
          <button key={c.id} role="radio" aria-checked={to === c.id} className={to === c.id ? "on" : ""} onClick={() => setTo(c.id)}>
            <img src={c.avatar} alt="" /><span>{c.name}</span>
          </button>
        ))}
      </div>

      <div className="amount-box">
        <p className="muted">To {contact.name}, free and instant</p>
        <p className={raw ? "big" : "big empty"}>{format(raw)}<small>{CURRENCY}</small></p>
        <span className="pill">Balance 1 284 650 {CURRENCY}</span>
      </div>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} aria-label={k === "del" ? "Delete" : k}>
            {k === "del" ? <Delete size={22} strokeWidth={2} aria-hidden /> : k}
          </button>
        ))}
      </div>

      <button className="btn-primary send-btn" disabled={!raw} onClick={() => setSent(true)}>Send {raw ? `${format(raw)} ${CURRENCY}` : ""}</button>
    </div>
  );
}

import "../styles/home.css";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, LayoutGrid, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import TxRow from "../components/TxRow";
import { BALANCE, CONTACTS, CURRENCY, TRANSACTIONS } from "../data";

const ACTIONS = [
  { label: "Send", icon: ArrowUpRight, to: "/send" },
  { label: "Request", icon: ArrowDownLeft, to: "/send" },
  { label: "Top up", icon: Plus, to: "/cards" },
  { label: "More", icon: LayoutGrid, to: "/profile" },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);

  return (
    <main className="app-main home-screen">
      <section className="balance">
        <div className="balance-top">
          <span>Total balance</span>
          <button className="peek" onClick={() => setHidden((v) => !v)} aria-label={hidden ? "Show balance" : "Hide balance"}>
            {hidden ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
          </button>
        </div>
        <p className="balance-amt">{hidden ? "••• •••" : BALANCE.total} <small>{CURRENCY}</small></p>
        <p className="balance-change"><span>{BALANCE.rate}</span> {BALANCE.change} this month</p>
        <svg className="spark" viewBox="0 0 300 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 48 C 30 44, 45 30, 70 34 S 115 52, 140 38 S 190 12, 215 22 S 265 30, 300 6" />
        </svg>
      </section>

      <section className="actions" aria-label="Quick actions">
        {ACTIONS.map(({ label, icon: Icon, to }) => (
          <Link key={label} to={to} className="action">
            <span><Icon size={21} strokeWidth={2} aria-hidden /></span>
            {label}
          </Link>
        ))}
      </section>

      <section>
        <div className="section-head">
          <h2>Send again</h2>
          <Link to="/send" className="link">See all</Link>
        </div>
        <div className="contacts">
          <button className="contact add" onClick={() => navigate("/send")} aria-label="New transfer">
            <span><Plus size={20} strokeWidth={2.2} aria-hidden /></span>New
          </button>
          {CONTACTS.map((c) => (
            <button key={c.id} className="contact" onClick={() => navigate("/send")}>
              <img src={c.avatar} alt="" />{c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card activity">
        <div className="section-head">
          <h2>Today</h2>
          <Link to="/insights" className="link">Insights</Link>
        </div>
        <ul className="tx-list">
          {TRANSACTIONS.map((tx) => <TxRow key={tx.id} tx={tx} />)}
        </ul>
      </section>
    </main>
  );
}

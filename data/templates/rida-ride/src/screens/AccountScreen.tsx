import "../styles/account.css";
import { CircleHelp, CreditCard, House, Shield } from "lucide-react";
import ListRow from "../components/ListRow";

const ROWS = [
  { icon: CreditCard, title: "Payment methods", sub: "Wave · Visa •••• 8830", action: "Manage" },
  { icon: House, title: "Saved places", sub: "Home · Work · Gym", action: "Edit" },
  { icon: Shield, title: "Safety", sub: "Trusted contacts · Share trip", action: "Set up" },
  { icon: CircleHelp, title: "Help & support", sub: "Trip issues · 24/7 chat", action: "Open" },
];

export default function AccountScreen() {
  return (
    <main className="app-main account-screen">
      <section className="card">
        {ROWS.map(({ icon: Icon, title, sub, action }) => (
          <ListRow key={title} icon={<Icon size={18} strokeWidth={1.8} aria-hidden />} title={title} sub={sub}>
            <span className="link">{action}</span>
          </ListRow>
        ))}
      </section>
    </main>
  );
}

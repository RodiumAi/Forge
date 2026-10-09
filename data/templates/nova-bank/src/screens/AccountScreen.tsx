import "../styles/account.css";
import { CircleHelp, Globe, Shield, Star } from "lucide-react";
import ListRow from "../components/ListRow";

export default function AccountScreen() {
  return (
    <main className="app-main account-screen">
      <section className="card">
        <ListRow icon={Star} title="Nova+ membership" sub="Free transfers, higher limits"><span className="link">Upgrade</span></ListRow>
        <ListRow icon={Globe} title="Linked accounts" sub="Wave · Orange Money"><span className="link">Manage</span></ListRow>
        <ListRow icon={Shield} title="Security" sub="Face ID · PIN"><span className="link">Edit</span></ListRow>
        <ListRow icon={CircleHelp} title="Help & support" sub="Chat with us 24/7"><span className="link">Open</span></ListRow>
      </section>
    </main>
  );
}

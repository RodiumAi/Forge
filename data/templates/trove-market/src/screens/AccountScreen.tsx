import "../styles/account.css";
import { ACCOUNT_LINKS, AVATAR } from "../data";
import RowItem from "../components/RowItem";

export default function AccountScreen() {
  return (
    <main className="app-main account-screen">
      <section className="card profile">
        <span className="pfp lg"><img src={AVATAR} alt="" /></span>
        <div><strong>Léa Moreau</strong><p className="muted">Trove member since 2023</p></div>
        <span className="pill">Gold</span>
      </section>
      <section className="card">
        {ACCOUNT_LINKS.map(({ Icon, size, title, sub, action }) => (
          <RowItem key={title} icon={<Icon size={size} strokeWidth={1.8} />} title={title} sub={<span>{sub}</span>}>
            <span className="link">{action}</span>
          </RowItem>
        ))}
      </section>
    </main>
  );
}

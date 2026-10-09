import "../styles/account.css";
import { SETTINGS } from "../data";
import ListRow from "../components/ListRow";

export default function AccountScreen() {
  return (
    <main className="app-main account-screen">
      <div className="profile">
        <span className="pfp-lg" aria-hidden>AD</span>
        <div>
          <strong>Awa Diallo</strong>
          <p className="muted" style={{ fontSize: ".82rem" }}>awa@kobo.app</p>
        </div>
      </div>
      {SETTINGS.map((group, gi) => (
        <section className="card" key={gi}>
          {group.map((row) => (
            <ListRow key={row.title} Icon={row.Icon} title={row.title} sub={row.sub}>
              <span className="link">{row.action}</span>
            </ListRow>
          ))}
        </section>
      ))}
    </main>
  );
}

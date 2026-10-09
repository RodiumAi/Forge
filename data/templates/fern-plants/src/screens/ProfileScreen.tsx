import "../styles/profile.css";
import { Camera, CircleHelp, CloudSun, Sprout } from "lucide-react";
import ListRow from "../components/ListRow";
import ToggleRow from "../components/ToggleRow";

type Props = {
  reminders: boolean;
  notify: boolean;
  onToggleReminders: () => void;
  onToggleNotify: () => void;
};

export default function ProfileScreen({ reminders, notify, onToggleReminders, onToggleNotify }: Props) {
  return (
    <main className="app-main profile-screen">
      <div className="stat-row">
        <div className="stat"><span className="n">12</span><span className="l">Plants</span></div>
        <div className="stat"><span className="n">7</span><span className="l">Day streak</span></div>
        <div className="stat"><span className="n">94%</span><span className="l">On time</span></div>
      </div>
      <section className="card">
        <ToggleRow title="Watering reminders" sub="Nudge me when a plant is due" on={reminders} onToggle={onToggleReminders} style={{ marginBottom: ".7rem" }} />
        <ToggleRow title="Push notifications" sub="Alerts on this device" on={notify} onToggle={onToggleNotify} />
      </section>
      <section className="card">
        <ListRow icon={CloudSun} title="Light sensor" sub="Measure a spot's brightness"><span className="link">Open</span></ListRow>
        <ListRow icon={Camera} title="Plant identifier" sub="Snap a photo to identify"><span className="link">Scan</span></ListRow>
        <ListRow icon={Sprout} title="Care history" sub="Every watering, logged"><span className="link">View</span></ListRow>
        <ListRow icon={CircleHelp} title="Help & support" sub="Ask our plant guides"><span className="link">Chat</span></ListRow>
      </section>
    </main>
  );
}

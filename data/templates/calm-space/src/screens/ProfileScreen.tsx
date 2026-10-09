import "../styles/profile.css";
import { Bell, Download, Heart, Sparkle } from "lucide-react";
import ListRow from "../components/ListRow";

export default function ProfileScreen() {
  return (
    <main className="app-main profile-screen">
      <section className="card stats">
        <div className="stat"><strong>128</strong><span>minutes</span></div>
        <div className="stat"><strong>12</strong><span>day streak</span></div>
        <div className="stat"><strong>34</strong><span>sessions</span></div>
      </section>
      <section className="card">
        <ListRow icon={Bell} iconSize={20} title="Reminders" sub="Daily calm · 8:00 AM"><span className="link">Edit</span></ListRow>
        <ListRow icon={Download} iconSize={20} title="Downloads" sub="6 sessions offline"><span className="link">Manage</span></ListRow>
        <ListRow icon={Heart} title="Favourites" sub="9 saved sessions"><span className="link">Open</span></ListRow>
        <ListRow icon={Sparkle} title="Calm Space+" sub="Unlock every session"><span className="link">Upgrade</span></ListRow>
      </section>
    </main>
  );
}

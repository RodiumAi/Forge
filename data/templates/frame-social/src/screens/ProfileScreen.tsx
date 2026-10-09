import "../styles/profile.css";
import { Bookmark, LayoutGrid } from "lucide-react";
import { AVA, GALLERY } from "../data";
import PhotoCell from "../components/PhotoCell";
import Ring from "../components/Ring";

export default function ProfileScreen() {
  return (
    <main className="app-main profile-screen">
      <div className="profile-head">
        <Ring ava={AVA.you} index={0} w={200} size="lg" />
        <div className="stats">
          <div><strong>128</strong><span>posts</span></div>
          <div><strong>18.4k</strong><span>followers</span></div>
          <div><strong>312</strong><span>following</span></div>
        </div>
      </div>
      <div className="profile-bio">
        <strong>Leo Rey</strong>
        <p className="muted">Film photographer · Casablanca ↔ everywhere. Chasing soft light and good coffee.</p>
      </div>
      <div className="profile-cta">
        <button className="btn-line">Edit profile</button>
        <button className="btn-line">Share</button>
      </div>
      <div className="grid-tabs" aria-hidden>
        <span className="gt active"><LayoutGrid size={20} strokeWidth={1.7} fill="currentColor" /></span>
        <span className="gt"><Bookmark size={22} strokeWidth={1.8} /></span>
      </div>
      <div className="grid profile-grid">
        {GALLERY.map((id, i) => (
          <PhotoCell key={id + i} id={id} index={i} w={400} />
        ))}
      </div>
    </main>
  );
}

import { Bell } from "lucide-react";

export default function Topbar() {
  return (
    <header className="topbar">
      <input className="search" type="search" placeholder="Search orders, customers..." />
      <div className="top-actions">
        <span className="bell" title="Notifications"><Bell size={18} strokeWidth={1.7} aria-hidden="true" /></span>
        <span className="avatar">
          <img
            src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=70"
            alt="Portrait of the signed-in user"
            loading="lazy"
          />
        </span>
      </div>
    </header>
  );
}

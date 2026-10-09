import { Box, ChartNoAxesColumn, CreditCard, LayoutDashboard, Settings, Users } from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Box, label: "Orders", active: false },
  { icon: Users, label: "Customers", active: false },
  { icon: ChartNoAxesColumn, label: "Reports", active: false },
  { icon: CreditCard, label: "Billing", active: false },
  { icon: Settings, label: "Settings", active: false },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="side-brand">
        <span className="side-dot"></span> Vantage Ops
      </div>
      <nav className="side-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <a key={item.label} href="#" className={item.active ? "side-link active" : "side-link"}>
              <span className="side-icon"><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></span>
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="side-foot">v0.0.1 &middot; demo data</div>
    </aside>
  );
}

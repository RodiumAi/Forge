const navItems = [
  { icon: "◧", label: "Overview", active: true },
  { icon: "📦", label: "Orders", active: false },
  { icon: "👥", label: "Customers", active: false },
  { icon: "📈", label: "Reports", active: false },
  { icon: "💳", label: "Billing", active: false },
  { icon: "⚙", label: "Settings", active: false },
];

const kpis = [
  { label: "Monthly revenue", value: "$84,210", delta: "+12.4%", up: true },
  { label: "Active customers", value: "3,482", delta: "+5.1%", up: true },
  { label: "Open tickets", value: "127", delta: "-8.3%", up: false },
  { label: "Avg. response time", value: "2h 14m", delta: "-14.0%", up: false },
];

const bars = [
  { month: "Jan", h: 42 }, { month: "Feb", h: 55 }, { month: "Mar", h: 48 },
  { month: "Apr", h: 63 }, { month: "May", h: 71 }, { month: "Jun", h: 58 },
  { month: "Jul", h: 80 }, { month: "Aug", h: 74 }, { month: "Sep", h: 88 },
  { month: "Oct", h: 66 }, { month: "Nov", h: 92 }, { month: "Dec", h: 97 },
];

const avatarPool = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=70",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=70",
];

const orders = [
  { id: "#4821", customer: "Mira Solvang", plan: "Growth", amount: "$490", status: "Paid" },
  { id: "#4820", customer: "Teo Barasso", plan: "Starter", amount: "$190", status: "Pending" },
  { id: "#4819", customer: "Ines Kaldwell", plan: "Scale", amount: "$1,290", status: "Paid" },
  { id: "#4818", customer: "Rowan Petek", plan: "Growth", amount: "$490", status: "Failed" },
  { id: "#4817", customer: "Lena Duraiv", plan: "Starter", amount: "$190", status: "Paid" },
  { id: "#4816", customer: "Omar Fenwick", plan: "Scale", amount: "$1,290", status: "Pending" },
];

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="side-brand">
          <span className="side-dot"></span> Vantage Ops
        </div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <a key={item.label} href="#" className={item.active ? "side-link active" : "side-link"}>
              <span className="side-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="side-foot">v0.0.1 &middot; demo data</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <input className="search" type="search" placeholder="Search orders, customers..." />
          <div className="top-actions">
            <span className="bell" title="Notifications">🔔</span>
            <span className="avatar">
              <img
                src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=70"
                alt="Portrait of the signed-in user"
                loading="lazy"
              />
            </span>
          </div>
        </header>

        <main className="content">
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">Here&apos;s what happened across your workspace this month.</p>

          <section className="kpi-grid">
            {kpis.map((k) => (
              <article key={k.label} className="kpi-card">
                <span className="kpi-label">{k.label}</span>
                <span className="kpi-value">{k.value}</span>
                <span className={k.up ? "kpi-delta up" : "kpi-delta down"}>{k.delta} vs last month</span>
              </article>
            ))}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Revenue by month</h2>
              <span className="panel-tag">2026</span>
            </div>
            <div className="chart">
              {bars.map((b) => (
                <div key={b.month} className="chart-col">
                  <div className="chart-bar" style={{ height: `${b.h}%` }}></div>
                  <span className="chart-label">{b.month}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Recent orders</h2>
              <a className="panel-link" href="#">View all</a>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th><th>Customer</th><th>Plan</th><th>Amount</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id}>
                    <td className="mono">{o.id}</td>
                    <td>
                      <span className="customer-cell">
                        <img
                          className="table-avatar"
                          src={avatarPool[i % avatarPool.length]}
                          alt={`Portrait of ${o.customer}`}
                          loading="lazy"
                        />
                        {o.customer}
                      </span>
                    </td>
                    <td>{o.plan}</td>
                    <td>{o.amount}</td>
                    <td><span className={`status status-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </div>
  );
}

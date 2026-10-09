const bars = [
  { month: "Jan", h: 42 }, { month: "Feb", h: 55 }, { month: "Mar", h: 48 },
  { month: "Apr", h: 63 }, { month: "May", h: 71 }, { month: "Jun", h: 58 },
  { month: "Jul", h: 80 }, { month: "Aug", h: 74 }, { month: "Sep", h: 88 },
  { month: "Oct", h: 66 }, { month: "Nov", h: 92 }, { month: "Dec", h: 97 },
];

export default function RevenueChart() {
  return (
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
  );
}

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

export default function OrdersTable() {
  return (
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
  );
}

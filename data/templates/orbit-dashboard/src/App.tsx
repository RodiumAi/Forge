import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import PageHeader from "./components/PageHeader";
import KpiGrid from "./components/KpiGrid";
import RevenueChart from "./components/RevenueChart";
import OrdersTable from "./components/OrdersTable";
import "./styles/home.css";

export default function App() {
  return (
    <div className="home-screen">
      <div className="shell">
        <Sidebar />
        <div className="main">
          <Topbar />
          <main className="content">
            <PageHeader />
            <KpiGrid />
            <RevenueChart />
            <OrdersTable />
          </main>
        </div>
      </div>
    </div>
  );
}

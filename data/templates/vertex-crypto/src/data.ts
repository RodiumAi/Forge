import { Bot, CreditCard, Eye, Landmark, Lock, Shield, Smartphone, Snowflake, TrendingUp, Waves } from "lucide-react";

export const TICKERS = [
  { sym: "BTC", name: "Bitcoin", price: "$97,412.50", change: "+2.34%", up: true, spark: [42, 48, 45, 52, 58, 55, 63, 68, 64, 72, 78, 82] },
  { sym: "ETH", name: "Ethereum", price: "$3,486.20", change: "+1.87%", up: true, spark: [55, 52, 58, 54, 60, 65, 62, 68, 66, 71, 69, 74] },
  { sym: "SOL", name: "Solana", price: "$212.84", change: "-0.92%", up: false, spark: [72, 68, 70, 64, 66, 60, 63, 58, 61, 55, 58, 52] },
  { sym: "AVAX", name: "Avalanche", price: "$41.16", change: "+4.61%", up: true, spark: [38, 42, 40, 48, 46, 54, 58, 55, 62, 68, 72, 79] },
];

export const STATS = [
  { value: "$14.2B", label: "30-day trading volume" },
  { value: "3.8M", label: "verified traders" },
  { value: "0.02%", label: "maker fee, flat" },
  { value: "7ms", label: "median order execution" },
];

export const FEATURES = [
  {
    icon: TrendingUp,
    title: "Pro-grade execution",
    text: "Our matching engine clears 1.2M orders per second with 7ms median latency. Colocated nodes in Frankfurt, Tokyo and Virginia.",
  },
  {
    icon: Waves,
    title: "Deep liquidity",
    text: "Aggregated books across 18 venues. BTC/USDT spread of 0.8bps on average — tighter than any single exchange.",
  },
  {
    icon: Bot,
    title: "Automation API",
    text: "REST + WebSocket + FIX. Backtest strategies against 6 years of tick data, then deploy with one endpoint change.",
  },
  {
    icon: CreditCard,
    title: "Instant on-ramp",
    text: "Buy crypto with SEPA, ACH, cards and Apple Pay in 34 currencies. Funds tradeable in under 60 seconds.",
  },
];

export const VOLUME_BARS = [34, 52, 41, 68, 55, 74, 62, 88, 71, 95, 83, 100];

export const EXTRA_FEATURES = [
  {
    icon: Snowflake,
    title: "Cold-storage vaults",
    text: "Withdraw straight to institutional-grade custody. Free vault transfers, 24h time-locked releases, no counterparty games.",
  },
  {
    icon: Smartphone,
    title: "One app, every market",
    text: "Spot, perpetuals, options and staking in a single portfolio view. Rated 4.8 across 210k App Store reviews.",
  },
];

export const SECURITY = [
  { icon: Shield, title: "95% cold storage", text: "Client assets held in geographically distributed, air-gapped vaults with multi-party computation signing." },
  { icon: Landmark, title: "Regulated & audited", text: "Licensed under MiCA (EU) and registered with FinCEN. Quarterly proof-of-reserves attested by Hartmann LLP." },
  { icon: Lock, title: "$500M insurance", text: "Custodial assets covered against theft and infrastructure failure through a syndicate led by Lloyd's of London." },
  { icon: Eye, title: "Real-time monitoring", text: "ML-driven anomaly detection reviews every withdrawal. Suspicious flows frozen in under 300ms." },
];

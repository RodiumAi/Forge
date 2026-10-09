import { Bell, CreditCard, Heart, House, Package } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "trove_onboard_done";

export const SLIDES = [
  { kicker: "Welcome", title: "Curated finds, daily", body: "A hand-picked market of makers and small labels. Trove keeps the good stuff up front." },
  { kicker: "Checkout", title: "Buy it in two taps", body: "Saved cards and one-tap address. No forms, no friction — just your order on its way." },
  { kicker: "After the buy", title: "Track every parcel", body: "Live delivery updates, easy returns, and a wishlist that remembers what you loved." },
];

export type Tab = "home" | "search" | "cart" | "account";

export type Cart = Record<string, number>;

export type Product = {
  id: string; name: string; label: string; price: number;
  img: string; grad: string;
};

export const PRODUCTS: Product[] = [
  { id: "watch", name: "Heirloom Watch", label: "Tech · Kestrel Co.", price: 189, img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fed7aa,#fdba74)" },
  { id: "runner", name: "Trail Runner", label: "Style · Mesa Athletic", price: 120, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#ffedd5,#fb923c)" },
  { id: "tee", name: "Garment-Dyed Tee", label: "Style · Loom & Co.", price: 34, img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fef3c7,#fcd34d)" },
  { id: "overshirt", name: "Wool Overshirt", label: "Style · North Field", price: 96, img: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=600&q=70", grad: "linear-gradient(135deg,#fde68a,#f59e0b)" },
];

export const AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=70";

export const CHIPS = ["New", "Home", "Style", "Tech", "Gifts"];
export const TRENDING = ["Linen shirts", "Ceramic mugs", "Desk lamps", "Vintage watches", "Wool socks"];

export const ACCOUNT_LINKS: { Icon: LucideIcon; size: number; title: string; sub: string; action: string }[] = [
  { Icon: Package, size: 18, title: "Orders", sub: "2 on the way · 14 delivered", action: "Track" },
  { Icon: House, size: 18, title: "Addresses", sub: "Home · Studio", action: "Edit" },
  { Icon: CreditCard, size: 18, title: "Payment", sub: "Visa •••• 4417", action: "Manage" },
  { Icon: Heart, size: 18, title: "Wishlist", sub: "9 saved items", action: "Open" },
  { Icon: Bell, size: 20, title: "Notifications", sub: "Drops & delivery updates", action: "Set" },
];

export const money = (n: number) => "$" + n.toLocaleString("en-US");

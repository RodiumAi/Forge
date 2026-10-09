const U = (id: string, w: number, extra = "") =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70${extra}`;

export type Product = { name: string; cat: string; price: string; old: string; g: string; img: string; alt: string };

export const heroImage = U("photo-1434389677669-e08b4cac3105", 1200);

export const popular: Product[] = [
  { name: "Heritage Chrono Watch", cat: "Accessories", price: "$129.00", old: "$159.00", g: "linear-gradient(135deg,#d6c9b8,#8a7a63)", img: U("photo-1523275335684-37898b6baf30", 800), alt: "Minimalist wristwatch with a tan leather strap" },
  { name: "Court Classic Sneaker", cat: "Men", price: "$74.00", old: "", g: "linear-gradient(135deg,#e8d5d0,#b08a80)", img: U("photo-1542291026-7eec264c27ff", 800), alt: "Red and white running sneaker on a red background" },
  { name: "Organic Cotton Tee", cat: "Women", price: "$24.50", old: "$32.00", g: "linear-gradient(135deg,#cfd8dc,#78909c)", img: U("photo-1521572163474-6864f9cf17ab", 800), alt: "Plain white cotton t-shirt on a hanger" },
  { name: "Studio Over-Ear Headphones", cat: "Accessories", price: "$89.00", old: "", g: "linear-gradient(135deg,#e0dcd3,#9c9484)", img: U("photo-1505740420928-5e560c06d30e", 800), alt: "Black over-ear wireless headphones" },
];

export const latest: Product[] = [
  { name: "Waxed Field Jacket", cat: "Men", price: "$118.00", old: "$140.00", g: "linear-gradient(135deg,#f2e2c4,#c9a15a)", img: U("photo-1591047139829-d91aecb6caea", 800), alt: "Man wearing a dark waxed canvas jacket" },
  { name: "Capsule Wardrobe Set", cat: "Women", price: "$96.00", old: "", g: "linear-gradient(135deg,#c8d6c4,#6e8a68)", img: U("photo-1434389677669-e08b4cac3105", 800), alt: "Rack of neutral-toned garments on wooden hangers" },
  { name: "Heritage Chrono, Steel", cat: "Accessories", price: "$139.00", old: "$165.00", g: "linear-gradient(135deg,#d8c4b4,#7d5a44)", img: U("photo-1523275335684-37898b6baf30", 800, "&crop=entropy"), alt: "Close crop of a leather-strap wristwatch" },
  { name: "Court Classic, Crimson", cat: "Men", price: "$79.50", old: "", g: "linear-gradient(135deg,#c4d4e4,#5a7a9c)", img: U("photo-1542291026-7eec264c27ff", 800, "&crop=entropy"), alt: "Detail crop of a red sneaker sole" },
];

export const categories = [
  { label: "Men", g: "linear-gradient(160deg,#374151,#111827)", img: U("photo-1521572163474-6864f9cf17ab", 800), alt: "White t-shirt on a hanger" },
  { label: "Women", g: "linear-gradient(160deg,#9a6a5a,#5a3a30)", img: U("photo-1591047139829-d91aecb6caea", 800), alt: "Person wearing a dark field jacket" },
  { label: "Accessories", g: "linear-gradient(160deg,#8a7a52,#4a4028)", img: U("photo-1505740420928-5e560c06d30e", 800), alt: "Black over-ear headphones" },
];

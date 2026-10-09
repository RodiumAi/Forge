export const ONBOARD_KEY = "frame_onboard_done";

export type Tab = "feed" | "explore" | "create" | "profile";

const U = "https://images.unsplash.com/";
export function photo(id: string, w: number) {
  return `${U}${id}?auto=format&fit=crop&w=${w}&q=70`;
}

export const AVA = {
  you: "photo-1500648767791-00dcc994a43e",
  maya: "photo-1494790108377-be9c29b29330",
  noor: "photo-1438761681033-6461ffad8d80",
};

export const SLIDES = [
  { kicker: "Welcome", title: "Share the moment", body: "Post the photo you actually love. Frame keeps your feed about people, not noise." },
  { kicker: "Discover", title: "Find your people", body: "Explore hand-picked photos and follow the creators who make your day brighter." },
  { kicker: "Stories", title: "Here for 24 hours", body: "Drop a story that vanishes tomorrow. Low pressure, all play." },
];

export const TITLES: Record<Tab, string> = { feed: "Frame", explore: "Explore", create: "New post", profile: "leo.rey" };

export const STORIES = [
  { name: "You", ava: AVA.you, me: true },
  { name: "maya", ava: AVA.maya },
  { name: "noor", ava: AVA.noor },
  { name: "leo", ava: AVA.you },
  { name: "ines", ava: AVA.maya },
  { name: "sam", ava: AVA.noor },
];

export type Post = {
  user: string;
  ava: string;
  time: string;
  photo: string;
  likes: string;
  caption: string;
  tag: string;
};

export const POSTS: Post[] = [
  { user: "maya.k", ava: AVA.maya, time: "2h", photo: "photo-1504674900247-0877df9cc836", likes: "1,204", caption: "Sunday plates, slow morning. Recipe soon.", tag: "Marrakech" },
  { user: "noor.travels", ava: AVA.noor, time: "5h", photo: "photo-1464822759023-fed622ff2c3b", likes: "3,872", caption: "Above the clouds again. This ridge never gets old.", tag: "Chefchaouen" },
  { user: "studio.leo", ava: AVA.you, time: "8h", photo: "photo-1523275335684-37898b6baf30", likes: "642", caption: "New drop, shot on film. Which colourway? 1 or 2?", tag: "The Studio" },
];

export const EXPLORE = [
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1500648767791-00dcc994a43e",
  "photo-1494790108377-be9c29b29330",
  "photo-1438761681033-6461ffad8d80",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
];

export const GALLERY = [
  "photo-1500648767791-00dcc994a43e",
  "photo-1523275335684-37898b6baf30",
  "photo-1504674900247-0877df9cc836",
  "photo-1464822759023-fed622ff2c3b",
  "photo-1438761681033-6461ffad8d80",
  "photo-1494790108377-be9c29b29330",
];

const FALLBACKS = [
  "linear-gradient(135deg, #ede9fe, #c4b5fd)",
  "linear-gradient(135deg, #fce7f3, #fbcfe8)",
  "linear-gradient(135deg, #dbeafe, #bfdbfe)",
  "linear-gradient(135deg, #fef3c7, #fde68a)",
  "linear-gradient(135deg, #d1fae5, #a7f3d0)",
  "linear-gradient(135deg, #ffe4e6, #fecdd3)",
];
export function fb(i: number) {
  return FALLBACKS[i % FALLBACKS.length];
}

/* +1 like when you tap the heart: keeps the count honest without a backend. */
export function incr(likes: string): string {
  const n = Number(likes.replace(/,/g, ""));
  if (!Number.isFinite(n)) return likes;
  return (n + 1).toLocaleString("en-US");
}

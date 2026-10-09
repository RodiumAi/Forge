export const ONBOARD_KEY = "echo_onboard_done";

export const SLIDES = [
  { kicker: "Welcome", title: "Your sound, uninterrupted", body: "Millions of tracks, zero clutter. Echo learns what you love and keeps it one tap away." },
  { kicker: "Offline", title: "Take your mixes offline", body: "Download playlists for the flight, the tunnel, the dead zone. The music never stops." },
  { kicker: "Lossless", title: "Hear every last detail", body: "Studio-grade lossless audio so the hi-hats shimmer and the bass actually lands." },
];

export type Tab = "home" | "search" | "library" | "now";
export type Track = { title: string; artist: string; g1: string; g2: string };

export const TITLES: Record<Tab, string> = { home: "Echo", search: "Search", library: "Your Library", now: "Now Playing" };
export const SUBS: Record<Tab, string> = { home: "Good evening, Maya", search: "Find your next favourite", library: "Recently added", now: "From Neon Tide" };

export const ALBUMS: Track[] = [
  { title: "Neon Tide", artist: "Nadi Vaal", g1: "#ec4899", g2: "#6d28d9" },
  { title: "Slow Static", artist: "Kite Season", g1: "#3b82f6", g2: "#0e7490" },
  { title: "Midnight Bloom", artist: "Nadi Vaal", g1: "#f97316", g2: "#be123c" },
  { title: "Paper Moons", artist: "Solene", g1: "#22d3ee", g2: "#4338ca" },
  { title: "Dust & Gold", artist: "Kite Season", g1: "#eab308", g2: "#7c2d12" },
];

export const PLAYLISTS = [
  { title: "Daily Mix 1", sub: "Nadi Vaal · Solene · Kite Season", g1: "#ec4899", g2: "#831843" },
  { title: "Late Night Drive", sub: "Synthwave · 42 tracks", g1: "#6366f1", g2: "#0c0a2e" },
  { title: "Focus Flow", sub: "Instrumental · 3 hr", g1: "#14b8a6", g2: "#134e4a" },
];

export const GENRES = [
  { name: "Pop", g1: "#ec4899", g2: "#7c3aed" },
  { name: "Hip-Hop", g1: "#f59e0b", g2: "#b91c1c" },
  { name: "Chill", g1: "#22d3ee", g2: "#1e3a8a" },
  { name: "Electronic", g1: "#a855f7", g2: "#1e1b4b" },
  { name: "Jazz", g1: "#f97316", g2: "#78350f" },
  { name: "Indie", g1: "#34d399", g2: "#065f46" },
  { name: "R&B", g1: "#fb7185", g2: "#4c1d95" },
  { name: "Workout", g1: "#38bdf8", g2: "#0f766e" },
];

export const LIBRARY = [
  { title: "Liked Songs", sub: "Playlist · 128 songs", g1: "#ec4899", g2: "#4c1d95", pinned: true },
  { title: "Nadi Vaal", sub: "Artist", g1: "#f97316", g2: "#be123c", round: true },
  { title: "Neon Tide", sub: "Album · Nadi Vaal", g1: "#ec4899", g2: "#6d28d9" },
  { title: "Late Night Drive", sub: "Playlist · 42 tracks", g1: "#6366f1", g2: "#0c0a2e" },
  { title: "Kite Season", sub: "Artist", g1: "#3b82f6", g2: "#0e7490", round: true },
  { title: "Paper Moons", sub: "Album · Solene", g1: "#22d3ee", g2: "#4338ca" },
];

/** Album / genre cover drawn as a CSS gradient (no image files). */
export function cover(g1: string, g2: string): string {
  return `radial-gradient(120% 120% at 20% 12%, ${g1}, transparent 60%), linear-gradient(150deg, ${g2}, #17121f 82%)`;
}

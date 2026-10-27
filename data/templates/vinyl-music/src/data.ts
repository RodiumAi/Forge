export const ONBOARD_KEY = "vinyl_onboard_done";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

/** 214 -> "3:34" */
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const ME = {
  first: "Kemi",
  name: "Kemi Adeyemi",
  handle: "@kemi.loops",
  avatar: img("photo-1534528741775-53994a69daeb", 160),
  followers: 1284,
  following: 316,
  minutes: 18420,
};

export const SLIDES = [
  { kicker: "Welcome to Vinyl", title: "Music that spins with your mood", body: "Afrobeats at dawn, jazz at midnight. Millions of tracks, zero ads, lossless when you want it." },
  { kicker: "Made for you", title: "Mixes that learn your taste", body: "Daily mixes, fresh drops from artists you follow and a radio that never repeats itself." },
  { kicker: "Take it anywhere", title: "Offline, crossfaded, yours", body: "Download playlists, keep listening on the subway and pick up on any device." },
];

export type Album = { id: string; title: string; artist: string; year: number; genre: string; cover: string; tint: string };

export const ALBUMS: Album[] = [
  { id: "harmattan", title: "Midnight Harmattan", artist: "Ayra Sol", year: 2026, genre: "Afro-pop", cover: img("photo-1504898770365-14faca6a7320"), tint: "#ff3d7f" },
  { id: "lagoon", title: "Neon Lagoon", artist: "Kofi Blaze", year: 2026, genre: "Afrobeats", cover: img("photo-1470225620780-dba8ba36b745"), tint: "#7b5cff" },
  { id: "velvet", title: "Velvet Static", artist: "Lune Moreau", year: 2025, genre: "Alt R&B", cover: img("photo-1541701494587-cb58502866ab"), tint: "#ff5a4e" },
  { id: "prism", title: "Prism", artist: "NOVAA", year: 2026, genre: "Electronic", cover: img("photo-1618005182384-a83a8bd57fbe"), tint: "#8f6bff" },
  { id: "tapes", title: "Low Tide Tapes", artist: "Sade Okoro", year: 2025, genre: "Lo-fi", cover: img("photo-1494232410401-ad00d5433cfa"), tint: "#e9d9b0" },
  { id: "goldcoast", title: "Gold Coast Nights", artist: "The Accra Collective", year: 2024, genre: "Highlife jazz", cover: img("photo-1415201364774-f6f0bb35f28f"), tint: "#ffb23e" },
  { id: "lanterns", title: "Paper Lanterns", artist: "Inès Kaba", year: 2026, genre: "Indie", cover: img("photo-1557672172-298e090bd0f1"), tint: "#ff9ccf" },
];

export const albumById = (id: string | undefined) => ALBUMS.find((a) => a.id === id);

export type Track = { id: string; title: string; albumId: string; duration: number; plays: string };

export const TRACKS: Track[] = [
  { id: "t1", title: "Slow Burn Lagos", albumId: "harmattan", duration: 214, plays: "12.4M" },
  { id: "t2", title: "Harmattan Kiss", albumId: "harmattan", duration: 198, plays: "8.9M" },
  { id: "t3", title: "Third Mainland", albumId: "harmattan", duration: 231, plays: "6.1M" },
  { id: "t4", title: "Ojuelegba Rain", albumId: "harmattan", duration: 187, plays: "4.7M" },
  { id: "t5", title: "Dust & Gold", albumId: "harmattan", duration: 246, plays: "3.2M" },
  { id: "t6", title: "Neon Lagoon", albumId: "lagoon", duration: 205, plays: "21.8M" },
  { id: "t7", title: "Calabash", albumId: "lagoon", duration: 192, plays: "9.3M" },
  { id: "t8", title: "Keta Sunrise", albumId: "lagoon", duration: 224, plays: "5.6M" },
  { id: "t9", title: "Static Hearts", albumId: "velvet", duration: 233, plays: "7.7M" },
  { id: "t10", title: "Satin Hours", albumId: "velvet", duration: 201, plays: "4.1M" },
  { id: "t11", title: "Refraction", albumId: "prism", duration: 262, plays: "11.0M" },
  { id: "t12", title: "Violet Hour", albumId: "prism", duration: 239, plays: "6.8M" },
  { id: "t13", title: "Low Tide", albumId: "tapes", duration: 168, plays: "3.9M" },
  { id: "t14", title: "Osu Night Market", albumId: "goldcoast", duration: 284, plays: "2.6M" },
  { id: "t15", title: "Paper Lanterns", albumId: "lanterns", duration: 211, plays: "5.2M" },
];

export const trackById = (id: string | undefined) => TRACKS.find((t) => t.id === id);
export const tracksOf = (albumId: string) => TRACKS.filter((t) => t.albumId === albumId);
export const coverOf = (t: Track) => albumById(t.albumId)?.cover ?? "";
export const artistOf = (t: Track) => albumById(t.albumId)?.artist ?? "";

/** Lyrics of the first track, shown as a peek on Now Playing. */
export const LYRICS = [
  "Streetlights humming on the bridge tonight",
  "You said the city sleeps, it never does",
  "Slow burn, Lagos, keep me in your light",
  "Every red horizon sounds like us",
];

export type Playlist = { id: string; name: string; meta: string; cover: string; albumId: string };

export const PLAYLISTS: Playlist[] = [
  { id: "p1", name: "Afro Chill Mix", meta: "Made for Kemi · 50 songs", cover: img("photo-1508700115892-45ecd05ae2ad", 300), albumId: "harmattan" },
  { id: "p2", name: "Late Night Drive", meta: "Playlist · 34 songs", cover: img("photo-1539375665275-f9de415ef9ac", 300), albumId: "velvet" },
  { id: "p3", name: "Focus Flow", meta: "Playlist · 62 songs", cover: img("photo-1520523839897-bd0b52f945a0", 300), albumId: "tapes" },
  { id: "p4", name: "Sunday Highlife", meta: "Playlist · 28 songs", cover: img("photo-1459749411175-04bf5292ceea", 300), albumId: "goldcoast" },
  { id: "p5", name: "Gym Heat", meta: "Playlist · 41 songs", cover: img("photo-1524368535928-5b5e00ddc76b", 300), albumId: "lagoon" },
];

export const ARTISTS = [
  { id: "a1", name: "Ayra Sol", photo: img("photo-1531123897727-8f129e1688ce", 300), listeners: "4.2M monthly" },
  { id: "a2", name: "Kofi Blaze", photo: img("photo-1507003211169-0a1dd7228f2d", 300), listeners: "6.8M monthly" },
  { id: "a3", name: "Lune Moreau", photo: img("photo-1524504388940-b1c1722653e1", 300), listeners: "2.1M monthly" },
  { id: "a4", name: "Sade Okoro", photo: img("photo-1494790108377-be9c29b29330", 300), listeners: "1.4M monthly" },
  { id: "a5", name: "NOVAA", photo: img("photo-1517841905240-472988babdf9", 300), listeners: "3.3M monthly" },
];

export const GENRES = [
  { name: "Afrobeats", from: "#ff3d7f", to: "#ff8a3d", cover: img("photo-1514525253161-7a46d19cd819", 200) },
  { name: "Amapiano", from: "#7b5cff", to: "#3d8bff", cover: img("photo-1470225620780-dba8ba36b745", 200) },
  { name: "R&B", from: "#c2185b", to: "#6a1b9a", cover: img("photo-1511671782779-c97d3d27a1d4", 200) },
  { name: "Jazz", from: "#ffb23e", to: "#d9480f", cover: img("photo-1415201364774-f6f0bb35f28f", 200) },
  { name: "Lo-fi", from: "#2bb5a0", to: "#2d6cdf", cover: img("photo-1494232410401-ad00d5433cfa", 200) },
  { name: "Electronic", from: "#8f6bff", to: "#ff3d7f", cover: img("photo-1618005182384-a83a8bd57fbe", 200) },
  { name: "Highlife", from: "#f5a524", to: "#2f9e44", cover: img("photo-1459749411175-04bf5292ceea", 200) },
  { name: "Rock", from: "#e03131", to: "#343a40", cover: img("photo-1510915361894-db8b60106cb1", 200) },
];

export const RECENT_SEARCHES = ["Ayra Sol", "amapiano 2026", "Neon Lagoon", "highlife classics"];

export type Tab = "home" | "search" | "library" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", search: "/search", library: "/library", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Vinyl", search: "Search", library: "Library", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}

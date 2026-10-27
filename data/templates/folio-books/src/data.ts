export const ONBOARD_KEY = "folio_onboard_done";

const img = (id: string, w = 160) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Adjoa",
  name: "Adjoa Mensah",
  since: "Reading with Folio since 2021",
  avatar: img("photo-1573496359142-b8d87734a5a2"),
};

/** A cover is either a photo with the title set on it, or a typographic cover. */
export type Cover =
  | { kind: "photo"; src: string; tint: string }
  | { kind: "type"; bg: string; ink: string; motif: "sun" | "lines" | "arch" | "wave" };

export type Book = {
  id: string;
  title: string;
  author: string;
  genre: string;
  cover: Cover;
  rating: number;
  reviews: string;
  pages: number;
  audio: string;
  year: number;
  synopsis: string;
  opening: string;
  chapters: { title: string; minutes: number }[];
};

const chapters = (titles: string[]) => titles.map((title, i) => ({ title, minutes: 18 + ((i * 7) % 15) }));

export const BOOKS: Book[] = [
  {
    id: "harmattan", title: "Harmattan", author: "Kossi Amedzro", genre: "Literary",
    cover: { kind: "photo", src: img("photo-1516026672322-bc52d61a55d5", 600), tint: "#5a2a18" },
    rating: 4.6, reviews: "12.4k", pages: 284, audio: "9 h 12 min", year: 2025,
    synopsis: "Every December the dry wind comes down from the Sahara and covers Atakpamé in fine red dust. The year Afi turns seventeen, it also brings back her father, gone for nine years, with a suitcase he refuses to open. A tender, luminous novel about the weather inside families, and the stories we only tell when the air is too thick to see each other's faces.",
    opening: "",
    chapters: chapters(["The first dust", "A suitcase on the veranda", "Market day in Atakpamé", "What the radio said", "Afi learns to drive", "Letters in the flour tin", "The long night", "When the rains come back"]),
  },
  {
    id: "salt-road", title: "The Salt Road", author: "Mariam Touré", genre: "History",
    cover: { kind: "photo", src: img("photo-1509316785289-025f5b846b35", 600), tint: "#6b3418" },
    rating: 4.4, reviews: "8.1k", pages: 412, audio: "13 h 40 min", year: 2024,
    synopsis: "In 1352 a young scribe joins a caravan carrying salt from Taghaza to Timbuktu, charged with recording every bargain made on the way. Touré rebuilds the great trans-Saharan trade through one notebook, three camels and a merchant who lies about everything except the stars.",
    opening: "The caravan left Taghaza before dawn, when the salt slabs still held the cold of the night. Bakary counted them twice, as the merchant had asked, and wrote the number at the top of a clean page: four hundred and twelve. By noon he would learn that the merchant had already sold forty of them to a man who did not exist.",
    chapters: chapters(["Taghaza", "The scribe's notebook", "Water at Ouallen", "A merchant's stars", "Sand that sings", "Timbuktu at last"]),
  },
  {
    id: "rain-grammar", title: "A Small Grammar of Rain", author: "Léa Fontaine", genre: "Poetry",
    cover: { kind: "type", bg: "#2f4a3a", ink: "#f1e6cf", motif: "lines" },
    rating: 4.8, reviews: "3.2k", pages: 96, audio: "1 h 48 min", year: 2023,
    synopsis: "Sixty short poems written over a single rainy season in Lyon, each named after a verb. Quiet, exact and surprisingly funny, a book to read one page at a time with the window open.",
    opening: "To fall is the first verb the rain learns. / The second is to return. / Between the two, a whole city / holds its umbrellas like questions / and waits to be answered.",
    chapters: chapters(["To fall", "To gather", "To overflow", "To return", "To dry"]),
  },
  {
    id: "night-ferry", title: "Night Ferry to Lomé", author: "Yaw Mensah", genre: "Mystery",
    cover: { kind: "photo", src: img("photo-1534447677768-be436bb09401", 600), tint: "#0f1d33" },
    rating: 4.3, reviews: "21.7k", pages: 336, audio: "10 h 05 min", year: 2025,
    synopsis: "Forty passengers board the overnight ferry from Lagos. Thirty-nine step off in Lomé. Inspector Esi Boateng has until the next sailing to find out which of them was never really there.",
    opening: "The ferry left Lagos at ten past eleven, twenty minutes late, which Esi would later write down as the first lie of the night. She counted the passengers from the upper deck: forty heads, forty tickets, one man in a white suit who did not look at the sea once.",
    chapters: chapters(["Ten past eleven", "The man in the white suit", "Cabin 14", "Dead calm", "Landfall"]),
  },
  {
    id: "cartographer", title: "The Cartographer's Daughter", author: "Inès Marchetti", genre: "History",
    cover: { kind: "type", bg: "#9c3d2e", ink: "#f7f1e6", motif: "arch" },
    rating: 4.5, reviews: "15.9k", pages: 368, audio: "11 h 20 min", year: 2022,
    synopsis: "Genoa, 1489. Caterina draws the maps her father signs, until a commission from Lisbon asks for a coastline nobody has ever seen. A sweeping story of ink, ambition and the edges of the known world.",
    opening: "Her father liked to say that a map is a promise made by someone who has never been there. Caterina, who had drawn every one of his promises since she was twelve, thought it was more like a confession.",
    chapters: chapters(["Genoa", "The blank edge", "A letter from Lisbon", "Salt and vellum", "The coast that wasn't", "Home port"]),
  },
  {
    id: "fog-keeps", title: "What the Fog Keeps", author: "Elias Brandt", genre: "Mystery",
    cover: { kind: "photo", src: img("photo-1505765050516-f72dcac9c60e", 600), tint: "#1f2a30" },
    rating: 4.2, reviews: "6.4k", pages: 298, audio: "8 h 55 min", year: 2024,
    synopsis: "A mountain hotel closed for the winter, a caretaker who keeps too careful a logbook, and a hiker who arrives on the one night the road is cut. Atmospheric, slow burning and very hard to put down.",
    opening: "The road closed at four, as it did every year on the first of December, and Matthias wrote it in the logbook in his small square hand. At nine there was a knock at the door. The hotel had been empty for six weeks.",
    chapters: chapters(["The last bus", "Logbook", "Room 9", "Whiteout", "The thaw"]),
  },
  {
    id: "ordinary-light", title: "Ordinary Light", author: "Nadia Okafor", genre: "Essays",
    cover: { kind: "type", bg: "#c99a3b", ink: "#231c16", motif: "sun" },
    rating: 4.7, reviews: "9.8k", pages: 212, audio: "6 h 30 min", year: 2025,
    synopsis: "Twelve essays on the small hours of a life: a grandmother's radio in Enugu, a first apartment in Paris, the long patience of learning to swim at forty. Warm, wise and written in sentences you will copy into notebooks.",
    opening: "My grandmother kept her radio on the windowsill so that the news would get some sun. It was the kind of thing she said with a straight face, and the kind of thing I believed for years.",
    chapters: chapters(["The radio on the windowsill", "Rue des Martyrs", "Learning to float", "Ordinary light", "Notes on staying"]),
  },
  {
    id: "quiet-tide", title: "The Quiet Tide", author: "Soren Ahl", genre: "Literary",
    cover: { kind: "photo", src: img("photo-1518837695005-2083093ee35b", 600), tint: "#0e2a33" },
    rating: 4.1, reviews: "4.6k", pages: 256, audio: "7 h 45 min", year: 2023,
    synopsis: "Two estranged sisters return to the island where they grew up to sell their mother's house, and find the tide has been keeping her secrets for them.",
    opening: "The ferry to Fårö ran twice a day in winter, and Ingrid missed the first one on purpose. She wanted to arrive after her sister, so that someone else would open the door.",
    chapters: chapters(["Low water", "The house on the dune", "Mother's letters", "Spring tide", "Ebb"]),
  },
  {
    id: "baobab", title: "Under the Baobab", author: "Fatou Ndiaye", genre: "Literary",
    cover: { kind: "photo", src: img("photo-1547471080-7cc2caa01a7e", 600), tint: "#5c2a12" },
    rating: 4.6, reviews: "7.3k", pages: 184, audio: "5 h 10 min", year: 2024,
    synopsis: "Nine linked stories set around one baobab in a village near Kaolack, told by the people who meet under it across a single, unforgettable year.",
    opening: "Everyone in Ndiobène agreed that the baobab was older than the village, and nobody agreed on anything else about it. That was why they met under it.",
    chapters: chapters(["The oldest tree", "Rains", "The wedding", "Fatou's radio", "Harvest"]),
  },
  {
    id: "ten-thousand", title: "Ten Thousand Mornings", author: "Hugo Lambert", genre: "Essays",
    cover: { kind: "type", bg: "#1f2a44", ink: "#e9d9b0", motif: "wave" },
    rating: 4.3, reviews: "11.2k", pages: 240, audio: "7 h 02 min", year: 2025,
    synopsis: "A former night-shift nurse on what thirty years of dawns taught him about attention, habit and the strange courage of starting again every single day.",
    opening: "I have seen ten thousand mornings arrive through hospital windows, and not one of them was in a hurry. That is the first thing they taught me.",
    chapters: chapters(["Before six", "Shift change", "The kettle", "Small courage", "Daylight"]),
  },
];

export const bookById = (id: string | undefined) => BOOKS.find((b) => b.id === id);

/** The book open in the reader, a few pages of its chapter. */
export const READING = { id: "harmattan", chapter: 4, page: 120 };

export const READER_PAGES: string[][] = [
  [
    "The radio was the only thing in the house that did not mind the dust. It sat on the kitchen shelf between the sugar and the matches, and every morning at six it told Afi the same three things: the price of cocoa in Kpalimé, the temperature in Lomé, and that the harmattan would not be leaving soon.",
    "Her father listened to it with his eyes closed, the way some men pray. He had been back for eleven days and had not once said where he had been. He drank his tea with too much sugar, as he always had, and when he set the cup down he turned it so the handle pointed at the door.",
    "Afi noticed it the first morning and every morning after. It was the kind of thing you only see in someone you have been missing for nine years.",
  ],
  [
    "On the twelfth day the suitcase moved. It had been standing on the veranda since he arrived, brown leather gone pale at the corners, a strip of airline tape still wrapped around the handle. Now it lay on its side under the bench, as if it had grown tired of waiting to be opened.",
    "\"Leave it,\" her mother said, without looking up from the beans. \"Some things are heavier when you carry them inside.\"",
    "So Afi left it. She swept around it in the mornings and watched the red dust settle on its lid in a fine, patient layer, and she began to wonder whether the wind was trying to bury it or to keep it safe.",
  ],
  [
    "The market in Atakpamé was half empty that week. The women who sold cloth had covered their stalls with plastic sheeting, and the colours showed through like something remembered. Afi bought onions, a tin of tomato paste and a newspaper she did not intend to read.",
    "It was Auntie Dédé who stopped her by the fish stalls, a hand on her elbow, a voice pitched low enough to be a secret. \"Your father,\" she said. \"Has he told you about Kumasi?\"",
    "Afi had never heard him say the word. She shook her head, and the old woman let go of her arm as if she had touched something hot.",
  ],
  [
    "That night the wind dropped. For the first time in two weeks Afi could see the hills from her window, black against a sky so clear it looked rinsed. Somewhere below, on the veranda, she heard the soft double click of a suitcase being opened.",
    "She did not go down. She lay very still and listened to her father unpack nine years, one folded thing at a time, and she understood that some stories are told only once, and only to the dark.",
    "In the morning the suitcase was gone, and the radio said the harmattan would be leaving soon.",
  ],
];

export const QUOTE = {
  text: "There is no Frigate like a Book, to take us Lands away.",
  author: "Emily Dickinson",
  source: "Poem 1263, 1873",
};

export const SLIDES = [
  { kicker: "Welcome to Folio", title: "A quiet place for every book you love", body: "Ebooks and audiobooks in one library, with your place saved on every device." },
  { kicker: "Read or listen", title: "Turn the page, or let it be read to you", body: "Switch from text to narration mid-chapter and Folio keeps the exact sentence." },
  { kicker: "Reading goals", title: "Small pages, every day, add up", body: "Set a yearly goal, keep a gentle streak and see the whole year on one shelf." },
];

export const GENRES = ["All", "Literary", "Mystery", "History", "Poetry", "Essays"];

export const TOP_CHARTS = ["night-ferry", "cartographer", "harmattan", "ten-thousand", "ordinary-light", "salt-road", "baobab", "fog-keeps"];

export const PICKS = [
  { id: "rain-grammar", note: "Poems for the rainy season" },
  { id: "baobab", note: "A village in nine voices" },
  { id: "quiet-tide", note: "Slow, salty, gorgeous" },
  { id: "ordinary-light", note: "Essays to underline" },
];

export type Status = "reading" | "want" | "finished";

/** Starting shelf: status and progress (0 to 1) of each book. */
export const SHELF: Record<string, { status: Status; progress: number }> = {
  harmattan: { status: "reading", progress: 0.42 },
  "salt-road": { status: "reading", progress: 0.22 },
  "fog-keeps": { status: "reading", progress: 0.41 },
  "rain-grammar": { status: "want", progress: 0 },
  "quiet-tide": { status: "want", progress: 0 },
  cartographer: { status: "finished", progress: 1 },
  "ordinary-light": { status: "finished", progress: 1 },
  baobab: { status: "finished", progress: 1 },
};

export const COLLECTIONS = [
  { name: "West African voices", count: 14, books: ["harmattan", "baobab", "salt-road"] },
  { name: "Rainy evenings", count: 9, books: ["rain-grammar", "quiet-tide", "fog-keeps"] },
  { name: "Listen on the road", count: 6, books: ["night-ferry", "ten-thousand", "ordinary-light"] },
];

export const FRIENDS = [
  { name: "Kofi", avatar: img("photo-1507003211169-0a1dd7228f2d"), book: "salt-road" },
  { name: "Lina", avatar: img("photo-1544005313-94ddf0286df2"), book: "night-ferry" },
  { name: "Yao", avatar: img("photo-1500648767791-00dcc994a43e"), book: "harmattan" },
  { name: "Sara", avatar: img("photo-1438761681033-6461ffad8d80"), book: "ordinary-light" },
];

export const GOAL = { year: 2026, read: 18, target: 24 };

export const STATS = [
  { label: "Pages read", value: "5 412" },
  { label: "Hours listened", value: "64" },
  { label: "Day streak", value: "23" },
  { label: "Avg. rating", value: "4.4" },
];

export const MONTHS = [
  { m: "J", v: 2 }, { m: "F", v: 1 }, { m: "M", v: 3 }, { m: "A", v: 2 }, { m: "M", v: 1 }, { m: "J", v: 2 },
  { m: "J", v: 3 }, { m: "A", v: 2 }, { m: "S", v: 1 }, { m: "O", v: 1 }, { m: "N", v: 0 }, { m: "D", v: 0 },
];

export type Tab = "home" | "discover" | "library" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", discover: "/discover", library: "/library", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Folio", discover: "Discover", library: "Library", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}

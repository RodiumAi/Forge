export const U = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

const micCover = U("photo-1590602847861-f357a9332bbc", 800);
const headphonesCover = U("photo-1505740420928-5e560c06d30e", 800);

export type Episode = { n: number; title: string; dur: string; g: string; img: string; alt: string };

export const episodes: Episode[] = [
  { n: 1, title: "Why your side project deserves a launch day", dur: "38 min", g: "linear-gradient(135deg,#7c5cff,#4b32c3)", img: micCover, alt: "Studio microphone against a dark background" },
  { n: 2, title: "Debugging in production without losing sleep", dur: "52 min", g: "linear-gradient(135deg,#ff7ab8,#b83280)", img: "", alt: "" },
  { n: 3, title: "The art of the tiny pull request", dur: "27 min", g: "linear-gradient(135deg,#5ccfff,#2a7fb8)", img: headphonesCover, alt: "Black over-ear headphones on a dark surface" },
  { n: 4, title: "From bootcamp to burnout and back again", dur: "61 min", g: "linear-gradient(135deg,#ffb85c,#c37a1f)", img: "", alt: "" },
  { n: 5, title: "Databases explained with kitchen metaphors", dur: "44 min", g: "linear-gradient(135deg,#6dd98a,#2f8a4a)", img: micCover, alt: "Studio microphone against a dark background" },
  { n: 6, title: "What we got wrong about remote work", dur: "35 min", g: "linear-gradient(135deg,#a08cff,#5c48c3)", img: "", alt: "" },
];

export type Host = { name: string; role: string; init: string; g: string; img: string; alt: string };

export const hosts: Host[] = [
  { name: "Mara Delacroix", role: "Producer and host", init: "MD", g: "linear-gradient(135deg,#7c5cff,#ff7ab8)", img: U("photo-1494790108377-be9c29b29330", 400), alt: "Portrait of Mara Delacroix smiling" },
  { name: "Theo Andersen", role: "Engineer and co-host", init: "TA", g: "linear-gradient(135deg,#5ccfff,#7c5cff)", img: U("photo-1507003211169-0a1dd7228f2d", 400), alt: "Portrait of Theo Andersen" },
  { name: "Iris Okafor", role: "Sound designer", init: "IO", g: "linear-gradient(135deg,#ffb85c,#ff7ab8)", img: U("photo-1438761681033-6461ffad8d80", 400), alt: "Portrait of Iris Okafor smiling" },
];

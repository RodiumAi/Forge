export interface ServiceItem {
  num: string;
  title: string;
  text: string;
  color: string;
  deliverables: string[];
  skills: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  category: "BRANDING" | "WEB" | "CAMPAIGNS";
  tag: string;
  year: string;
  client: string;
  img: string;
  stat: string;
  scope: string[];
  outcome: string;
  accentColor: string;
}

export interface StudioConfig {
  name: string;
  shortName: string;
  tagline: string;
  heroHeadline: {
    line1: string;
    line2: string;
    line3: string;
    highlight: string;
  };
  heroSub: string;
  location: string;
  foundedYear: string;
  email: string;
  phone: string;
  statsNotice: string;
}

export const STUDIO_DATA: StudioConfig = {
  name: "Raw Works Studio",
  shortName: "RAW★WORKS",
  tagline: "We make brands you can't ignore.",
  heroHeadline: {
    line1: "WE MAKE",
    line2: "BRANDS YOU",
    line3: "CAN'T",
    highlight: "IGNORE.",
  },
  heroSub:
    "Raw Works is a 14-person creative studio. We do branding, websites and campaigns for companies bored of looking like everyone else. 9 awards. 0 beige deliverables.",
  location: "Rotterdam, NL",
  foundedYear: "2017",
  email: "hello@rawworks.studio",
  phone: "+31 10 555 0192",
  statsNotice: "2 project slots left for Q4",
};

export const MARQUEE_WORDS = [
  "BRANDING",
  "WEB DESIGN",
  "MOTION",
  "PACKAGING",
  "ART DIRECTION",
  "STRATEGY",
  "NAMING",
  "CAMPAIGNS",
];

export const SERVICES: ServiceItem[] = [
  {
    num: "01",
    title: "Brand identity",
    text: "Logos people actually remember. Systems that survive an intern with Canva. We've rebranded 60+ companies and only two cried.",
    color: "#ffe600",
    skills: ["Identity Systems", "Typography", "Guidelines"],
    deliverables: ["Full Vector Kit", "Brand Bible PDF", "Custom Type Pairing", "Asset Repository"],
  },
  {
    num: "02",
    title: "Websites & apps",
    text: "Fast, weird, unforgettable. No templates, no 'hero-features-testimonials' zombie layouts. Average Lighthouse score: 98.",
    color: "#ff4911",
    skills: ["Creative Dev", "React / Vite", "Interaction UX"],
    deliverables: ["Custom Front-End", "CMS Integration", "Sub-second Load", "Interactive Shaders"],
  },
  {
    num: "03",
    title: "Motion & 3D",
    text: "Product films, loops, launch videos. If it doesn't stop the scroll in 0.4 seconds, we redo it. On our dime.",
    color: "#1a6dff",
    skills: ["Cinema 4D", "Houdini", "Keyframe Stunts"],
    deliverables: ["4K Hero Cut", "Social Loops x12", "Lottie Assets", "Sound Design Track"],
  },
  {
    num: "04",
    title: "Wild campaigns",
    text: "Out-of-home that makes people photograph a billboard. Social that gets stolen and reposted. That's the metric.",
    color: "#f5f0e8",
    skills: ["Art Direction", "Guerilla OOH", "Copywriting"],
    deliverables: ["OOH Print Masters", "Stunt Production Deck", "Viral Hook Playbook", "Press Launch Pack"],
  },
];

export const PROJECTS: ProjectItem[] = [
  {
    id: "moshpit-energy",
    title: "MOSHPIT ENERGY",
    category: "BRANDING",
    tag: "Brand + Packaging",
    year: "2026",
    client: "Moshpit Beverage Co.",
    img: "https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=1200&q=70",
    stat: "+312% shelf pickup",
    scope: ["Identity System", "Custom Can Artwork", "3D Motion Teasers", "POS Displays"],
    outcome: "Turned an unknown electrolyte drink into the #1 festival sponsor across Europe in 90 days.",
    accentColor: "#ffe600",
  },
  {
    id: "tangerine-bank",
    title: "TANGERINE BANK",
    category: "WEB",
    tag: "Web + Motion",
    year: "2025",
    client: "Tangerine Financial Group",
    img: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=70",
    stat: "2.1M launch views",
    scope: ["Fintech Web App", "Interactive 3D Cards", "Micro-interactions", "Design System"],
    outcome: "Doubled customer onboarding conversions without a single stock photograph.",
    accentColor: "#ff4911",
  },
  {
    id: "grublab",
    title: "GRUBLAB",
    category: "CAMPAIGNS",
    tag: "Identity + Campaign",
    year: "2025",
    client: "GrubLab Fermentations",
    img: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=70",
    stat: "Cannes shortlist",
    scope: ["Guerrilla Posters", "Brand Voice Bible", "Wild OOH Placements", "Packaging"],
    outcome: "Sold out initial 50,000 unit batch in 48 hours following viral billboard stunt in Berlin.",
    accentColor: "#1a6dff",
  },
  {
    id: "offcut-vintage",
    title: "OFFCUT VINTAGE",
    category: "WEB",
    tag: "E-commerce",
    year: "2024",
    client: "Offcut Apparel Group",
    img: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=70",
    stat: "+188% conversion",
    scope: ["High-speed Storefront", "Brutalist Cart UX", "Archival Lookbook", "Custom CMS"],
    outcome: "Reduced checkout abandonment by 42% and won eCommerce Site of the Month.",
    accentColor: "#f5f0e8",
  },
];

export const PROCESS = [
  {
    step: "A",
    title: "We listen",
    text: "One brutal kickoff workshop. You talk, we interrogate. 90 minutes, no slides.",
  },
  {
    step: "B",
    title: "We fight",
    text: "Three directions, one week. We argue internally so you don't have to. The best idea wins, not the safest.",
  },
  {
    step: "C",
    title: "We build",
    text: "Design, code, motion — all in-house, all in one room. You see progress every 48 hours.",
  },
  {
    step: "D",
    title: "We ship",
    text: "On time or we tell you why two weeks early. Then we measure what happened and brag about it.",
  },
];

export const FAQS = [
  {
    q: "How much does it cost?",
    a: "Identity projects start at $28k. Websites at $45k. Campaigns depend on how famous you want to be. If that made you flinch, we're probably not your studio — and that's fine.",
  },
  {
    q: "How long does it take?",
    a: "Identity: 5-7 weeks. Website: 8-12 weeks. We don't do 'quick versions'. Quick versions are how brands end up beige.",
  },
  {
    q: "Do you work with startups?",
    a: "Constantly. Half our clients are seed-to-Series-B. We take two equity-partial projects per year. Pitch us.",
  },
  {
    q: "Can we just get a logo?",
    a: "No. A logo without a system is a sticker. We do stickers too, but only as part of something bigger.",
  },
  {
    q: "Who will actually work on our project?",
    a: "The people you meet in the first call. No bait-and-switch to juniors. 14 people, zero account managers.",
  },
  {
    q: "Do you do AI-generated design?",
    a: "We use tools like everyone else. But every idea, sketch and final pixel is decided by a human with taste and a deadline.",
  },
];

export const CLIENTS = [
  "MOSHPIT",
  "TANGERINE",
  "GRUBLAB",
  "OFFCUT",
  "HELVETICA GYM",
  "PLONK WINES",
  "DIALTONE",
  "KAPOW SNACKS",
  "BRUUT",
];
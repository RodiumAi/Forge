import { Droplet, Flame, Flower, Leaf, Moon, Sprout } from "lucide-react";

export const treatments = [
  {
    icon: Flower,
    name: "Petal Glow Facial",
    desc: "Rose-quartz massage and botanical peel that leaves skin luminous and calm.",
    duration: "60 min",
    price: "$120",
  },
  {
    icon: Sprout,
    name: "Sage Deep Release",
    desc: "Slow, deep-tissue work with warm sage oil for shoulders, back and neck.",
    duration: "75 min",
    price: "$145",
  },
  {
    icon: Droplet,
    name: "Still Water Soak",
    desc: "Private mineral bath with magnesium salts, followed by warm-towel wrapping.",
    duration: "45 min",
    price: "$85",
  },
  {
    icon: Flame,
    name: "Candlelight Ritual",
    desc: "Full-body warm candle-oil massage in our quietest room, lit only by flame.",
    duration: "90 min",
    price: "$180",
  },
  {
    icon: Leaf,
    name: "Forest Breath",
    desc: "Guided breathwork and lymphatic facial massage with cedar and pine essences.",
    duration: "50 min",
    price: "$95",
  },
  {
    icon: Moon,
    name: "Moonrise Duo",
    desc: "Side-by-side evening massage for two, with herbal tea service after.",
    duration: "80 min",
    price: "$260",
  },
];

export const schedule = [
  { day: "Monday", cls: "Sunrise Yin Yoga", time: "7:30 – 8:30", coach: "Amara" },
  { day: "Tuesday", cls: "Breath & Sound Bath", time: "18:00 – 19:00", coach: "Theo" },
  { day: "Wednesday", cls: "Slow Flow Pilates", time: "9:00 – 10:00", coach: "June" },
  { day: "Thursday", cls: "Candlelit Stretch", time: "19:30 – 20:30", coach: "Amara" },
  { day: "Friday", cls: "Meditation Circle", time: "8:00 – 8:45", coach: "Theo" },
  { day: "Saturday", cls: "Restorative Yoga", time: "10:00 – 11:15", coach: "June" },
];

export const ritual = [
  { step: "01", title: "Arrive & Unwind", text: "Trade the outside world for a robe, warm slippers and our signature hibiscus tea." },
  { step: "02", title: "Warm Preparation", text: "Ten minutes in the eucalyptus steam room prepares muscles and quiets the mind." },
  { step: "03", title: "Your Treatment", text: "Your therapist tailors pressure, oils and pace to exactly how you feel today." },
  { step: "04", title: "The Slow Return", text: "Rest in the daybed lounge as long as you like. There is no clock in that room." },
];

export const testimonials = [
  {
    quote: "I walked in carrying a whole week of stress. Ninety minutes later I felt like I had slept for two days.",
    name: "Claire M.",
    detail: "Candlelight Ritual guest",
  },
  {
    quote: "Bloom is the only place where my phone stays in the locker and I don't even miss it.",
    name: "Priya S.",
    detail: "Member since 2024",
  },
  {
    quote: "The therapists actually listen. Every visit feels designed for that day, not from a script.",
    name: "Daniel R.",
    detail: "Sage Deep Release regular",
  },
];

export const memberships = [
  { name: "Seedling", price: "$79/mo", perks: ["1 treatment each month", "Unlimited steam room", "10% off retail"] },
  { name: "Garden", price: "$139/mo", perks: ["2 treatments each month", "2 guest passes yearly", "Priority booking"] },
  { name: "Meadow", price: "$219/mo", perks: ["Weekly classes included", "3 treatments each month", "Private locker & robe"] },
];

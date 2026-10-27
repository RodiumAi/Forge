import { Baby, Brain, HeartPulse, Sparkles, Stethoscope, Flower2, type LucideIcon } from "lucide-react";

export const ONBOARD_KEY = "kin_onboard_done";
export const CURRENCY = "FCFA";

const img = (id: string, w = 600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const ME = {
  first: "Aïcha",
  name: "Aïcha Bello",
  age: 34,
  blood: "O+",
  weight: "64 kg",
  height: "1.68 m",
  avatar: img("photo-1573496359142-b8d87734a5a2", 160),
};

export const INSURANCE = { plan: "Kin Care Plus", insurer: "NSIA Assurances", member: "KC 2048 7731 09", valid: "12/27", cover: "80%" };

export const ONBOARD_PHOTO = img("photo-1666214280557-f1b5022eb634", 900);

export const SLIDES = [
  { kicker: "Welcome to Kin", title: "Care that fits in your day", body: "Find a trusted doctor, book in two taps and see them in clinic or on video." },
  { kicker: "Real doctors, real reviews", title: "Choose with confidence", body: "Verified specialists near you, honest ratings from patients and clear prices up front." },
  { kicker: "Your health, in one place", title: "Vitals, visits and records", body: "Appointments, prescriptions and insurance travel with you, ready when you need them." },
];

export type Specialty = { id: string; label: string; icon: LucideIcon; tint: string };

export const SPECIALTIES: Specialty[] = [
  { id: "general", label: "General", icon: Stethoscope, tint: "#dff3ef" },
  { id: "cardio", label: "Cardiology", icon: HeartPulse, tint: "#ffe6dd" },
  { id: "pedia", label: "Pediatrics", icon: Baby, tint: "#e3ecff" },
  { id: "derma", label: "Dermatology", icon: Sparkles, tint: "#fff2d6" },
  { id: "neuro", label: "Neurology", icon: Brain, tint: "#ece4ff" },
  { id: "gyneco", label: "Gynecology", icon: Flower2, tint: "#ffe4ee" },
];

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  title: string;
  clinic: string;
  photo: string;
  rating: number;
  reviews: number;
  years: number;
  patients: string;
  fee: number;
  distance: string;
  today: boolean;
  about: string;
};

export const DOCTORS: Doctor[] = [
  { id: "amara-mensah", name: "Dr. Amara Mensah", specialty: "cardio", title: "Cardiologist", clinic: "Clinique Les Cocotiers, Cotonou", photo: img("photo-1559839734-2b71ea197ec2"), rating: 4.9, reviews: 312, years: 14, patients: "3.1k", fee: 25000, distance: "2.4 km", today: true, about: "Interventional cardiologist trained in Dakar and Lyon. Dr. Mensah follows hypertension, palpitations and heart health after 40, with a calm, step-by-step approach and clear written plans after every visit." },
  { id: "kwame-boateng", name: "Dr. Kwame Boateng", specialty: "general", title: "General practitioner", clinic: "Kin Health Centre, Haie Vive", photo: img("photo-1622253692010-333f2da6031d"), rating: 4.8, reviews: 527, years: 9, patients: "5.6k", fee: 12000, distance: "1.1 km", today: true, about: "Family doctor for everyday care: fevers, check-ups, vaccines and chronic conditions. Speaks English, French and Twi, and keeps short waits by running on time." },
  { id: "lucia-moreno", name: "Dr. Lucia Moreno", specialty: "pedia", title: "Pediatrician", clinic: "Centre Mère et Enfant, Akpakpa", photo: img("photo-1594824476967-48c8b964273f"), rating: 5.0, reviews: 198, years: 11, patients: "2.2k", fee: 18000, distance: "3.8 km", today: false, about: "Pediatrician from newborns to teens, with a special interest in asthma and nutrition. Parents love her patience and her follow-up messages after each visit." },
  { id: "rayan-haddad", name: "Dr. Rayan Haddad", specialty: "derma", title: "Dermatologist", clinic: "Skin Studio, Ganhi", photo: img("photo-1612349317150-e413f6a5b16d"), rating: 4.7, reviews: 143, years: 8, patients: "1.4k", fee: 20000, distance: "4.2 km", today: true, about: "Medical and cosmetic dermatology: acne, eczema, pigmentation and skin checks. Offers short video follow-ups with photos between visits." },
  { id: "nadia-okafor", name: "Dr. Nadia Okafor", specialty: "neuro", title: "Neurologist", clinic: "Hôpital de la Mère, Cotonou", photo: img("photo-1651008376811-b90baee60c1f"), rating: 4.9, reviews: 221, years: 16, patients: "2.9k", fee: 30000, distance: "5.0 km", today: false, about: "Neurologist focused on migraine, sleep and nerve pain. Builds long-term plans with patients and works closely with their family doctor." },
  { id: "priya-raman", name: "Dr. Priya Raman", specialty: "gyneco", title: "Gynecologist", clinic: "Clinique Atinkanmey, Cotonou", photo: img("photo-1614608682850-e0d6ed316d47"), rating: 4.8, reviews: 264, years: 12, patients: "3.4k", fee: 22000, distance: "2.9 km", today: true, about: "Women's health at every stage: check-ups, pregnancy follow-up and menopause. Known for listening first and explaining every option." },
];

export type Appointment = {
  id: string;
  doctorId: string;
  day: string;
  date: string;
  month: string;
  time: string;
  kind: "video" | "clinic";
  note?: string;
};

export const UPCOMING: Appointment[] = [
  { id: "a1", doctorId: "amara-mensah", day: "Tue", date: "27", month: "Oct", time: "10:30", kind: "video", note: "Blood pressure follow-up" },
  { id: "a2", doctorId: "lucia-moreno", day: "Fri", date: "30", month: "Oct", time: "15:00", kind: "clinic", note: "For Inaya, yearly check-up" },
];

export const PAST: Appointment[] = [
  { id: "p1", doctorId: "kwame-boateng", day: "Mon", date: "12", month: "Oct", time: "09:00", kind: "clinic", note: "Flu and fever" },
  { id: "p2", doctorId: "rayan-haddad", day: "Mon", date: "28", month: "Sep", time: "17:30", kind: "video", note: "Eczema review" },
];

/** Next 7 days for the booking picker (today is Sunday 25 October 2026). */
export const DAYS = [
  { day: "Mon", date: "26", open: true }, { day: "Tue", date: "27", open: true }, { day: "Wed", date: "28", open: false },
  { day: "Thu", date: "29", open: true }, { day: "Fri", date: "30", open: true }, { day: "Sat", date: "31", open: true },
  { day: "Sun", date: "1", open: false },
];

export const SLOTS = ["08:30", "09:00", "10:30", "11:00", "14:00", "15:30", "16:00", "17:30"];
export const TAKEN = ["09:00", "14:00", "17:30"];

export const VITALS = { heart: 72, sleep: "7h 20m", steps: 8432, stepsGoal: 10000 };

export const doctorById = (id: string) => DOCTORS.find((d) => d.id === id);
export const specialtyOf = (id: string) => SPECIALTIES.find((s) => s.id === id) ?? SPECIALTIES[0];
export const money = (n: number) => `${n.toLocaleString("fr-FR").replace(/\s/g, " ")} ${CURRENCY}`;

export type Tab = "home" | "doctors" | "appointments" | "profile";

/** URL of each tab. Route path = kebab name of the screen file. */
export const PATHS: Record<Tab, string> = { home: "/", doctors: "/doctors", appointments: "/appointments", profile: "/profile" };

export const TITLES: Record<Tab, string> = { home: "Kin", doctors: "Find a doctor", appointments: "Appointments", profile: "Profile" };

/** Tab matching the current URL (falls back to Home). */
export function tabFromPath(pathname: string): Tab {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (Object.keys(PATHS) as Tab[]).find((t) => PATHS[t] === path) ?? "home";
}

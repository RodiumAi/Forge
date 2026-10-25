import { createContext, useContext, useState, type ReactNode } from "react";
import { PAST, UPCOMING, type Appointment } from "../data";

type CareState = {
  upcoming: Appointment[];
  past: Appointment[];
  book: (a: Omit<Appointment, "id">) => void;
  cancel: (id: string) => void;
  favourites: string[];
  toggleFavourite: (doctorId: string) => void;
};

const Ctx = createContext<CareState | null>(null);

/** Appointments and favourite doctors, shared by Home, Doctors, Appointments and the doctor screen. */
export function CareProvider({ children }: { children: ReactNode }) {
  const [upcoming, setUpcoming] = useState<Appointment[]>(UPCOMING);
  const [favourites, setFavourites] = useState<string[]>(["amara-mensah"]);

  const value: CareState = {
    upcoming,
    past: PAST,
    // New bookings go first so Home shows them as the next appointment.
    book: (a) => setUpcoming((list) => [{ ...a, id: `a${Date.now()}` }, ...list]),
    cancel: (id) => setUpcoming((list) => list.filter((a) => a.id !== id)),
    favourites,
    toggleFavourite: (doctorId) =>
      setFavourites((list) => (list.includes(doctorId) ? list.filter((d) => d !== doctorId) : [...list, doctorId])),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCare() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCare must be used inside <CareProvider>");
  return ctx;
}

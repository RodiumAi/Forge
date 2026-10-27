import { createContext, useContext, useState, type ReactNode } from "react";
import { HABITS, TODAY, type Habit } from "../data";

type NewHabit = Pick<Habit, "name" | "icon" | "tint" | "time" | "frequency">;

type HabitsState = {
  habits: Habit[];
  /** Flips one day (0 = Monday, 6 = today) and keeps today's streak in step. */
  toggle: (id: string, day?: number) => void;
  add: (h: NewHabit) => void;
  setNote: (id: string, note: string) => void;
};

const Ctx = createContext<HabitsState | null>(null);

/** Habit list shared by Today, Habits, Stats, the habit detail and the new habit flow. */
export function HabitsProvider({ children }: { children: ReactNode }) {
  const [habits, setHabits] = useState<Habit[]>(HABITS);

  const value: HabitsState = {
    habits,
    toggle: (id, day = TODAY) =>
      setHabits((list) =>
        list.map((h) => {
          if (h.id !== id) return h;
          const week = h.week.map((v, i) => (i === day ? !v : v));
          const delta = day === TODAY ? (week[day] ? 1 : -1) : 0;
          const streak = Math.max(0, h.streak + delta);
          return { ...h, week, streak, best: Math.max(h.best, streak) };
        })
      ),
    add: (h) =>
      setHabits((list) => [
        ...list,
        { ...h, id: `h${Date.now()}`, goal: "Once", streak: 0, best: 0, week: Array(7).fill(false), note: "" },
      ]),
    setNote: (id, note) => setHabits((list) => list.map((h) => (h.id === id ? { ...h, note } : h))),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHabits() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHabits must be used inside <HabitsProvider>");
  return ctx;
}

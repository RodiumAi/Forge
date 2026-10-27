import { createContext, useContext, useState, type ReactNode } from "react";
import { RUNS, START, type Goals, type Run } from "../data";

type ActivityState = {
  today: Goals;
  runs: Run[];
  addRun: (km: number, seconds: number) => void;
  addWorkout: (minutes: number, kcal: number) => void;
};

const ActivityContext = createContext<ActivityState | null>(null);

function clock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Today's rings and the run log, shared by Today, Stats, the run and workout screens. */
export function ActivityProvider({ children }: { children: ReactNode }) {
  const [today, setToday] = useState<Goals>(START);
  const [runs, setRuns] = useState<Run[]>(RUNS);

  function addRun(km: number, seconds: number) {
    const minutes = Math.round(seconds / 60);
    setToday((t) => ({ move: t.move + Math.round(km * 62), exercise: t.exercise + minutes, stand: Math.min(t.stand + 1, 24) }));
    const pace = km > 0 ? clock(seconds / km) : "0:00";
    setRuns((list) => [{ id: `r${Date.now()}`, title: "Morning run", when: "Today, just now", km: Math.round(km * 100) / 100, time: clock(seconds), pace }, ...list]);
  }

  function addWorkout(minutes: number, kcal: number) {
    setToday((t) => ({ move: t.move + kcal, exercise: t.exercise + minutes, stand: Math.min(t.stand + 1, 24) }));
  }

  return <ActivityContext.Provider value={{ today, runs, addRun, addWorkout }}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error("useActivity must be used inside <ActivityProvider>");
  return ctx;
}

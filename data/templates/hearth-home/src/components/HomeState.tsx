import { createContext, useContext, useState, type ReactNode } from "react";
import { DEVICES, type Device, type SceneId } from "../data";

export type ClimateMode = "heat" | "cool" | "auto";

type HomeState = {
  devices: Device[];
  toggle: (id: string) => void;
  setLevel: (id: string, level: number) => void;
  /** Sets every dimmable light of a room to one level and switches them on. */
  dimRoom: (room: string, level: number) => void;
  scene: SceneId | null;
  setScene: (id: SceneId) => void;
  target: number;
  setTarget: (t: number) => void;
  mode: ClimateMode;
  setMode: (m: ClimateMode) => void;
};

const Ctx = createContext<HomeState | null>(null);

export const TEMP_MIN = 16;
export const TEMP_MAX = 30;

/** Device, scene and thermostat state shared by Home, Rooms, Room and Climate. */
export function HomeProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>(DEVICES);
  const [scene, setSceneState] = useState<SceneId | null>("evening");
  const [target, setTargetState] = useState(22.5);
  const [mode, setMode] = useState<ClimateMode>("cool");

  const patch = (fn: (d: Device) => Device) => setDevices((list) => list.map(fn));

  const value: HomeState = {
    devices,
    toggle: (id) => patch((d) => (d.id === id ? { ...d, on: !d.on } : d)),
    setLevel: (id, level) => patch((d) => (d.id === id ? { ...d, level, on: level > 0 } : d)),
    dimRoom: (room, level) => patch((d) => (d.room === room && d.level !== undefined ? { ...d, level, on: true } : d)),
    scene,
    setScene: (id) => {
      setSceneState(id);
      // "Away" and "Good night" switch the lights off, the others warm them up.
      const off = id === "away" || id === "night";
      patch((d) => (d.level !== undefined ? { ...d, on: !off, level: id === "movie" ? 20 : d.level } : d));
    },
    target,
    setTarget: (t) => setTargetState(Math.min(TEMP_MAX, Math.max(TEMP_MIN, Math.round(t * 2) / 2))),
    mode,
    setMode,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHome() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHome must be used inside <HomeProvider>");
  return ctx;
}

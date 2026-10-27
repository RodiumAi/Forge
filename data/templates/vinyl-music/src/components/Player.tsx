import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TRACKS, trackById, type Track } from "../data";

type PlayerState = {
  track: Track;
  playing: boolean;
  progress: number;
  queue: string[];
  liked: string[];
  play: (id: string, queue?: string[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (s: number) => void;
  toggleLike: (id: string) => void;
};

const PlayerContext = createContext<PlayerState | null>(null);

/** One player for the whole app: mini player, Now Playing, album and track rows read it. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<string[]>(TRACKS.map((t) => t.id));
  const [current, setCurrent] = useState(TRACKS[0].id);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(71);
  const [liked, setLiked] = useState<string[]>(["t1", "t6", "t11"]);
  const track = trackById(current) ?? TRACKS[0];

  function jump(step: number) {
    const i = queue.indexOf(current);
    const nextId = queue[(i + step + queue.length) % queue.length];
    setCurrent(nextId);
    setProgress(0);
  }

  // Fake playback clock: one tick per second, then the next track.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setProgress((p) => p + 1), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (progress >= track.duration) jump(1);
  }, [progress, track.duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: PlayerState = {
    track,
    playing,
    progress,
    queue,
    liked,
    play: (id, list) => {
      if (list) setQueue(list);
      if (id !== current) { setCurrent(id); setProgress(0); }
      setPlaying(true);
    },
    toggle: () => setPlaying((p) => !p),
    next: () => jump(1),
    prev: () => (progress > 3 ? setProgress(0) : jump(-1)),
    seek: (s) => setProgress(Math.max(0, Math.min(track.duration - 1, s))),
    toggleLike: (id) => setLiked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])),
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

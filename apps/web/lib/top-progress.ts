/** Lightweight top progress controller (YouTube-style). */

type Listener = (state: { active: boolean; value: number }) => void;

const listeners = new Set<Listener>();
const keys = new Set<string>();
let value = 0;
let trickleTimer: ReturnType<typeof setInterval> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function notify() {
  const active = keys.size > 0 || value > 0;
  for (const fn of listeners) {
    try {
      fn({ active, value });
    } catch {
      /* ignore */
    }
  }
}

function clearTrickle() {
  if (trickleTimer) {
    clearInterval(trickleTimer);
    trickleTimer = null;
  }
}

function startTrickle() {
  clearTrickle();
  trickleTimer = setInterval(() => {
    if (keys.size === 0) return;
    // Ease toward ~90% while waiting
    if (value < 0.9) {
      const remaining = 0.9 - value;
      value += Math.max(0.008, remaining * 0.08);
      notify();
    }
  }, 200);
}

export function subscribeTopProgress(listener: Listener): () => void {
  listeners.add(listener);
  listener({ active: keys.size > 0 || value > 0, value });
  return () => listeners.delete(listener);
}

export function topProgressStart(key?: string) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const id = key || `auto-${++seq}`;
  const wasEmpty = keys.size === 0;
  keys.add(id);
  if (wasEmpty) {
    value = 0.12;
    startTrickle();
  } else if (value < 0.2) {
    value = 0.2;
  }
  notify();
  return id;
}

export function topProgressDone(key?: string) {
  if (key) keys.delete(key);
  else keys.clear();

  if (keys.size > 0) {
    notify();
    return;
  }

  clearTrickle();
  value = 1;
  notify();
  hideTimer = setTimeout(() => {
    value = 0;
    notify();
    hideTimer = null;
  }, 280);
}

export function topProgressInc(amount = 0.05) {
  if (keys.size === 0) return;
  value = Math.min(0.95, value + amount);
  notify();
}

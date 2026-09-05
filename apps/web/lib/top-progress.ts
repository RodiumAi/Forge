/** Indeterminate top activity indicator — on while any keyed job is running. */

type Listener = (state: { active: boolean }) => void;

const listeners = new Set<Listener>();
const keys = new Set<string>();
let hideTimer: ReturnType<typeof setTimeout> | null = null;
/** Soft “still visible while fading out” so CSS can animate opacity. */
let fading = false;
let seq = 0;

function notify() {
  const active = keys.size > 0 || fading;
  for (const fn of listeners) {
    try {
      fn({ active });
    } catch {
      /* ignore */
    }
  }
}

export function subscribeTopProgress(listener: Listener): () => void {
  listeners.add(listener);
  listener({ active: keys.size > 0 || fading });
  return () => listeners.delete(listener);
}

export function topProgressStart(key?: string) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  fading = false;
  const id = key || `auto-${++seq}`;
  keys.add(id);
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

  // Brief hold so the CSS fade-out can run, then unmount.
  fading = true;
  notify();
  hideTimer = setTimeout(() => {
    fading = false;
    hideTimer = null;
    notify();
  }, 220);
}

/** No-op — kept so older call sites that trickled progress still compile. */
export function topProgressInc(_amount = 0.05) {
  /* indeterminate — progress % unused */
}

import { create } from 'zustand';

interface AppState {
  /** Rest timer end time (ms) or null when hidden. */
  restEndsAt: number | null;
  /** Total rest length (s) for the progress bar. */
  restTotal: number;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  restEndsAt: null,
  restTotal: 0,
  startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000, restTotal: seconds }),
  adjustRest: (d) => {
    const cur = get().restEndsAt;
    if (cur) set({ restEndsAt: Math.max(Date.now(), cur) + d * 1000, restTotal: Math.max(1, get().restTotal + d) });
  },
  stopRest: () => set({ restEndsAt: null }),
}));

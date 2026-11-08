import { create } from 'zustand';

interface AppState {
  /** Rest timer end time (ms) or null when hidden. */
  restEndsAt: number | null;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  restEndsAt: null,
  startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000 }),
  adjustRest: (d) => {
    const cur = get().restEndsAt;
    if (cur) set({ restEndsAt: Math.max(Date.now(), cur) + d * 1000 });
  },
  stopRest: () => set({ restEndsAt: null }),
}));

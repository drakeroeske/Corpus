// Watch sync behind an interface so a real HealthKit / Garmin bridge can replace it.

export interface WatchData {
  sleepHours: number;
  hrv: number;
  restingHr: number;
  steps: number;
}

export interface WatchSync {
  name: string;
  fetchDay(date: string): Promise<WatchData>;
}

/** Deterministic pseudo-random numbers from a date so re-syncing gives the same values. */
function seeded(date: string) {
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 2 ** 32;
  };
}

export const simulatedWatch: WatchSync = {
  name: 'Simulated watch',
  async fetchDay(date) {
    const r = seeded(date);
    await new Promise((res) => setTimeout(res, 400));
    return {
      sleepHours: Math.round((5.5 + r() * 3) * 4) / 4,
      hrv: Math.round(48 + r() * 24),
      restingHr: Math.round(50 + r() * 12),
      steps: Math.round(5000 + r() * 8000),
    };
  },
};

export const watchSync: WatchSync = simulatedWatch;

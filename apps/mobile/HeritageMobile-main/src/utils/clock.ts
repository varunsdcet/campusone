/**
 * Demo clock. All "now" lookups go through here so the developer
 * accelerated-clock scenario can jump time without touching device settings.
 */
let offsetMs = 0;
const listeners = new Set<() => void>();

export const clock = {
  now(): number {
    return Date.now() + offsetMs;
  },
  nowDate(): Date {
    return new Date(clock.now());
  },
  getOffsetMs(): number {
    return offsetMs;
  },
  setOffsetMs(ms: number) {
    offsetMs = ms;
    listeners.forEach(l => l());
  },
  advance(ms: number) {
    clock.setOffsetMs(offsetMs + ms);
  },
  reset() {
    clock.setOffsetMs(0);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const MINUTE_MS = 60 * 1000;

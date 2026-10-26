import { ServiceError, ServiceErrorCode } from '../errors';
import { appConfig } from '../../config/appConfig';

/**
 * Deterministic demo scenario controller. The developer gallery sets flags
 * here; mock adapters call `simulate(method)` before doing work.
 * No random failures are ever produced.
 */
export type ScenarioMode = 'success' | 'slow' | 'error' | 'permissionDenied' | 'empty';

interface ScenarioState {
  mode: ScenarioMode;
  /** When set, only methods matching this prefix are affected. */
  methodFilter?: string;
  /** One-shot: clear after the next affected call (lets Retry succeed). */
  oneShot: boolean;
  latencyMs: number;
}

const state: ScenarioState = {
  mode: 'success',
  methodFilter: undefined,
  oneShot: true,
  latencyMs: appConfig.demo.latencyMs,
};

const listeners = new Set<() => void>();

export const scenario = {
  get(): Readonly<ScenarioState> {
    return state;
  },
  set(partial: Partial<ScenarioState>) {
    Object.assign(state, partial);
    listeners.forEach(l => l());
  },
  reset() {
    scenario.set({ mode: 'success', methodFilter: undefined, oneShot: true, latencyMs: appConfig.demo.latencyMs });
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  /** Returns true when the "empty" scenario applies to this method. */
  isEmpty(method: string): boolean {
    return state.mode === 'empty' && matches(method);
  },
};

function matches(method: string): boolean {
  return !state.methodFilter || method.startsWith(state.methodFilter);
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function simulate(method: string): Promise<void> {
  const applies = matches(method);
  let ms = state.latencyMs;
  if (applies && state.mode === 'slow') ms = Math.max(ms, 4000);
  if (ms > 0) await delay(ms);
  if (!applies) return;
  if (state.mode === 'error' || state.mode === 'permissionDenied') {
    const code: ServiceErrorCode = state.mode === 'error' ? 'SERVER' : 'PERMISSION_DENIED';
    if (state.oneShot) scenario.set({ mode: 'success' });
    throw new ServiceError(
      code,
      code === 'SERVER' ? 'Demo server error (scenario). Tap Retry to continue.' : 'You do not have permission for this action (demo scenario).',
    );
  }
  if (state.mode === 'slow' && state.oneShot) scenario.set({ mode: 'success' });
}

export function demoEmpty<T>(method: string, value: T, empty: T): T {
  return scenario.isEmpty(method) ? empty : value;
}

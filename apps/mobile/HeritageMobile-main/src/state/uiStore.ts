import { create } from 'zustand';

interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface UiState {
  toasts: Toast[];
  showToast(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  /** Demo clock offset (ms) in addition to the fixed anchor; persisted separately. */
  demoClockJumps: number;
  setDemoClockJumps(n: number): void;
  offline: boolean;
  setOffline(offline: boolean): void;
}

let toastId = 0;
export const useUiStore = create<UiState>(set => ({
  toasts: [],
  showToast: (message, tone = 'info') => {
    const id = ++toastId;
    set(s => ({ toasts: [...s.toasts, { id, message, tone }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3200);
  },
  dismissToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  demoClockJumps: 0,
  setDemoClockJumps: n => set({ demoClockJumps: n }),
  offline: false,
  setOffline: offline => set(s => (s.offline === offline ? s : { offline })),
}));

export const toast = (message: string, tone: Toast['tone'] = 'info') => useUiStore.getState().showToast(message, tone);

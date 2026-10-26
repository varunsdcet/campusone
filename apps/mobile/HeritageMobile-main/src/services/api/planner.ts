import type { PlannerService, PlannerStudySession, StudyArtifact, StudyGoal } from '../contracts/planner';
import type { KeyValueStore } from '../../storage/asyncStorage';
import { ServiceError } from '../errors';
import type { ApiClient } from './client';

export function createPlannerApi(api: ApiClient, store?: KeyValueStore): PlannerService {
  const cachedRead = async <T>(key: string, load: () => Promise<T>): Promise<T> => {
    const scopedKey = `campusone.planner.${api.accountId ?? 'signed-out'}.${key}`;
    try {
      const value = await load();
      await store?.setItem(scopedKey, JSON.stringify({ value, cachedAt: new Date().toISOString() }));
      return value;
    } catch (error) {
      if (!store || !(ServiceError.is(error, 'NETWORK') || ServiceError.is(error, 'TIMEOUT'))) throw error;
      const raw = await store.getItem(scopedKey);
      if (!raw) throw error;
      const saved = JSON.parse(raw) as { value: T; cachedAt: string };
      return { ...(saved.value as object), offline: true, cachedAt: saved.cachedAt } as T;
    }
  };
  return {
    myDay(date) {
      return cachedRead(`day.${date}`, () => api.get(`/student/planner/day?date=${encodeURIComponent(date)}`));
    },
    generate(input) {
      return api.post('/student/planner/ai-plan', input);
    },
    async saveDraft(input) {
      const dates = input.draft.sessions.map(row => row.scheduledAt.slice(0, 10)).sort();
      await api.post('/student/planner/plans', {
        title: input.draft.title,
        startsOn: dates[0],
        endsOn: dates[dates.length - 1],
        runId: input.runId,
        sessions: input.draft.sessions,
      });
    },
    async addSession(input) {
      const response = await api.post<{ session: PlannerStudySession }>('/student/planner/sessions', input);
      return response.session;
    },
    async setSessionStatus(id, status) {
      const response = await api.patch<{ session: PlannerStudySession }>(`/student/planner/sessions/${encodeURIComponent(id)}`, { status });
      return response.session;
    },
    async startFocus(input) {
      const response = await api.post<{ focus: { id: string; startedAt: string } }>('/student/planner/focus', input);
      return response.focus;
    },
    async completeFocus(id) {
      await api.post(`/student/planner/focus/${encodeURIComponent(id)}/complete`);
    },
    insights: () => cachedRead('insights', () => api.get('/student/planner/insights')),
    async addGoal(input) {
      const response = await api.post<{ goal: StudyGoal }>('/student/planner/goals', input);
      return response.goal;
    },
    async syncReminders() { await api.post('/student/planner/reminders/sync'); },
    studySources: () => cachedRead('sources', () => api.get('/student/planner/study-sources')),
    async generateStudyAid(input) {
      const response = await api.post<{ artifact: StudyArtifact }>('/student/planner/study-tools', input);
      return response.artifact;
    },
    opportunities: () => cachedRead('opportunities', () => api.get('/student/planner/opportunities')),
    async setOpportunityBookmark(id, bookmarked) {
      const path = `/student/planner/opportunities/${encodeURIComponent(id)}/bookmark`;
      if (bookmarked) await api.put(path, {}); else await api.del(path);
    },
    calendarExport: () => cachedRead('calendar', () => api.get('/student/planner/calendar-export')),
  };
}

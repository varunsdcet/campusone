import { createTestServices } from '../../src/services';
import { createMemoryStore } from '../../src/storage/asyncStorage';
import { canAccess } from '../../src/navigation/permissions';
import { Routes } from '../../src/navigation/routes';
import { IDS } from '../../src/fixtures/constants';

describe('Smart Student Planner', () => {
  it('generates a review draft and persists it only after save', async () => {
    const { repo, services } = createTestServices(createMemoryStore());
    await repo.hydrate();
    const date = '2026-10-16';
    expect((await services.planner.myDay(date)).studySessions).toHaveLength(0);
    const draft = await services.planner.generate({ startDate: date, days: 7, dailyMinutes: 120, goal: 'Prepare for my deadline' });
    expect(draft.provider).toContain('deepseek');
    expect((await services.planner.myDay(date)).studySessions).toHaveLength(0);
    await services.planner.saveDraft(draft);
    expect((await services.planner.myDay(date)).studySessions).toHaveLength(1);
  });

  it('keeps My Day student-only', async () => {
    const { repo } = createTestServices(createMemoryStore());
    await repo.hydrate();
    expect(canAccess(Routes.StudentMyDay, repo.find('users', IDS.student)!).ok).toBe(true);
    expect(canAccess(Routes.StudentMyDay, repo.find('users', IDS.instructor)!).ok).toBe(false);
  });

  it('exposes risks, grade targets, grounded study aids, matches and calendar export', async () => {
    const { repo, services } = createTestServices(createMemoryStore());
    await repo.hydrate();
    const insights = await services.planner.insights();
    expect(insights.risks[0]?.kind).toBe('deadline');
    expect(insights.grades[0]?.scenarios[0]?.requiredOnRemaining).toEqual(expect.any(Number));
    const sources = await services.planner.studySources();
    const artifact = await services.planner.generateStudyAid({ sectionId: sources.courses[0].sectionId, sourceId: sources.courses[0].sources[0].id, kind: 'flashcards', notes: '' });
    expect(artifact.items[0]?.source).toContain('SOWK205');
    expect((await services.planner.opportunities()).opportunities[0]?.matchPercent).toBeGreaterThan(0);
    expect((await services.planner.calendarExport()).ics).toContain('BEGIN:VCALENDAR');
    await expect(services.planner.addGoal({ title: 'Study consistently', weeklyTargetMinutes: 300 })).resolves.toMatchObject({ title: 'Study consistently', weeklyTargetMinutes: 300 });
  });

  it('keeps every planner extension student-only', async () => {
    const { repo } = createTestServices(createMemoryStore());
    await repo.hydrate();
    const student = repo.find('users', IDS.student)!;
    const instructor = repo.find('users', IDS.instructor)!;
    for (const route of [Routes.StudentStudyAnalytics, Routes.StudentGradeCalculator, Routes.StudentStudyTools, Routes.StudentOpportunityMatcher, Routes.StudentPlannerCalendar]) {
      expect(canAccess(route, student).ok).toBe(true);
      expect(canAccess(route, instructor).ok).toBe(false);
    }
  });
});

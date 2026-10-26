import type { PlannerService, PlannerStudySession } from '../contracts/planner';

export function createPlannerMock(): PlannerService {
  let sessions: PlannerStudySession[] = [];
  return {
    async myDay(date) {
      return {
        date,
        timeZone: 'America/Vancouver',
        summary: { classes: 1, assignments: 1, tasks: 1, studySessions: sessions.filter(row => row.scheduledAt.startsWith(date)).length },
        classes: [{ id: 'class-demo', sectionId: 'sec-demo', title: 'Social Work Practice', startsAt: `${date}T17:00:00.000Z`, endsAt: `${date}T18:30:00.000Z`, location: 'Room 204', courseCode: 'SOWK205' }],
        assignments: [{ id: 'assignment-demo', sectionId: 'sec-demo', title: 'Reflection paper', dueAt: `${date}T23:59:00.000Z`, courseCode: 'SOWK205' }],
        tasks: [{ id: 'task-demo', title: 'Confirm emergency contact', detail: 'Required student record task', dueAt: `${date}T23:59:00.000Z`, href: null }],
        studySessions: sessions.filter(row => row.scheduledAt.startsWith(date)),
        attendance: [{ sectionId: 'sec-demo', courseCode: 'SOWK205', attended: 8, counted: 10, rate: 80, targetPercent: 80, canMiss: 0, neededConsecutive: 0 }],
      };
    },
    async generate(input) {
      return {
        runId: 'mock-planner-run',
        provider: 'deepseek:demo',
        draft: {
          title: 'Balanced study week',
          rationale: 'Your nearest deadline is prioritised around today’s class.',
          sessions: [{ title: 'SOWK205 reflection outline', scheduledAt: `${input.startDate}T19:00:00.000Z`, durationMinutes: Math.min(50, input.dailyMinutes), sectionId: 'sec-demo', assignmentId: 'assignment-demo' }],
        },
      };
    },
    async saveDraft(input) {
      sessions = input.draft.sessions.map((row, index) => ({ id: `mock-ai-${index}`, planId: 'mock-plan', sectionId: row.sectionId ?? null, assignmentId: row.assignmentId ?? null, title: row.title, scheduledAt: row.scheduledAt, durationMinutes: row.durationMinutes, status: 'planned', source: 'ai_reviewed', completedAt: null }));
    },
    async addSession(input) {
      const row: PlannerStudySession = { id: `mock-manual-${sessions.length + 1}`, planId: null, sectionId: input.sectionId ?? null, assignmentId: input.assignmentId ?? null, title: input.title, scheduledAt: input.scheduledAt, durationMinutes: input.durationMinutes, status: 'planned', source: 'manual', completedAt: null };
      sessions.push(row);
      return row;
    },
    async setSessionStatus(id, status) {
      const row = sessions.find(item => item.id === id);
      if (!row) throw new Error('Study session not found');
      row.status = status;
      row.completedAt = status === 'completed' ? new Date().toISOString() : null;
      return row;
    },
    async startFocus() { return { id: 'mock-focus', startedAt: new Date().toISOString() }; },
    async completeFocus() {},
    async insights() {
      return {
        risks: [{ id: 'risk-1', level: 'medium', title: 'Reflection paper', detail: 'Due in 3 days · 50 planned min', kind: 'deadline' }],
        attendance: [{ sectionId: 'sec-demo', courseCode: 'SOWK205', attended: 8, counted: 10, rate: 80, targetPercent: 80, canMiss: 0, neededConsecutive: 0, remainingClasses: 8, bestPossible: 88.9, recoveryPossible: true }],
        grades: [{ sectionId: 'sec-demo', courseCode: 'SOWK205', courseTitle: 'Social Work Practice', credits: 3, currentPercent: 82, completedWeight: 40, remainingWeight: 60, scenarios: [{ targetPercent: 80, letter: 'B+', gradePoint: 3.3, requiredOnRemaining: 78.7 }] }],
        cumulativeGpa: 3.42,
        analytics: { focusMinutes: 100, focusSessions: 2, streakDays: 2, plannedMinutes: 150, completedStudyMinutes: 100, completionPercent: 67 },
        goals: [], programName: 'Social Work',
      };
    },
    async addGoal(input) { return { id: 'goal-demo', title: input.title, targetDate: input.targetDate ?? null, weeklyTargetMinutes: input.weeklyTargetMinutes }; },
    async syncReminders() {},
    async studySources() { return { courses: [{ sectionId: 'sec-demo', courseCode: 'SOWK205', courseTitle: 'Social Work Practice', sources: [{ id: 'topic-demo', type: 'syllabus_topic', title: 'Ethical practice', reference: 'SOWK205 syllabus' }] }] }; },
    async generateStudyAid(input) { return { id: 'aid-demo', kind: input.kind, title: 'Ethical practice review', items: [{ front: 'Core principle', back: 'Use informed consent and protect confidentiality.', source: 'SOWK205 syllabus' }], sources: [{ id: input.sourceId ?? 'student-notes', type: input.sourceId ? 'syllabus_topic' : 'student_notes', title: 'Ethical practice', reference: input.sourceId ? 'SOWK205 syllabus' : 'Student-provided notes' }], createdAt: new Date().toISOString() }; },
    async opportunities() { return { programName: 'Social Work', opportunities: [{ id: 'opp-demo', title: 'Community Support Intern', employerName: 'Heritage Partner', skills: ['Communication'], programCodes: ['Social Work'], href: '/student/messages', updatedAt: new Date().toISOString(), lastCheckedAt: new Date().toISOString(), sourceType: 'institution_managed', matchPercent: 90, matchReason: 'Matches Social Work', bookmarked: false }] }; },
    async setOpportunityBookmark() {},
    async calendarExport() { return { mode: 'read_only_export', filename: 'heritage-study-calendar.ics', events: [{ id: 'class-demo', kind: 'class', title: 'Social Work Practice', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(), location: 'Room 204' }], ics: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' }; },
  };
}

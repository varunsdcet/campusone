export type PlannerStudySession = {
  id: string;
  planId: string | null;
  sectionId: string | null;
  assignmentId: string | null;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'planned' | 'completed' | 'missed';
  source: string;
  completedAt: string | null;
};

export type MyDay = {
  offline?: boolean;
  cachedAt?: string;
  date: string;
  timeZone: string;
  summary: { classes: number; assignments: number; tasks: number; studySessions: number };
  classes: { id: string; sectionId: string; title: string; startsAt: string; endsAt: string | null; location: string | null; courseCode: string }[];
  assignments: { id: string; sectionId: string; title: string; dueAt: string; courseCode: string }[];
  tasks: { id: string; title: string; detail: string | null; dueAt: string | null; href: string | null }[];
  studySessions: PlannerStudySession[];
  attendance: { sectionId: string; courseCode: string; attended: number; counted: number; rate: number; targetPercent: number; canMiss: number; neededConsecutive: number }[];
};

export type PlannerDraft = {
  runId: string;
  provider: string;
  draft: {
    title: string;
    rationale: string;
    sessions: { title: string; scheduledAt: string; durationMinutes: number; sectionId?: string; assignmentId?: string }[];
  };
};

export type PlannerInsights = {
  risks: { id: string; level: 'low' | 'medium' | 'high'; title: string; detail: string; kind: string }[];
  attendance: { sectionId: string; courseCode: string; attended: number; counted: number; rate: number; targetPercent: number; canMiss: number; neededConsecutive: number; remainingClasses: number; bestPossible: number; recoveryPossible: boolean }[];
  grades: { sectionId: string; courseCode: string; courseTitle: string; credits: number; currentPercent: number | null; completedWeight: number; remainingWeight: number; scenarios: { targetPercent: number; letter: string; gradePoint: number | null; requiredOnRemaining: number | null }[] }[];
  cumulativeGpa: number | null;
  analytics: { focusMinutes: number; focusSessions: number; streakDays: number; plannedMinutes: number; completedStudyMinutes: number; completionPercent: number };
  goals: { id: string; title: string; targetDate: string | null; weeklyTargetMinutes: number }[];
  programName: string;
};

export type StudySources = { courses: { sectionId: string; courseCode: string; courseTitle: string; sources: { id: string; type: string; title: string; reference: string }[] }[] };
export type StudyAidItem = { front: string; back: string; source: string; options?: string[]; answerIndex?: number };
export type StudyArtifact = { id: string; kind: string; title: string; items: StudyAidItem[]; sources: { id: string; type: string; title: string; reference: string }[]; createdAt: string };
export type StudyGoal = { id: string; title: string; targetDate: string | null; weeklyTargetMinutes: number };
export type MatchedOpportunity = { id: string; title: string; employerName: string; skills: string[]; programCodes: string[]; href: string; updatedAt: string; lastCheckedAt: string; sourceType: 'institution_managed'; matchPercent: number; matchReason: string; bookmarked: boolean };
export type PlannerCalendar = { mode: 'read_only_export'; filename: string; events: { id: string; kind: string; title: string; startsAt: string; endsAt: string; location: string | null }[]; ics: string };

export interface PlannerService {
  myDay(date: string): Promise<MyDay>;
  generate(input: { startDate: string; days: number; dailyMinutes: number; goal: string; mode?: 'new' | 'replan' }): Promise<PlannerDraft>;
  saveDraft(input: PlannerDraft): Promise<void>;
  addSession(input: { title: string; scheduledAt: string; durationMinutes: number; sectionId?: string; assignmentId?: string }): Promise<PlannerStudySession>;
  setSessionStatus(id: string, status: PlannerStudySession['status']): Promise<PlannerStudySession>;
  startFocus(input: { title: string; durationMinutes: number; studySessionId?: string }): Promise<{ id: string; startedAt: string }>;
  completeFocus(id: string): Promise<void>;
  insights(): Promise<PlannerInsights>;
  addGoal(input: { title: string; targetDate?: string; weeklyTargetMinutes: number }): Promise<StudyGoal>;
  syncReminders(): Promise<void>;
  studySources(): Promise<StudySources>;
  generateStudyAid(input: { sectionId: string; kind: 'summary' | 'flashcards' | 'quiz' | 'checklist'; sourceId?: string; notes: string }): Promise<StudyArtifact>;
  opportunities(): Promise<{ programName: string; opportunities: MatchedOpportunity[] }>;
  setOpportunityBookmark(id: string, bookmarked: boolean): Promise<void>;
  calendarExport(): Promise<PlannerCalendar>;
}

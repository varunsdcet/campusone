import type { ActivityType } from '../../../domain/types';
import { Routes } from '../../../navigation/routes';

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  reading: 'Reading',
  lecture: 'Lecture',
  practiceQuiz: 'Practice quiz',
  matching: 'Matching',
  assessment: 'Assessment',
};

export const ACTIVITY_ROUTE: Record<ActivityType, 'StudentReading' | 'StudentLecture' | 'StudentPracticeQuiz' | 'StudentMatching' | 'StudentAssessment'> = {
  reading: Routes.StudentReading,
  lecture: Routes.StudentLecture,
  practiceQuiz: Routes.StudentPracticeQuiz,
  matching: Routes.StudentMatching,
  assessment: Routes.StudentAssessment,
};

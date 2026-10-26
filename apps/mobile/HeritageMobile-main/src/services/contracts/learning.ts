import type {
  Programme, Bookmark, Enrolment, Payment, LearningProgress, Certificate, CoachConversation, CoachMessage, ActivityType,
} from '../../domain/types';

export interface CatalogueFilters {
  query?: string;
  subject?: string;
  level?: string;
  category?: string;
}

export interface CatalogueService {
  listProgrammes(filters?: CatalogueFilters): Promise<Programme[]>;
  getProgramme(programmeId: string): Promise<Programme>;
  listBookmarks(userId: string): Promise<Bookmark[]>;
  toggleBookmark(userId: string, programmeId: string): Promise<{ bookmarked: boolean }>;
}

export type CheckoutOutcome = 'success' | 'cancel' | 'fail';

export interface EnrolmentService {
  listEnrolments(userId: string): Promise<Enrolment[]>;
  getEnrolment(userId: string, programmeId: string): Promise<Enrolment | null>;
  /** DEMO checkout. Never charges money. Deterministic outcome chosen by the caller. */
  checkout(input: { userId: string; programmeId: string; outcome: CheckoutOutcome }): Promise<{ payment: Payment; enrolment?: Enrolment }>;
  listPayments(userId: string): Promise<Payment[]>;
  /** Hosted card checkout (live API): returns the payment page and the URLs it redirects to when done. */
  startCardCheckout?(input: { userId: string; programmeId: string }): Promise<{ url: string; successUrl: string; cancelUrl: string }>;
  /** Verifies a completed hosted checkout session and records the paid enrolment. */
  completeCardCheckout?(input: { userId: string; programmeId: string; sessionId: string }): Promise<{ payment: Payment; enrolment: Enrolment }>;
}

export interface ActivityGateState {
  activityId: string;
  unlocked: boolean; // reachable in sequence + chapter released
  completed: boolean;
  current: boolean;
  chapterReleased: boolean;
  releasesAt?: string;
  reason?: string;
}

export interface ProgressSnapshot {
  progress: LearningProgress;
  gates: Record<string, ActivityGateState>;
  chapterUnlockedCount: number;
  completedCount: number;
  totalCount: number;
  percent: number;
  nextActivityId?: string;
  completedAll: boolean;
  chaptersPassed: number;
}

export interface LearningService {
  getSnapshot(userId: string, programmeId: string): Promise<ProgressSnapshot>;
  recordTime(userId: string, programmeId: string, activityId: string, seconds: number): Promise<void>;
  markReadToBottom(userId: string, programmeId: string, activityId: string): Promise<void>;
  completeActivity(userId: string, programmeId: string, activityId: string): Promise<ProgressSnapshot>;
  saveQuizAnswer(userId: string, programmeId: string, activityId: string, questionId: string, optionIndex: number): Promise<void>;
  submitQuiz(userId: string, programmeId: string, activityId: string, kind: Extract<ActivityType, 'practiceQuiz' | 'assessment'>): Promise<{ score: number; passed: boolean; correct: number; total: number }>;
  resetQuiz(userId: string, programmeId: string, activityId: string): Promise<void>;
  saveMatching(userId: string, programmeId: string, activityId: string, pairId: string, definitionPairId: string | null): Promise<void>;
  submitMatching(userId: string, programmeId: string, activityId: string): Promise<{ score: number; passed: boolean; correct: number; total: number; wrongPairIds: string[] }>;
  getCertificate(userId: string, programmeId: string): Promise<Certificate | null>;
  issueDemoCertificate(userId: string, programmeId: string): Promise<Certificate>;
  /** Developer scenario: marks everything before `activityId` complete (same records the UI uses). */
  devJumpTo(userId: string, programmeId: string, activityId: string): Promise<ProgressSnapshot>;
}

export interface CoachService {
  getConversation(userId: string, programmeId: string, chapterId: string): Promise<CoachConversation>;
  ask(input: { userId: string; programmeId: string; chapterId: string; activityId: string; prompt: string }): Promise<CoachMessage>;
  clear(userId: string, programmeId: string, chapterId: string): Promise<void>;
}

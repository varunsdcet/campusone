import type { AiDraftStoryboard } from '../../domain/types';

/** Enrolled-course learning surfaces (LMS content, quizzes, lectures, lab notes, assessments, live classes). Live API only. */

export interface CourseQuizQuestion {
  id: string;
  text: string;
  answers: string[];
  /** Marks for this question (API `mark`). */
  points?: number;
}

export interface CourseQuizAttempt {
  score: number;
  maxScore: number;
  submittedAt: string;
}

export interface CourseChoice {
  options: string[];
  multiple: boolean;
  response: { selected: string[]; submittedAt: string } | null;
}

export interface CourseActivity {
  id: string;
  /** Upper-case LMS type: PAGE, FILE, FOLDER, QUIZ, CHOICE, FORUM, ASSIGN, URL, BIGBLUEBUTTON, … */
  type: string;
  name: string;
  body?: string;
  description?: string;
  note?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  /** External https link. */
  url?: string;
  /** Live-class launcher; `liveSectionId` is set when it points at the in-app BigBlueButton room. */
  joinUrl?: string;
  liveSectionId?: string;
  assignmentId?: string;
  /** AI avatar lesson video script. */
  storyboard?: AiDraftStoryboard;
  questions?: CourseQuizQuestion[];
  quizMinutes?: number | null;
  /** Quiz close date set by the instructor ("Close the quiz" activity setting), ISO. */
  closesAt?: string;
  /** True when the quiz has an answer key on the server and accepts one graded attempt. */
  gradable: boolean;
  quizAttempt?: CourseQuizAttempt | null;
  choice?: CourseChoice;
}

export interface CourseTopic {
  id: string;
  title: string;
  summary?: string;
  activities: CourseActivity[];
}

export interface CourseLms {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  dayBlocks: { id: string; label: string; title: string; lessons: { id: string; title: string; body: string; href?: string; completed: boolean }[] }[];
  folders: { id: string; name: string; items: { id: string; title: string; kind: string; href?: string; sizeLabel?: string }[] }[];
  syllabus: { id: string; title: string; level: number }[];
  topics: CourseTopic[];
  gradeScheme: { title: string; weightPercent: number }[];
  location?: string;
  instructorName?: string;
  sessionLabel?: string;
  liveSectionId?: string;
}

export interface CourseContentItem {
  /** Progress key, e.g. `session:<id>` or `assignment:<id>`. */
  id: string;
  kind: 'lecture' | 'lab' | 'resource';
  title: string;
  startsAt?: string;
  location?: string;
  dueAt?: string;
  sessionId?: string;
  assignmentId?: string;
  liveSectionId?: string;
  completed: boolean;
}

export interface CourseContent {
  progressPct: number;
  completedCount: number;
  totalCount: number;
  items: CourseContentItem[];
}

export interface CourseSession {
  id: string;
  sectionId: string;
  courseCode: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  joinUrl: string | null;
  liveSectionId?: string;
  sessionKind: 'lecture' | 'lab';
  deliveryMode: string | null;
}

export interface LabNotebook {
  id: string;
  classSessionId: string;
  title: string;
  body: string;
  version: number;
  rowVersion: number;
  lockedAt: string | null;
  updatedAt: string;
}

export interface LabAccess {
  accessStatus: string;
  canLaunchVirtualLabs: boolean;
  eligibility: { id: string; status: string; clearedOn: string | null; expiresOn: string | null; training: string | null; equipment: string | null; notes: string | null }[];
  virtualLabs: { id: string; name: string; courseId: string; course: string; provider: string | null; seats: number; canLaunch: boolean }[];
}

export interface CourseAssessment {
  id: string;
  sectionId: string;
  courseCode: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  maxAttempts: number;
  attemptCount: number;
  openAttemptId: string | null;
  state: 'upcoming' | 'open' | 'in_progress' | 'submitted' | 'closed';
}

export interface SyllabusInfo {
  available: boolean;
  name?: string;
  mime?: string;
  size?: number | null;
  updatedAt?: string | null;
  description: string;
}

export interface LiveRoomStatus {
  provider: 'bigbluebutton' | 'jitsi';
  sectionId: string;
  meetingName: string;
  courseCode: string;
  sectionCode: string;
  role: 'moderator' | 'viewer';
  canJoin: boolean;
  running: boolean | null;
  participantCount: number | null;
  recording: boolean | null;
  startedAt: string | null;
}

export type LiveJoinResult =
  | { status: 'ready'; provider: 'bigbluebutton' | 'jitsi'; role: 'moderator' | 'viewer'; meetingName: string; url: string }
  | { status: 'waiting'; provider: 'bigbluebutton' | 'jitsi'; role: 'moderator' | 'viewer'; meetingName: string };

export interface LiveRecording {
  recordId: string;
  name: string;
  published: boolean;
  startTime: string | null;
  endTime: string | null;
  participants: number;
  playbackUrl: string | null;
  lengthMinutes: number | null;
}

export interface CourseLearningService {
  getLms(sectionId: string): Promise<CourseLms>;
  getContent(sectionId: string): Promise<CourseContent>;
  markComplete(sectionId: string, itemId: string): Promise<{ completed: string[] }>;
  submitQuiz(sectionId: string, activityId: string, answers: Record<string, number>): Promise<CourseQuizAttempt & { results: { id: string; correct: boolean }[] }>;
  submitChoice(sectionId: string, activityId: string, selected: string[]): Promise<{ selected: string[]; submittedAt: string }>;
  listSessions(sectionId: string, kind: 'lecture' | 'lab'): Promise<CourseSession[]>;
  getSession(sessionId: string): Promise<CourseSession>;
  getNotebook(sessionId: string): Promise<LabNotebook>;
  saveNotebook(sessionId: string, input: { title: string; body: string; rowVersion?: number }): Promise<LabNotebook>;
  getLabAccess(): Promise<LabAccess>;
  launchVirtualLab(id: string): Promise<{ url: string }>;
  listAssessments(sectionId: string): Promise<CourseAssessment[]>;
  startAssessment(assessmentId: string): Promise<{ attemptId: string; expiresAt: string }>;
  submitAssessment(attemptId: string): Promise<{ attemptId: string; submittedAt: string }>;
  getSyllabus(sectionId: string): Promise<SyllabusInfo>;
  /** Downloads the released syllabus to a local file and returns its path. */
  downloadSyllabus(sectionId: string): Promise<{ path: string; name: string; mime: string }>;
  /** Downloads an uploaded LMS activity file to a local file and returns its path. */
  downloadFile(sectionId: string, fileId: string): Promise<{ path: string; name: string; mime: string }>;
  liveStatus(sectionId: string): Promise<LiveRoomStatus>;
  joinLive(sectionId: string): Promise<LiveJoinResult>;
  endLive(sectionId: string): Promise<{ ended: boolean }>;
  liveRecordings(sectionId: string): Promise<LiveRecording[]>;
}

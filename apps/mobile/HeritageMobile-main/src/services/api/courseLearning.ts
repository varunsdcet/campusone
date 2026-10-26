import * as RNFS from '@dr.pogodin/react-native-fs';
import type {
  CourseActivity, CourseAssessment, CourseContent, CourseContentItem, CourseLearningService, CourseLms, CourseSession, LabAccess, LabNotebook, LiveJoinResult, LiveRecording, LiveRoomStatus, SyllabusInfo,
} from '../contracts/courseLearning';
import type { AiDraftStoryboard } from '../../domain/types';
import type { ApiClient } from './client';

/* ------------------------------ DTOs ------------------------------ */

interface ActivityDto {
  id: string;
  type: string;
  name: string;
  body?: string;
  description?: string;
  note?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  url?: string;
  joinUrl?: string | null;
  assignmentId?: string;
  storyboard?: AiDraftStoryboard;
  questions?: { id: string; text: string; answers: string[]; mark?: string }[];
  quizMinutes?: number | null;
  settings?: Record<string, string>;
  quizAttempt?: { score: number; maxScore: number; submittedAt: string } | null;
  choice?: { options: string[]; multiple: boolean; response?: { selected: string[]; submittedAt: string } | null };
}

interface LmsDto {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  dayBlocks?: { id: string; label: string; title: string; lessons: { id: string; title: string; body: string; resourceHref: string | null; completed: boolean }[] }[];
  folders?: { id: string; name: string; items: { id: string; title: string; kind: string; href: string | null; sizeLabel?: string | null }[] }[];
  syllabus?: { id: string; title: string; level: number }[];
  topics?: { id: string; title: string; summary?: string; activities: (ActivityDto & { hidden?: boolean })[] }[];
  gradeScheme?: { title: string; weightPercent: number }[];
  sessionLabel?: string;
  location?: string;
  instructorName?: string;
  joinUrl?: string | null;
}

interface ContentDto {
  progressPct: number;
  completedCount: number;
  totalCount: number;
  items: { id: string; kind: 'lecture' | 'lab' | 'resource'; title: string; detail: string; href: string | null; joinUrl: string | null; completed: boolean }[];
}

type SessionDto = Omit<CourseSession, 'liveSectionId'>;

/** Section id of an in-app live-class launcher (`/live/<sectionId>`, relative or absolute). */
export function liveSectionIdOf(url?: string | null): string | undefined {
  const m = /^(?:https?:\/\/[^/]+)?\/live\/([0-9a-zA-Z-]+)\/?$/.exec(url?.trim() ?? '');
  return m?.[1];
}

const enc = encodeURIComponent;
const ISO = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/;

function isoDate(raw?: string): string | undefined {
  const d = raw?.trim() ? new Date(raw.trim()) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
}

function mapActivity(a: ActivityDto): CourseActivity {
  const type = a.type.toUpperCase();
  return {
    id: a.id,
    type,
    name: a.name,
    body: a.body || undefined,
    description: a.description || undefined,
    note: a.note || undefined,
    fileName: a.fileName || undefined,
    fileId: a.fileId || undefined,
    fileSize: a.fileSize,
    url: a.url && /^https:\/\//i.test(a.url) ? a.url : undefined,
    joinUrl: a.joinUrl || undefined,
    liveSectionId: liveSectionIdOf(a.joinUrl),
    assignmentId: a.assignmentId || undefined,
    storyboard: a.storyboard?.slides?.length ? a.storyboard : undefined,
    questions: a.questions?.map(q => ({ id: q.id, text: q.text, answers: q.answers, points: q.mark !== undefined && Number.isFinite(Number(q.mark)) ? Number(q.mark) : undefined })),
    quizMinutes: a.quizMinutes,
    closesAt: type === 'QUIZ' ? isoDate(a.settings?.['Close the quiz']) : undefined,
    gradable: type === 'QUIZ' && a.quizAttempt !== undefined,
    quizAttempt: a.quizAttempt,
    choice: a.choice ? { options: a.choice.options, multiple: a.choice.multiple, response: a.choice.response ?? null } : undefined,
  };
}

function mapContentItem(i: ContentDto['items'][number]): CourseContentItem {
  const iso = ISO.exec(i.detail)?.[0];
  const [, location] = i.detail.split(' · ');
  const isSession = i.id.startsWith('session:');
  return {
    id: i.id,
    kind: i.kind,
    title: i.title,
    startsAt: isSession ? iso : undefined,
    location: isSession ? location : undefined,
    dueAt: !isSession && /^Due /.test(i.detail) ? iso : undefined,
    sessionId: isSession ? i.id.slice('session:'.length) : undefined,
    assignmentId: i.id.startsWith('assignment:') ? i.id.slice('assignment:'.length) : undefined,
    liveSectionId: liveSectionIdOf(i.joinUrl),
    completed: i.completed,
  };
}

const withLive = (s: SessionDto): CourseSession => ({ ...s, liveSectionId: liveSectionIdOf(s.joinUrl) });

async function saveBase64(name: string, base64: string): Promise<string> {
  const safe = (name || 'file').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
  const path = `${RNFS.CachesDirectoryPath}/${safe}`;
  if (await RNFS.exists(path)) await RNFS.unlink(path);
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

/* --------------------------- Service ------------------------------ */

export function createCourseLearningApi(api: ApiClient): { courseLearning: CourseLearningService } {
  const sessions = async (kind: 'lecture' | 'lab') => (await api.get<{ lectures: SessionDto[] }>(kind === 'lab' ? '/student/labs' : '/student/lectures')).lectures;

  const courseLearning: CourseLearningService = {
    async getLms(sectionId) {
      const d = await api.get<LmsDto>(`/student/courses/${enc(sectionId)}/lms`);
      const lms: CourseLms = {
        sectionId: d.sectionId,
        courseCode: d.courseCode,
        courseTitle: d.courseTitle,
        dayBlocks: (d.dayBlocks ?? []).map(b => ({ id: b.id, label: b.label, title: b.title, lessons: b.lessons.map(l => ({ id: l.id, title: l.title, body: l.body, href: l.resourceHref ?? undefined, completed: l.completed })) })),
        folders: (d.folders ?? []).map(f => ({ id: f.id, name: f.name, items: f.items.map(it => ({ id: it.id, title: it.title, kind: it.kind, href: it.href ?? undefined, sizeLabel: it.sizeLabel ?? undefined })) })),
        syllabus: d.syllabus ?? [],
        topics: (d.topics ?? []).map(t => ({ id: t.id, title: t.title, summary: t.summary || undefined, activities: t.activities.filter(a => !a.hidden).map(mapActivity) })),
        gradeScheme: d.gradeScheme ?? [],
        location: d.location,
        instructorName: d.instructorName,
        sessionLabel: d.sessionLabel,
        liveSectionId: liveSectionIdOf(d.joinUrl),
      };
      return lms;
    },
    async getContent(sectionId) {
      const d = await api.get<ContentDto>(`/student/courses/${enc(sectionId)}/content`);
      const content: CourseContent = { progressPct: d.progressPct, completedCount: d.completedCount, totalCount: d.totalCount, items: d.items.map(mapContentItem) };
      return content;
    },
    async markComplete(sectionId, itemId) {
      const d = await api.post<{ completed: string[] }>(`/student/courses/${enc(sectionId)}/content/${enc(itemId)}/complete`, {});
      return { completed: d.completed };
    },
    submitQuiz: (sectionId, activityId, answers) => api.post(`/student/courses/${enc(sectionId)}/quizzes/${enc(activityId)}/attempts`, { answers }),
    submitChoice: (sectionId, activityId, selected) => api.post(`/student/courses/${enc(sectionId)}/choices/${enc(activityId)}/responses`, { selected }),
    async listSessions(sectionId, kind) {
      return (await sessions(kind)).filter(s => s.sectionId === sectionId).map(withLive);
    },
    async getSession(sessionId) {
      return withLive((await api.get<{ lecture: SessionDto }>(`/student/lectures/${enc(sessionId)}`)).lecture);
    },
    getNotebook: sessionId => api.get<LabNotebook>(`/student/labs/${enc(sessionId)}/notebook`),
    saveNotebook: (sessionId, input) => api.put<LabNotebook>(`/student/labs/${enc(sessionId)}/notebook`, input),
    getLabAccess: () => api.get<LabAccess>('/student/labs/access'),
    launchVirtualLab: id => api.post<{ url: string }>(`/student/labs/virtual/${enc(id)}/launch`, {}),
    async listAssessments(sectionId) {
      const d = await api.get<{ assessments: CourseAssessment[] }>('/student/assessments');
      return d.assessments.filter(a => a.sectionId === sectionId);
    },
    startAssessment: id => api.post(`/student/assessments/${enc(id)}/start`, {}),
    submitAssessment: attemptId => api.post(`/student/assessments/attempts/${enc(attemptId)}/submit`, {}),
    getSyllabus: sectionId => api.get<SyllabusInfo>(`/me/courses/${enc(sectionId)}/syllabus`),
    async downloadSyllabus(sectionId) {
      const f = await api.get<{ name: string; mime: string; base64: string }>(`/me/courses/${enc(sectionId)}/syllabus/file`);
      return { path: await saveBase64(f.name || 'syllabus', f.base64), name: f.name || 'Syllabus', mime: f.mime || 'application/octet-stream' };
    },
    async downloadFile(sectionId, fileId) {
      const f = await api.get<{ name: string; mime: string; base64: string }>(`/lms-files/${enc(sectionId)}/${enc(fileId)}`);
      return { path: await saveBase64(f.name || 'file', f.base64), name: f.name || 'File', mime: f.mime || 'application/octet-stream' };
    },
    liveStatus: sectionId => api.get<LiveRoomStatus>(`/live/sections/${enc(sectionId)}`),
    joinLive: sectionId => api.post<LiveJoinResult>(`/live/sections/${enc(sectionId)}/join`, {}),
    endLive: sectionId => api.post<{ ended: boolean }>(`/live/sections/${enc(sectionId)}/end`, {}),
    async liveRecordings(sectionId) {
      return (await api.get<{ recordings: LiveRecording[] }>(`/live/sections/${enc(sectionId)}/recordings`)).recordings;
    },
  };
  return { courseLearning };
}

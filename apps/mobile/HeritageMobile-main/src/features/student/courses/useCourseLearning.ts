import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { useCurrentUserId } from '../../../state/sessionStore';
import { ServiceError } from '../../../services/errors';
import type { CourseLearningService } from '../../../services/contracts';

const key = {
  lms: (userId: string, sectionId: string) => ['courseLms', userId, sectionId] as const,
  content: (userId: string, sectionId: string) => ['courseContent', userId, sectionId] as const,
  sessions: (userId: string, sectionId: string, kind: string) => ['courseSessions', userId, sectionId, kind] as const,
  session: (userId: string, sessionId: string) => ['courseSession', userId, sessionId] as const,
  notebook: (userId: string, sessionId: string) => ['labNotebook', userId, sessionId] as const,
  labAccess: (userId: string) => ['labAccess', userId] as const,
  assessments: (userId: string, sectionId: string) => ['courseAssessments', userId, sectionId] as const,
  syllabus: (userId: string, sectionId: string) => ['courseSyllabus', userId, sectionId] as const,
  live: (userId: string, sectionId: string) => ['liveRoom', userId, sectionId] as const,
  recordings: (userId: string, sectionId: string) => ['liveRecordings', userId, sectionId] as const,
};

/** The live course-learning service; absent in mock mode, so callers must only enable queries in live mode. */
export function useCourseLearning(): CourseLearningService {
  const s = useServices();
  return (
    s.courseLearning ??
    new Proxy({} as CourseLearningService, {
      get: () => () => Promise.reject(new ServiceError('NOT_CONFIGURED', 'Course learning requires the live Heritage API.')),
    })
  );
}

export function useCourseLms(sectionId: string, enabled = true) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.lms(userId, sectionId), queryFn: () => cl.getLms(sectionId), enabled });
}

export function useCourseContent(sectionId: string, enabled = true) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.content(userId, sectionId), queryFn: () => cl.getContent(sectionId), enabled });
}

export function useMarkComplete(sectionId: string) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => cl.markComplete(sectionId, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key.content(userId, sectionId) });
      qc.invalidateQueries({ queryKey: key.lms(userId, sectionId) });
    },
  });
}

export function useSubmitQuiz(sectionId: string) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { activityId: string; answers: Record<string, number> }) => cl.submitQuiz(sectionId, p.activityId, p.answers),
    onSettled: () => qc.invalidateQueries({ queryKey: key.lms(userId, sectionId) }),
  });
}

export function useSubmitChoice(sectionId: string) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: { activityId: string; selected: string[] }) => cl.submitChoice(sectionId, p.activityId, p.selected),
    onSuccess: () => qc.invalidateQueries({ queryKey: key.lms(userId, sectionId) }),
  });
}

export function useCourseSessions(sectionId: string, kind: 'lecture' | 'lab') {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.sessions(userId, sectionId, kind), queryFn: () => cl.listSessions(sectionId, kind) });
}

export function useCourseSession(sessionId: string) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.session(userId, sessionId), queryFn: () => cl.getSession(sessionId) });
}

export function useLabNotebook(sessionId: string | undefined) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const notebook = useQuery({ queryKey: key.notebook(userId, sessionId ?? ''), queryFn: () => cl.getNotebook(sessionId!), enabled: Boolean(sessionId) });
  const save = useMutation({
    mutationFn: (input: { title: string; body: string; rowVersion?: number }) => cl.saveNotebook(sessionId!, input),
    onSuccess: nb => qc.setQueryData(key.notebook(userId, nb.classSessionId), nb),
  });
  return { notebook, save };
}

export function useLabAccess(enabled = true) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.labAccess(userId), queryFn: () => cl.getLabAccess(), enabled });
}

export function useCourseAssessments(sectionId: string) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: key.assessments(userId, sectionId), queryFn: () => cl.listAssessments(sectionId) });
  const refresh = () => qc.invalidateQueries({ queryKey: key.assessments(userId, sectionId) });
  return {
    list,
    start: useMutation({ mutationFn: (assessmentId: string) => cl.startAssessment(assessmentId), onSettled: refresh }),
    submit: useMutation({ mutationFn: (attemptId: string) => cl.submitAssessment(attemptId), onSettled: refresh }),
  };
}

export function useSyllabus(sectionId: string, enabled = true) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: key.syllabus(userId, sectionId), queryFn: () => cl.getSyllabus(sectionId), enabled });
}

export function useLiveRoom(sectionId: string, enabled = true) {
  const cl = useCourseLearning();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: key.live(userId, sectionId), queryFn: () => cl.liveStatus(sectionId), enabled, refetchInterval: 20_000 });
  const recordings = useQuery({ queryKey: key.recordings(userId, sectionId), queryFn: () => cl.liveRecordings(sectionId), enabled });
  const refresh = () => qc.invalidateQueries({ queryKey: key.live(userId, sectionId) });
  return {
    status,
    recordings,
    join: useMutation({ mutationFn: () => cl.joinLive(sectionId), onSettled: refresh }),
    end: useMutation({ mutationFn: () => cl.endLive(sectionId), onSettled: refresh }),
  };
}

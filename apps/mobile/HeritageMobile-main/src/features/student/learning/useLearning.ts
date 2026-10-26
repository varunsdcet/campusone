import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUserId } from '../../../state/sessionStore';
import type { Activity, Chapter, Programme } from '../../../domain/types';
import { useClockTick } from '../../shared/hooks';
import { progressionPolicy } from '../../../config/progressionPolicy';

export function useSnapshot(programmeId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.snapshot(userId, programmeId), queryFn: () => s.learning.getSnapshot(userId, programmeId) });
}

export function findActivity(programme: Programme | undefined, activityId: string): { chapter: Chapter; activity: Activity; index: number; all: Activity[] } | null {
  if (!programme) return null;
  const all = programme.chapters.flatMap(c => c.activities);
  const index = all.findIndex(a => a.id === activityId);
  if (index < 0) return null;
  const activity = all[index];
  const chapter = programme.chapters.find(c => c.id === activity.chapterId)!;
  return { chapter, activity, index, all };
}

export function useInvalidateLearning(programmeId: string) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  return () => {
    qc.invalidateQueries({ queryKey: qk.snapshot(userId, programmeId) });
    qc.invalidateQueries({ queryKey: qk.enrolments(userId) });
    qc.invalidateQueries({ queryKey: qk.certificate(userId, programmeId) });
  };
}

/** Records time spent on an activity (every 5s + on unmount) and exposes the gate countdown. */
export function useActivityTimer(programmeId: string, activity: Activity | undefined, secondsAlready: number) {
  const s = useServices();
  const userId = useCurrentUserId();
  const invalidate = useInvalidateLearning(programmeId);
  const start = useRef(Date.now());
  const flushed = useRef(0);
  const now = useClockTick(1000);
  const elapsed = Math.floor((now - start.current) / 1000);
  const need = activity ? progressionPolicy.activityGateSeconds[activity.type] : 0;
  const total = secondsAlready + Math.max(0, Math.floor((Date.now() - start.current) / 1000));
  const remaining = Math.max(0, need - total);
  useEffect(() => {
    if (!activity) return;
    const flush = () => {
      const totalNow = Math.floor((Date.now() - start.current) / 1000);
      const delta = totalNow - flushed.current;
      if (delta > 0) {
        flushed.current = totalNow;
        void s.learning.recordTime(userId, programmeId, activity.id, delta);
      }
    };
    const id = setInterval(flush, 5000);
    return () => {
      clearInterval(id);
      flush();
      invalidate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id]);
  void elapsed;
  return { remaining, need, total };
}

export function useCompleteActivity(programmeId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  const invalidate = useInvalidateLearning(programmeId);
  return useMutation({
    mutationFn: async (activityId: string) => {
      // Flush any un-recorded seconds first is handled by the timer hook; here we just complete.
      return s.learning.completeActivity(userId, programmeId, activityId);
    },
    onSuccess: invalidate,
  });
}

export function useLearningMutations(programmeId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  const invalidate = useInvalidateLearning(programmeId);
  return {
    saveAnswer: useMutation({ mutationFn: (p: { activityId: string; questionId: string; optionIndex: number }) => s.learning.saveQuizAnswer(userId, programmeId, p.activityId, p.questionId, p.optionIndex), onSuccess: invalidate }),
    submitQuiz: useMutation({ mutationFn: (p: { activityId: string; kind: 'practiceQuiz' | 'assessment' }) => s.learning.submitQuiz(userId, programmeId, p.activityId, p.kind), onSuccess: invalidate }),
    resetQuiz: useMutation({ mutationFn: (activityId: string) => s.learning.resetQuiz(userId, programmeId, activityId), onSuccess: invalidate }),
    saveMatching: useMutation({ mutationFn: (p: { activityId: string; pairId: string; definitionPairId: string | null }) => s.learning.saveMatching(userId, programmeId, p.activityId, p.pairId, p.definitionPairId), onSuccess: invalidate }),
    submitMatching: useMutation({ mutationFn: (activityId: string) => s.learning.submitMatching(userId, programmeId, activityId), onSuccess: invalidate }),
    markReadToBottom: useMutation({ mutationFn: (activityId: string) => s.learning.markReadToBottom(userId, programmeId, activityId), onSuccess: invalidate }),
    issueCertificate: useMutation({ mutationFn: () => s.learning.issueDemoCertificate(userId, programmeId), onSuccess: invalidate }),
  };
}

export function useCertificate(programmeId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.certificate(userId, programmeId), queryFn: () => s.learning.getCertificate(userId, programmeId) });
}

export function useCoach(programmeId: string, chapterId: string) {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const conversation = useQuery({ queryKey: qk.coach(userId, chapterId), queryFn: () => s.coach.getConversation(userId, programmeId, chapterId) });
  const ask = useMutation({
    mutationFn: (p: { activityId: string; prompt: string }) => s.coach.ask({ userId, programmeId, chapterId, ...p }),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.coach(userId, chapterId) }),
  });
  const clear = useMutation({ mutationFn: () => s.coach.clear(userId, programmeId, chapterId), onSuccess: () => qc.invalidateQueries({ queryKey: qk.coach(userId, chapterId) }) });
  return { conversation, ask, clear };
}

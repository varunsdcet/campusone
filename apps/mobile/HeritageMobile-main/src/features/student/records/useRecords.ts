import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUserId } from '../../../state/sessionStore';
import type { SubmissionAttachment, ChangeRequest } from '../../../domain/types';
import type { CourseEvaluationInput } from '../../../services/contracts/records';
import { ServiceError } from '../../../services/errors';

export function useFinalMarks() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.finalMarks(userId), queryFn: () => s.grades.listFinalMarks(userId) });
}
export function useBadges() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.badges(userId), queryFn: () => s.records.listBadges(userId) });
}
export function useExtracurricular() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.extracurricular(userId), queryFn: () => s.records.listExtracurricular(userId) });
}
export function usePlan() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.plan(userId), queryFn: () => s.records.listPlan(userId) });
}
export function useAcademicProfile() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.getAcademicProfile;
  return { supported: Boolean(fn), ...useQuery({ queryKey: ['academic-profile', userId], queryFn: () => fn!(), enabled: Boolean(fn) }) };
}
export function useTasks() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.tasks(userId), queryFn: () => s.tasks.list(userId) });
  const complete = useMutation({ mutationFn: (p: { taskId: string; evidence?: SubmissionAttachment; confirmation?: boolean }) => s.tasks.complete({ studentId: userId, ...p }), onSuccess: () => qc.invalidateQueries({ queryKey: qk.tasks(userId) }) });
  return { list, complete };
}
export function useDocuments() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.documents(userId), queryFn: () => s.documents.list(userId) });
}
export function useCompliance() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.getCompliance;
  return { supported: Boolean(fn), ...useQuery({ queryKey: qk.compliance(userId), queryFn: () => fn!(), enabled: Boolean(fn) }) };
}
export function useTaxDocuments() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.taxDocs(userId), queryFn: () => s.documents.listTax(userId) });
}
export function useStatements() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.statements(userId), queryFn: () => s.finance.listStatements(userId) });
}
export function useTransactions(termId?: string) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.transactions(userId, termId), queryFn: () => s.finance.listTransactions(userId, termId) });
}
export function useRequests(kind?: ChangeRequest['kind']) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.requests(userId, kind), queryFn: () => s.requests.list(userId, kind) });
}
export function useRequest(id: string) {
  const s = useServices();
  return useQuery({ queryKey: ['request', id], queryFn: () => s.requests.get(id) });
}
export function useEnglishTests() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.englishTests(userId), queryFn: () => s.requests.listEnglishTests(userId) });
}
/* Live-only surfaces: `enabled` is false (and `supported` false) when the service lacks the method. */
export function usePendingEvaluations() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.listPendingEvaluations;
  return { supported: Boolean(fn), ...useQuery({ queryKey: ['evaluations', userId], queryFn: () => fn!(), enabled: Boolean(fn) }) };
}
export function useEvaluation(evaluationId?: string) {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const get = s.records.getEvaluation;
  const query = useQuery({ queryKey: ['evaluation', userId, evaluationId], queryFn: () => get!(evaluationId!), enabled: Boolean(get && evaluationId) });
  const submit = useMutation({
    mutationFn: (input: CourseEvaluationInput) => {
      if (!s.records.submitEvaluation || !evaluationId) throw new ServiceError('NOT_CONFIGURED', 'Course evaluations are not available.');
      return s.records.submitEvaluation(evaluationId, input);
    },
    onSuccess: ev => {
      qc.setQueryData(['evaluation', userId, evaluationId], ev);
      qc.invalidateQueries({ queryKey: ['evaluations', userId] });
      qc.invalidateQueries({ queryKey: qk.tasks(userId) });
    },
  });
  return { query, submit };
}
export function usePracticum() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const fn = s.records.listPracticum;
  const list = useQuery({ queryKey: ['practicum', userId], queryFn: () => fn!(), enabled: Boolean(fn) });
  const logHours = useMutation({
    mutationFn: (p: { placementId: string; weekLabel: string; hours: number }) => {
      if (!s.records.logPracticumHours) throw new ServiceError('NOT_CONFIGURED', 'Practicum hours are not available.');
      return s.records.logPracticumHours(p);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practicum', userId] }),
  });
  return { supported: Boolean(fn), list, logHours };
}
export function useCareer() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.getCareer;
  return { supported: Boolean(fn), ...useQuery({ queryKey: ['career', userId], queryFn: () => fn!(), enabled: Boolean(fn) }) };
}
export function useCalendars() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.getCalendars;
  return { supported: Boolean(fn), ...useQuery({ queryKey: ['calendars', userId], queryFn: () => fn!(), enabled: Boolean(fn) }) };
}
export function useCredentials() {
  const s = useServices(); const userId = useCurrentUserId();
  const fn = s.records.listCredentials;
  return { supported: Boolean(fn), ...useQuery({ queryKey: ['credentials', userId], queryFn: () => fn!(), enabled: Boolean(fn) }) };
}

export function useRecordMutations() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const inv = () => {
    qc.invalidateQueries({ queryKey: ['requests', userId] });
    qc.invalidateQueries({ queryKey: qk.transactions(userId) });
    qc.invalidateQueries({ queryKey: qk.statements(userId) });
    qc.invalidateQueries({ queryKey: qk.englishTests(userId) });
  };
  return {
    requestTranscript: useMutation({ mutationFn: () => s.records.requestTranscript(userId), onSuccess: inv }),
    requestLetter: useMutation({ mutationFn: (p: { purpose: string; details: string }) => s.documents.requestSpecialLetter({ studentId: userId, ...p }), onSuccess: inv }),
    payBalance: useMutation({ mutationFn: (p: { termId: string; amount: number; outcome: 'success' | 'cancel' | 'fail' }) => s.finance.payBalance({ studentId: userId, ...p }), onSettled: inv }),
    submitPersonalDetails: useMutation({ mutationFn: (payload: Record<string, unknown>) => s.requests.submitPersonalDetails({ studentId: userId, payload }), onSuccess: inv }),
    submitLeave: useMutation({ mutationFn: (p: { startDate: string; endDate: string; reason: string }) => s.requests.submitLeave({ studentId: userId, ...p }), onSuccess: inv }),
    cancelRequest: useMutation({
      mutationFn: (requestId: string) => s.requests.cancel(requestId),
      onSuccess: (_result, requestId) => {
        inv();
        qc.invalidateQueries({ queryKey: ['request', requestId] });
      },
    }),
    registerEnglishTest: useMutation({ mutationFn: (p: Omit<Parameters<typeof s.requests.registerEnglishTest>[0], 'studentId'>) => s.requests.registerEnglishTest({ studentId: userId, ...p }), onSuccess: inv }),
  };
}

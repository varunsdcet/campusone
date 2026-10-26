import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../../app/ServicesProvider';
import { qk } from '../../../app/queryKeys';
import { useCurrentUserId } from '../../../state/sessionStore';
import { isMockMode } from '../../../config/appConfig';

export function useStudentSections() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.studentSections(userId), queryFn: () => s.courses.listStudentSections(userId) });
}

export function activeCourseCount(sections: Array<{ status: string }> | undefined): number | undefined {
  return sections ? sections.filter(section => section.status !== 'Completed').length : undefined;
}

/** Label for the current academic term pill; live mode derives it from enrolled sections. */
export function useCurrentTermLabel(): string | undefined {
  const sections = useStudentSections();
  if (isMockMode()) return 'Fall 2026';
  const terms = (sections.data ?? []).map(s => s.term);
  const label = (terms.find(t => t.status === 'current') ?? terms[0])?.name;
  return label && label !== 'Current term' ? label : undefined;
}

export function useSection(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.section(sectionId), queryFn: () => s.courses.getSection(sectionId) });
}

export function useSessions(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.sessions(sectionId), queryFn: () => s.courses.listSessions(sectionId) });
}

export function useGradeItems(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.gradeItems(sectionId), queryFn: () => s.grades.listGradeItems(sectionId) });
}

export function useStudentMarks() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.studentMarks(userId), queryFn: () => s.grades.listStudentMarks(userId) });
}

export function useAssignments() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.assignments(userId), queryFn: () => s.assignments.listForStudent(userId) });
}

export function useAssignment(assignmentId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.assignment(userId, assignmentId), queryFn: () => s.assignments.get(assignmentId, userId) });
}

export function useAssignmentMutations(assignmentId: string) {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.assignment(userId, assignmentId) });
    qc.invalidateQueries({ queryKey: qk.assignments(userId) });
  };
  return {
    saveDraft: useMutation({ mutationFn: (p: { attachments: Parameters<typeof s.assignments.saveDraft>[0]['attachments']; note?: string }) => s.assignments.saveDraft({ assignmentId, studentId: userId, ...p }), onSuccess: invalidate }),
    submit: useMutation({ mutationFn: (p: { attachments: Parameters<typeof s.assignments.submit>[0]['attachments']; note?: string; failUpload?: boolean; onProgress?: (n: number) => void }) => s.assignments.submit({ assignmentId, studentId: userId, ...p }), onSettled: invalidate }),
  };
}

export function useStudentAttendance() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.attendance(userId), queryFn: () => s.attendance.listStudentRecords(userId) });
}

export function useCorrections() {
  const s = useServices();
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.corrections(userId), queryFn: () => s.attendance.listCorrections(userId) });
  const request = useMutation({ mutationFn: (p: { recordId: string; reason: string }) => s.attendance.requestCorrection({ studentId: userId, ...p }), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.corrections(userId) }); qc.invalidateQueries({ queryKey: qk.requests(userId) }); } });
  return { list, request };
}

export function useWorkshops() {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.workshops(userId), queryFn: () => s.workshops.list(userId) });
}

export function useWorkshop(workshopId: string) {
  const s = useServices();
  const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.workshop(userId, workshopId), queryFn: () => s.workshops.get(workshopId, userId) });
}

export function useWorkshopMutations() {
  const s = useServices();
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.workshops(userId) });
    qc.invalidateQueries({ queryKey: ['workshop', userId] });
    qc.invalidateQueries({ queryKey: qk.badges(userId) });
  };
  return {
    register: useMutation({ mutationFn: (workshopId: string) => s.workshops.register({ studentId: userId, workshopId }), onSuccess: invalidate }),
    drop: useMutation({ mutationFn: (workshopId: string) => s.workshops.drop({ studentId: userId, workshopId }), onSuccess: invalidate }),
    join: useMutation({ mutationFn: (workshopId: string) => s.workshops.join!(workshopId), onSuccess: invalidate }),
  };
}

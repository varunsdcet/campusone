import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../app/ServicesProvider';
import { qk } from '../../app/queryKeys';
import { useCurrentUserId } from '../../state/sessionStore';
import type { LessonPlan, AttendanceStatus, CompetencyDef, SectionBadge, ContentRepository, Faculty, AcademicProgram, ProgramType, Term, InstructorProfile, BadgeBase, FacultyRecord, AiDraftStoryboard } from '../../domain/types';
import type { AiCourseBlueprintEdits, AiCourseBrief, AiCourseState, AiDraftInput } from '../../services/contracts/instructor';
import { ServiceError } from '../../services/errors';

export function useDashboard() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.dashboard(userId), queryFn: () => s.instructor.dashboard(userId) });
}
export function useInstructorSections() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.instructorSections(userId), queryFn: () => s.courses.listInstructorSections(userId) });
}
export function useRoster(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.roster(sectionId), queryFn: () => s.courses.listRoster(sectionId) });
}
export function useAttendanceSummary(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.attendanceSummary(sectionId), queryFn: () => s.attendance.sectionSummary(sectionId) });
}
export function useStudents(filters: Parameters<ReturnType<typeof useServices>['instructor']['listStudents']>[1]) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.students(userId, filters), queryFn: () => s.instructor.listStudents(userId, filters) });
}
export function useStudent(studentId: string) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.student(userId, studentId), queryFn: () => s.instructor.getStudent(userId, studentId) });
}
export function useStudentRecord(studentId: string) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: ['instructorStudentRecord', userId, studentId], queryFn: () => s.instructor.getStudentRecord(userId, studentId) });
}
export function useStudentNotes(studentId: string) {
  const s = useServices(); const qc = useQueryClient();
  const api = s.instructor.studentNotes;
  const key = ['instructorStudentNotes', studentId];
  return {
    supported: !!api,
    list: useQuery({ queryKey: key, queryFn: () => api!.list(studentId), enabled: !!api }),
    add: useMutation({ mutationFn: (text: string) => api!.add(studentId, text), onSuccess: () => qc.invalidateQueries({ queryKey: key }) }),
  };
}
export function useLessonCourses() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.lessonCourses(userId), queryFn: () => s.instructor.listLessonCourses(userId) });
}
export function useLessonPlans(courseId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.lessonPlans(courseId), queryFn: () => s.instructor.listLessonPlans(courseId), enabled: !!courseId });
}
export function useLessonPlan(id: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.lessonPlan(id), queryFn: () => s.instructor.getLessonPlan(id) });
}
export function useLessonMutations(courseId?: string) {
  const s = useServices(); const qc = useQueryClient();
  const inv = (id?: string) => { if (courseId) qc.invalidateQueries({ queryKey: qk.lessonPlans(courseId) }); if (id) qc.invalidateQueries({ queryKey: qk.lessonPlan(id) }); qc.invalidateQueries({ queryKey: ['lessonPlans'] }); };
  return {
    save: useMutation({ mutationFn: (l: LessonPlan) => s.instructor.saveLessonPlan(l), onSuccess: l => inv(l.id) }),
    generate: useMutation({ mutationFn: (p: { lessonId: string; kind: 'lesson' | 'quiz' }) => s.instructor.generateLessonDraft(p.lessonId, p.kind) }),
    publish: useMutation({ mutationFn: (id: string) => s.instructor.publishLessonPlan(id), onSuccess: l => inv(l.id) }),
  };
}
const aiOf = (s: ReturnType<typeof useServices>) => {
  if (!s.instructor.ai) throw new ServiceError('NOT_CONFIGURED', 'AI drafting is not available.', { retryable: false });
  return s.instructor.ai;
};
export const aiCourseBusy = (st?: AiCourseState) => !!st?.job && ((st.job.stage === 'blueprint' && st.job.blueprintTask.status === 'running') || (st.job.stage === 'approved' && (st.running || st.items.some(i => i.status === 'running' || i.status === 'pending'))));
export function useAiDraftCourses() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.aiDraftCourses(userId), queryFn: () => aiOf(s).courses(), enabled: !!s.instructor.ai });
}
export function useAiDraftTopics(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.aiDraftTopics(sectionId), queryFn: () => aiOf(s).topics(sectionId), enabled: !!s.instructor.ai && !!sectionId });
}
export function useAiDraftMutations(sectionId: string) {
  const s = useServices(); const qc = useQueryClient();
  return {
    generate: useMutation({ mutationFn: (p: Omit<AiDraftInput, 'sectionId'>) => aiOf(s).generateDraft({ ...p, sectionId }) }),
    add: useMutation({
      mutationFn: (p: { topicId: string; name: string; html: string; storyboard: AiDraftStoryboard }) => aiOf(s).addDraftToTopic({ ...p, sectionId }),
      onSuccess: () => { qc.invalidateQueries({ queryKey: qk.aiDraftTopics(sectionId) }); qc.invalidateQueries({ queryKey: qk.section(sectionId) }); },
    }),
  };
}
export function useAiCourse(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.aiCourse(sectionId), queryFn: () => aiOf(s).course(sectionId), enabled: !!s.instructor.ai && !!sectionId, refetchInterval: q => (aiCourseBusy(q.state.data) ? 4000 : false) });
}
export function useAiCourseItem(sectionId: string, key: string | null) {
  const s = useServices();
  return useQuery({ queryKey: qk.aiCourseItem(sectionId, key ?? ''), queryFn: () => aiOf(s).preview(sectionId, key!), enabled: !!s.instructor.ai && !!key });
}
export function useAiCourseMutations(sectionId: string) {
  const s = useServices(); const qc = useQueryClient();
  const set = (st: AiCourseState) => { qc.setQueryData(qk.aiCourse(sectionId), st); qc.removeQueries({ queryKey: ['aiCourseItem', sectionId] }); };
  const m = <A>(fn: (a: A) => Promise<AiCourseState>, after?: () => void) => ({ mutationFn: fn, onSuccess: (st: AiCourseState) => { set(st); after?.(); } });
  return {
    blueprint: useMutation(m((brief: AiCourseBrief) => aiOf(s).startBlueprint(sectionId, brief))),
    save: useMutation(m((edits: AiCourseBlueprintEdits) => aiOf(s).saveBlueprint(sectionId, edits))),
    approve: useMutation(m<void>(() => aiOf(s).approve(sectionId))),
    run: useMutation(m((key: string | undefined) => aiOf(s).run(sectionId, key))),
    publish: useMutation(m<void>(() => aiOf(s).publish(sectionId), () => { qc.invalidateQueries({ queryKey: qk.section(sectionId) }); qc.invalidateQueries({ queryKey: qk.aiDraftTopics(sectionId) }); })),
    reopen: useMutation(m<void>(() => aiOf(s).reopen(sectionId))),
    discard: useMutation(m<void>(() => aiOf(s).discard(sectionId))),
  };
}
export function useAttendanceForDate(date: string, sectionId?: string) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.attendanceDate(userId, date, sectionId), queryFn: () => s.attendance.listForDate(userId, date, sectionId) });
}
export function useAttendanceMutations() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: ['attendanceDate'] }); qc.invalidateQueries({ queryKey: ['attendanceSummary'] }); qc.invalidateQueries({ queryKey: ['attendance'] }); qc.invalidateQueries({ queryKey: ['logs'] }); qc.invalidateQueries({ queryKey: qk.dashboard(userId) }); qc.invalidateQueries({ queryKey: ['instructorStudentRecord'] }); };
  type Input = { sectionId: string; date: string; entries: { studentId: string; status: AttendanceStatus; note?: string }[] };
  return {
    saveDraft: useMutation({ mutationFn: (p: Input) => s.attendance.saveDraft({ instructorId: userId, ...p }), onSuccess: inv }),
    submit: useMutation({ mutationFn: (p: Input) => s.attendance.submit({ instructorId: userId, ...p }), onSuccess: inv }),
  };
}
export function useSectionMarks(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.marks(sectionId), queryFn: () => s.grades.listMarks(sectionId) });
}
export function useGradeMutations(sectionId: string) {
  const s = useServices(); const qc = useQueryClient(); const userId = useCurrentUserId();
  const inv = () => { qc.invalidateQueries({ queryKey: qk.marks(sectionId) }); qc.invalidateQueries({ queryKey: qk.gradeItems(sectionId) }); qc.invalidateQueries({ queryKey: ['gradeOverview'] }); qc.invalidateQueries({ queryKey: qk.dashboard(userId) }); qc.invalidateQueries({ queryKey: ['logs'] }); qc.invalidateQueries({ queryKey: ['instructorStudentRecord'] }); };
  return {
    addItem: useMutation({ mutationFn: (p: { name: string; weightPct: number; maxPoints: number }) => s.grades.addGradeItem({ sectionId, ...p }), onSuccess: inv }),
    saveDraft: useMutation({ mutationFn: (marks: { gradeItemId: string; studentId: string; score?: number; feedback?: string }[]) => s.grades.saveDraftMarks({ sectionId, marks }), onSuccess: inv }),
    submit: useMutation({ mutationFn: () => s.grades.submitMarks(sectionId), onSuccess: inv }),
    release: useMutation({ mutationFn: () => s.grades.releaseMarks(sectionId), onSuccess: inv }),
    exportCsv: useMutation({ mutationFn: () => s.grades.exportGradesCsv(sectionId) }),
  };
}
export function useSubmissionsForSection(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.submissionsForSection(sectionId), queryFn: () => s.assignments.listSubmissionsForSection(sectionId) });
}
export function useCompetencies(sectionId: string) {
  const s = useServices(); const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.competencies(sectionId), queryFn: () => s.instructor.listCompetencies(sectionId) });
  const inv = () => qc.invalidateQueries({ queryKey: qk.competencies(sectionId) });
  return { list,
    save: useMutation({ mutationFn: (d: Omit<CompetencyDef, 'id'> & { id?: string }) => s.instructor.saveCompetency(d), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => s.instructor.deleteCompetency(id), onSuccess: inv }),
    assess: useMutation({ mutationFn: (p: { competencyId: string; studentId: string; level: string }) => s.instructor.assessCompetency(p), onSuccess: inv }) };
}
export function useSectionBadges(sectionId: string) {
  const s = useServices(); const qc = useQueryClient();
  const list = useQuery({ queryKey: qk.sectionBadges(sectionId), queryFn: () => s.instructor.listSectionBadges(sectionId) });
  const inv = () => qc.invalidateQueries({ queryKey: qk.sectionBadges(sectionId) });
  return { list, save: useMutation({ mutationFn: (b: Omit<SectionBadge, 'id'> & { id?: string }) => s.instructor.saveSectionBadge(b), onSuccess: inv }), remove: useMutation({ mutationFn: (id: string) => s.instructor.deleteSectionBadge(id), onSuccess: inv }) };
}
export function useLogs(filters: Parameters<ReturnType<typeof useServices>['instructor']['queryLogs']>[0], enabled: boolean) {
  const s = useServices();
  return useQuery({ queryKey: qk.logs(filters), queryFn: () => s.instructor.queryLogs(filters), enabled });
}
export function useEvaluations() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.evaluations(userId), queryFn: () => s.instructor.listEvaluations(userId) });
}
export function useEvaluation(sectionId: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.evaluation(sectionId), queryFn: () => s.instructor.getEvaluation(sectionId) });
}
export function useRepositories(filters: { query?: string; repository?: string; page: number; pageSize: number }) {
  const s = useServices();
  return useQuery({ queryKey: qk.repositories(filters), queryFn: () => s.instructor.listRepositories(filters) });
}
export function useRepositoryMutations() {
  const s = useServices(); const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ['repositories'] });
  return {
    create: useMutation({ mutationFn: (p: Parameters<typeof s.instructor.createRepository>[0]) => s.instructor.createRepository(p), onSuccess: inv }),
    update: useMutation({ mutationFn: (p: { id: string; patch: Partial<ContentRepository> }) => s.instructor.updateRepository(p.id, p.patch), onSuccess: inv }),
    remove: useMutation({ mutationFn: (id: string) => s.instructor.deleteRepository(id), onSuccess: inv }),
    action: useMutation({ mutationFn: (p: { id: string; action: 'push' | 'pull' | 'manage' }) => s.instructor.repositoryAction(p.id, p.action), onSuccess: inv }),
    canRestore: !!s.instructor.restoreRepositoryVersion,
    restore: useMutation({ mutationFn: (p: { id: string; historyId: string }) => s.instructor.restoreRepositoryVersion!(p.id, p.historyId), onSuccess: inv }),
  };
}
export function useScheduleChanges(type?: string) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.scheduleChanges(userId, type), queryFn: () => s.instructor.listScheduleChanges(userId, type) });
}
export function useDecideSchedule() {
  const s = useServices(); const qc = useQueryClient(); const userId = useCurrentUserId();
  return useMutation({ mutationFn: (p: { id: string; decision: 'accepted' | 'rejected'; note?: string }) => s.instructor.decideScheduleChange(p), onSuccess: () => { qc.invalidateQueries({ queryKey: ['scheduleChanges'] }); qc.invalidateQueries({ queryKey: qk.instructorSections(userId) }); qc.invalidateQueries({ queryKey: ['section'] }); } });
}
export function useGradeOverview(filters: { sectionId?: string; status?: 'required' | 'submitted' | 'released' | 'all' }) {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.gradeOverview(userId, filters), queryFn: () => s.instructor.gradeSubmissionOverview(userId, filters) });
}
export function useHistory() {
  const s = useServices(); const userId = useCurrentUserId();
  return useQuery({ queryKey: qk.history(userId), queryFn: () => s.instructor.listHistory(userId) });
}
export function useHistoryGradeDistribution(offeringId: string) {
  const s = useServices();
  return useQuery({ queryKey: ['historyGradeDistribution', offeringId], queryFn: () => s.instructor.historyGradeDistribution(offeringId) });
}
export function useWorkshopEnrolments() {
  const s = useServices(); const qc = useQueryClient(); const userId = useCurrentUserId();
  const list = useQuery({ queryKey: qk.workshopEnrolments(), queryFn: () => s.workshops.listEnrolmentsForInstructor() });
  const decide = useMutation({ mutationFn: (p: { enrolmentId: string; decision: 'approved' | 'declined' | 'dropped' }) => s.workshops.decide({ ...p, instructorId: userId }), onSuccess: () => { qc.invalidateQueries({ queryKey: qk.workshopEnrolments() }); qc.invalidateQueries({ queryKey: ['workshops'] }); qc.invalidateQueries({ queryKey: ['workshop'] }); } });
  return { list, decide };
}
export function useRegistry() {
  const s = useServices(); const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: qk.faculties() }); qc.invalidateQueries({ queryKey: ['programTypes'] }); qc.invalidateQueries({ queryKey: ['terms'] }); };
  return {
    faculties: useQuery({ queryKey: qk.faculties(), queryFn: () => s.instructor.listFaculties() }),
    saveFaculty: useMutation({ mutationFn: (f: Omit<Faculty, 'id'> & { id?: string }) => s.instructor.saveFaculty(f), onSuccess: inv }),
    deleteFaculty: useMutation({ mutationFn: (id: string) => s.instructor.deleteFaculty(id), onSuccess: inv }),
    saveProgram: useMutation({ mutationFn: (p: Omit<AcademicProgram, 'id'> & { id?: string }) => s.instructor.saveProgram(p), onSuccess: inv }),
    deleteProgram: useMutation({ mutationFn: (id: string) => s.instructor.deleteProgram(id), onSuccess: inv }),
    saveProgramType: useMutation({ mutationFn: (t: Omit<ProgramType, 'id' | 'order'> & { id?: string }) => s.instructor.saveProgramType(t), onSuccess: inv }),
    reorderProgramTypes: useMutation({ mutationFn: (ids: string[]) => s.instructor.reorderProgramTypes(ids), onSuccess: inv }),
    deleteProgramType: useMutation({ mutationFn: (id: string) => s.instructor.deleteProgramType(id), onSuccess: inv }),
    saveTerm: useMutation({ mutationFn: (t: Omit<Term, 'id'> & { id?: string }) => s.instructor.saveTerm(t), onSuccess: inv }),
    deleteTerm: useMutation({ mutationFn: (id: string) => s.instructor.deleteTerm(id), onSuccess: inv }),
  };
}
export function useProgramTypes(query?: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.programTypes(query), queryFn: () => s.instructor.listProgramTypes(query) });
}
export function useTerms(campus?: string) {
  const s = useServices();
  return useQuery({ queryKey: qk.terms(campus), queryFn: () => s.instructor.listTerms(campus) });
}
export function useInstructorProfile() {
  const s = useServices(); const userId = useCurrentUserId(); const qc = useQueryClient();
  const profile = useQuery({ queryKey: qk.profile(userId), queryFn: () => s.instructor.getProfile(userId) });
  const accomplishments = useQuery({ queryKey: qk.accomplishments(userId), queryFn: () => s.instructor.accomplishments(userId) });
  const inv = () => { qc.invalidateQueries({ queryKey: qk.profile(userId) }); qc.invalidateQueries({ queryKey: qk.accomplishments(userId) }); };
  return { profile, accomplishments,
    update: useMutation({ mutationFn: (p: Partial<InstructorProfile> & { displayName?: string; preferredName?: string; email?: string }) => s.instructor.updateProfile(userId, p), onSuccess: inv }),
    createBase: useMutation({ mutationFn: (p: Omit<BadgeBase, 'id' | 'createdAt' | 'status'>) => s.instructor.createBadgeBase(p), onSuccess: inv }),
    addRecord: useMutation({ mutationFn: (p: Omit<FacultyRecord, 'id' | 'instructorId'>) => s.instructor.addFacultyRecord({ ...p, instructorId: userId }), onSuccess: inv }),
    updateRecord: useMutation({ mutationFn: (p: { id: string; patch: Partial<FacultyRecord> }) => s.instructor.updateFacultyRecord(p.id, p.patch), onSuccess: inv }) };
}

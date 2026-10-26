import type {
  LessonPlan, CompetencyDef, CompetencyAssessment, SectionBadge, LogEntry, ContentRepository, ScheduleChangeRequest, CourseEvaluation,
  HistoricalOffering, Faculty, ProgramType, AcademicProgram, BadgeBase, FacultyRecord, TodoItem, Certificate,
} from '../domain/types';
import { IDS, ROSTER } from './constants';

export const lessonPlans: LessonPlan[] = [
  { id: 'lp1', courseId: 'c_comp101', title: 'Chapter 1 – Computer applications in business', contentType: 'Text article', order: 0, minutes: 45, readMinutes: 6, content: '## Why computer applications matter\n\nBusinesses rely on productivity software for communication, analysis, and record keeping.\n\n- Word processing\n- Spreadsheets\n- Presentations\n\n**Key idea:** choose the tool that matches the task.', draftUpdatedAt: '2026-09-20T10:00:00-07:00', published: { title: 'Chapter 1 – Computer applications in business', content: '## Why computer applications matter\n\nBusinesses rely on productivity software for communication, analysis, and record keeping.', publishedAt: '2026-09-15T10:00:00-07:00' } },
  { id: 'lp2', courseId: 'c_comp101', title: 'Ch 2 – Choosing the Right Computer Application for a Business Task', contentType: 'Text article', order: 1, minutes: 40, readMinutes: 6, content: '## Matching tools to tasks\n\n1. Identify the output needed\n2. Consider collaboration\n3. Evaluate cost and training', draftUpdatedAt: '2026-09-21T10:00:00-07:00' },
  { id: 'lp3', courseId: 'c_comp101', title: 'Ch 3 – Spreadsheets for decision support', contentType: 'PDF', order: 2, readMinutes: 6, content: '', attachment: { name: 'spreadsheets_decision_support.pdf', pages: 10, sizeLabel: '0.3 MB', sampleAsset: 'lessonPdf' }, draftUpdatedAt: '2026-09-21T11:00:00-07:00' },
  { id: 'lp4', courseId: 'c_acsw100', title: 'Introduction to Human Services — Lesson 1', contentType: 'Text article', order: 0, minutes: 50, readMinutes: 7, content: '## Human services overview\n\nRoles, settings, and ethical foundations.', draftUpdatedAt: '2026-09-19T10:00:00-07:00' },
  { id: 'lp5', courseId: 'c_acsw100', title: 'Introduction to Human Services — Lesson 2', contentType: 'Slides', order: 1, minutes: 35, readMinutes: 5, content: '## Case management basics\n\n- Intake\n- Planning\n- Review', draftUpdatedAt: '2026-09-19T10:30:00-07:00' },
];

export const competencies: CompetencyDef[] = [];
export const competencyAssessments: CompetencyAssessment[] = [];
export const sectionBadges: SectionBadge[] = [];

export const logs: LogEntry[] = [
  ...ROSTER.slice(0, 4).map((r, i) => ({
    id: `log_${i + 1}`, sectionId: IDS.secACSW500, at: `2026-09-2${1 + (i % 3)}T18:${10 + i * 7}:00-07:00`, actorId: r.id, actorName: `${r.first} ${r.last}`,
    activity: i % 2 === 0 ? 'Lecture 2: Family Systems' : 'Quiz 1: Family Systems', action: (i % 2 === 0 ? 'viewed' : 'submitted') as LogEntry['action'], source: 'app' as const,
    event: i % 2 === 0 ? 'Course module viewed' : 'Quiz attempt submitted', description: `${r.first} ${r.last} ${i % 2 === 0 ? 'viewed the lecture material' : 'submitted a quiz attempt'}.`,
  })),
  { id: 'log_5', sectionId: IDS.secACSW500, at: '2026-09-21T22:05:00-07:00', actorId: IDS.instructor, actorName: 'Monica Dahiya', activity: 'Attendance', action: 'created', source: 'app', event: 'Attendance submitted', description: 'Attendance submitted for 2026-09-21 (6 present).' },
  { id: 'log_6', sectionId: IDS.secACSW500, at: '2026-09-15T09:00:00-07:00', actorId: IDS.instructor, actorName: 'Monica Dahiya', activity: 'Course Syllabus', action: 'updated', source: 'web', event: 'Resource updated', description: 'Replaced syllabus PDF.' },
];

const repo = (id: string, code: string, name: string, status: ContentRepository['status'], push: number, pull: number, hist: number, courseId?: string): ContentRepository => ({
  id, code, name, courseId, status, lms: 'Moodle (demo label)', types: 'All Types', pushCount: push, pullCount: pull, version: hist + 1, deployed: 'synced', format: 'Topics', sections: 10, isDefault: true,
  history: Array.from({ length: hist }, (_, i) => ({ id: `${id}_h${i + 1}`, at: `2026-0${6 + (i % 3)}-1${i % 9}T10:00:00-07:00`, action: i % 2 === 0 ? 'Push (demo)' : 'Pull (demo)', version: i + 1, by: 'Monica Dahiya' })),
});

export const repositories: ContentRepository[] = [
  repo('repo1', '0', 'DAP Practicum', 'active', 5, 13, 0),
  repo('repo2', '0', 'MOA Work Experience', 'active', 3, 7, 2),
  repo('repo3', '0', 'Work Experience', 'active', 6, 14, 4),
  repo('repo4', '000', 'Practicum', 'inactive', 9, 5, 6),
  repo('repo5', '101', 'ECOM', 'active', 0, 12, 8),
  repo('repo6', '101', 'E-Commerce (sandbox)', 'active', 3, 3, 10),
  repo('repo7', '121', 'ABCD', 'active', 6, 10, 0),
  repo('repo8', 'ACSW 100', 'Addictions Fundamentals', 'inactive', 1, 8, 0, 'c_acsw100'),
  repo('repo9', 'ACSW 100', 'Addictions Fundamentals', 'active', 1, 8, 3, 'c_acsw100'),
];

export const scheduleChanges: ScheduleChangeRequest[] = [
  { id: 'sc1', sectionId: IDS.secBETH190, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Fri, 8:00am – 12:00pm' }, conflict: 'Overlaps BMGT 112 (EXRETAKE-01) Mon–Fri 8:00am – 12:00pm with the same instructor.', status: 'pending' },
  { id: 'sc2', sectionId: IDS.secBMGT112, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Fri, 8:00am – 12:00pm' }, conflict: 'Overlaps BETH 190 (EXRETAKE-01) requested slot.', status: 'pending' },
  { id: 'sc3', sectionId: IDS.secCOMP101, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Fri, 8:00am – 12:00pm' }, conflict: 'Room TBA — no room allocated for the requested slot.', status: 'pending' },
  { id: 'sc4', sectionId: IDS.secDAP101, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Fri, 8:00am – 12:00pm' }, conflict: 'Instructor already scheduled Mon–Fri mornings.', status: 'pending' },
  { id: 'sc5', sectionId: IDS.secEMPL111, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Fri, 8:00am – 12:00pm' }, conflict: 'Instructor already scheduled Mon–Fri mornings.', status: 'pending' },
  { id: 'sc6', sectionId: IDS.secMARK114, changeType: 'Schedule Change', requestedAt: '2026-09-14', requestedBy: 'Registrar Scheduling', proposed: { startDate: '2026-09-14', endDate: '2026-09-14', scheduleLabel: 'Mon–Thu, 3:00pm – 7:00pm' }, conflict: 'Overlaps ACSW 500 (ACSW-MAR26-01) Mon–Thu 5:00pm start.', status: 'pending' },
  { id: 'sc7', sectionId: IDS.secACSW500, changeType: 'Room Change', requestedAt: '2026-09-10', requestedBy: 'Facilities', proposed: { startDate: '2026-09-14', endDate: '2026-10-02', scheduleLabel: 'Mon–Thu, 5:00pm – 10:00pm', location: '#112 Heritage College - Surrey' }, status: 'pending' },
];

export const evaluations: CourseEvaluation[] = [
  { id: 'ev_acsw500', sectionId: IDS.secACSW500, evaluationName: 'End of course evaluation', invited: 6, responses: [
    { id: 'r1', rating: 5, comment: 'Clear structure and very practical case discussions.', submittedAt: '2026-09-22T20:00:00-07:00' },
    { id: 'r2', rating: 4, comment: 'Would appreciate more time on genograms.', submittedAt: '2026-09-22T21:00:00-07:00' },
    { id: 'r3', rating: 4, comment: 'The online session worked well.', submittedAt: '2026-09-23T07:00:00-07:00' },
    { id: 'r4', rating: 5, comment: '', submittedAt: '2026-09-23T07:30:00-07:00' },
  ] },
];

const histCodes: [string, string, string][] = [
  ['ACSW 100', 'ACSW100–PREV', 'ACSW 100'], ['ACSW 200', 'ACSW200–PREV', 'ACSW 200'], ['ACSW 300', 'ACSW300–PREV', 'ACSW 300'], ['ACSW 400', 'ACSW400–PREV', 'ACSW 400'],
  ['BETH 190', 'BETH190–PREV', 'Business Ethics'], ['BMGT 101', 'BMGT101–PREV', 'BMGT 101'], ['BMGT 112', 'BMGT112–PREV', 'Introduction to Organizational Behaviour'], ['COMC 150', 'COMC150–PREV', 'COMC 150'],
  ['COMP 101', 'COMP101–PREV', 'Introduction to Computers'], ['COMP 102', 'COMP102–PREV', 'COMP 102'],
];

export const history: HistoricalOffering[] = histCodes.map(([code, sec, title], i) => ({
  id: `hist_${i + 1}`, termLabel: 'Fall 2025', code, sectionCode: sec, title, room: 'TBA', schedule: 'TBA', instructorName: 'Monica Dahiya', startDate: '2025-09-01', endDate: '2025-12-18',
  resources: [{ title: `${code} syllabus (archived)`, sampleAsset: 'syllabus' }, { title: 'Final grade sheet (archived)', sampleAsset: 'transcript' }], enrolled: 24 + i,
}));

export const faculties: Faculty[] = [
  { id: 'fac_acc', name: 'Accounting/Payroll', abbreviation: 'ACP', status: 'active' },
  { id: 'fac_bus', name: 'Business', abbreviation: 'BUS', status: 'active' },
  { id: 'fac_cs', name: 'Computer Science', abbreviation: 'CS', status: 'active' },
];

export const programTypes: ProgramType[] = [
  { id: 'pt_online', name: 'Online study', abbreviation: 'online', status: 'active', order: 0 },
  { id: 'pt_visitor', name: 'Visitor', abbreviation: 'ND', status: 'active', order: 1 },
  { id: 'pt_cert', name: 'Certificate', abbreviation: 'C', status: 'active', order: 2 },
  { id: 'pt_dip', name: 'Diploma', abbreviation: 'D', status: 'active', order: 3 },
  { id: 'pt_bach', name: 'Bachelor', abbreviation: 'B', status: 'active', order: 4 },
  { id: 'pt_mast', name: 'Masters', abbreviation: 'M', status: 'active', order: 5 },
  { id: 'pt_na', name: 'Not Applicable', abbreviation: 'NA', status: 'active', order: 6 },
];

const bus = (i: number, name: string, abbr: string, type = 'pt_dip'): AcademicProgram => ({ id: `ap_bus_${i}`, facultyId: 'fac_bus', name, abbreviation: abbr, programTypeId: type, status: 'active' });

export const academicPrograms: AcademicProgram[] = [
  { id: 'ap_capa', facultyId: 'fac_acc', name: 'Certificate in Accounting and Payroll Administrator', legalName: 'Certificate in Accounting and Payroll Administrator', abbreviation: 'CAPA', programTypeId: 'pt_cert', status: 'active' },
  { id: 'ap_dap', facultyId: 'fac_acc', name: 'Diploma in Accounting and Payroll administrator', legalName: 'Diploma in Accounting and Payroll Administrator', abbreviation: 'DAP', programTypeId: 'pt_dip', status: 'active' },
  bus(1, 'Diploma in Business Management', 'DBM'), bus(2, 'Certificate in Business Fundamentals', 'CBF', 'pt_cert'), bus(3, 'Diploma in Marketing', 'DMK'), bus(4, 'Diploma in Hospitality Management', 'DHM'),
  bus(5, 'Certificate in Office Administration', 'COA', 'pt_cert'), bus(6, 'Diploma in Project Management', 'DPM'), bus(7, 'Diploma in Supply Chain', 'DSC'), bus(8, 'Certificate in Entrepreneurship', 'CEN', 'pt_cert'), bus(9, 'Diploma in Human Resources', 'DHR'),
  { id: 'prog_cs', facultyId: 'fac_cs', name: 'Computer Science (B.Sc.)', legalName: 'Bachelor of Science in Computer Science', abbreviation: 'BCS', programTypeId: 'pt_bach', status: 'active' },
  { id: 'ap_cs_dip', facultyId: 'fac_cs', name: 'Diploma in Software Development', abbreviation: 'DSD', programTypeId: 'pt_dip', status: 'active' },
];

export const badgeBases: BadgeBase[] = [
  { id: 'bb1', name: 'Instructor Base Badge', description: 'Created via Create Base (demo)', checkVersion: '1.0', language: 'English (EN-US)', issuer: 'Heritage Community College', skillLevel: 'Instructor', status: 'active', createdAt: '2026-09-01T10:00:00-07:00' },
];

export const facultyRecords: FacultyRecord[] = [
  { id: 'fr1', instructorId: IDS.instructor, title: 'Peer mentoring lead', description: 'Coordinated the faculty peer-mentoring circle for new sessional instructors.', year: '2026', icon: 'note' },
  { id: 'fr2', instructorId: IDS.instructor, title: 'Faculty Excellence Award', description: 'Recognized for outstanding teaching across Business and Applied Community Social Work programs.', year: '2025', icon: 'award' },
  { id: 'fr3', instructorId: IDS.instructor, title: 'Curriculum redesign · ACSW pathway', description: 'Led course sequence refresh for Family Studies and related ACSW offerings.', year: '2024', icon: 'curriculum' },
];

export const todos: TodoItem[] = [
  { id: 'td1', instructorId: IDS.instructor, title: 'Submit Grade · ACSW 500', subtitle: 'Due today · Final review', priority: 'high', action: 'open', link: { route: 'InstructorGradesSubmission', params: { sectionId: IDS.secACSW500 } }, done: false },
  { id: 'td2', instructorId: IDS.instructor, title: 'Submit Grade · BETH 190', subtitle: 'Due today', priority: 'high', action: 'open', link: { route: 'InstructorGradesSubmission', params: { sectionId: IDS.secBETH190 } }, done: false },
  { id: 'td3', instructorId: IDS.instructor, title: 'Submit Grade · BMGT 112', subtitle: 'Due tomorrow · 5 remaining', priority: 'medium', action: 'open', link: { route: 'InstructorGradesSubmission', params: { sectionId: IDS.secBMGT112 } }, done: false },
  { id: 'td4', instructorId: IDS.instructor, title: 'Draft grades pending', subtitle: '· Needs sign-off', tag: 'In review', priority: 'medium', action: 'review', link: { route: 'InstructorGradesSubmission' }, done: false },
  { id: 'td5', instructorId: IDS.instructor, title: 'Roster check — ACSW 500', subtitle: '· Add/Drop date', tag: 'Verification', priority: 'low', action: 'check', link: { route: 'InstructorCourseWorkspace', params: { sectionId: IDS.secACSW500, tab: 'classList' } }, done: false },
];

export const certificates: Certificate[] = [];

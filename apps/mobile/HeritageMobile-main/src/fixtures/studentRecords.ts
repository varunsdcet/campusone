import type {
  Workshop, WorkshopEnrolment, Badge, BadgeAward, ExtracurricularRecord, PlanCourse, RequiredTask, StudentDocument, TaxDocument,
  FinanceStatement, FinanceTransaction, ChangeRequest, Enrolment, Payment, LearningProgress, Bookmark,
} from '../domain/types';
import { IDS } from './constants';

export const workshops: Workshop[] = [
  { id: IDS.wsWell, code: 'WS-WELL', title: 'Wellness Check-in', category: 'Mental Health & Care', description: 'Campus wellness and peer support orientation. Connect with student counselors and explore community resources.', date: '2026-10-12', startTime: '16:00', durationHours: 1.5, ceu: 0.25, mode: 'Online', location: 'Virtual Room Link', capacity: 100, instructor: 'Student Wellness Team', requiresApproval: false, agenda: ['Welcome and outcomes', 'Counsellor introductions', 'Peer support circles', 'Close and resources'], materials: [{ id: 'm_well', title: 'WS-WELL outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Demo online room' },
  { id: IDS.wsResume, code: 'WS-RESUME', title: 'Resume Lab', category: 'Career Services', description: 'Build a job-ready resume with Career Services.', date: '2026-10-05', startTime: '16:00', durationHours: 2, ceu: 0.5, mode: 'In person', location: 'Career Hub A', capacity: 25, instructor: 'Career Services', requiresApproval: true, agenda: ['Welcome and outcomes', 'Facilitated session', 'Practice activity', 'Close and next steps'], materials: [{ id: 'm_resume', title: 'WS–RESUME outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Career Hub A' },
  { id: IDS.wsStudy, code: 'WS-STUDY', title: 'Exam Study Skills', category: 'Academic Success', description: 'Evidence-based study strategies for exam season.', date: '2026-10-08', startTime: '12:00', durationHours: 1.5, ceu: 0.25, mode: 'Online', location: 'Virtual Room Link', capacity: 60, instructor: 'Learning Centre', requiresApproval: true, agenda: ['Welcome and outcomes', 'Spaced practice', 'Retrieval practice', 'Close and next steps'], materials: [{ id: 'm_study', title: 'WS-STUDY outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Demo online room' },
  { id: IDS.wsLead, code: 'WS-LEAD', title: 'Student Leadership Essentials', category: 'Leadership', description: 'Leadership skills for club executives and peer mentors.', date: '2026-10-19', startTime: '17:30', durationHours: 2, ceu: 0.5, mode: 'In person', location: 'Student Centre 2B', capacity: 30, instructor: 'Student Affairs', requiresApproval: true, agenda: ['Welcome', 'Leadership styles', 'Running meetings', 'Close'], materials: [{ id: 'm_lead', title: 'WS-LEAD outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Student Centre 2B' },
  { id: IDS.wsGis, code: 'WS-GIS', title: 'GIS Mapping Basics', category: 'Technology', description: 'Hands-on introduction to GIS mapping tools.', date: '2026-10-26', startTime: '14:00', durationHours: 3, ceu: 0.5, mode: 'In person', location: 'Lab 118', capacity: 20, instructor: 'Geography Faculty', requiresApproval: false, agenda: ['Welcome', 'Layers and projections', 'Build a map', 'Close'], materials: [{ id: 'm_gis', title: 'WS-GIS outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Lab 118' },
  { id: 'ws_cv_past', code: 'WS-CV25', title: 'Cover Letter Clinic', category: 'Career Services', description: 'Past workshop used to demonstrate the Completed view.', date: '2026-03-10', startTime: '15:00', durationHours: 1, ceu: 0.25, mode: 'Online', location: 'Virtual Room Link', capacity: 50, instructor: 'Career Services', requiresApproval: false, agenda: ['Welcome', 'Structure', 'Close'], materials: [{ id: 'm_cv', title: 'WS-CV25 outline', type: 'PDF', sampleAsset: 'outline' }], joinUrlLabel: 'Demo online room' },
];

export const workshopEnrolments: WorkshopEnrolment[] = [
  { id: 'we1', workshopId: IDS.wsWell, studentId: IDS.student, status: 'approved', requestedAt: '2026-09-19T10:00:00-07:00', decidedAt: '2026-09-19T10:00:00-07:00' },
  { id: 'we2', workshopId: IDS.wsStudy, studentId: IDS.student, status: 'approved', requestedAt: '2026-09-19T10:05:00-07:00', decidedAt: '2026-09-19T12:00:00-07:00', decidedBy: IDS.instructor },
  { id: 'we3', workshopId: IDS.wsResume, studentId: 'u_student_mei', status: 'approved', requestedAt: '2026-09-19T11:00:00-07:00', decidedAt: '2026-09-19T12:00:00-07:00', decidedBy: IDS.instructor },
  { id: 'we4', workshopId: IDS.wsResume, studentId: 'u_student_priya', status: 'pending', requestedAt: '2026-09-19T13:00:00-07:00' },
  { id: 'we5', workshopId: IDS.wsResume, studentId: 'u_student_jordan', status: 'approved', requestedAt: '2026-09-18T13:00:00-07:00', decidedAt: '2026-09-18T15:00:00-07:00', decidedBy: IDS.instructor },
  { id: 'we6', workshopId: IDS.wsResume, studentId: 'u_student_daniel', status: 'approved', requestedAt: '2026-09-18T13:30:00-07:00', decidedAt: '2026-09-18T15:00:00-07:00', decidedBy: IDS.instructor },
  { id: 'we7', workshopId: IDS.wsLead, studentId: 'u_student_daniel', status: 'declined', requestedAt: '2026-09-17T09:00:00-07:00', decidedAt: '2026-09-17T16:00:00-07:00', decidedBy: IDS.instructor },
  { id: 'we8', workshopId: 'ws_cv_past', studentId: 'u_student_priya', status: 'completed', requestedAt: '2026-03-01T09:00:00-08:00', decidedAt: '2026-03-01T09:00:00-08:00' },
];

export const badges: Badge[] = [
  { id: 'b_first_block', code: 'FIRST-BLOCK', title: 'First block complete', description: 'Finished your first academic block.', requirement: { type: 'block', target: 1 } },
  { id: 'b_workshop3', code: 'WORKSHOP-3', title: 'Workshop explorer', description: 'Attend three workshops.', requirement: { type: 'workshops', target: 3 } },
];

export const badgeAwards: BadgeAward[] = [
  { id: 'ba1', badgeId: 'b_first_block', studentId: IDS.student, earnedAt: '2025-10-15', issuedBy: IDS.instructor },
  { id: 'ba2', badgeId: 'b_workshop3', studentId: IDS.student, issuedBy: IDS.instructor },
];

export const extracurricular: ExtracurricularRecord[] = [
  { id: 'ex1', studentId: IDS.student, category: 'Student leadership', title: 'CS Club · Events lead', description: 'Organized two peer study nights.', term: '2026F', status: 'Recorded', details: 'Planned logistics, booked rooms, and coordinated 40+ attendees across two evening sessions.' },
  { id: 'ex2', studentId: IDS.student, category: 'Volunteer', title: 'Open house volunteer', description: 'Campus tour guide.', term: '2025F', status: 'Recorded', details: 'Led six campus tours for prospective students and families during Fall open house.' },
  { id: 'ex3', studentId: IDS.student, category: 'Athletics', title: 'Intramural basketball', description: 'Team roster · winter block.', term: '2026F', status: 'Recorded', details: 'Registered player on the winter intramural roster; 8 of 10 games attended.' },
];

export const planCourses: PlanCourse[] = [
  { id: 'pc1', studentId: IDS.student, order: 1, code: 'CS201', title: 'Data Structures', status: 'completed', startDate: '2025-09-01', endDate: '2025-10-10', scheduleLabel: 'Mon/Wed 09:00–12:00', campusRoom: 'Main Academic Hall · Rm 302', sectionId: IDS.secCS201 },
  { id: 'pc2', studentId: IDS.student, order: 2, code: 'CS301', title: 'Algorithms', status: 'completed', startDate: '2026-05-04', endDate: '2026-08-14', scheduleLabel: 'Tue/Thu 13:00–15:00', campusRoom: 'Main Academic Hall · Rm 302', sectionId: IDS.secCS301 },
  { id: 'pc3', studentId: IDS.student, order: 3, code: 'ACC201', title: 'Financial Accounting', status: 'inProgress', startDate: '2026-09-01', endDate: '2026-10-10', scheduleLabel: 'Sat 19:00–20:20', campusRoom: 'Business Centre 204', sectionId: IDS.secACC201 },
  { id: 'pc4', studentId: IDS.student, order: 4, code: 'ENG110', title: 'Academic Writing', status: 'dropped', startDate: '2025-11-01', endDate: '2025-12-12', scheduleLabel: 'Mon 13:00–16:00', campusRoom: 'Main Academic Hall · Rm 110', retakeSectionCode: 'EX/RETAKE-01' },
  { id: 'pc5', studentId: IDS.student, order: 5, code: 'MATH210', title: 'Discrete Mathematics', status: 'notStarted', startDate: '2026-10-20', endDate: '2026-11-28', scheduleLabel: 'Block 4 · TBD', campusRoom: 'TBD' },
  { id: 'pc6', studentId: IDS.student, order: 6, code: 'DATA401', title: 'Data Engineering', status: 'notStarted', startDate: '2027-01-12', endDate: '2027-04-30', scheduleLabel: 'Placement · supervised hours', campusRoom: 'TBD' },
  { id: 'pc7', studentId: IDS.student, order: 7, code: 'ENG110', title: 'Academic Writing', status: 'inProgress', startDate: '2026-09-01', endDate: '2026-10-10', scheduleLabel: 'Mon 13:00–16:00', campusRoom: 'Main Academic Hall · Rm 110', sectionId: IDS.secENG110, retakeSectionCode: 'EX/RETAKE-01' },
];

export const requiredTasks: RequiredTask[] = [
  { id: 'task1', studentId: IDS.student, category: 'Clinical Requirement', title: 'Upload immunization record', description: 'Required for practicum clearance.', requestedAt: '2026-09-05', dueNote: 'Clearance due prior to field placement', requirement: 'upload', status: 'pending' },
  { id: 'task2', studentId: IDS.student, category: 'Course Feedback', title: 'Complete ACC201 course evaluation', description: 'Submit feedback before the block closes.', requestedAt: '2026-09-12', requirement: 'evaluation', status: 'completed', completedAt: '2026-09-14T10:00:00-07:00' },
  { id: 'task3', studentId: IDS.student, category: 'Student Profile', title: 'Confirm emergency contact', description: 'Verify phone number on file.', requestedAt: '2026-08-28', requirement: 'confirm', status: 'completed', completedAt: '2026-08-29T10:00:00-07:00' },
];

export const documents: StudentDocument[] = [
  { id: 'doc1', studentId: IDS.student, title: 'Program Confirmation', type: 'Registrar', issuedAt: '2026-09-01', status: 'available', sampleAsset: 'letter', sizeLabel: '96 KB' },
  { id: 'doc2', studentId: IDS.student, title: 'Letter of Enrolment', type: 'Official letter', issuedAt: '2025-01-15', status: 'available', sampleAsset: 'letter', sizeLabel: '88 KB' },
  { id: 'doc3', studentId: IDS.student, title: 'Student ID Card', type: 'Campus ID', issuedAt: '2024-09-02', status: 'available', sampleAsset: 'idcard', sizeLabel: '140 KB' },
];

export const taxDocuments: TaxDocument[] = [
  { id: 'tax2025', studentId: IDS.student, year: 2025, form: 'T2202', issuedAt: '2026-02-28', status: 'available', reportingTerm: 'Winter & Fall 2025', eligibleTuition: 8450, fullTimeMonths: 8, sizeLabel: '340 KB', sampleAsset: 'tax' },
  { id: 'tax2024', studentId: IDS.student, year: 2024, form: 'T2202', issuedAt: '2025-02-26', status: 'archived', reportingTerm: 'Fall 2024', eligibleTuition: 4200, fullTimeMonths: 4, sizeLabel: '315 KB', sampleAsset: 'tax' },
];

export const statements: FinanceStatement[] = [
  { id: 'st_tr1_2026', studentId: IDS.student, termId: IDS.termTR1_2026, termLabel: '1st Term– 2026', charges: [{ label: 'Tuition Fee', amount: 11000 }, { label: 'Textbooks', amount: 1728 }, { label: 'Application Fee', amount: 250 }, { label: 'Lab, Books, Supplies, etc.', amount: 250 }], taxes: [{ label: 'GST 0%', amount: 0 }, { label: 'PST 0%', amount: 0 }] },
  { id: 'st_2026F', studentId: IDS.student, termId: IDS.term2026F, termLabel: 'Fall 2026', charges: [{ label: 'Tuition Fee', amount: 6400 }, { label: 'Student Services Fee', amount: 180 }], taxes: [{ label: 'GST 0%', amount: 0 }, { label: 'PST 0%', amount: 0 }] },
  { id: 'st_2025F', studentId: IDS.student, termId: IDS.term2025F, termLabel: 'Fall 2025', charges: [{ label: 'Tuition Fee', amount: 6400 }, { label: 'Textbooks', amount: 420 }], taxes: [{ label: 'GST 0%', amount: 0 }, { label: 'PST 0%', amount: 0 }] },
];

export const transactions: FinanceTransaction[] = [
  { id: 'tx1', studentId: IDS.student, termId: IDS.termTR1_2026, date: '2026-01-05', description: 'Tuition deposit', amount: 2000, kind: 'payment', reference: 'PAY-26-0001' },
  { id: 'tx2', studentId: IDS.student, termId: IDS.termTR1_2026, date: '2026-02-01', description: 'Payment plan instalment 1', amount: 4000, kind: 'payment', reference: 'PAY-26-0034' },
  { id: 'tx3', studentId: IDS.student, termId: IDS.termTR1_2026, date: '2026-03-01', description: 'Payment plan instalment 2', amount: 4000, kind: 'payment', reference: 'PAY-26-0077' },
  { id: 'tx4', studentId: IDS.student, termId: IDS.term2026F, date: '2026-08-20', description: 'Fall tuition payment', amount: 6580, kind: 'payment', reference: 'PAY-26-0310' },
  { id: 'tx5', studentId: IDS.student, termId: IDS.term2025F, date: '2025-08-22', description: 'Fall tuition payment', amount: 6820, kind: 'payment', reference: 'PAY-25-0298' },
];

export const requests: ChangeRequest[] = [
  {
    id: 'req_leave_1', studentId: IDS.student, kind: 'leave', status: 'pending', createdAt: '2026-09-28T09:30:00-07:00', reviewer: 'Academic Registrar',
    payload: { startDate: '2026-11-01', endDate: '2026-11-14', days: 14, reason: 'Short medical leave for a scheduled procedure; able to resume coursework and asynchronous lectures after recovery.', termLabel: 'Autumn Mid-Term' },
    summary: '01 Nov 2026 → 14 Nov 2026 · 14 days',
  },
];

export const enrolments: Enrolment[] = [
  { id: 'enr1', userId: IDS.student, programmeId: IDS.programmeOffice, enrolledAt: '2026-09-24T08:00:00-07:00', paymentId: 'pay1', status: 'active' },
];

export const payments: Payment[] = [
  { id: 'pay1', userId: IDS.student, programmeId: IDS.programmeOffice, amountCad: 9500, status: 'succeeded', createdAt: '2026-09-24T08:00:00-07:00', reference: 'DEMO-CHK-000001' },
];

export const progress: LearningProgress[] = [
  {
    id: `${IDS.student}:${IDS.programmeOffice}`,
    userId: IDS.student,
    programmeId: IDS.programmeOffice,
    completedActivityIds: [`${IDS.programmeOffice}_ch1_a1`],
    secondsSpent: { [`${IDS.programmeOffice}_ch1_a1`]: 1100 },
    readToBottom: { [`${IDS.programmeOffice}_ch1_a1`]: true },
    quizAnswers: {},
    quizBestScore: {},
    matchingAssignments: {},
    matchingResult: {},
    assessmentResults: {},
    lastActivityId: `${IDS.programmeOffice}_ch1_a2`,
  },
];

export const bookmarks: Bookmark[] = [];

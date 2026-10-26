import type { Notification, MailMessage } from '../domain/types';
import { IDS } from './constants';

const missed = (i: number, minute: number, read: boolean): Notification => ({
  id: `n_s_${i}`,
  userId: IDS.student,
  title: 'You may have missed class',
  body: 'ACSW 500: "Online Class Link" started. If you were absent, open MyHeritage to review the recording and confirm your attendance.',
  category: 'Class Attendance',
  createdAt: `2026-09-21T21:${String(minute).padStart(2, '0')}:00-07:00`,
  read,
  icon: read ? 'video' : 'warning',
  link: { route: 'StudentAttendance', params: { sectionId: IDS.secACSW500 } },
});

export const notifications: Notification[] = [
  missed(1, 49, true),
  missed(2, 48, false),
  missed(3, 48, true),
  missed(4, 47, true),
  missed(5, 47, true),
  missed(6, 46, true),
  missed(7, 46, true),
  missed(8, 45, true),
  // Instructor notifications
  { id: 'n_i_1', userId: IDS.instructor, title: 'Grade submission due', body: 'ACSW 500 (ACSW-MAR26-01) final grades are due. 30 marks are missing.', category: 'Grades', createdAt: '2026-09-24T08:00:00-07:00', read: false, icon: 'grade', link: { route: 'InstructorGradesSubmission' } },
  { id: 'n_i_2', userId: IDS.instructor, title: 'Workshop request pending', body: 'Priya Sandhu requested WS-RESUME — Resume Lab. Review the enrolment.', category: 'Workshops', createdAt: '2026-09-19T13:05:00-07:00', read: false, icon: 'workshop', link: { route: 'InstructorWorkshopEnrolments' } },
  { id: 'n_i_3', userId: IDS.instructor, title: 'Schedule conflict detected', body: 'BETH 190 (EXRETAKE-01) requested schedule change conflicts with BMGT 112.', category: 'Scheduling', createdAt: '2026-09-14T09:00:00-07:00', read: true, icon: 'schedule', link: { route: 'InstructorPendingSchedules' } },
  { id: 'n_i_4', userId: IDS.instructor, title: 'Attendance not taken', body: 'BETH 190 (EXRETAKE-01) has no attendance recorded for 2026-09-18.', category: 'Attendance', createdAt: '2026-09-18T14:00:00-07:00', read: true, icon: 'warning', link: { route: 'InstructorCourseAttendance' } },
  { id: 'n_i_5', userId: IDS.instructor, title: 'Evaluation results available', body: 'ACSW 500 end-of-course evaluation responses are ready to review.', category: 'Evaluations', createdAt: '2026-09-23T07:30:00-07:00', read: true, icon: 'info', link: { route: 'InstructorEvaluations' } },
];

export const mail: MailMessage[] = [
  // Student mailbox
  { id: 'm_s_in1', ownerId: IDS.student, folder: 'inbox', fromId: IDS.instructor, fromName: 'Monica Dahiya', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'ACSW 500 — Day 5 mid-term reminder', body: 'Hello Marcus,\n\nA reminder that the mid-term runs during Day 5 (Sep 28). Bring your student card. The review sheet is posted under Day 4 materials.\n\nMonica', attachments: [], createdAt: '2026-09-23T16:10:00-07:00', read: false, flagged: false },
  { id: 'm_s_in2', ownerId: IDS.student, folder: 'inbox', fromId: 'c_registrar', fromName: 'Registrar Services', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'Personal details request received', body: 'We received your request to update personal details. Expect a decision within five business days (demo).', attachments: [], createdAt: '2026-09-20T09:00:00-07:00', read: true, flagged: true },
  { id: 'm_s_in3', ownerId: IDS.student, folder: 'inbox', fromId: 'c_accounts', fromName: 'Student Accounts', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'Statement available: 1st Term–2026', body: 'Your term statement is available in Financial Statements. Outstanding balance: $3,228.00 CAD.', attachments: [{ id: 'ma1', name: 'statement_TR1-2026.pdf', size: 92000 }], createdAt: '2026-09-15T08:00:00-07:00', read: true, flagged: false },
  { id: 'm_s_out1', ownerId: IDS.student, folder: 'outbox', fromId: IDS.student, fromName: 'Marcus Vance', toIds: ['c_elena'], toNames: ['Elena Vance'], subject: 'Question about CS301 Midterm', body: "Could you clarify the weighting for question 3? I was reviewing the rubric provided in yesterday's lecture and the points do not add up to 30.", attachments: [{ id: 'ma2', name: 'rubric_notes.pdf', size: 1258291 }], createdAt: '2026-09-19T14:20:00-07:00', read: true, flagged: false, outboxStatus: 'queued', sendAt: '2026-09-25T15:46:00-07:00' },
  { id: 'm_s_dr1', ownerId: IDS.student, folder: 'drafts', fromId: IDS.student, fromName: 'Marcus Vance', toIds: ['c_advising'], toNames: ['Academic Advising'], subject: 'Summer course options', body: 'Hi — I would like to discuss summer course options for MATH210.', attachments: [], createdAt: '2026-09-22T11:00:00-07:00', read: true, flagged: false },
  { id: 'm_s_junk1', ownerId: IDS.student, folder: 'junk', fromId: 'ext', fromName: 'Prize Desk', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'You have won a laptop', body: 'Demo junk message filtered by campus mail rules.', attachments: [], createdAt: '2026-09-18T03:00:00-07:00', read: false, flagged: false },
  { id: 'm_s_del1', ownerId: IDS.student, folder: 'deleted', fromId: 'c_registrar', fromName: 'Registrar Services', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'Old reminder', body: 'This message was deleted.', attachments: [], createdAt: '2026-08-30T10:00:00-07:00', read: true, flagged: false, previousFolder: 'inbox' },
  // Instructor mailbox
  { id: 'm_i_in1', ownerId: IDS.instructor, folder: 'inbox', fromId: IDS.student, fromName: 'Marcus Vance', toIds: [IDS.instructor], toNames: ['Monica Dahiya'], subject: 'Question about Day 2 quiz', body: 'Hi Monica, is Quiz 1 open-book? Thanks, Marcus', attachments: [], createdAt: '2026-09-22T19:40:00-07:00', read: false, flagged: false },
  { id: 'm_i_in2', ownerId: IDS.instructor, folder: 'inbox', fromId: 'c_registrar', fromName: 'Registrar Services', toIds: [IDS.instructor], toNames: ['Monica Dahiya'], subject: 'Final grades deadline', body: 'Final grades for retake sections are due within 5 business days of the section end date (demo).', attachments: [], createdAt: '2026-09-18T08:00:00-07:00', read: true, flagged: true },
  { id: 'm_i_out1', ownerId: IDS.instructor, folder: 'outbox', fromId: IDS.instructor, fromName: 'Monica Dahiya', toIds: ['c_elena'], toNames: ['Elena Vance'], subject: 'Question about CS301 Midterm', body: 'Forwarding the rubric notes for the shared midterm question bank.', attachments: [{ id: 'ma3', name: 'rubric_notes.pdf', size: 1258291 }], createdAt: '2026-09-19T15:00:00-07:00', read: true, flagged: false, outboxStatus: 'queued', sendAt: '2026-09-25T15:46:00-07:00' },
  { id: 'm_i_dr1', ownerId: IDS.instructor, folder: 'drafts', fromId: IDS.instructor, fromName: 'Monica Dahiya', toIds: [IDS.student], toNames: ['Marcus Vance'], subject: 'Re: Question about Day 2 quiz', body: 'Hi Marcus — Quiz 1 is closed-book but', attachments: [], createdAt: '2026-09-23T08:00:00-07:00', read: true, flagged: false },
];

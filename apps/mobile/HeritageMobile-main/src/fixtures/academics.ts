import type {
  Term, Course, Section, SectionEnrolment, ClassSession, Assignment, Submission, GradeItem, Mark, AttendanceRecord, FinalMark,
} from '../domain/types';
import { IDS, SECTION_ROSTERS } from './constants';

export const terms: Term[] = [
  { id: IDS.term2026F, code: '2026F', name: 'Fall 2026', startDate: '2026-09-01', endDate: '2026-12-18', campus: '#110 Heritage College- Surrey', status: 'current' },
  { id: IDS.term2025F, code: '2025F', name: 'Fall 2025', startDate: '2025-09-01', endDate: '2025-12-18', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: 't_TR3_2026', code: 'TR3-2026', name: '3rd Term–2026', startDate: '2026-09-01', endDate: '2026-12-31', campus: '#110 Heritage College- Surrey', status: 'current' },
  { id: 't_TR2_2026', code: 'TR2-2026', name: '2nd Term–2026', startDate: '2026-05-01', endDate: '2026-08-31', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: IDS.termTR1_2026, code: 'TR1-2026', name: '1st Term–2026', startDate: '2026-01-01', endDate: '2026-04-30', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: 't_TR3_2025', code: 'TR3-2025', name: '3rd Term–2025', startDate: '2025-09-01', endDate: '2025-12-31', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: 't_TR2_2025', code: 'TR2-2025', name: '2nd Term–2025', startDate: '2025-05-01', endDate: '2025-08-31', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: 't_TR1_2025', code: 'TR1-2025', name: '1st Term–2025', startDate: '2025-01-01', endDate: '2025-04-30', campus: '#110 Heritage College- Surrey', status: 'past' },
  { id: 't_HRA_2024', code: 'HRA-2024', name: '2024–03–18', startDate: '2024-03-18', endDate: '2024-12-31', campus: '#110 Heritage College- Surrey', status: 'archived' },
];

export const courses: Course[] = [
  { id: 'c_acsw500', code: 'ACSW 500', title: 'Family Studies', department: 'Department of Applied Community Social Work', credits: 3, description: 'Family systems concepts relevant to addiction practice, assessment techniques for family and relational risk, and treatment models used with families affected by substance use.' },
  { id: 'c_acc201', code: 'ACC201', title: 'Financial Accounting', department: 'Business', credits: 3, description: 'Introduction to financial accounting: ledgers, adjusting entries, and financial statements.' },
  { id: 'c_beth190', code: 'BETH 190', title: 'Business Ethics', department: 'Business', credits: 3, description: 'Ethical frameworks and decision-making in Canadian business.' },
  { id: 'c_bmgt112', code: 'BMGT 112', title: 'Introduction to Organizational Behaviour', department: 'Business', credits: 3, description: 'Individual and group behaviour in organisations.' },
  { id: 'c_comp101', code: 'COMP 101', title: 'Introduction to Computers', department: 'Computer Science', credits: 3, description: 'Computer applications in business.' },
  { id: 'c_dap101', code: 'DAP 101', title: 'Financial Accounting', department: 'Accounting/Payroll', credits: 3, description: 'Financial accounting for the accounting and payroll diploma.' },
  { id: 'c_empl111', code: 'EMPL 111', title: 'Career Employment & Strategies', department: 'Business', credits: 3, description: 'Career planning and employment strategies.' },
  { id: 'c_mark114', code: 'MARK 114', title: 'Social Media Marketing Strategies', department: 'Business', credits: 3, description: 'Social media marketing strategies for small business.' },
  { id: 'c_cs301', code: 'CS301', title: 'Algorithms', department: 'Computer Science', credits: 3, description: 'Algorithm design and analysis.' },
  { id: 'c_cs201', code: 'CS201', title: 'Data Structures', department: 'Computer Science', credits: 3, description: 'Fundamental data structures.' },
  { id: 'c_eng110', code: 'ENG110', title: 'Academic Writing', department: 'Arts', credits: 3, description: 'Academic writing and research skills.' },
  { id: 'c_math210', code: 'MATH210', title: 'Discrete Mathematics', department: 'Mathematics', credits: 3, description: 'Logic, sets, and combinatorics.' },
  { id: 'c_data401', code: 'DATA401', title: 'Data Engineering', department: 'Computer Science', credits: 3, description: 'Pipelines and data platforms.' },
  { id: 'c_acsw100', code: 'ACSW 100', title: 'Addictions Fundamentals', department: 'Department of Applied Community Social Work', credits: 3, description: 'Foundations of addictions practice.' },
];

const ACSW_EVAL = [
  { label: 'Class Participation', weight: 20, color: '#1E8A5A' },
  { label: 'Quizzes & Assignments', weight: 20, color: '#2F6FB5' },
  { label: 'Mid-term Exam', weight: 30, color: '#E8714D' },
  { label: 'Final Exam', weight: 30, color: '#6D4FB8' },
];

function retakeSection(id: string, courseId: string, scheduleLabel: string, days: number[], start: string, end: string, assessmentLabel: string, status: Section['status'] = 'In Progress'): Section {
  return {
    id,
    courseId,
    sectionCode: 'EXRETAKE-01',
    termId: IDS.term2026F,
    instructorId: IDS.instructor,
    delivery: 'TBA',
    location: 'Room TBA',
    startDate: '2026-09-14',
    endDate: '2026-09-18',
    scheduleLabel,
    meetingDays: days,
    startTime: start,
    endTime: end,
    status,
    assessmentLabel,
    evaluation: ACSW_EVAL,
    objectives: 'By the end of this course, learners will be able to apply the core concepts of the subject to workplace scenarios.',
    description: 'Intensive one-week retake offering.',
    syllabusFile: 'Course-Syllabus.pdf',
    liveRoomReady: false,
    days: [1, 2, 3, 4, 5].map(i => ({
      id: `${id}_d${i}`,
      index: i,
      label: `Day ${i}`,
      materials: [
        { id: `${id}_d${i}_lec`, kind: 'folder', title: `Lecture ${i}`, fileName: `Day${i}_Lecture.pdf`, sampleAsset: 'lecture' },
        { id: `${id}_d${i}_man`, kind: 'file', title: 'Learning Manual', fileName: `Day${i}_Manual.pdf`, sampleAsset: 'manual' },
      ],
    })),
  };
}

export const sections: Section[] = [
  {
    id: IDS.secACSW500,
    courseId: 'c_acsw500',
    sectionCode: 'ACSW-MAR26-01',
    termId: IDS.term2026F,
    instructorId: IDS.instructor,
    delivery: 'In-Person & Live',
    location: '#110 Heritage College - Surrey',
    startDate: '2026-09-14',
    endDate: '2026-10-02',
    scheduleLabel: 'Mon–Thu, 5:00pm – 10:00pm',
    meetingDays: [1, 2, 3, 4],
    startTime: '17:00',
    endTime: '22:00',
    status: 'In Progress',
    assessmentLabel: 'Standard Assessment',
    evaluation: ACSW_EVAL,
    objectives:
      'By the end of this course, learners will be able to: (1) describe family systems concepts relevant to addiction practice; (2) apply assessment techniques for family and relational risk; (3) compare treatment models used with families affected by substance use; and (4) demonstrate professional communication that supports recovery-oriented care.',
    description:
      'Family Studies examines the family as a system, with emphasis on how substance use affects relational dynamics, assessment, and recovery-oriented practice.',
    syllabusFile: 'ACSW500-Family-Studies-Syllabus.pdf',
    liveRoomReady: true,
    days: [
      { id: 'd1', index: 1, label: 'Day 1', date: '2026-09-14', materials: [
        { id: 'd1_lec', kind: 'folder', title: 'Lecture 1: Foundations', fileName: 'ACSW500_Day1_Lecture.pdf', sampleAsset: 'lecture' },
        { id: 'd1_man', kind: 'file', title: 'Learning Manual', fileName: 'ACSW500_Day1_Manual.pdf', sampleAsset: 'manual' },
      ] },
      { id: 'd2', index: 2, label: 'Day 2', date: '2026-09-15', note: 'Quiz active', materials: [
        { id: 'd2_lec', kind: 'folder', title: 'Lecture 2: Family Systems', fileName: 'ACSW500_Day2_Lecture.pdf', sampleAsset: 'lecture' },
        { id: 'd2_man', kind: 'file', title: 'Learning Manual', fileName: 'ACSW500_Day2_Manual.pdf', sampleAsset: 'manual' },
        { id: 'd2_quiz', kind: 'quiz', title: 'Quiz 1: Family Systems', status: 'Click to open · Attempt when ready' },
      ] },
      { id: 'd3', index: 3, label: 'Day 3', date: '2026-09-22', materials: [
        { id: 'd3_lec', kind: 'folder', title: 'Lecture 3: Assessment', fileName: 'ACSW500_Day3_Lecture.pdf', sampleAsset: 'lecture' },
        { id: 'd3_man', kind: 'file', title: 'Learning Manual', fileName: 'ACSW500_Day3_Manual.pdf', sampleAsset: 'manual' },
      ] },
      { id: 'd4', index: 4, label: 'Day 4', date: '2026-09-24', materials: [
        { id: 'd4_lec', kind: 'folder', title: 'Lecture 4: Relational Risk', fileName: 'ACSW500_Day4_Lecture.pdf', sampleAsset: 'lecture' },
      ] },
      { id: 'd5', index: 5, label: 'Day 5', date: '2026-09-28', note: 'Mid-term Exam', materials: [
        { id: 'd5_quiz', kind: 'quiz', title: 'Mid-term Exam', status: 'Opens in class' },
      ] },
      { id: 'd6', index: 6, label: 'Day 6', date: '2026-09-29', materials: [
        { id: 'd6_lec', kind: 'folder', title: 'Lecture 5: Treatment Models', fileName: 'ACSW500_Day6_Lecture.pdf', sampleAsset: 'lecture' },
        { id: 'd6_man', kind: 'file', title: 'Learning Manual', fileName: 'ACSW500_Day6_Manual.pdf', sampleAsset: 'manual' },
      ] },
      { id: 'd7', index: 7, label: 'Day 7', date: '2026-10-01', note: 'Final Exam & Review', materials: [
        { id: 'd7_quiz', kind: 'quiz', title: 'Final Exam', status: 'Opens in class' },
      ] },
    ],
  },
  {
    id: IDS.secACC201,
    courseId: 'c_acc201',
    sectionCode: 'ACC201-01',
    termId: IDS.term2026F,
    instructorId: IDS.instructorPendelton,
    delivery: 'In person',
    location: 'Business Centre 204',
    startDate: '2026-09-01',
    endDate: '2026-10-10',
    scheduleLabel: 'Saturday, 7:00pm – 8:20pm',
    meetingDays: [6],
    startTime: '19:00',
    endTime: '20:20',
    status: 'In Progress',
    assessmentLabel: 'Weekly Lectures',
    evaluation: [
      { label: 'Homework', weight: 30, color: '#2F6FB5' },
      { label: 'Mid-term', weight: 30, color: '#E8714D' },
      { label: 'Final', weight: 40, color: '#6D4FB8' },
    ],
    objectives: 'Prepare and interpret basic financial statements.',
    description: 'Introductory financial accounting.',
    syllabusFile: 'ACC201-Syllabus.pdf',
    liveRoomReady: false,
    days: [1, 2, 3, 4, 5, 6].map(i => ({
      id: `acc_d${i}`, index: i, label: `Week ${i}`, materials: [
        { id: `acc_d${i}_lec`, kind: 'folder', title: `Lecture ${i}`, fileName: `ACC201_W${i}.pdf`, sampleAsset: 'lecture' },
      ],
    })),
  },
  retakeSection(IDS.secBETH190, 'c_beth190', 'Mon–Fri, 9:00am – 1:00pm', [1, 2, 3, 4, 5], '09:00', '13:00', 'Intensive Week'),
  retakeSection(IDS.secBMGT112, 'c_bmgt112', 'Mon–Fri, 8:00am – 12:00pm', [1, 2, 3, 4, 5], '08:00', '12:00', 'Core Subject'),
  retakeSection(IDS.secCOMP101, 'c_comp101', 'Mon–Fri, 8:00am – 12:00pm', [1, 2, 3, 4, 5], '08:00', '12:00', 'Core Subject', 'Upcoming'),
  retakeSection(IDS.secDAP101, 'c_dap101', 'Mon–Fri, 8:00am – 12:00pm', [1, 2, 3, 4, 5], '08:00', '12:00', 'Core Subject', 'Upcoming'),
  retakeSection(IDS.secEMPL111, 'c_empl111', 'Mon–Fri, 8:00am – 12:00pm', [1, 2, 3, 4, 5], '08:00', '12:00', 'Core Subject', 'Upcoming'),
  { ...retakeSection(IDS.secMARK114, 'c_mark114', 'Mon–Thu, 3:00pm – 7:00pm', [1, 2, 3, 4], '15:00', '19:00', 'Online Module'), sectionCode: 'ONM-MAR26-01', startDate: '2026-09-14', endDate: '2026-12-10' },
  {
    id: IDS.secCS301, courseId: 'c_cs301', sectionCode: 'CS301-01', termId: IDS.term2026F, instructorId: IDS.instructorSterling, delivery: 'In person', location: 'Main Academic Hall · Rm 302', startDate: '2026-09-01', endDate: '2026-12-10', scheduleLabel: 'Tue/Thu 13:00–15:00', meetingDays: [2, 4], startTime: '13:00', endTime: '15:00', status: 'In Progress', assessmentLabel: 'Standard Assessment', evaluation: [{ label: 'Project', weight: 40, color: '#2F6FB5' }, { label: 'Midterm', weight: 30, color: '#E8714D' }, { label: 'Final', weight: 30, color: '#6D4FB8' }], objectives: 'Design and analyse algorithms.', description: 'Algorithms.', syllabusFile: 'CS301-Syllabus.pdf', liveRoomReady: false, days: [],
  },
  {
    id: IDS.secENG110, courseId: 'c_eng110', sectionCode: 'EX/RETAKE-01', termId: IDS.term2026F, instructorId: IDS.instructorSterling, delivery: 'In person', location: 'Main Academic Hall · Rm 110', startDate: '2026-09-01', endDate: '2026-10-10', scheduleLabel: 'Mon 13:00–16:00', meetingDays: [1], startTime: '13:00', endTime: '16:00', status: 'In Progress', assessmentLabel: 'Standard Assessment', evaluation: [{ label: 'Essays', weight: 60, color: '#2F6FB5' }, { label: 'Participation', weight: 40, color: '#1E8A5A' }], objectives: 'Write clear academic prose.', description: 'Academic writing.', syllabusFile: 'ENG110-Syllabus.pdf', liveRoomReady: false, days: [],
  },
  {
    id: IDS.secCS201, courseId: 'c_cs201', sectionCode: 'CS201-01', termId: IDS.term2025F, instructorId: IDS.instructorSterling, delivery: 'In person', location: 'Main Academic Hall · Rm 302', startDate: '2025-09-01', endDate: '2025-10-10', scheduleLabel: 'Mon/Wed 09:00–12:00', meetingDays: [1, 3], startTime: '09:00', endTime: '12:00', status: 'Completed', assessmentLabel: 'Standard Assessment', evaluation: [{ label: 'Labs', weight: 50, color: '#2F6FB5' }, { label: 'Final', weight: 50, color: '#6D4FB8' }], objectives: 'Implement fundamental data structures.', description: 'Data structures.', syllabusFile: 'CS201-Syllabus.pdf', liveRoomReady: false, days: [],
  },
];

export const sectionEnrolments: SectionEnrolment[] = [
  ...Object.entries(SECTION_ROSTERS).flatMap(([sec, ids]) =>
    ids.map(id => ({ id: `${sec}:${id}`, sectionId: sec, studentId: id, status: 'enrolled' as const })),
  ),
  { id: `${IDS.secACC201}:${IDS.student}`, sectionId: IDS.secACC201, studentId: IDS.student, status: 'enrolled' },
  { id: `${IDS.secCS301}:${IDS.student}`, sectionId: IDS.secCS301, studentId: IDS.student, status: 'enrolled' },
  { id: `${IDS.secENG110}:${IDS.student}`, sectionId: IDS.secENG110, studentId: IDS.student, status: 'enrolled' },
  { id: `${IDS.secCS201}:${IDS.student}`, sectionId: IDS.secCS201, studentId: IDS.student, status: 'completed' },
];

function sessionsFor(sectionId: string, dates: [string, string][], start: string, end: string): ClassSession[] {
  return dates.map(([date, topic], i) => ({ id: `${sectionId}_s${i + 1}`, sectionId, date, startTime: start, endTime: end, topic }));
}

export const classSessions: ClassSession[] = [
  ...sessionsFor(IDS.secACSW500, [
    ['2026-09-14', 'Foundations'], ['2026-09-15', 'Family Systems'], ['2026-09-16', 'Genograms'], ['2026-09-17', 'Attachment & roles'],
    ['2026-09-21', 'Online class · Assessment'], ['2026-09-22', 'Assessment tools'], ['2026-09-23', 'Relational risk'], ['2026-09-24', 'Case review'],
    ['2026-09-28', 'Mid-term exam'], ['2026-09-29', 'Treatment models'], ['2026-09-30', 'Recovery-oriented care'], ['2026-10-01', 'Final exam & review'],
  ], '17:00', '22:00'),
  ...sessionsFor(IDS.secACC201, [['2026-09-12', 'Introduction'], ['2026-09-19', 'Ledgers'], ['2026-09-24', 'Adjusting entries'], ['2026-10-03', 'Trial balance'], ['2026-10-10', 'Statements']], '19:00', '20:20'),
  ...sessionsFor(IDS.secCS301, [['2026-09-03', 'Asymptotics'], ['2026-09-08', 'Sorting'], ['2026-09-10', 'Divide & conquer'], ['2026-09-15', 'Greedy'], ['2026-09-17', 'Dynamic programming'], ['2026-09-22', 'Graphs I'], ['2026-09-24', 'Graphs II'], ['2026-09-29', 'Review']], '13:00', '15:00'),
  ...sessionsFor(IDS.secBETH190, [['2026-09-14', 'Day 1'], ['2026-09-15', 'Day 2'], ['2026-09-16', 'Day 3'], ['2026-09-17', 'Day 4'], ['2026-09-18', 'Day 5']], '09:00', '13:00'),
  ...sessionsFor(IDS.secBMGT112, [['2026-09-14', 'Day 1'], ['2026-09-15', 'Day 2'], ['2026-09-16', 'Day 3'], ['2026-09-17', 'Day 4'], ['2026-09-18', 'Day 5']], '08:00', '12:00'),
  ...sessionsFor(IDS.secENG110, [['2026-09-07', 'Thesis statements'], ['2026-09-14', 'Paragraphs'], ['2026-09-21', 'Sources'], ['2026-09-28', 'Revision']], '13:00', '16:00'),
  ...sessionsFor(IDS.secMARK114, [['2026-09-14', 'Intro'], ['2026-09-21', 'Platforms'], ['2026-09-28', 'Content calendars']], '15:00', '19:00'),
];

export const gradeItems: GradeItem[] = [
  { id: 'gi_acsw_q1', sectionId: IDS.secACSW500, name: 'Quiz 1', weightPct: 10, maxPoints: 100 },
  { id: 'gi_acsw_q2', sectionId: IDS.secACSW500, name: 'Quiz 2', weightPct: 10, maxPoints: 100 },
  { id: 'gi_acsw_part', sectionId: IDS.secACSW500, name: 'Participation', weightPct: 20, maxPoints: 100 },
  { id: 'gi_acsw_mid', sectionId: IDS.secACSW500, name: 'MID TERM', weightPct: 30, maxPoints: 100 },
  { id: 'gi_acsw_final', sectionId: IDS.secACSW500, name: 'FINAL EXAM', weightPct: 30, maxPoints: 100 },
  { id: 'gi_acc_hw5', sectionId: IDS.secACC201, name: 'Homework 5', weightPct: 10, maxPoints: 100 },
  { id: 'gi_acc_mid', sectionId: IDS.secACC201, name: 'Mid-term', weightPct: 30, maxPoints: 100 },
  { id: 'gi_cs301_p1', sectionId: IDS.secCS301, name: 'Project 1', weightPct: 40, maxPoints: 100 },
  { id: 'gi_cs301_mid', sectionId: IDS.secCS301, name: 'Midterm Exam', weightPct: 30, maxPoints: 100 },
  { id: 'gi_eng_essay', sectionId: IDS.secENG110, name: 'Research Essay', weightPct: 60, maxPoints: 100 },
  { id: 'gi_cs201_final', sectionId: IDS.secCS201, name: 'Final Grade', weightPct: 50, maxPoints: 100 },
  ...[IDS.secBETH190, IDS.secBMGT112, IDS.secCOMP101, IDS.secDAP101, IDS.secEMPL111, IDS.secMARK114].flatMap(sec => [
    { id: `gi_${sec}_final`, sectionId: sec, name: 'Final Grade', weightPct: 100, maxPoints: 100 },
  ]),
];

export const assignments: Assignment[] = [
  { id: 'as_acsw_final', sectionId: IDS.secACSW500, title: 'FINAL EXAM', description: 'Comprehensive final assessment covering core family studies casework, dynamic structures, and ethical care protocols.', points: 100, weightPct: 30, dueAt: '2026-10-03T05:29:00-07:00', gradeItemId: 'gi_acsw_final' },
  { id: 'as_acsw_mid', sectionId: IDS.secACSW500, title: 'MID TERM', description: 'Mid-term assessment on family systems and assessment techniques.', points: 100, weightPct: 30, dueAt: '2026-10-03T05:29:00-07:00', gradeItemId: 'gi_acsw_mid' },
  { id: 'as_acsw_part', sectionId: IDS.secACSW500, title: 'Participation', description: 'Reflective participation log for in-class and online sessions.', points: 100, weightPct: 20, dueAt: '2026-10-03T05:29:00-07:00', gradeItemId: 'gi_acsw_part' },
  { id: 'as_acsw_q1', sectionId: IDS.secACSW500, title: 'Quiz 1', description: 'Quiz on family systems concepts.', points: 100, weightPct: 10, dueAt: '2026-10-03T05:29:00-07:00', gradeItemId: 'gi_acsw_q1' },
  { id: 'as_acsw_q2', sectionId: IDS.secACSW500, title: 'Quiz 2', description: 'Quiz on relational risk assessment.', points: 100, weightPct: 10, dueAt: '2026-10-03T05:29:00-07:00', gradeItemId: 'gi_acsw_q2' },
  { id: 'as_acc_hw5', sectionId: IDS.secACC201, title: 'Homework 5', description: 'Adjusting entries practice set.', points: 100, weightPct: 10, dueAt: '2026-10-13T23:59:00-07:00', gradeItemId: 'gi_acc_hw5' },
  { id: 'as_cs301_p1', sectionId: IDS.secCS301, title: 'Project 1', description: 'Implement and benchmark two sorting algorithms.', points: 100, weightPct: 40, dueAt: '2026-10-16T23:59:00-07:00', gradeItemId: 'gi_cs301_p1' },
  { id: 'as_cs301_mid', sectionId: IDS.secCS301, title: 'Midterm Exam', description: 'In-class midterm.', points: 100, weightPct: 30, dueAt: '2026-10-20T21:30:00-07:00', gradeItemId: 'gi_cs301_mid' },
  { id: 'as_eng_essay', sectionId: IDS.secENG110, title: 'Research Essay', description: '1,500-word research essay with citations.', points: 100, weightPct: 60, dueAt: '2026-10-29T23:59:00-07:00', gradeItemId: 'gi_eng_essay' },
  { id: 'as_cs201_final', sectionId: IDS.secCS201, title: 'Final Grade', description: 'Final grade record.', points: 100, weightPct: 50, dueAt: undefined, gradeItemId: 'gi_cs201_final' },
];

export const submissions: Submission[] = [
  { id: 'sub_acc_hw5', assignmentId: 'as_acc_hw5', studentId: IDS.student, status: 'graded', attachments: [{ id: 'att1', name: 'hw5_adjusting_entries.pdf', size: 184000, mimeType: 'application/pdf', uri: '' }], submittedAt: '2026-09-20T18:12:00-07:00', receiptId: 'RCPT-ACC201-0091', updatedAt: '2026-09-22T09:00:00-07:00' },
  { id: 'sub_cs301_p1', assignmentId: 'as_cs301_p1', studentId: IDS.student, status: 'draft', attachments: [], note: 'Benchmarks pending', updatedAt: '2026-09-24T10:05:00-07:00' },
  { id: 'sub_cs301_mid', assignmentId: 'as_cs301_mid', studentId: IDS.student, status: 'graded', attachments: [], submittedAt: '2026-09-23T15:00:00-07:00', receiptId: 'RCPT-CS301-0210', updatedAt: '2026-09-24T09:00:00-07:00' },
];

const now = '2026-09-24T09:00:00-07:00';
export const marks: Mark[] = [
  { id: `gi_acc_hw5:${IDS.student}`, gradeItemId: 'gi_acc_hw5', sectionId: IDS.secACC201, studentId: IDS.student, score: 94, status: 'released', feedback: 'Excellent work on accruals.', updatedAt: now },
  { id: `gi_cs301_mid:${IDS.student}`, gradeItemId: 'gi_cs301_mid', sectionId: IDS.secCS301, studentId: IDS.student, score: 88, status: 'released', feedback: 'Strong on recurrences.', updatedAt: now },
];

export const attendance: AttendanceRecord[] = [
  // ACSW 500 — taken 2026-09-21, all present
  ...SECTION_ROSTERS.sec_acsw500.map(id => ({ id: `${IDS.secACSW500}_s5:${id}`, sessionId: `${IDS.secACSW500}_s5`, sectionId: IDS.secACSW500, studentId: id, status: 'present' as const, state: 'submitted' as const, recordedAt: '2026-09-21T22:05:00-07:00' })),
  // ACC201 for Marcus
  { id: `${IDS.secACC201}_s2:${IDS.student}`, sessionId: `${IDS.secACC201}_s2`, sectionId: IDS.secACC201, studentId: IDS.student, status: 'late', state: 'submitted', recordedAt: '2026-09-19T00:40:00-07:00' },
  { id: `${IDS.secACC201}_s3:${IDS.student}`, sessionId: `${IDS.secACC201}_s3`, sectionId: IDS.secACC201, studentId: IDS.student, status: 'present', state: 'submitted', recordedAt: '2026-09-24T00:35:00-07:00' },
  // CS301 for Marcus (4 recorded: 3 present, 1 absent)
  { id: `${IDS.secCS301}_s1:${IDS.student}`, sessionId: `${IDS.secCS301}_s1`, sectionId: IDS.secCS301, studentId: IDS.student, status: 'present', state: 'submitted', recordedAt: '2026-09-03T15:10:00-07:00' },
  { id: `${IDS.secCS301}_s2:${IDS.student}`, sessionId: `${IDS.secCS301}_s2`, sectionId: IDS.secCS301, studentId: IDS.student, status: 'present', state: 'submitted', recordedAt: '2026-09-08T15:10:00-07:00' },
  { id: `${IDS.secCS301}_s3:${IDS.student}`, sessionId: `${IDS.secCS301}_s3`, sectionId: IDS.secCS301, studentId: IDS.student, status: 'absent', state: 'submitted', recordedAt: '2026-09-10T15:10:00-07:00' },
  { id: `${IDS.secCS301}_s4:${IDS.student}`, sessionId: `${IDS.secCS301}_s4`, sectionId: IDS.secCS301, studentId: IDS.student, status: 'present', state: 'submitted', recordedAt: '2026-09-15T15:10:00-07:00' },
];

export const finalMarks: FinalMark[] = [
  { id: 'fm1', studentId: IDS.student, courseCode: 'MARK 114', courseTitle: 'Social Media Marketing Strategies', programId: 'prog_cs', termId: IDS.term2026F, startDate: '2026-09-14', endDate: '2026-12-10', credits: 3, grade: 'IP', status: 'In Progress' },
  { id: 'fm2', studentId: IDS.student, courseCode: 'EMPL 111', courseTitle: 'Career Employment & Strategies', programId: 'prog_cs', termId: IDS.term2026F, startDate: '2026-09-14', endDate: '2026-09-18', credits: 3, grade: 'IP', status: 'In Progress' },
  { id: 'fm3', studentId: IDS.student, courseCode: 'ACC 201', courseTitle: 'Financial Accounting', programId: 'prog_cs', termId: IDS.term2025F, startDate: '2025-09-01', endDate: '2025-10-10', credits: 3, grade: 'B', gradePoints: 3.0, scorePct: 76, status: 'Completed' },
  { id: 'fm4', studentId: IDS.student, courseCode: 'ENG 110', courseTitle: 'Academic Writing', programId: 'prog_cs', termId: IDS.term2025F, startDate: '2025-11-01', endDate: '2025-12-12', credits: 3, grade: 'W', status: 'Withdrawn' },
  { id: 'fm5', studentId: IDS.student, courseCode: 'CS 301', courseTitle: 'Algorithms', programId: 'prog_cs', termId: 't_TR2_2026', startDate: '2026-05-04', endDate: '2026-08-14', credits: 3, grade: 'A-', gradePoints: 3.7, scorePct: 88, status: 'Distinction', honors: true },
  { id: 'fm6', studentId: IDS.student, courseCode: 'DATA 150', courseTitle: 'Introduction to Data', programId: 'prog_cs', termId: IDS.termTR1_2026, startDate: '2026-01-12', endDate: '2026-04-24', credits: 3, grade: 'I', status: 'Incomplete Extension' },
  { id: 'fm7', studentId: IDS.student, courseCode: 'ACSW 500', courseTitle: 'Family Studies', programId: 'prog_cs', termId: IDS.term2026F, startDate: '2026-09-14', endDate: '2026-10-02', credits: 3, grade: 'IP', status: 'In Progress' },
  { id: 'fm8', studentId: IDS.student, courseCode: 'BETH 190', courseTitle: 'Business Ethics', programId: 'prog_cs', termId: IDS.term2026F, startDate: '2026-09-14', endDate: '2026-09-18', credits: 3, grade: 'IP', status: 'In Progress' },
];

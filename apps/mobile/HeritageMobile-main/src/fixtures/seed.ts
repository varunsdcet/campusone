import type { DemoDb } from '../storage/schema';
import { DB_SCHEMA_VERSION } from '../storage/schema';
import { users, settings, contacts } from './users';
import { programmes } from './programmes';
import * as A from './academics';
import * as S from './studentRecords';
import * as C from './communication';
import * as I from './instructor';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Builds a fresh, deep-cloned demo database. */
export function buildSeed(): DemoDb {
  return clone({
    schemaVersion: DB_SCHEMA_VERSION,
    seededAt: new Date().toISOString(),
    users,
    settings,
    programmes,
    enrolments: S.enrolments,
    payments: S.payments,
    progress: S.progress,
    bookmarks: S.bookmarks,
    coachConversations: [],
    certificates: I.certificates,
    terms: A.terms,
    courses: A.courses,
    sections: A.sections,
    sectionEnrolments: A.sectionEnrolments,
    classSessions: A.classSessions,
    assignments: A.assignments,
    submissions: A.submissions,
    gradeItems: A.gradeItems,
    marks: A.marks,
    finalMarks: A.finalMarks,
    attendance: A.attendance,
    attendanceCorrections: [],
    workshops: S.workshops,
    workshopEnrolments: S.workshopEnrolments,
    badges: S.badges,
    badgeAwards: S.badgeAwards,
    extracurricular: S.extracurricular,
    planCourses: S.planCourses,
    requiredTasks: S.requiredTasks,
    documents: S.documents,
    taxDocuments: S.taxDocuments,
    statements: S.statements,
    transactions: S.transactions,
    requests: S.requests,
    notifications: C.notifications,
    mail: C.mail,
    contacts,
    lessonPlans: I.lessonPlans,
    competencies: I.competencies,
    competencyAssessments: I.competencyAssessments,
    sectionBadges: I.sectionBadges,
    logs: I.logs,
    repositories: I.repositories,
    scheduleChanges: I.scheduleChanges,
    evaluations: I.evaluations,
    history: I.history,
    faculties: I.faculties,
    programTypes: I.programTypes,
    academicPrograms: I.academicPrograms,
    badgeBases: I.badgeBases,
    facultyRecords: I.facultyRecords,
    todos: I.todos,
    englishTests: [],
  });
}

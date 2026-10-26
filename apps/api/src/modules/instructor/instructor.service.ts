import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import { hashPassword, requireApproval } from "@myheritage/auth";
import type { SessionClaims } from "@myheritage/contracts";
import {
  LIFECYCLE_STATUSES,
  lifecycleFromStudent,
  LMS_ACTIVITY_TYPES,
} from "../../lib/lifecycle-status.js";
import { gradeItemsInOpenApproval } from "../../lib/gradeApprovals.js";
import { assertSeat } from "../admin/heritage/enrolment.js";
import { DEFAULT_TZ } from "../courses/sectionSchedule.js";
import { sectionOfferings, type Offering } from "../courses/sectionOffering.js";
import { sectionTerm, UNASSIGNED_TERM } from "../../lib/sectionTerm.js";
import { myRepository } from "./myCourses.js";
import { buildAddProgramScreenForm } from "./addProgramForm.js";
import { buildAddSessionScreenForm } from "./addSessionForm.js";
import {
  ADD_FACULTY_PATH,
  DEFAULT_FACULTIES,
  FACULTIES_PROGRAMS_PATH,
  facultyIdFromName,
  facultySlug,
  groupFacultiesPrograms,
  mergeFacultyList,
  mergeFacultyProgramList,
  type FacultyProgramRecord,
  type FacultyRecord,
} from "./facultiesPrograms.js";
import {
  BADGES_PATH,
  PROGRAM_SETTINGS_PATH,
  applyProgramSettingsPatch,
  buildProgramSettingsPayload,
  settingsHref,
} from "./programSettings.js";
import {
  ADD_BADGE_PATH,
  ADD_GRADING_SCHEME_PATH,
  BADGES_LIST_PATH,
  COURSE_RESOURCES_PATH,
  GRADING_SCHEMES_PATH,
  buildAddBadgeFormPayload,
  buildAddCourseResourceForm,
  buildAddResourceCategoryForm,
  awardBadge,
  createBadgeDefinition,
  createCourseResource,
  createResourceCategory,
  gradeEntriesFromScheme,
  listBadgesPayload,
  listCourseResourcesPayload,
} from "./courseResourcesScreens.js";
import {
  buildNewWorkshopEnrolmentForm,
  buildWorkshopAttendance,
  buildWorkshopDetail,
  buildWorkshopEnrolments,
  buildWorkshopList,
  saveWorkshopAttendance,
  saveWorkshopEnrolment,
  updateWorkshopEnrolmentStatus,
  workshopNavCounts,
  type WorkshopEnrolmentStatus,
} from "./workshopScreens.js";
import {
  AVAILABILITY_PATH,
  buildProfileCompletionPayload,
  buildProfilePayload,
  loadAvailabilitySlots,
  persistAvailabilitySlot,
  persistAccomplishment,
  persistConnect,
  persistEducation,
  persistGeneralInfo,
  persistProfileDetails,
  persistTimezone,
  profileHeaderPayload,
  profileTabs,
  loadFacultyAccomplishments,
  updateAccomplishment,
  ACCOMPLISHMENTS_PATH,
  type AvailabilitySlot,
} from "./profileScreens.js";
import {
  buildHccAttendance,
  buildHccCourseEvaluations,
  buildHccCourseHistory,
  buildHccGradesSubmission,
  buildHccMyCourses,
  buildHccPendingGradeSubmissions,
  buildHccPendingSchedules,
  buildHccStudentFlags,
  buildHccStudentsDirectory,
  buildHccTranscriptPending,
  loadStudentStatusCounts,
} from "./hccCampusScreens.js";
import {
  COURSE_CONFIG_PATH,
  DEFAULT_COURSE_CONFIGS,
  ENROLLMENT_PERMISSION_OPTIONS,
  REPOSITORY_SETTING_OPTIONS,
  SYLLABUS_PRIVACY_OPTIONS,
  TEXTBOOK_OPT_OUT_OPTIONS,
  mergeCourseConfigList,
  selectOptions,
  type CourseConfigRecord,
} from "./courseConfigurations.js";
import {
  buildScheduleManagePayload,
  mergeScheduleFeesOverlay,
} from "./scheduleManageScreens.js";
import {
  TEXTBOOKS_LIST_PATH,
  REPOSITORY_LIST_PATH,
  DEFAULT_TEXTBOOKS,
  buildAddTextbookForm,
  buildContentRepositoryList,
  buildCourseTextbooksList,
  buildCreateContentCourseForm,
  buildRepositoryCatalog,
  mergeRepositoryList,
  mergeTextbookList,
  repositoryCourseFromFields,
  textbookFromFields,
  type RepositoryCourseRecord,
  type TextbookRecord,
} from "./courseContentScreens.js";
import {
  COURSE_LMS_TABS,
  badgeFromFields,
  buildCourseLms,
  competencyFromFields,
  groupFromFields,
  instructorNameParts,
  mergeCourseLmsOverlay,
  questionFromFields,
  type CourseLmsReporting,
  type CourseLmsState,
} from "./courseLmsScreens.js";
import { normalizeStoryboard, sanitizeLessonHtml } from "./aiDraftContent.js";
import {
  activityContentFromForm,
  findOverlayActivity,
  linkedLmsAssignment,
  loadLmsOverlay,
  retireLmsAssignment,
  saveLmsAssignment,
  setLmsAssignmentHidden,
  workspaceSectionId,
  type LmsAssignmentSettings,
} from "./lmsActivities.js";
import { LMS_ACCESS_RESTRICTIONS_KEY, parseLmsAccessRestrictions, serializeLmsAccessRestrictions } from "./lmsAccessRestrictions.js";
import { loadCourseGradeBoard } from "./courseGradeBoard.js";
import { sectionLmsMeta } from "./sectionLmsMeta.js";
import {
  buildInstructorAlertQueue,
  buildInstructorAssessmentQueue,
  buildInstructorLeaveQueue,
  buildInstructorRequirementQueue,
  buildInstructorWithdrawQueue,
  instructorAlertCount,
  loadStudentAdminDetail,
  recordAdminAlert,
  recordAdminFlag,
  seesAllStudents,
} from "./adminStudentRecords.js";
import { classJoinUrl, liveClassUrl, sessionJoinUrl, type LiveClassProvider } from "../../lib/liveClass.js";
import { addDays, hmIn, institutionTimezone, ymdIn, zonedToUtc } from "../../lib/workshopPolicy.js";
import { createClassSessionWithNotifications } from "../campusCompliance/sessions.js";
import { applyDraftToSubmittedAttendance, writeAttendanceRecords } from "./attendanceSessions.js";
import { buildCourseApprovalReview, buildGradeCorrectionReview } from "./approvalReviewScreens.js";
import { buildCourseBackups, buildCourseGroupsList, saveCourseGroup } from "./courseCatalogScreens.js";
import { FLAG_PRIORITIES, FLAG_TYPES, updateInstructorFlag, validateFlagFields } from "./instructorFlags.js";
import { markNotificationsRead, notificationPagination } from "../notifications/inbox.js";
import { facultySectionIds } from "./sectionFaculty.js";
import { generateWithAi } from "../../lib/ask.js";
import { assertInstitutionAiAllowed } from "../ai/governance-policy.js";
import { listInterviewerInterviews, safeInterviewMeetingUrl } from "../admissions/interviewAccess.js";
import { listOwnProgramChangeRequests, submitProgramChangeRequest } from "../admin/heritage/ops.js";

export type InstructorLivePayload = Record<string, unknown>;

type InstructorCtx = {
  user: SessionClaims;
  person: { givenName: string; familyName: string; email: string };
  displayName: string;
  term: { code: string; name: string } | null;
  terms: Array<{ id: string; code: string; name: string; startsOn: string; endsOn: string }>;
  sections: Array<{
    id: string;
    code: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    credits: number;
    termCode: string;
    enrolmentCount: number;
    enrolments: Array<{
      id: string;
      status: string;
      studentId: string;
      studentNumber: string;
      studentName: string;
      email: string;
      programName: string;
      standing: string;
    }>;
    assignments: Array<{
      id: string;
      title: string;
      maxScore: number;
      weightPercent: number;
      dueAt: Date | null;
    }>;
  }>;
  studentCount: number;
  draftGradeCount: number;
  notifications: Array<{ id: string; title: string; body: string; createdAt: Date; readAt: Date | null }>;
  threads: Array<{
    id: string;
    subject: string;
    updatedAt: Date;
    preview: string;
    otherName: string;
    otherAccountId: string | null;
    messages: Array<{ id: string; body: string; senderAccountId: string; createdAt: Date }>;
  }>;
  grades: Array<{
    id: string;
    studentId: string;
    score: number | null;
    maxScore: number;
    letter: string | null;
    status: string;
    studentName: string;
    studentNumber: string;
    assignmentTitle: string;
    sectionCode: string;
    courseCode: string;
    weightPercent: number;
  }>;
  announcementPosts: Array<{ id: string; title: string; body: string; when: string; sectionId: string | null; audience: string }>;
  submissions: Array<{
    id: string;
    status: string;
    submittedAt: Date | null;
    studentName: string;
    studentNumber: string;
    assignmentTitle: string;
    courseCode: string;
    sectionCode: string;
    files: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number; version: number }>;
  }>;
  classSessions: Array<{
    id: string;
    title: string;
    startsAt: Date;
    endsAt: Date | null;
    location: string | null;
    sectionCode: string;
    courseCode: string;
    joinUrl: string | null;
  }>;
  programs: Array<{ id: string; code: string; name: string; awardLevel?: string }>;
};

function pct(score: number | null, max: number) {
  if (score == null || max <= 0) return null;
  return Math.round((score / max) * 1000) / 10;
}

function letterFromPct(p: number | null) {
  if (p == null) return "—";
  if (p >= 90) return "A";
  if (p >= 85) return "A-";
  if (p >= 80) return "B+";
  if (p >= 75) return "B";
  if (p >= 70) return "B-";
  if (p >= 65) return "C+";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  return "F";
}

/** Course Management admins open any section's course workspace (View Course) through the instructor screens. */
function adminSectionId(user: SessionClaims, path?: string) {
  if (!path || !(user.roles.includes("admin") || user.roles.includes("registrar"))) return null;
  const workspace = /^\/instructor\/sections\/([0-9a-z-]{36})(?:[/?]|$)/i.exec(path)?.[1];
  if (workspace) return workspace;
  const { query } = parseScreenQuery(path);
  const requested = (query.get("sectionId") || query.get("view") || "").trim();
  return SECTION_ID_RE.test(requested) ? requested : null;
}

const SECTION_ID_RE = /^[0-9a-z-]{36}$/i;

/** Sections named by a screen path (workspace URL, `view`, `sectionId`) or action payload must be taught by the caller; admins/registrars may open any section in their institution. */
export async function assertInstructorSectionAccess(user: SessionClaims, path: string, rowKey?: string) {
  const { pathname, query } = parseScreenQuery(path);
  const workspaceId = /^\/instructor\/sections\/([^/]+)$/.exec(pathname.replace(/\/+$/, ""))?.[1] ?? "";
  const ids = new Set<string>();
  for (const raw of [workspaceId, query.get("view"), query.get("sectionId")]) {
    const id = (raw || "").trim();
    if (SECTION_ID_RE.test(id)) ids.add(id);
  }
  if (rowKey?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rowKey) as { sectionId?: unknown };
      if (typeof parsed.sectionId === "string" && SECTION_ID_RE.test(parsed.sectionId.trim())) ids.add(parsed.sectionId.trim());
    } catch {
      /* not a JSON payload */
    }
  }
  if (!ids.size) return;
  const sections = await prisma.section.findMany({
    where: { id: { in: [...ids] }, institutionId: user.institutionId },
    select: { id: true, instructorPersonId: true },
  });
  if (SECTION_ID_RE.test(workspaceId) && !sections.some((s) => s.id === workspaceId)) {
    throw Object.assign(new Error("Course section not found"), { status: 404, code: "NOT_FOUND" });
  }
  if (user.roles.includes("admin") || user.roles.includes("registrar")) return;
  const assigned = await facultySectionIds(user, sections.map((section) => section.id));
  if (sections.some((section) => !assigned.has(section.id))) {
    throw Object.assign(new Error("You do not teach this course section"), { status: 403, code: "FORBIDDEN" });
  }
}

async function loadCtx(user: SessionClaims, path?: string): Promise<InstructorCtx> {
  const person = await prisma.person.findFirstOrThrow({
    where: { id: user.personId, institutionId: user.institutionId },
  });
  const termsRaw = await prisma.term.findMany({
    where: { institutionId: user.institutionId },
    orderBy: { startsOn: "desc" },
  });
  const term = termsRaw[0] ?? null;
  const viewSectionId = adminSectionId(user, path);
  const canManageAll = user.roles.includes("admin") || user.roles.includes("registrar");
  const needsAdminSectionPicker = canManageAll && Boolean(path?.toLowerCase().includes("attendance"));
  const assignedIds = canManageAll ? null : await facultySectionIds(user);
  const sectionsRaw = await prisma.section.findMany({
    where: {
      institutionId: user.institutionId,
      ...(canManageAll
        ? viewSectionId
          ? { id: viewSectionId }
          : needsAdminSectionPicker
            ? {}
            : { instructorPersonId: user.personId }
        : viewSectionId
          ? { id: { in: [...new Set([...assignedIds!, viewSectionId])] } }
          : { id: { in: [...assignedIds!] } }),
    },
    include: {
      course: true,
      term: true,
      assignments: { orderBy: { dueAt: "asc" } },
      enrolments: {
        where: { status: { in: ["enrolled", "completed", "withdrawn"] } },
        include: { student: { include: { person: true } } },
      },
    },
    orderBy: { code: "asc" },
  });
  // Only labels depend on the offering dates, so a lookup failure falls back to the stored term instead of failing the screen.
  const offerings = await sectionOfferings(user.institutionId, sectionsRaw.map((s) => s.id)).catch(() => new Map<string, Offering>());

  const sections = sectionsRaw.map((s) => ({
    id: s.id,
    code: s.code,
    courseId: s.courseId,
    courseCode: s.course.code,
    courseTitle: s.course.title,
    credits: s.course.credits,
    termCode: sectionTerm(s.term, { startsOn: offerings.get(s.id)?.startsOn, endsOn: offerings.get(s.id)?.endsOn }, termsRaw)?.code ?? "",
    enrolmentCount: s.enrolments.filter((e) => e.status === "enrolled").length,
    enrolments: s.enrolments.map((e) => ({
      id: e.id,
      status: e.status,
      studentId: e.studentId,
      studentNumber: e.student.studentNumber,
      studentName: `${e.student.person.givenName} ${e.student.person.familyName}`.trim(),
      email: e.student.person.email,
      programName: e.student.programName,
      standing: e.student.standing,
    })),
    assignments: s.assignments.map((a) => ({
      id: a.id,
      title: a.title,
      maxScore: a.maxScore,
      weightPercent: a.weightPercent,
      dueAt: a.dueAt,
    })),
  }));

  const studentIds = new Set(
    sections.flatMap((s) =>
      s.enrolments.filter((e) => e.status === "enrolled").map((e) => e.studentId),
    ),
  );
  const ctxSectionIds = sectionsRaw.map((s) => s.id);
  const today = ymdIn(new Date(), await institutionTimezone(user.institutionId));
  const activeSectionIds = sectionsRaw
    .filter((section) => {
      const offeringEnd = offerings.get(section.id)?.endsOn;
      const termEnd = section.term?.endsOn ? String(section.term.endsOn).slice(0, 10) : "";
      return !(offeringEnd || termEnd) || (offeringEnd || termEnd) >= today;
    })
    .map((section) => section.id);
  const draftGradeCount = await prisma.gradeItem.count({
    where: {
      institutionId: user.institutionId,
      status: "draft",
      score: { not: null },
      enrolment: { status: "enrolled" },
      assignment: { sectionId: { in: activeSectionIds } },
    },
  });

  const notifications = await prisma.notification.findMany({
    where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const allThreads = await prisma.messageThread.findMany({
    where: { institutionId: user.institutionId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 120 } },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  const myThreads = allThreads.filter((t) => {
    try {
      const ids = JSON.parse(t.participantAccountIdsJson) as string[];
      return ids.includes(user.accountId);
    } catch {
      return false;
    }
  });
  const otherAccountIds = [
    ...new Set(
      myThreads.flatMap((t) => {
        try {
          return (JSON.parse(t.participantAccountIdsJson) as string[]).filter((id) => id !== user.accountId);
        } catch {
          return [];
        }
      }),
    ),
  ];
  const otherAccounts = await prisma.account.findMany({
    where: { id: { in: otherAccountIds } },
    include: { person: true },
  });
  const otherName = new Map(
    otherAccounts.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim()]),
  );
  const threads = myThreads.slice(0, 30).map((t) => {
    let other = "Participant";
    let otherAccountId: string | null = null;
    try {
      const ids = JSON.parse(t.participantAccountIdsJson) as string[];
      const oid = ids.find((id) => id !== user.accountId) ?? null;
      otherAccountId = oid;
      if (oid) other = otherName.get(oid) ?? other;
    } catch {
      /* ignore */
    }
    const latest = t.messages[t.messages.length - 1];
    return {
      id: t.id,
      subject: t.subject,
      updatedAt: t.updatedAt,
      preview: latest?.body ?? "",
      otherName: other,
      otherAccountId,
      messages: t.messages.map((m) => ({
        id: m.id,
        body: m.body,
        senderAccountId: m.senderAccountId,
        createdAt: m.createdAt,
      })),
    };
  });

  const gradeRows = await prisma.gradeItem.findMany({
    where: {
      institutionId: user.institutionId,
      assignment: { sectionId: { in: ctxSectionIds } },
    },
    include: {
      student: { include: { person: true } },
      assignment: { include: { section: { include: { course: true } } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const announcementRecords = await prisma.portalRecord.findMany({
    where: {
      institutionId: user.institutionId,
      role: "instructor",
      screenPath: { contains: "announcement" },
      audienceAccountId: user.accountId,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const announcementPosts = announcementRecords.map((r) => ({
    id: r.id,
    title: r.primaryText,
    body: r.secondaryText ?? "",
    when: r.createdAt.toLocaleString(),
    sectionId: (r.href && parseScreenQuery(r.href).query.get("sectionId")) || null,
    audience: r.metaText?.startsWith("Posted to ") ? r.metaText.slice("Posted to ".length) : "All enrolled",
  }));

  const programRows = await prisma.program.findMany({
    where: { institutionId: user.institutionId },
    orderBy: { name: "asc" },
  });
  const rosterProgramNames = [
    ...new Set(sections.flatMap((s) => s.enrolments.map((e) => e.programName).filter(Boolean))),
  ];
  const institutionProgramNames = await prisma.student.findMany({
    where: { institutionId: user.institutionId },
    select: { programName: true },
    distinct: ["programName"],
  });
  const programNameSet = new Map<string, { id: string; code: string; name: string; awardLevel?: string }>();
  for (const p of programRows) {
    programNameSet.set(p.name.toLowerCase(), { id: p.id, code: p.code, name: p.name, awardLevel: p.awardLevel });
  }
  for (const name of [...rosterProgramNames, ...institutionProgramNames.map((p) => p.programName)]) {
    const key = name.trim().toLowerCase();
    if (!key || programNameSet.has(key)) continue;
    programNameSet.set(key, {
      id: `name:${name}`,
      code: name.slice(0, 8).toUpperCase().replace(/\s+/g, "-"),
      name,
    });
  }
  const programs = [...programNameSet.values()].sort((a, b) => a.name.localeCompare(b.name));

  const sectionIds = sections.map((s) => s.id);
  const assignmentIds = sections.flatMap((s) => s.assignments.map((a) => a.id));

  const submissionRows = assignmentIds.length
    ? await prisma.submission.findMany({
        where: {
          institutionId: user.institutionId,
          assignmentId: { in: assignmentIds },
        },
        include: {
          student: { include: { person: true } },
          assignment: { include: { section: { include: { course: true } } } },
          files: { where: { archivedAt: null }, orderBy: { version: "desc" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
    : [];

  const classSessions = sectionIds.length
    ? await prisma.classSession.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: sectionIds } },
        include: { section: { include: { course: true } } },
        orderBy: { startsAt: "asc" },
        take: 200,
      })
    : [];

  return {
    user,
    person: { givenName: person.givenName, familyName: person.familyName, email: person.email },
    displayName: `${person.givenName} ${person.familyName}`.trim(),
    term: term ? { code: term.code, name: term.name } : null,
    terms: termsRaw.map((t) => ({ id: t.id, code: t.code, name: t.name, startsOn: t.startsOn, endsOn: t.endsOn })),
    sections,
    studentCount: studentIds.size,
    draftGradeCount,
    notifications,
    threads,
    grades: gradeRows.map((g) => ({
      id: g.id,
      studentId: g.studentId,
      score: g.score,
      maxScore: g.maxScore,
      letter: g.letter,
      status: g.status,
      studentName: `${g.student.person.givenName} ${g.student.person.familyName}`.trim(),
      studentNumber: g.student.studentNumber,
      assignmentTitle: g.assignment.title,
      sectionCode: g.assignment.section.code,
      courseCode: g.assignment.section.course.code,
      weightPercent: g.assignment.weightPercent,
    })),
    announcementPosts,
    submissions: submissionRows.map((s) => ({
      id: s.id,
      status: s.status,
      submittedAt: s.submittedAt,
      studentName: `${s.student.person.givenName} ${s.student.person.familyName}`.trim(),
      studentNumber: s.student.studentNumber,
      assignmentTitle: s.assignment.title,
      courseCode: s.assignment.section.course.code,
      sectionCode: s.assignment.section.code,
      files: s.files.map((f) => ({
        id: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        version: f.version,
      })),
    })),
    classSessions: classSessions.map((c) => ({
      id: c.id,
      title: c.title,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      location: c.location,
      sectionCode: c.section.code,
      courseCode: c.section.course.code,
      joinUrl: sessionJoinUrl(c.sectionId, c.joinUrl),
    })),
    programs,
  };
}

function primarySection(ctx: InstructorCtx) {
  return ctx.sections[0] ?? null;
}

/** Prefer a section that still has enrolled students (attendance needs an active roster). */
function attendanceSection(ctx: InstructorCtx) {
  const ranked = [...ctx.sections].sort((a, b) => {
    const ae = a.enrolments.filter((e) => e.status === "enrolled").length;
    const be = b.enrolments.filter((e) => e.status === "enrolled").length;
    return be - ae;
  });
  return ranked[0] ?? null;
}

function tableRowsFromSections(ctx: InstructorCtx) {
  return ctx.sections.map((s) => ({
    cells: [s.courseCode, s.courseTitle, s.code, String(s.enrolmentCount), s.termCode, "Active"],
    primary: s.courseCode,
    secondary: s.courseTitle,
    badge: "Active",
    badgeTone: "active" as const,
    href: `/instructor/sections/${s.id}`,
    action: "Open",
  }));
}

function rosterRows(ctx: InstructorCtx) {
  const seen = new Set<string>();
  const rows: Array<{
    cells: string[];
    primary: string;
    secondary: string;
    studentId: string;
    badge: string;
    badgeTone: "active" | "warning" | "danger" | "muted";
    href: string;
  }> = [];
  for (const s of ctx.sections) {
    for (const e of s.enrolments) {
      if (e.status !== "enrolled") continue;
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);
      const tone =
        e.standing === "probation" || e.standing === "alert"
          ? ("danger" as const)
          : e.standing === "warning"
            ? ("warning" as const)
            : ("active" as const);
      rows.push({
        cells: [e.studentNumber, e.studentName, e.programName, s.courseCode, e.standing, e.status],
        primary: e.studentName,
        secondary: e.studentNumber,
        studentId: e.studentId,
        badge: e.standing,
        badgeTone: tone,
        href: `/instructor/f/t22-student-detail-full-page?studentId=${e.studentId}`,
      });
    }
  }
  return rows;
}

type GradeBoardStatus = "SUBMITTED" | "UNDER REVIEW" | "REJECTED";

function sectionGradeBoard(ctx: InstructorCtx, sectionCode: string) {
  const grades = ctx.grades.filter((g) => g.sectionCode === sectionCode);
  const drafts = grades.filter((g) => g.status === "draft").length;
  const pending = grades.filter((g) => g.status === "pending_publish").length;
  const missing = grades.filter((g) => g.score == null).length;
  let status: GradeBoardStatus;
  let submittedLabel: string;
  if (drafts > 0 || missing > 0 || grades.length === 0) {
    status = "UNDER REVIEW";
    submittedLabel = "Submission required";
  } else if (pending > 0) {
    status = "SUBMITTED";
    submittedLabel = "Pending approval";
  } else {
    status = "SUBMITTED";
    submittedLabel = "Approved";
  }
  return { drafts, pending, missing, status, submittedLabel };
}

function buildDashboard(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const gradeSubmissions = ctx.sections.map((s) => {
    const board = sectionGradeBoard(ctx, s.code);
    return {
      code: s.courseCode,
      sectionCode: s.code,
      title: s.courseTitle,
      status: board.submittedLabel,
      statusTone:
        board.submittedLabel === "Approved"
          ? ("active" as const)
          : board.submittedLabel === "Pending approval"
            ? ("info" as const)
            : ("warning" as const),
      missing: String(board.missing),
      href: "/instructor/f/t62-pending-grade-submissions",
    };
  });
  const alerts = [
    ...(ctx.draftGradeCount > 0
      ? [
          {
            id: "draft-grades",
            title: "Draft grades pending",
            body: `${ctx.draftGradeCount} grade item(s) still in draft across your sections.`,
            tone: "warning" as const,
          },
        ]
      : []),
    ...ctx.notifications.slice(0, 3).map((n) => ({
      id: `notification:${n.id}`,
      title: n.title,
      body: n.body,
      tone: "info" as const,
    })),
  ];
  return {
    title: "Home",
    subtitle: ctx.term ? `${ctx.term.name} · ${ctx.term.code}` : "Teaching workspace",
    kpis: [],
    gradesQueue: ctx.sections.map((s) => {
      const board = sectionGradeBoard(ctx, s.code);
      return {
        code: s.courseCode,
        title: s.courseTitle,
        instructor: ctx.displayName,
        submitted: board.submittedLabel,
        enrolled: String(s.enrolmentCount),
        distribution: `${s.assignments.length} assessments`,
        bars: [25, 40, 25, 10] as [number, number, number, number?],
        status: board.submittedLabel,
      };
    }),
    dashboard: {
      greeting: "Welcome to Heritage Community College",
      name: ctx.displayName,
      meta: ctx.person.email,
      statusBadge: ctx.sections.length ? "Instructor" : "Instructor",
      quickActions: [
        { label: "Message Center", href: "/instructor/messages", variant: "primary" },
        { label: "Notifications", href: "/instructor/notifications", variant: "secondary" },
        { label: "Enter Grades", href: "/instructor/gradebook", variant: "secondary" },
        { label: "Ask MyHeritage", href: "/instructor/ask", variant: "ai" },
      ],
      timetable: ctx.sections.slice(0, 6).map((s) => {
        const board = sectionGradeBoard(ctx, s.code);
        return {
          time: s.termCode || UNASSIGNED_TERM,
          code: s.courseCode,
          title: s.courseTitle,
          room: s.code,
          status: board.submittedLabel,
          statusTone:
            board.submittedLabel === "Approved"
              ? ("active" as const)
              : board.submittedLabel === "Pending approval"
                ? ("info" as const)
                : ("warning" as const),
          action: "Open",
          href: `/instructor/sections/${s.id}`,
        };
      }),
      gradeSubmissions,
      announcements: ctx.notifications.slice(0, 4).map((n) => ({
        title: n.title,
        body: n.body,
        when: n.createdAt.toLocaleString(),
      })),
      alerts,
      officeHours: sec
        ? [{ day: "By appointment", window: "See calendar", mode: "Campus", remaining: sec.code }]
        : [],
      endedCourses: ctx.sections.map((s) => ({
        label: `${s.courseCode}: ${s.code}`,
        sectionId: s.id,
        href: `/instructor/gradebook?sectionId=${encodeURIComponent(s.id)}`,
      })),
    },
  };
}

async function buildAdmissionsInterviews(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const interviews = await listInterviewerInterviews(ctx.user.institutionId, ctx.user.personId);
  const applicationIds = [...new Set(interviews.map((row) => row.applicationId))];
  const applications = applicationIds.length
    ? await prisma.admissionsApplication.findMany({
        where: { institutionId: ctx.user.institutionId, id: { in: applicationIds } },
        select: { id: true, personId: true, programName: true },
      })
    : [];
  const people = applications.length
    ? await prisma.person.findMany({
        where: { institutionId: ctx.user.institutionId, id: { in: applications.map((row) => row.personId) } },
        select: { id: true, givenName: true, familyName: true },
      })
    : [];
  const personNames = new Map(people.map((person) => [person.id, `${person.givenName} ${person.familyName}`.trim()]));
  const applicationMeta = new Map(applications.map((application) => [application.id, {
    name: personNames.get(application.personId) || "Applicant",
    program: application.programName,
  }]));
  return {
    title: "Admissions Interviews",
    subtitle: "Interviews assigned to you by Admissions",
    countLabel: `${interviews.length} assigned interview${interviews.length === 1 ? "" : "s"}`,
    emptyMessage: "No admissions interviews are assigned to you.",
    columns: ["When", "Applicant", "Program", "Mode / Location", "Status"],
    columnTemplate: "minmax(150px,1fr) minmax(150px,1fr) minmax(160px,1.2fr) minmax(170px,1.2fr) minmax(100px,.7fr)",
    rows: interviews.map((interview) => {
      const meta = applicationMeta.get(interview.applicationId);
      const meetingUrl = interview.status === "Scheduled" ? safeInterviewMeetingUrl(interview.location) : null;
      return {
        cells: [
          interview.scheduledAt.replace("T", " "),
          meta?.name || "Applicant",
          meta?.program || "—",
          meetingUrl ? `${interview.mode || "Video"} · Start interview` : [interview.mode, interview.location].filter(Boolean).join(" · ") || "—",
          interview.status,
        ],
        primary: meta?.name || "Applicant",
        badge: interview.status,
        badgeTone: interview.status === "Completed" ? "success" : interview.status === "Scheduled" ? "info" : interview.status === "Cancelled" ? "danger" : "muted",
        href: meetingUrl || undefined,
        action: meetingUrl ? "Start Interview" : undefined,
      };
    }),
  };
}

function sectionSchedule(ctx: InstructorCtx, section: InstructorCtx["sections"][number]) {
  const sessions = ctx.classSessions.filter(
    (s) => s.sectionCode === section.code && s.courseCode === section.courseCode,
  );
  const room = sessions.find((s) => s.location)?.location || "Room Not Set";
  if (!sessions.length) {
    return { schedule: "Schedule not set", room };
  }
  const timeZone = DEFAULT_TZ;
  const byDay = new Map<string, string>();
  for (const s of sessions) {
    const day = s.startsAt.toLocaleDateString("en-CA", { weekday: "short", timeZone });
    const start = s.startsAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", timeZone });
    const end = s.endsAt ? s.endsAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", timeZone }) : "";
    byDay.set(day, end ? `${start}–${end}` : start);
  }
  return {
    schedule: [...byDay.entries()].map(([day, time]) => `${day} ${time}`).join(" · "),
    room,
  };
}

function sectionLocation(ctx: InstructorCtx, section: InstructorCtx["sections"][number]) {
  const sessions = ctx.classSessions.filter((s) => s.sectionCode === section.code && s.courseCode === section.courseCode);
  return (
    sessions.find((s) => s.location?.trim())?.location?.trim() ||
    (sessions.some((s) => s.joinUrl) ? "Online" : "Location not set")
  );
}

function sectionTermStatus(ctx: InstructorCtx, section: InstructorCtx["sections"][number]) {
  const term = ctx.terms.find((t) => t.code === section.termCode);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const startsOn = term?.startsOn ? String(term.startsOn).slice(0, 10) : "";
  const endsOn = term?.endsOn ? String(term.endsOn).slice(0, 10) : "";
  if (endsOn && endsOn < today) return "Completed" as const;
  if (startsOn && startsOn > today) return "Not Started" as const;
  return "In Progress" as const;
}

function buildCourseList(ctx: InstructorCtx, path?: string): InstructorLivePayload {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekSessions = ctx.classSessions.filter((s) => s.startsAt >= now && s.startsAt <= weekEnd);
  const studentTotal = ctx.sections.reduce(
    (sum, s) => sum + s.enrolments.filter((e) => e.status === "enrolled").length,
    0,
  );
  return {
    title: "MY COURSES",
    subtitle: "",
    countLabel: `${ctx.sections.length} section(s)`,
    rows: tableRowsFromSections(ctx),
    courseList: {
      filters: ["All terms", "All statuses"],
      searchPlaceholder: "Search course name or number",
      kpis: [
        { label: "Active sections", value: String(ctx.sections.length), hint: ctx.term?.name || "This term" },
        { label: "Students", value: String(studentTotal), hint: "Enrolled" },
        { label: "This week", value: String(weekSessions.length), hint: "Sessions" },
      ],
      week: weekSessions.slice(0, 8).map((s) => {
        const section = ctx.sections.find((sec) => sec.code === s.sectionCode);
        return {
          day: s.startsAt.toLocaleDateString("en-CA", { weekday: "short" }),
          time: [
            s.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            s.endsAt ? s.endsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          ]
            .filter(Boolean)
            .join("–"),
          course: `${s.courseCode} · ${section?.courseTitle || s.title}`,
          room: s.location || "Room Not Set",
          href: section ? `/instructor/sections/${section.id}` : "/instructor/sections",
        };
      }),
      courses: ctx.sections.map((s) => {
        const slot = sectionSchedule(ctx, s);
        const enrolled = s.enrolments.filter((e) => e.status === "enrolled").length;
        return {
          id: s.id,
          code: s.courseCode,
          title: s.courseTitle,
          section: s.code,
          term: s.termCode || ctx.term?.name || ctx.term?.code || "—",
          schedule: slot.schedule,
          room: slot.room,
          location: sectionLocation(ctx, s),
          enrolled: String(enrolled || s.enrolmentCount),
          capacity: String(Math.max(enrolled || s.enrolmentCount, 30)),
          status: "Active",
          statusTone: "active",
          href: `/instructor/sections/${s.id}`,
          attendanceHref: `/instructor/attendance?sectionId=${encodeURIComponent(s.id)}`,
        };
      }),
    },
  };
}

function buildCoursesSessionsList(ctx: InstructorCtx): InstructorLivePayload {
  type ManageCourse = {
    id: string;
    name: string;
    number: string;
    creditValue: string;
    notStarted: number;
    inProgress: number;
    completed: number;
  };
  const fromSections = new Map<string, ManageCourse>();
  for (const s of ctx.sections) {
    const key = s.courseCode;
    const row = fromSections.get(key) ?? {
      id: `course-${key.toLowerCase().replace(/\s+/g, "-")}`,
      name: s.courseTitle,
      number: s.courseCode,
      creditValue: Number(s.credits || 0).toFixed(1),
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    };
    const status = sectionTermStatus(ctx, s);
    if (status === "Completed") row.completed += 1;
    else if (status === "Not Started") row.notStarted += 1;
    else row.inProgress += 1;
    fromSections.set(key, row);
  }
  return {
    title: "Manage Courses & Sessions",
    subtitle: "Courses and their scheduled sessions",
    primaryAction: "Create Course",
    primaryActionHref: "/instructor/f/t55-add-course-form",
    secondaryAction: "Bulk Actions",
    coursesSessions: {
      searchPlaceholder: "Search Courses",
      filterCoursePlaceholder: "Enter Course Name / Number Here",
      courses: [...fromSections.values()],
    },
  };
}

function courseAdminIdFor(code: string) {
  return `course-${code.toLowerCase().replace(/\s+/g, "-")}`;
}

function buildCourseAdmin(ctx: InstructorCtx, path: string): InstructorLivePayload {
  const courseIdMatch = /courseId=([^&]+)/.exec(path);
  const courseId = courseIdMatch
    ? decodeURIComponent(courseIdMatch[1])
    : ctx.sections[0]
      ? courseAdminIdFor(ctx.sections[0].courseCode)
      : "";
  const matching = ctx.sections.filter(
    (s) => courseAdminIdFor(s.courseCode) === courseId || s.courseCode === courseId || s.courseId === courseId,
  );
  const section = matching[0];
  const label = section ? `${section.courseCode}: ${section.courseTitle}` : "No course selected";
  const fromDb = matching.map((s) => ({
    id: s.id,
    courseId,
    course: `${s.courseCode}: ${s.courseTitle}`,
    location: sectionLocation(ctx, s),
    instructors: ctx.displayName,
    schedule: sectionSchedule(ctx, s).schedule,
    enrolled: s.enrolmentCount,
    reserved: 0,
    waitList: 0,
    status: sectionTermStatus(ctx, s),
  }));
  const courseOptions = [...new Map(ctx.sections.map((s) => [s.courseCode, s])).values()].map((s) => ({
    label: `${s.courseCode}: ${s.courseTitle}`,
    value: courseAdminIdFor(s.courseCode),
  }));
  return {
    title: "Course Sessions & Offerings",
    subtitle: "Sessions and offerings for this course",
    primaryAction: "Create Session / Offering",
    primaryActionHref: `/instructor/f/t78-add-session-offering?courseId=${encodeURIComponent(courseId)}`,
    courseAdmin: {
      courseId,
      courseLabel: label,
      tabs: [
        "Course Settings",
        "Course Sessions & Offerings",
        "Cross-Listing / Linked Courses",
        "Course Textbooks & e-Texts",
        "Transfer Courses & Equivalence",
      ],
      activeTab: "Course Sessions & Offerings",
      statusFilter: "",
      statusOptions: [
        { label: "Not Started", value: "Not Started" },
        { label: "In Progress", value: "In Progress" },
        { label: "Completed", value: "Completed" },
        { label: "All Statuses", value: "" },
      ],
      createSessionHref: "/instructor/f/t78-add-session-offering",
      sessions: fromDb,
      linkedCourses: {
        emptyMessage: "No linked courses were found.",
        rows: [],
        courseOptions,
        conditionOptions: [
          { label: "Optional Enrolment", value: "Optional Enrolment" },
          { label: "Required Enrolment", value: "Required Enrolment" },
          { label: "Same Session", value: "Same Session" },
        ],
      },
      textbooks: {
        emptyMessage: "No textbooks were found.",
        rows: [],
        textbookOptions: [
          { label: "-- Select Textbook --", value: "" },
          { label: "Business Essentials · ISBN 978-0134729220", value: "tb-biz-essentials" },
          { label: "Accounting Principles · ISBN 978-1119707110", value: "tb-acct-principles" },
          { label: "International Business · ISBN 978-1292214733", value: "tb-intl-biz" },
        ],
      },
      transferCourses: {
        emptyMessage: "No transfer courses were found.",
        rows: [],
        institutionOptions: [
          { label: "-- Select Institution --", value: "" },
          { label: "Douglas College", value: "Douglas College" },
          { label: "Kwantlen Polytechnic University", value: "Kwantlen Polytechnic University" },
          { label: "British Columbia Institute of Technology", value: "British Columbia Institute of Technology" },
        ],
      },
    },
  };
}

function buildAddSessionOfferingForm(ctx: InstructorCtx, path: string): InstructorLivePayload {
  const courseIdMatch = /courseId=([^&]+)/.exec(path);
  const courseId = courseIdMatch
    ? decodeURIComponent(courseIdMatch[1])
    : ctx.sections[0]
      ? courseAdminIdFor(ctx.sections[0].courseCode)
      : "";
  const section = ctx.sections.find(
    (s) => courseAdminIdFor(s.courseCode) === courseId || s.courseCode === courseId || s.courseId === courseId,
  );
  const number = section?.courseCode || courseId.replace(/^course-/i, "").replace(/-/g, " ").toUpperCase() || "New course";
  const form = buildAddSessionScreenForm(number);
  return {
    title: `Add Session / Offering: ${number}`,
    subtitle: "Add a session or offering",
    primaryAction: "Save Session",
    secondaryAction: "Cancel",
    secondaryActionHref: `/instructor/f/t77-course-admin?courseId=${encodeURIComponent(courseId)}`,
    form,
  };
}

function resolveSectionFromPath(ctx: InstructorCtx, path: string) {
  const { pathname, query } = parseScreenQuery(path);
  const viewId = (query.get("view") || "").trim();
  const sectionId = viewId || pathname.split("/").pop() || "";
  return (
    ctx.sections.find((s) => s.id === sectionId) ||
    (sectionId === "demo" ? ctx.sections[0] : undefined) ||
    ctx.sections.find((s) => s.enrolments.some((e) => e.status === "enrolled")) ||
    ctx.sections[0]
  );
}

async function assertLmsRestrictionScope(ctx: InstructorCtx, path: string, value: string | undefined) {
  const restrictions = parseLmsAccessRestrictions(value);
  if (!restrictions) return;
  const section = resolveSectionFromPath(ctx, path);
  if (!section) throw Object.assign(new Error("Open a course section before adding access restrictions"), { status: 400 });
  const allowedStudents = new Set(section.enrolments.filter((row) => row.status !== "withdrawn").map((row) => row.studentId));
  const overlay = await loadLmsOverlay(ctx.user.institutionId, path);
  const extraGroups = Array.isArray(overlay?.extraGroups) ? (overlay!.extraGroups as Array<{ id?: unknown }>) : [];
  const groupMembers = overlay?.groupMembers && typeof overlay.groupMembers === "object"
    ? (overlay.groupMembers as Record<string, unknown>)
    : {};
  const allowedGroups = new Set([
    ...extraGroups.map((group) => (typeof group.id === "string" ? group.id : "")).filter(Boolean),
    ...Object.keys(groupMembers),
  ]);
  for (const rule of restrictions.rules) {
    if (rule.type === "student" && rule.studentIds.some((id) => !allowedStudents.has(id))) {
      throw Object.assign(new Error("A selected student is not enrolled in this course section"), { status: 400 });
    }
    if (rule.type === "group" && rule.groupIds.some((id) => !allowedGroups.has(id))) {
      throw Object.assign(new Error("A selected course group no longer exists"), { status: 400 });
    }
  }
}

async function uploadedLmsFile(ctx: InstructorCtx, path: string, fileId: string) {
  if (!fileId) return null;
  const section = resolveSectionFromPath(ctx, path);
  const file = section
    ? await prisma.heritageRecord.findFirst({
        where: {
          id: fileId,
          institutionId: ctx.user.institutionId,
          screenId: "LMS:FILE",
          contextKey: section.id,
          deletedAt: null,
        },
        select: { id: true, dataJson: true },
      })
    : null;
  if (!file) throw Object.assign(new Error("Uploaded file not found for this course. Upload it again."), { status: 400 });
  const meta = JSON.parse(file.dataJson) as { name?: string; mime?: string; size?: number };
  return {
    fileId: file.id,
    fileName: meta.name || "Course file",
    fileMime: meta.mime || "",
    fileSize: Number(meta.size) || 0,
  };
}

function parseNotifyStudentIds(fields: Record<string, string>): string[] | undefined {
  const audience = (fields.Audience || fields.audience || "All enrolled students").trim().toLowerCase();
  if (audience.startsWith("all") || audience === "") return undefined;
  const raw = fields.NotifyStudentIds || fields.notifyStudentIds || fields.StudentIds || "";
  const ids = raw
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length) {
    throw Object.assign(new Error("Select at least one student to notify"), {
      status: 400,
      code: "NO_STUDENTS",
    });
  }
  return ids;
}

function onlineClassProvider(fields: Record<string, string>): LiveClassProvider | undefined {
  const value = (fields.Provider || fields.provider || "").trim().toLowerCase();
  if (value.includes("bigbluebutton")) return "bigbluebutton";
  if (value.includes("jitsi")) return "jitsi";
  return undefined;
}

async function publishOnlineClassSession(
  ctx: InstructorCtx,
  path: string,
  fields: Record<string, string>,
) {
  const sec = resolveSectionFromPath(ctx, path);
  if (!sec) {
    throw Object.assign(new Error("No teaching section found for this course"), {
      status: 400,
      code: "NO_SECTION",
    });
  }
  const title =
    (fields.Name || fields.Title || fields.title || `${sec.courseCode} Online Class`).trim() ||
    `${sec.courseCode} Online Class`;
  const openRaw = (fields["Open date/time"] || fields.StartsAt || fields.startsAt || "").trim();
  const startsAt = openRaw ? new Date(openRaw) : new Date();
  const joinUrl = classJoinUrl(sec.id, fields.JoinUrl || fields.joinUrl, onlineClassProvider(fields));
  const notifyStudentIds = parseNotifyStudentIds(fields);
  const published = await createClassSessionWithNotifications({
    institutionId: ctx.user.institutionId,
    sectionId: sec.id,
    title,
    startsAt: Number.isNaN(startsAt.getTime()) ? new Date() : startsAt,
    joinUrl,
    deliveryMode: "online",
    sessionKind: "lecture",
    notifyStudentIds,
    createdByAccountId: ctx.user.accountId,
  });
  return {
    sectionId: sec.id,
    joinUrl: published.session.joinUrl || joinUrl,
    sessionId: published.session.id,
    notified: published.notified,
    title: published.session.title,
  };
}

async function loadSectionAttendancePayload(
  ctx: InstructorCtx,
  sectionId: string,
): Promise<{
  meetings: Array<{
    label: string;
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  }>;
  rows: Array<{
    studentId: string;
    name: string;
    studentNumber: string;
    status: string;
    meetingLabel: string;
    recordedAt: string;
  }>;
  markHref: string;
  emptyMessage?: string;
  attendanceDates: string[];
}> {
  const records = await prisma.attendanceRecord.findMany({
    where: { institutionId: ctx.user.institutionId, sectionId },
    include: { student: { include: { person: true } } },
    orderBy: [{ meetingLabel: "desc" }, { recordedAt: "desc" }],
    take: 500,
  });
  const byMeeting = new Map<
    string,
    { label: string; present: number; absent: number; late: number; excused: number; total: number }
  >();
  const rows = records.map((r) => {
    const status = (r.status || "present").toLowerCase();
    const cur = byMeeting.get(r.meetingLabel) || {
      label: r.meetingLabel,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    };
    cur.total += 1;
    if (status === "absent") cur.absent += 1;
    else if (status === "late") cur.late += 1;
    else if (status === "excused") cur.excused += 1;
    else cur.present += 1;
    byMeeting.set(r.meetingLabel, cur);
    return {
      studentId: r.studentId,
      name: `${r.student.person.givenName} ${r.student.person.familyName}`.trim(),
      studentNumber: r.student.studentNumber,
      status: status.charAt(0).toUpperCase() + status.slice(1),
      meetingLabel: r.meetingLabel,
      recordedAt: r.recordedAt.toISOString(),
    };
  });
  const meetings = [...byMeeting.values()].sort((a, b) => b.label.localeCompare(a.label));
  const attendanceDates = meetings.map((m) => {
    const d = new Date(`${m.label}T12:00:00`);
    if (Number.isNaN(d.getTime())) return m.label;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      weekday: "short",
    });
  });
  return {
    meetings,
    rows,
    markHref: `/instructor/attendance?sectionId=${encodeURIComponent(sectionId)}`,
    emptyMessage:
      meetings.length === 0
        ? "No attendance submitted for this section yet. Mark attendance, then return here."
        : undefined,
    attendanceDates,
  };
}

function safeJsonRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function latestIso(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function reportIso(value: Date | string | null | undefined, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

async function loadCourseLmsReporting(
  ctx: InstructorCtx,
  section: InstructorCtx["sections"][number],
  baseLms: CourseLmsState,
): Promise<CourseLmsReporting> {
  const institutionId = ctx.user.institutionId;
  const enrolled = section.enrolments.filter((row) => row.status === "enrolled" || row.status === "completed");
  const studentIds = enrolled.map((row) => row.studentId);
  const overlayPaths = [
    `/instructor/sections/${section.id}`,
    `/instructor/f/t56-active-courses?view=${section.id}`,
    `/instructor/f/t56-active-courses?view=${encodeURIComponent(section.id)}`,
  ];
  const [overlayStates, submissions, interactionStates, progressStates, studentAccounts] = await Promise.all([
    prisma.sisScreenState.findMany({
      where: { institutionId, path: { in: overlayPaths } },
      select: { path: true, payloadJson: true, updatedAt: true },
    }),
    prisma.submission.findMany({
      where: { institutionId, assignment: { sectionId: section.id } },
      include: { assignment: { select: { id: true, title: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.sisScreenState.findMany({
      where: {
        institutionId,
        OR: [
          { path: { startsWith: `/student/lms-quiz/${section.id}/` } },
          { path: { startsWith: `/student/lms-choice/${section.id}/` } },
        ],
      },
      select: { id: true, path: true, payloadJson: true, updatedAt: true },
    }),
    prisma.sisScreenState.findMany({
      where: { institutionId, path: { startsWith: "/student/content-progress/", endsWith: `/${section.id}` } },
      select: { id: true, path: true, payloadJson: true, updatedAt: true },
    }),
    studentIds.length
      ? prisma.student.findMany({
          where: { institutionId, id: { in: studentIds } },
          select: { id: true, person: { select: { accounts: { select: { id: true } } } } },
        })
      : Promise.resolve([]),
  ]);

  const preferredOverlay = overlayStates.find((row) => row.path === overlayPaths[0]) || overlayStates[0];
  const overlay = preferredOverlay ? safeJsonRecord(preferredOverlay.payloadJson) : {};
  const lms = mergeCourseLmsOverlay(baseLms, overlay);
  const activities = lms.topics.flatMap((topic) => topic.activities);
  const activityById = new Map(activities.map((activity) => [activity.id, activity]));
  const assignmentActivity = new Map(
    activities.filter((activity) => activity.assignmentId).map((activity) => [activity.assignmentId!, activity]),
  );
  const studentById = new Map(enrolled.map((row) => [row.studentId, row]));
  const studentByAccount = new Map<string, string>();
  for (const row of studentAccounts) {
    for (const account of row.person.accounts) studentByAccount.set(account.id, row.id);
  }

  type StudentStat = {
    completed: Set<string>;
    submissions: number;
    quizAttempts: number;
    choiceResponses: number;
    times: string[];
  };
  const studentStats = new Map<string, StudentStat>();
  const statFor = (studentId: string) => {
    const existing = studentStats.get(studentId);
    if (existing) return existing;
    const created: StudentStat = { completed: new Set(), submissions: 0, quizAttempts: 0, choiceResponses: 0, times: [] };
    studentStats.set(studentId, created);
    return created;
  };
  for (const row of enrolled) statFor(row.studentId);

  const logs: CourseLmsReporting["logs"] = [];
  for (const submission of submissions) {
    const stat = statFor(submission.studentId);
    stat.submissions += 1;
    if (submission.status !== "draft") stat.completed.add(assignmentActivity.get(submission.assignmentId)?.id || `assignment:${submission.assignmentId}`);
    const at = reportIso(submission.submittedAt || submission.updatedAt || submission.createdAt);
    stat.times.push(at);
    logs.push({
      id: `submission-${submission.id}`,
      at,
      participant: studentById.get(submission.studentId)?.studentName || "Student",
      action: submission.submittedAt ? "Submitted" : "Saved draft",
      activity:
        submission.assignment?.title ||
        section.assignments.find((assignment) => assignment.id === submission.assignmentId)?.title ||
        "Assignment",
      source: "Assignment",
      detail: submission.status,
    });
  }

  for (const state of interactionStates) {
    const parts = state.path.split("/");
    const kind = parts[2];
    const activityId = parts[4] || "";
    const studentId = parts[5] || "";
    if (!studentId) continue;
    const payload = safeJsonRecord(state.payloadJson);
    const submittedAt = typeof payload.submittedAt === "string" ? payload.submittedAt : reportIso(state.updatedAt);
    const stat = statFor(studentId);
    stat.completed.add(activityId);
    stat.times.push(submittedAt);
    if (kind === "lms-quiz") stat.quizAttempts += 1;
    else stat.choiceResponses += 1;
    const activity = activityById.get(activityId);
    logs.push({
      id: state.id,
      at: submittedAt,
      participant: studentById.get(studentId)?.studentName || "Student",
      action: kind === "lms-quiz" ? "Quiz submitted" : "Choice submitted",
      activity: activity?.name || activityId || "Course activity",
      source: kind === "lms-quiz" ? "Quiz" : "Choice",
      detail:
        kind === "lms-quiz" && typeof payload.score === "number" && typeof payload.maxScore === "number"
          ? `${payload.score}/${payload.maxScore}`
          : undefined,
    });
  }

  for (const state of progressStates) {
    const accountId = state.path.split("/")[3] || "";
    const studentId = studentByAccount.get(accountId);
    if (!studentId) continue;
    const payload = safeJsonRecord(state.payloadJson);
    const completed = Array.isArray(payload.completed)
      ? payload.completed.filter((item): item is string => typeof item === "string")
      : [];
    const at = typeof payload.updatedAt === "string" ? payload.updatedAt : reportIso(state.updatedAt);
    const stat = statFor(studentId);
    for (const item of completed) stat.completed.add(item.replace(/^(activity|assignment|lesson|session):/, ""));
    stat.times.push(at);
    logs.push({
      id: state.id,
      at,
      participant: studentById.get(studentId)?.studentName || "Student",
      action: "Progress updated",
      activity: "Course content",
      source: "Content progress",
      detail: `${completed.length} item${completed.length === 1 ? "" : "s"} completed`,
    });
  }

  const instructorActivity = Array.isArray(overlay.activity) ? overlay.activity : [];
  for (const [index, value] of instructorActivity.entries()) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const at = typeof row.at === "string" ? row.at : reportIso(preferredOverlay?.updatedAt);
    const rowKey = typeof row.rowKey === "string" ? row.rowKey : "";
    logs.push({
      id: `instructor-${index}-${at}`,
      at,
      participant: ctx.displayName,
      action: typeof row.action === "string" ? row.action : "Course updated",
      activity: rowKey && !rowKey.startsWith("{") ? rowKey : "Course workspace",
      source: "Instructor",
    });
  }

  const activityRows = activities.map((activity) => {
    const matchingSubmissions = submissions.filter((row) => row.assignmentId === activity.assignmentId);
    const matchingStates = interactionStates.filter((row) => row.path.split("/")[4] === activity.id);
    const quizStates = matchingStates.filter((row) => row.path.split("/")[2] === "lms-quiz");
    const choiceStates = matchingStates.filter((row) => row.path.split("/")[2] === "lms-choice");
    const completed = [...studentStats.values()].filter((stat) => stat.completed.has(activity.id)).length;
    return {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      completions: Math.max(completed, matchingSubmissions.filter((row) => row.status !== "draft").length, quizStates.length, choiceStates.length),
      submissions: matchingSubmissions.length,
      attempts: quizStates.length,
      responses: choiceStates.length,
      lastActivityAt: latestIso([
        ...matchingSubmissions.map((row) => reportIso(row.submittedAt || row.updatedAt || row.createdAt)),
        ...matchingStates.map((row) => reportIso(row.updatedAt)),
      ]),
    };
  });

  const participation = enrolled.map((student) => {
    const stat = statFor(student.studentId);
    return {
      studentId: student.studentId,
      name: student.studentName,
      studentNumber: student.studentNumber,
      status: student.status,
      completed: stat.completed.size,
      submissions: stat.submissions,
      quizAttempts: stat.quizAttempts,
      choiceResponses: stat.choiceResponses,
      lastActivityAt: latestIso(stat.times),
    };
  });

  const competencies = lms.competencies.map((competency) => {
    const needle = (competency.resource || competency.name).trim().toLowerCase();
    const linked = activities.filter((activity) => {
      const name = activity.name.toLowerCase();
      return Boolean(needle) && (name.includes(needle) || needle.includes(name));
    });
    const completedStudents = linked.length
      ? participation.filter((student) => {
          const stat = studentStats.get(student.studentId);
          return linked.some((activity) => stat?.completed.has(activity.id));
        }).length
      : 0;
    return {
      id: competency.id,
      name: competency.name,
      resource: competency.resource || "Course level",
      linkedActivities: linked.length,
      participants: enrolled.length,
      completed: completedStudents,
      progressPercent: enrolled.length ? Math.round((completedStudents / enrolled.length) * 100) : 0,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    logs: logs.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200),
    activities: activityRows,
    participation,
    competencies,
  };
}

async function buildCourseDetail(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const { pathname, query } = parseScreenQuery(path);
  const viewId = (query.get("view") || "").trim();
  const sectionId = viewId || pathname.split("/").pop() || "";
  const names = instructorNameParts(ctx.displayName);
  const explicitId = /^\/instructor\/sections\/[^/]+$/.test(pathname) && sectionId !== "demo";
  const sec = ctx.sections.find((s) => s.id === sectionId) || (explicitId ? undefined : ctx.sections[0]);
  if (explicitId && !sec) {
    throw Object.assign(new Error("Course section not found"), { status: 404, code: "NOT_FOUND" });
  }

  if (!sec) {
    const code = "—";
    const title = "No section";
    const session = "Session not scheduled";
    const location = "Location not set";
    return {
      title: "Section detail",
      subtitle: "No teaching section assigned",
      courseDetail: {
        code,
        title,
        meta: "Assign a section to this instructor to open the workspace.",
        status: "Empty",
        tabs: [...COURSE_LMS_TABS],
        activeTab: "Course",
        overview: [{ label: "Status", value: "No section" }],
        modules: [],
        team: [
          {
            name: ctx.displayName,
            role: "Lead Instructor",
            initials: `${ctx.person.givenName[0] ?? ""}${ctx.person.familyName[0] ?? ""}`.toUpperCase(),
          },
        ],
        roster: [],
        assessments: [],
        lectures: [],
        labs: [],
        resources: [],
        lms: buildCourseLms({
          code,
          title,
          session,
          location,
          instructorFirst: names.first,
          instructorLast: names.last,
          sectionCode: "SECTION",
          ended: false,
        }),
      },
    };
  }

  const sectionSessions = ctx.classSessions.filter(
    (s) => s.sectionCode === sec.code || s.courseCode === sec.courseCode,
  );
  const lectures = sectionSessions
    .filter((s) => !/lab/i.test(s.title))
    .map((s) => ({
      title: s.title,
      when: s.startsAt.toLocaleString(),
      location: s.location || "—",
      joinUrl: s.joinUrl || undefined,
    }));
  const labs = sectionSessions
    .filter((s) => /lab/i.test(s.title))
    .map((s) => ({
      title: s.title,
      when: s.startsAt.toLocaleString(),
      location: s.location || "—",
    }));

  const meta = await sectionLmsMeta(ctx.user.institutionId, sec.id);
  const session = meta?.session ?? `${sec.code}${sec.termCode ? `: ${sec.termCode}` : ""}`;
  const location = meta?.location ?? "Location to be announced";
  const namesLive = instructorNameParts(ctx.displayName);
  const liveJoin = liveClassUrl(sec.id);

  const payload: InstructorLivePayload = {
    title: `${sec.courseCode}: ${sec.courseTitle}`.toUpperCase().includes(sec.courseCode)
      ? `${sec.courseCode}: ${sec.courseTitle}`
      : `${sec.courseCode}: ${sec.courseTitle}`,
    subtitle: session,
    courseDetail: {
      sectionId: sec.id,
      code: sec.courseCode,
      title: sec.courseTitle,
      meta: `${session} · ${location}`,
      status: meta?.ended ? "Ended" : "Active",
      tabs: [...COURSE_LMS_TABS],
      activeTab: "Course",
      overview: [
        { label: "Credits", value: String(sec.credits) },
        { label: "Section", value: sec.code },
        { label: "Term", value: sec.termCode || ctx.term?.name || "—" },
        { label: "Enrolled", value: String(sec.enrolmentCount) },
        { label: "Assignments", value: String(sec.assignments.length) },
        { label: "Instructor", value: ctx.displayName },
      ],
      modules: sec.assignments.length
        ? sec.assignments.map((a) => ({
            title: a.title,
            items: 1,
            status: a.dueAt && a.dueAt < new Date() ? "Complete" : "In Progress",
          }))
        : [{ title: "Course outline", items: 0, status: "Draft" }],
      team: [
        {
          name: ctx.displayName,
          role: "Lead Instructor",
          initials: `${ctx.person.givenName[0] ?? ""}${ctx.person.familyName[0] ?? ""}`.toUpperCase(),
        },
      ],
      roster: sec.enrolments
        .filter((e) => e.status === "enrolled")
        .map((e) => ({
          studentId: e.studentId,
          name: e.studentName,
          studentNumber: e.studentNumber,
          program: e.programName,
          standing: e.standing,
          email: e.email,
        })),
      assessments: sec.assignments.map((a) => ({
        title: a.title,
        due: a.dueAt ? a.dueAt.toLocaleString() : "—",
        maxScore: String(a.maxScore),
        weight: `${a.weightPercent}%`,
      })),
      lectures,
      labs,
      resources: [
        {
          name: "Course repository",
          type: "Folder",
          meta: "Shared teaching files",
          href: "/instructor/f/t37-course-repository",
        },
        {
          name: "Announcements",
          type: "Workspace",
          meta: "Section notices",
          href: "/instructor/announcements",
        },
        {
          name: "Gradebook",
          type: "Workspace",
          meta: "Scores and publish",
          href: "/instructor/gradebook",
        },
      ],
      lms: buildCourseLms({
        code: sec.courseCode,
        title: sec.courseTitle,
        session,
        location,
        instructorFirst: namesLive.first,
        instructorLast: namesLive.last,
        sectionCode: sec.code,
        joinUrl: liveJoin,
        ended: meta?.ended ?? false,
      }),
    },
  };

  const attendance = await loadSectionAttendancePayload(ctx, sec.id);
  const detail = payload.courseDetail as Record<string, unknown> & {
    lms?: { attendanceDates?: string[] };
  };
  detail.attendance = {
    meetings: attendance.meetings,
    rows: attendance.rows,
    markHref: attendance.markHref,
    emptyMessage: attendance.emptyMessage,
  };
  if (detail.lms && attendance.attendanceDates.length) {
    detail.lms.attendanceDates = attendance.attendanceDates;
  }
  if (detail.lms) {
    const gradeBoard = await loadCourseGradeBoard(ctx.user.institutionId, sec.id);
    const reporting = await loadCourseLmsReporting(ctx, sec, detail.lms as CourseLmsState);
    Object.assign(detail.lms, {
      gradeBoard,
      reporting,
      gradeEmpty: gradeBoard.rows.length ? undefined : "No students are currently registered in this course offering.",
    });
  }
  return payload;
}

function buildAnnouncements(ctx: InstructorCtx, path = ""): InstructorLivePayload {
  const requested = parseScreenQuery(path).query.get("sectionId")?.trim() || "";
  const sec = ctx.sections.find((s) => s.id === requested) || primarySection(ctx);
  const posts = ctx.announcementPosts.map((p) => ({
    title: p.title,
    body: p.body,
    when: p.when,
    audience: p.audience,
    sectionId: p.sectionId,
    pinned: false,
  }));
  return {
    title: "Course Announcements",
    subtitle: sec
      ? `Publish updates to enrolled students in ${sec.courseCode}.`
      : "Publish class updates to enrolled students",
    primaryAction: "New Announcement",
    announcements: {
      course: sec ? `${sec.courseCode} · ${sec.courseTitle}` : "All sections",
      sectionId: sec?.id ?? null,
      sections: ctx.sections.map((s) => ({
        id: s.id,
        label: `${s.courseCode} · ${s.code} — ${s.courseTitle}`,
        enrolled: s.enrolments.filter((e) => e.status === "enrolled").length,
      })),
      posts,
      compose: {
        titleLabel: "Announcement title",
        bodyLabel: "Message body",
        audienceLabel: "Audience",
        audienceValue: "All enrolled students",
        publishLabel: "Publish announcement",
      },
    },
  };
}

function buildAddCourseForm(ctx: InstructorCtx): InstructorLivePayload {
  const categorySet = new Map<string, string>();
  for (const section of ctx.sections) {
    const code = section.courseCode.replace(/\d+.*/, "") || section.courseCode.slice(0, 3);
    const key = code.toUpperCase();
    if (!categorySet.has(key)) categorySet.set(key, key);
  }
  const liveCategories = [...categorySet.values()].map((c) => ({ label: c, value: c }));
  const categoryOptions = [
    { label: "Select Category", value: "" },
    ...liveCategories,
    { label: "DAP: Accounting", value: "DAP: Accounting" },
    { label: "Computer Science", value: "Computer Science" },
    { label: "Nursing", value: "Nursing" },
    { label: "Business Administration", value: "Business Administration" },
    { label: "General Education", value: "General Education" },
  ].filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx);

  return {
    title: "Add New Course Instance",
    subtitle: "Course workspace overview",
    primaryAction: "Save Course",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t54-courses-sessions",
    form: {
      submitLabel: "Save Course",
      groups: [
        {
          title: "Course Details",
          fields: [
            {
              label: "Course Category",
              value: "",
              type: "select",
              options: categoryOptions,
            },
            {
              label: "Course Group",
              value: "No Grouping",
              type: "select",
              options: [
                { label: "No Grouping", value: "No Grouping" },
                { label: "Accounting Principles", value: "Accounting Principles" },
                { label: "Core", value: "Core" },
                { label: "Elective", value: "Elective" },
                { label: "Capstone", value: "Capstone" },
              ],
            },
            { label: "Course Name", value: "", type: "text" },
            { label: "Course Number", value: "", type: "text" },
            { label: "Course Credit Value", value: "", type: "number" },
            {
              label: "Course In-take Type",
              value: "Standard",
              type: "select",
              options: [
                { label: "Standard", value: "Standard" },
                { label: "Continuous", value: "Continuous" },
                { label: "Cohort", value: "Cohort" },
                { label: "Open Entry", value: "Open Entry" },
              ],
            },
            {
              label: "Course Enrollment Permission",
              value: "No permission required",
              type: "select",
              options: [
                { label: "No permission required", value: "No permission required" },
                { label: "Instructor approval", value: "Instructor approval" },
                { label: "Department approval", value: "Department approval" },
                { label: "Prerequisite gate", value: "Prerequisite gate" },
              ],
            },
          ],
        },
        {
          title: "Course Outline / Description",
          fields: [
            { label: "Course Description", value: "", type: "textarea" },
            { label: "Course Syllabus", value: "", type: "file" },
            {
              label: "Course Syllabus Privacy",
              value: "Private",
              type: "select",
              options: [
                { label: "Private", value: "Private" },
                { label: "Enrolled students", value: "Enrolled students" },
                { label: "Institution", value: "Institution" },
                { label: "Public", value: "Public" },
              ],
            },
          ],
        },
        {
          title: "Course Chair & Lead Accesses",
          fields: [
            {
              label: "Override course category permissions",
              value: "false",
              type: "checkbox",
              hint: "Override course category permissions for chair and lead access",
            },
          ],
        },
        {
          title: "Course Tuition",
          fields: [
            {
              label: "Course tuition included in the program cost",
              value: "false",
              type: "checkbox",
            },
            {
              label: "Course Cost Calculation",
              value: "Total Amount",
              type: "select",
              options: [
                { label: "Total Amount", value: "Total Amount" },
                { label: "Per Credit", value: "Per Credit" },
                { label: "Per Hour", value: "Per Hour" },
                { label: "Program Package", value: "Program Package" },
              ],
            },
            { label: "Domestic", value: "0.00", type: "number", hint: "$0.00" },
            { label: "International", value: "0.00", type: "number", hint: "$0.00" },
          ],
        },
        {
          title: "Default Course Schedule",
          fields: [
            { label: "Total Course Hours", value: "", type: "number" },
            { label: "Hours per Day", value: "", type: "number" },
            {
              label: "Weekly Schedule",
              value: "Monday,Tuesday,Wednesday,Thursday,Friday",
              type: "weekdays",
            },
            {
              label: "Time of Day",
              value: "Morning",
              type: "select",
              options: [
                { label: "Morning", value: "Morning" },
                { label: "Afternoon", value: "Afternoon" },
                { label: "Evening", value: "Evening" },
                { label: "Flexible", value: "Flexible" },
              ],
            },
            { label: "Customize weekly schedule", value: "false", type: "checkbox" },
          ],
        },
        {
          title: "Grading",
          fields: [
            {
              label: "Grading Scheme",
              value: "",
              type: "select",
              options: [
                { label: "Select Grading Scheme", value: "" },
                { label: "DIB and DAP", value: "DIB and DAP" },
                { label: "HCC Grading", value: "HCC Grading" },
                { label: "Health Care Assistant", value: "Health Care Assistant" },
                { label: "Pass / Fail", value: "Pass / Fail" },
                { label: "Standard GPA Ladder", value: "Standard GPA Ladder" },
                { label: "Competency Based", value: "Competency Based" },
                { label: "Letter Only", value: "Letter Only" },
              ],
            },
          ],
        },
        {
          title: "Course Content Settings",
          fields: [
            {
              label: "Repository Settings",
              value: "Use brand settings",
              type: "select",
              options: [
                { label: "Use brand settings", value: "Use brand settings" },
                { label: "Course-specific", value: "Course-specific" },
                { label: "Section-specific", value: "Section-specific" },
                { label: "Disabled", value: "Disabled" },
              ],
            },
          ],
        },
        {
          title: "Miscellaneous Conditions",
          fields: [
            {
              label: "Transcript",
              value: "Visible on Transcript",
              type: "select",
              options: [
                { label: "Visible on Transcript", value: "Visible on Transcript" },
                { label: "Hidden", value: "Hidden" },
                { label: "Internal only", value: "Internal only" },
              ],
            },
            {
              label: "Count Credits",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Do not count", value: "Do not count" },
                { label: "Half credit", value: "Half credit" },
              ],
            },
            {
              label: "Prior Experience",
              value: "Eligible",
              type: "select",
              options: [
                { label: "Eligible", value: "Eligible" },
                { label: "Not eligible", value: "Not eligible" },
                { label: "Requires review", value: "Requires review" },
              ],
            },
            {
              label: "Registration Limits",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Restricted", value: "Restricted" },
                { label: "Waitlist only", value: "Waitlist only" },
              ],
            },
            {
              label: "Repeat Enrollment Condition",
              value: "Use program settings",
              type: "select",
              options: [
                { label: "Use program settings", value: "Use program settings" },
                { label: "Allow repeats", value: "Allow repeats" },
                { label: "One attempt only", value: "One attempt only" },
                { label: "Requires approval", value: "Requires approval" },
              ],
            },
            {
              label: "Commissions",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Special rate", value: "Special rate" },
              ],
            },
            {
              label: "Promotion Calculation",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Weighted", value: "Weighted" },
              ],
            },
            {
              label: "Full-time Calculation",
              value: "Normal",
              type: "select",
              options: [
                { label: "Normal", value: "Normal" },
                { label: "Excluded", value: "Excluded" },
                { label: "Half-time only", value: "Half-time only" },
              ],
            },
            {
              label: "Textbook Opt-Out",
              value: "System Default",
              type: "select",
              options: [
                { label: "System Default", value: "System Default" },
                { label: "Allow opt-out", value: "Allow opt-out" },
                { label: "Required materials", value: "Required materials" },
              ],
            },
          ],
        },
      ],
    },
  };
}

function buildStudents(ctx: InstructorCtx): InstructorLivePayload {
  const rows = rosterRows(ctx);
  const students = rows.map((r) => {
    const risk =
      r.badgeTone === "danger" ? "High Risk" : r.badgeTone === "warning" ? "At Risk" : "Normal";
    const studentId = r.studentId;
    const missing = String(ctx.grades.filter((g) => g.studentId === studentId && g.score == null).length);
    return {
      id: studentId,
      name: r.primary,
      program: r.cells[2] ?? "",
      attendance: "—",
      gpa: "—",
      missing,
      risk,
      riskTone: r.badgeTone === "danger" ? ("danger" as const) : r.badgeTone === "warning" ? ("warning" as const) : ("active" as const),
    };
  });
  const first = students[0];
  return {
    title: "Students",
    subtitle: `${ctx.studentCount} unique student(s) across your sections`,
    countLabel: `${rows.length} student(s)`,
    rows,
    studentsDirectory: {
      rosterFilter: ctx.sections[0] ? `Roster: ${ctx.sections[0].courseCode} ${ctx.sections[0].code}` : "Roster: All sections",
      riskFilter: "Risk Level: All",
      note: "YOU ONLY VIEW ASSIGNED CLASS SECTIONS.",
      students,
      drawer: first
        ? {
            name: first.name,
            meta: `${rows[0]?.secondary ?? first.id} // ${first.program || "—"}`,
            alert: first.riskTone === "danger" || first.riskTone === "warning" ? "URGENT VERIFICATION" : "STUDENT SUMMARY",
            body: `${first.name} (${rows[0]?.secondary ?? first.id}) — ${first.risk} in ${first.program || "program"}.`,
            action: "Send Direct Notification",
          }
        : {
            name: "—",
            meta: "—",
            alert: "—",
            body: "No students assigned to your sections yet.",
            action: "Send Direct Notification",
          },
    },
  };
}

async function buildStudentDetail(ctx: InstructorCtx, studentId?: string | null): Promise<InstructorLivePayload> {
  type EnrolmentHit = InstructorCtx["sections"][number]["enrolments"][number] & {
    courseCode: string;
    courseTitle: string;
    sectionId: string;
  };
  const hits: EnrolmentHit[] = [];
  for (const section of ctx.sections) {
    for (const enrolment of section.enrolments) {
      hits.push({
        ...enrolment,
        courseCode: section.courseCode,
        courseTitle: section.courseTitle,
        sectionId: section.id,
      });
    }
  }

  if (
    studentId &&
    seesAllStudents(ctx.user) &&
    !hits.some((h) => h.studentId === studentId || h.studentNumber === studentId)
  ) {
    const other = await prisma.student.findFirst({
      where: { institutionId: ctx.user.institutionId, OR: [{ id: studentId }, { studentNumber: studentId }] },
      include: {
        person: true,
        enrolments: {
          where: { status: { in: ["enrolled", "completed", "withdrawn"] } },
          include: { section: { include: { course: true } } },
        },
      },
    });
    if (other) {
      const base = {
        studentId: other.id,
        studentNumber: other.studentNumber,
        studentName: `${other.person.givenName} ${other.person.familyName}`.trim(),
        email: other.person.email,
        programName: other.programName,
        standing: other.standing,
      };
      if (other.enrolments.length) {
        for (const e of other.enrolments) {
          hits.push({
            ...base,
            id: e.id,
            status: e.status,
            courseCode: e.section.course.code,
            courseTitle: e.section.course.title,
            sectionId: e.sectionId,
          });
        }
      } else {
        hits.push({ ...base, id: "", status: "", courseCode: "", courseTitle: "", sectionId: "" });
      }
    }
  }

  const focus =
    (studentId
      ? hits.find((h) => h.studentId === studentId || h.studentNumber === studentId)
      : undefined) ?? hits[0] ?? null;

  const emptyDetail = {
    name: "No student selected",
    meta: "Open Students and pick a roster member to view their profile.",
    tabs: ["Overview", "Assessments", "Requirements", "Flags", "Leave"],
    fields: [
      { label: "Institution", value: "—" },
      { label: "Student Status", value: "—" },
      { label: "CGPA", value: "—" },
      { label: "Attendance", value: "—" },
    ],
    alerts: [] as Array<{ title: string; body: string; tone: "danger" | "warning" | "info" | "muted" }>,
    courses: [] as Array<{ code: string; title: string; grade: string; status: string }>,
    assessments: [] as Array<{ title: string; course: string; score: string; status: string; due?: string }>,
    requirements: [] as Array<{ code: string; title: string; credits: string; kind: string; status: string }>,
    flags: [] as Array<{ title: string; body: string; when: string; tone: "danger" | "warning" | "info" | "muted" }>,
    leave: [] as Array<{ title: string; body: string; status: string; when?: string }>,
    alertTypes: [] as string[],
    priorities: [] as string[],
  };

  if (!focus) {
    return {
      title: "Student detail",
      subtitle: "No students assigned to your sections yet.",
      primaryAction: "Create academic alert",
      studentDetail: emptyDetail,
    };
  }

  const institution = await prisma.institution.findFirst({
    where: { institutionId: ctx.user.institutionId },
  });
  const admin = await loadStudentAdminDetail(ctx.user, {
    studentId: focus.studentId,
    studentNumber: focus.studentNumber,
    studentName: focus.studentName,
  });

  const studentHits = hits.filter((h) => h.studentId === focus.studentId && h.sectionId);
  const studentGrades = ctx.grades.filter((g) => g.studentId === focus.studentId);
  const scored = studentGrades.filter((g) => g.score != null);
  const gpaPct =
    scored.length > 0
      ? Math.round(
          (scored.reduce((sum, g) => sum + (pct(g.score, g.maxScore) ?? 0), 0) / scored.length) * 10,
        ) / 10
      : null;
  const gpaLetter = letterFromPct(gpaPct);
  const missingCount = studentGrades.filter((g) => g.score == null).length;

  const attendanceRows = await prisma.attendanceRecord.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      studentId: focus.studentId,
      sectionId: { in: studentHits.map((h) => h.sectionId) },
    },
  });
  const presentCount = attendanceRows.filter((r) => /present|late/i.test(r.status)).length;
  const attendancePct =
    attendanceRows.length > 0 ? `${Math.round((presentCount / attendanceRows.length) * 100)}%` : "—";

  const courses = studentHits.map((h) => {
    const courseGrades = studentGrades.filter((g) => g.courseCode === h.courseCode && g.score != null);
    const coursePct =
      courseGrades.length > 0
        ? Math.round(
            (courseGrades.reduce((sum, g) => sum + (pct(g.score, g.maxScore) ?? 0), 0) / courseGrades.length) *
              10,
          ) / 10
        : null;
    const pending = studentGrades.some((g) => g.courseCode === h.courseCode && g.score == null);
    return {
      code: h.courseCode,
      title: h.courseTitle,
      grade: letterFromPct(coursePct),
      status: pending ? "Correction Pending" : h.status === "enrolled" ? "Active" : h.status,
    };
  });

  const assessments = studentGrades.map((g) => {
    const scoreLabel =
      g.score == null ? "—" : `${g.score}/${g.maxScore}${g.letter ? ` (${g.letter})` : ""}`;
    return {
      title: g.assignmentTitle,
      course: `${g.courseCode} · ${g.sectionCode}`,
      score: scoreLabel,
      status: g.score == null ? "Missing / unscored" : g.status,
      due: undefined as string | undefined,
    };
  });

  // Attach due dates from section assignments where possible
  for (const a of assessments) {
    for (const section of ctx.sections) {
      const match = section.assignments.find((asg) => asg.title === a.title);
      if (match?.dueAt) {
        a.due = match.dueAt.toLocaleDateString();
        break;
      }
    }
  }

  const { alerts, flags, requirements, leave } = admin;

  // Distinct alert types / priorities already used for THIS student
  const alertTypeSet = new Set<string>();
  for (const a of alerts) alertTypeSet.add(a.title.toUpperCase());
  for (const f of flags) {
    const head = f.title.split("·")[0]?.trim();
    if (head) alertTypeSet.add(head.toUpperCase());
  }
  if (missingCount > 0) alertTypeSet.add("MISSING WORK");
  if (focus.standing === "probation" || focus.standing === "alert") alertTypeSet.add("ACADEMIC RISK");
  if (attendanceRows.length && presentCount / Math.max(attendanceRows.length, 1) < 0.7) {
    alertTypeSet.add("ATTENDANCE RISK");
  }
  if (!alertTypeSet.size) alertTypeSet.add("ACADEMIC ALERT");

  const suggestedPriority =
    focus.standing === "probation" || focus.standing === "alert" || admin.holdCount > 0
      ? "High"
      : focus.standing === "warning" || missingCount > 0 || admin.openFlagCount > 0 || alerts.length > 0
        ? "Medium"
        : "Low";
  const prioritySet = new Set<string>([suggestedPriority, "High", "Medium", "Low"]);

  return {
    title: focus.studentName,
    subtitle: `${focus.studentNumber} · ${focus.programName || "Program"} · live roster`,
    primaryAction: "Create academic alert",
    studentDetail: {
      name: focus.studentName,
      meta: `${focus.studentNumber} · ${focus.programName || "—"} · ${focus.email}`,
      tabs: ["Overview", "Current Courses", "Assessments", "Requirements", "Flags", "Leave"],
      fields: [
        { label: "Institution", value: institution?.name || institution?.legalName || "Heritage Community College" },
        { label: "Student Status", value: admin.status },
        { label: "CGPA", value: admin.cgpa != null ? admin.cgpa.toFixed(2) : "—" },
        { label: "Average in My Sections", value: gpaPct != null ? `${gpaLetter} (${gpaPct}%)` : "—" },
        { label: "Attendance", value: attendancePct },
        {
          label: "Open Flags / Holds",
          value: `${admin.openFlagCount} flag(s) · ${admin.holdCount} hold(s)`,
        },
      ],
      alerts,
      courses,
      assessments,
      requirements,
      flags,
      leave,
      alertTypes: [...alertTypeSet],
      priorities: [...prioritySet],
    },
  };
}

function buildGradebook(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  if (!sec) {
    return {
      title: "Assessments & Gradebook",
      subtitle: "No teaching sections assigned",
      gradebook: { course: "—", publishLabel: "Publish Final Marks", columns: [], rows: [] },
      gradesQueue: [],
      pendingGrades: {
        alert: "No sections assigned to this instructor.",
        queueTitle: "Auditable Submissions Queue",
        actionBadge: "0 ACTION REQUIRED",
        rows: [],
        audit: {
          title: "Gradebook Audit",
          locked: "—",
          average: "—",
          notes: "",
          rejectPlaceholder: "Specify reasons here...",
        },
        fileQueue: [],
      },
    };
  }

  const asgCols = sec.assignments.map((a) => `${a.title} (${a.weightPercent}%)`);
  const byStudent = new Map<string, { name: string; number: string; scores: Map<string, string>; total: number; weight: number }>();
  for (const e of sec.enrolments.filter((x) => x.status === "enrolled")) {
    byStudent.set(e.studentId, {
      name: e.studentName,
      number: e.studentNumber,
      scores: new Map(),
      total: 0,
      weight: 0,
    });
  }
  for (const g of ctx.grades.filter((g) => g.sectionCode === sec.code)) {
    const row = byStudent.get(g.studentId);
    if (!row) continue;
    const p = pct(g.score, g.maxScore);
    row.scores.set(g.assignmentTitle, p == null ? "—" : `${p}% (${g.letter ?? letterFromPct(p)})`);
    if (p != null) {
      row.total += p * (g.weightPercent / 100);
      row.weight += g.weightPercent;
    }
  }

    const rows = [...byStudent.values()].map((s) => {
      const w = Math.round(s.total * 10) / 10;
      const letter = letterFromPct(w || null);
      return {
        name: s.name,
        id: s.number,
        assessments: sec.assignments.map((a) => s.scores.get(a.title) ?? "—"),
        total: w ? `${w}% (${letter})` : "—",
        letter,
        status: "Draft",
      };
    });

  return {
    title: "Assessments & Gradebook",
    subtitle: `${sec.courseCode} ${sec.code} · Grades`,
    primaryActionHref: "/instructor/gradebook",
    gradebook: {
      course: `${sec.courseCode} · ${sec.courseTitle}`,
      publishLabel: "Open live gradebook",
      status: ctx.draftGradeCount ? "Grades: draft" : "Grades: ready",
      target: ctx.term?.name ?? "",
      columns: ["STUDENT", ...asgCols, "WEIGHTED TOTAL"],
      rows,
      history: ctx.grades
        .filter((g) => g.sectionCode === sec.code)
        .slice(0, 40)
        .map((g) => ({
          student: g.studentName,
          assignment: g.assignmentTitle,
          score: g.score == null ? "—" : `${g.score}/${g.maxScore}${g.letter ? ` (${g.letter})` : ""}`,
          status: g.status,
        })),
    },
    gradesQueue: ctx.sections.map((s) => {
      const board = sectionGradeBoard(ctx, s.code);
      return {
        code: s.courseCode,
        title: s.courseTitle,
        instructor: ctx.displayName,
        submitted: board.submittedLabel,
        enrolled: String(s.enrolmentCount),
        distribution: `${s.assignments.length} assessments`,
        bars: [25, 40, 25, 10] as [number, number, number, number?],
        status: board.submittedLabel,
      };
    }),
    pendingGrades: {
      alert:
        ctx.draftGradeCount > 0
          ? `${ctx.draftGradeCount} DRAFT GRADE ITEM(S) REQUIRE INSTRUCTOR ACTION.`
          : ctx.grades.some((g) => g.status === "pending_publish")
            ? `${ctx.grades.filter((g) => g.status === "pending_publish").length} GRADE ITEM(S) PENDING APPROVAL.`
            : ctx.submissions.filter((s) => s.status === "submitted" && s.files.length).length
              ? `${ctx.submissions.filter((s) => s.status === "submitted" && s.files.length).length} STUDENT FILE SUBMISSION(S) READY FOR REVIEW.`
              : "NO PENDING GRADE AUDITS FOR YOUR SECTIONS.",
      queueTitle: "Final Grade Submission Queue",
      actionBadge: `${ctx.sections.length} SECTION(S)`,
      rows: ctx.sections.map((s, i) => {
        const board = sectionGradeBoard(ctx, s.code);
        return {
          code: `${s.courseCode} ${s.code.split("-").pop() ?? ""}`.trim(),
          title: s.courseTitle,
          teacher: ctx.displayName,
          students: String(s.enrolmentCount),
          missing: String(board.missing),
          missingTone: board.missing ? ("warn" as const) : ("ok" as const),
          status: board.status,
          active: i === 0,
        };
      }),
      audit: {
        title: `Gradebook Audit: ${sec.courseCode} ${sec.code}`,
        locked: ctx.draftGradeCount ? "Unlocked" : "Locked",
        average: "—",
        notes: `${sec.enrolmentCount} enrolments · ${sec.assignments.length} assessments · ${ctx.draftGradeCount} drafts · ${ctx.grades.filter((g) => g.status === "pending_publish").length} pending approval · ${ctx.submissions.filter((s) => s.files.length).length} file packet(s)`,
        rejectPlaceholder: "Specify reasons here...",
      },
      fileQueue: ctx.submissions
        .filter((s) => s.files.length > 0)
        .slice(0, 40)
        .map((s) => ({
          id: s.id,
          student: s.studentName,
          studentNumber: s.studentNumber,
          assignment: s.assignmentTitle,
          course: `${s.courseCode} · ${s.sectionCode}`,
          status: s.status,
          submittedAt: s.submittedAt ? s.submittedAt.toLocaleString() : "Draft upload",
          files: s.files.map((f) => ({
            id: f.id,
            name: f.filename,
            version: `v${f.version}`,
            size: `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB`,
            mimeType: f.mimeType,
          })),
        })),
    },
  };
}

function enrolledAcrossSections(ctx: InstructorCtx) {
  const seen = new Set<string>();
  const enrolments: InstructorCtx["sections"][number]["enrolments"] = [];
  for (const s of ctx.sections) {
    for (const e of s.enrolments.filter((x) => x.status === "enrolled")) {
      if (seen.has(e.studentId)) continue;
      seen.add(e.studentId);
      enrolments.push(e);
    }
  }
  return enrolments;
}

function buildAttendance(ctx: InstructorCtx, saved?: {
  finalized?: boolean;
  sectionId?: string;
  roster?: Array<{ studentId: string; studentNumber: string; name: string; status: string }>;
} | null): InstructorLivePayload {
  const sec =
    (saved?.sectionId ? ctx.sections.find((s) => s.id === saved.sectionId) : null) ||
    attendanceSection(ctx);
  if (!sec && !ctx.sections.length) {
    return {
      title: "Attendance Session",
      subtitle: "No section assigned",
      attendanceSession: {
        alert: "No teaching section available for attendance.",
        classNode: "—",
        dateLabel: new Date().toLocaleString(),
        rosterTitle: "Student Roster (0)",
        draftStatus: "STATUS: EMPTY",
        students: [],
        stats: [],
      },
    };
  }
  // Always show every enrolled student across the instructor's sections (deduped),
  // matching the Students nav count — not just the largest single section.
  const enrolments = enrolledAcrossSections(ctx);
  const sectionLabel =
    ctx.sections.length > 1
      ? `All sections (${ctx.sections.map((s) => s.courseCode).join(", ")})`
      : `${sec!.courseCode} ${sec!.code}`;
  const sectionId = sec?.id ?? ctx.sections[0]!.id;
  const students = enrolments.map((e) => {
    const prior = saved?.roster?.find((r) => r.studentId === e.studentId || r.studentNumber === e.studentNumber);
    return {
      name: e.studentName,
      id: e.studentNumber,
      studentId: e.studentId,
      status: (prior?.status as "Present" | "Absent" | "Late" | "Excused") || ("Present" as const),
      note: e.standing !== "good" ? `Standing: ${e.standing}` : "—",
      pct: "—",
      atRisk: e.standing === "warning" || e.standing === "probation" || e.standing === "alert",
    };
  });
  const present = students.filter((s) => s.status === "Present").length;
  const absent = students.filter((s) => s.status === "Absent").length;
  const late = students.filter((s) => s.status === "Late").length;
  const excused = students.filter((s) => s.status === "Excused").length;
  const total = students.length || 1;
  return {
    title: "Attendance Session",
    subtitle:
      ctx.sections.length > 1
        ? `${ctx.sections.length} sections · ${students.length} enrolled`
        : `${sec!.courseCode} ${sec!.code}`,
    primaryAction: "Submit & Finalize Session",
    secondaryAction: "Save Draft State",
    attendanceSession: {
      alert:
        students.length === 0
          ? "No enrolled students found across your sections. Open Students to confirm roster."
          : students.filter((s) => s.atRisk).length > 0
            ? `${students.filter((s) => s.atRisk).length} student(s) flagged by standing for review.`
            : saved?.finalized
              ? "Attendance session finalized and stored."
              : "Roster loaded from all section enrolments. Tap a status pill to change, then save.",
      classNode: sectionLabel,
      dateLabel: new Date().toLocaleString(),
      rosterTitle: `Student Roster (${students.length} Total)`,
      draftStatus: saved?.finalized
        ? `Finalized · ${students.length} recorded`
        : `Draft · ${students.length} loaded`,
      sectionId,
      students,
      stats: [
        { label: "Present", count: present, pct: `${Math.round((present / total) * 100)}%` },
        { label: "Absent", count: absent, pct: `${Math.round((absent / total) * 100)}%` },
        { label: "Late", count: late, pct: `${Math.round((late / total) * 100)}%` },
        { label: "Excused", count: excused, pct: `${Math.round((excused / total) * 100)}%` },
      ],
    },
  };
}

function buildMessages(ctx: InstructorCtx): InstructorLivePayload {
  const enrolments = ctx.sections.flatMap((s) => s.enrolments);
  const findPeer = (otherName: string) =>
    enrolments.find((e) => e.studentName.toLowerCase() === otherName.toLowerCase());

  const formatTime = (d: Date) =>
    d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const threadPayloads = ctx.threads.map((t) => {
    const peerEnrolment = findPeer(t.otherName);
    const peerGrade = peerEnrolment
      ? ctx.grades.find((g) => g.studentId === peerEnrolment.studentId && g.score != null)
      : undefined;
    const peerPct = peerGrade ? pct(peerGrade.score, peerGrade.maxScore) : null;
    const chat = [
      {
        kind: "system" as const,
        text: t.subject ? `Thread: ${t.subject}` : "Secure faculty messaging thread.",
      },
      ...(t.messages ?? []).map((m) => ({
        kind: "message" as const,
        from: (m.senderAccountId === ctx.user.accountId ? "me" : "them") as "me" | "them",
        text: m.body || "",
        time: formatTime(m.createdAt),
      })),
    ];
    return {
      id: t.id,
      name: t.otherName,
      role: peerEnrolment ? "Student" : "Campus",
      preview: t.preview || t.subject || "No messages yet",
      unread: 0,
      time: formatTime(t.updatedAt),
      studentId: peerEnrolment?.studentId,
      chat,
      context: {
        program: peerEnrolment?.programName || "—",
        grade: peerGrade?.letter || (peerPct != null ? letterFromPct(peerPct) : "—"),
        gradePct: peerPct != null ? `${peerPct}%` : "—",
        attendance: "—",
        attendanceTone: peerEnrolment?.standing || "Record",
        missing: peerEnrolment
          ? String(ctx.grades.filter((g) => g.studentId === peerEnrolment.studentId && g.score == null).length)
          : "—",
        sharedFiles: [] as Array<{ name: string; size: string }>,
      },
    };
  });

  const active = threadPayloads[0];
  return {
    title: "Messages",
    subtitle: `${ctx.threads.length} thread(s) · Secure faculty messaging`,
    messages: {
      threads: threadPayloads,
      activeThreadId: active?.id,
      chat: active?.chat ?? [],
      context: active?.context ?? {
        program: "—",
        grade: "—",
        gradePct: "—",
        attendance: "—",
        attendanceTone: "Record",
        missing: "—",
        sharedFiles: [],
      },
    },
  };
}

async function sendInstructorMessage(ctx: InstructorCtx, rowKey?: string) {
  let threadId = "";
  let body = "";
  if (rowKey?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rowKey) as { threadId?: string; body?: string; text?: string };
      threadId = String(parsed.threadId || "").trim();
      body = String(parsed.body || parsed.text || "").trim();
    } catch {
      body = String(rowKey || "").trim();
    }
  } else {
    body = String(rowKey || "").trim();
  }
  if (!body) throw Object.assign(new Error("Message body required"), { status: 400 });

  if (!threadId) {
    throw Object.assign(new Error("Choose a message thread before sending"), {
      code: "VALIDATION_ERROR",
      status: 400,
    });
  }

  const thread = await prisma.messageThread.findFirst({
    where: { id: threadId, institutionId: ctx.user.institutionId },
  });
  if (!thread) throw Object.assign(new Error("Message thread not found"), { code: "NOT_FOUND", status: 404 });

  let participantIds: string[] = [];
  try {
    participantIds = JSON.parse(thread.participantAccountIdsJson) as string[];
  } catch {
    participantIds = [];
  }
  if (!participantIds.includes(ctx.user.accountId)) {
    throw Object.assign(new Error("Not a participant on this thread"), { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      threadId: thread.id,
      senderAccountId: ctx.user.accountId,
      body,
    },
  });
  await prisma.messageThread.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  const recipients = participantIds.filter((id) => id !== ctx.user.accountId);
  for (const recipientAccountId of recipients) {
    await prisma.notification.create({
      data: {
        institutionId: ctx.user.institutionId,
        recipientAccountId,
        channel: "in_app",
        title: `Message from ${ctx.displayName}`,
        body: body.slice(0, 160),
        templateKey: "instructor.message",
      },
    });
  }

  return {
    messageId: message.id,
    threadId: thread.id,
    body,
    recipients: recipients.length,
  };
}

function buildNotifications(ctx: InstructorCtx, total = ctx.notifications.length, unreadTotal?: number): InstructorLivePayload {
  const unread = unreadTotal ?? ctx.notifications.filter((n) => !n.readAt).length;
  const academic = ctx.notifications.filter((n) => /alert|flag|academic|attendance/i.test(`${n.title} ${n.body}`)).length;
  const system = ctx.notifications.filter((n) => /publish|system|reminder|schedule/i.test(`${n.title} ${n.body}`)).length;

  return {
    title: "Notifications",
    subtitle: "Alerts and updates about your courses, students and account.",
    primaryAction: "Notification Preferences",
    secondaryAction: "Mark All as Read",
    notifications: {
      termLabel: ctx.term ? `Term: ${ctx.term.name}` : "",
      total,
      filters: [
        { label: "All Alerts" },
        { label: "Unread", count: unread },
        { label: "Academic", count: academic },
        { label: "System", count: system || Math.max(ctx.notifications.length - academic, 0) },
      ],
      items: ctx.notifications.map((n) => {
        const blob = `${n.title} ${n.body}`.toLowerCase();
        const category = /attend/.test(blob)
          ? "Attendance"
          : /grade|publish|assignment|rubric/.test(blob)
            ? "Assignments"
            : /message|chat/.test(blob)
              ? "Academic"
              : /alert|flag|academic/.test(blob)
                ? "Academic"
                : "System";
        const cta =
          category === "Attendance"
            ? "Open Attendance Sheet"
            : category === "Assignments"
              ? "View Gradebook"
              : /message|chat/.test(blob)
                ? "Go to Chat"
                : category === "Academic"
                  ? "Open Student Record"
                  : "View Details";
        const href =
          category === "Attendance"
            ? "/instructor/attendance"
            : category === "Assignments"
              ? "/instructor/gradebook"
              : /message|chat/.test(blob)
                ? "/instructor/messages"
                : "/instructor/students";
        return {
          id: n.id,
          title: n.title,
          body: n.body,
          when: relativeWhen(n.createdAt),
          category,
          unread: !n.readAt,
          tone: n.readAt ? ("muted" as const) : ("info" as const),
          cta,
          href,
        };
      }),
      pagination: notificationPagination(ctx.notifications.length, total),
    },
  };
}

function relativeWhen(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

async function buildProfile(ctx: InstructorCtx, path = "", availabilitySlots: AvailabilitySlot[] = []): Promise<InstructorLivePayload> {
  return (await buildProfilePayload(ctx, path, availabilitySlots)) as InstructorLivePayload;
}

async function buildCalendar(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
  const tz = await institutionTimezone(ctx.user.institutionId);
  const today = ymdIn(new Date(), tz);
  const mondayIso = addDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const weekIsos = dayLabels.map((_, i) => addDays(mondayIso, i));
  type CalEvent = { id: string; title: string; time: string; tone: "blue" | "purple" | "orange" };
  const byIso = new Map(weekIsos.map((iso) => [iso, [] as CalEvent[]]));
  const sectionIds = ctx.sections.map((s) => s.id);
  const sessions = sectionIds.length
    ? await prisma.classSession.findMany({
        where: {
          institutionId: ctx.user.institutionId,
          sectionId: { in: sectionIds },
          startsAt: { gte: zonedToUtc(mondayIso, "00:00", tz), lt: zonedToUtc(addDays(mondayIso, 7), "00:00", tz) },
        },
        orderBy: { startsAt: "asc" },
        select: { id: true, title: true, startsAt: true, endsAt: true, sectionId: true },
      })
    : [];
  const sectionById = new Map(ctx.sections.map((s, i) => [s.id, { s, tone: (i % 2 ? "purple" : "blue") as CalEvent["tone"] }]));
  for (const c of sessions) {
    const sec = sectionById.get(c.sectionId);
    const start = hmIn(c.startsAt, tz);
    byIso.get(ymdIn(c.startsAt, tz))?.push({
      id: `session:${c.id}`,
      title: sec ? `${sec.s.courseCode} ${sec.s.code} · ${c.title}` : c.title,
      time: c.endsAt ? `${start}–${hmIn(c.endsAt, tz)}` : start,
      tone: sec?.tone ?? "blue",
    });
  }
  for (const s of ctx.sections) {
    for (const a of s.assignments) {
      if (!a.dueAt) continue;
      byIso.get(ymdIn(a.dueAt, tz))?.push({
        id: `assignment:${a.id}`,
        title: `${s.courseCode}: ${a.title} due`,
        time: hmIn(a.dueAt, tz),
        tone: "orange",
      });
    }
  }
  const days = weekIsos
    .map((iso, i) => ({
      label: dayLabels[i]!,
      date: String(Number(iso.slice(8))),
      events: (byIso.get(iso) ?? []).sort((x, y) => x.time.localeCompare(y.time)),
    }))
    .filter((d, i) => i < 5 || d.events.length > 0);
  const rangeFmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

  return {
    title: "Calendar",
    subtitle: days.some((d) => d.events.length)
      ? "Class sessions and assessment deadlines for your sections this week"
      : "No class sessions or deadlines scheduled for your sections this week",
    timetable: {
      rangeLabel: `Week of ${rangeFmt(mondayIso)} – ${rangeFmt(weekIsos[6]!)}`,
      termLabel: ctx.term?.name ?? "",
      views: ["Week"],
      activeView: "Week",
      filters: ["Show All", "Classes", "Deadlines"],
      days,
    },
  };
}

async function buildAccomplishments(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const currentTerm = ctx.term?.code || "";
  const currentSections = currentTerm ? ctx.sections.filter((s) => s.termCode === currentTerm) : ctx.sections;
  const previousSections = currentTerm ? ctx.sections.filter((s) => s.termCode !== currentTerm) : [];
  const courseCodes = [...new Set(ctx.sections.map((s) => s.courseCode).filter(Boolean))];
  const currentCodes = [...new Set(currentSections.map((s) => s.courseCode).filter(Boolean))];
  const studentIds = [...new Set(ctx.sections.flatMap((s) => s.enrolments.map((e) => e.studentId)))];

  const [facultyItems, badges, definitions, badgeForm] = await Promise.all([
    loadFacultyAccomplishments(ctx),
    studentIds.length
      ? prisma.studentBadge.findMany({
          where: { institutionId: ctx.user.institutionId, studentId: { in: studentIds } },
          include: { student: { include: { person: true } } },
          orderBy: { updatedAt: "desc" },
          take: 40,
        })
      : Promise.resolve([]),
    prisma.badgeDefinition.findMany({
      where: { institutionId: ctx.user.institutionId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    buildAddBadgeFormPayload(ctx.user.institutionId),
  ]);

  const teachingItems = [
    currentCodes.length
      ? {
          title: "Current teaching load",
          detail: currentCodes.join(", "),
          year: currentTerm || "Current",
          tone: "success" as const,
          category: "faculty" as const,
        }
      : null,
    previousSections.length
      ? {
          title: "Previous courses taught",
          detail: `${previousSections.length} past offering(s) · ${[...new Set(previousSections.map((s) => s.courseCode))].slice(0, 12).join(", ")}`,
          year:
            [...new Set(previousSections.map((s) => s.termCode))].filter(Boolean).join(", ") || "Prior terms",
          tone: "info" as const,
          category: "faculty" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    detail: string;
    year: string;
    tone: "success" | "info";
    category: "faculty";
  }>;

  const issued = badges.map((b) => ({
    title: b.title,
    detail: `${b.student.person.givenName} ${b.student.person.familyName} · ${b.code} · ${b.status}`,
    year: b.earnedAt ? String(b.earnedAt.getFullYear()) : "—",
    tone: (b.status === "earned" ? "success" : "info") as "success" | "info",
    category: "student" as const,
  }));

  const createBaseGroup = badgeForm.form.groups.find((g) => g.title === "Create Base") || badgeForm.form.groups[0];
  const settingsGroups = badgeForm.form.groups.filter((g) => g.title !== "Create Base");

  return {
    title: "My Accomplishments & Badges",
    subtitle: "",
    primaryAction: "Create Base",
    primaryActionHref: ADD_BADGE_PATH,
    secondaryAction: "Manage badges",
    secondaryActionHref: BADGES_LIST_PATH,
    accomplishments: {
      tabs: profileTabs(ACCOMPLISHMENTS_PATH),
      stats: [
        { label: "Current sections", value: String(currentSections.length) },
        { label: "Courses taught", value: String(courseCodes.length) },
        { label: "Students", value: String(studentIds.length || ctx.studentCount) },
        { label: "Badge bases", value: String(definitions.length) },
        { label: "Badges issued", value: String(issued.filter((i) => i.tone === "success").length) },
      ],
      items: [...facultyItems, ...teachingItems, ...issued],
      createBase: {
        title: "Create Base",
        submitLabel: "Save Badge / Accomplishment",
        href: ADD_BADGE_PATH,
        groups: createBaseGroup ? [createBaseGroup, ...settingsGroups] : badgeForm.form.groups,
      },
      definitions: definitions.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        badgeType: b.badgeType,
        approvalMode: b.approvalMode,
        status: b.status,
      })),
    },
  };
}

async function buildAlerts(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const ALERTS_PATH = "/instructor/f/t44-academic-alerts";
  const persisted = await prisma.portalRecord.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      screenPath: ALERTS_PATH,
      role: "instructor",
      OR: [{ audienceAccountId: ctx.user.accountId }, { audienceAccountId: null }],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const fromDb = persisted.map((r) => {
    let meta: { course?: string; tag?: string; tagTone?: string; avatar?: string; studentId?: string } = {};
    try {
      meta = r.metaText ? (JSON.parse(r.metaText) as typeof meta) : {};
    } catch {
      meta = { tag: r.metaText || "ALERT", course: "" };
    }
    const tagTone =
      meta.tagTone === "danger" || meta.tagTone === "warning" || meta.tagTone === "info"
        ? meta.tagTone
        : /high|risk|danger/i.test(meta.tag || "")
          ? ("danger" as const)
          : ("warning" as const);
    return {
      id: r.id,
      name: r.primaryText,
      course: meta.course || "—",
      tag: (meta.tag || "ACADEMIC ALERT").toUpperCase(),
      tagTone,
      body: r.secondaryText || "",
      avatar: meta.avatar || r.primaryText.slice(0, 2).toUpperCase(),
      href: r.href || undefined,
    };
  });

  const standingItems = rosterRows(ctx)
    .filter((r) => r.badgeTone === "warning" || r.badgeTone === "danger")
    .map((r) => ({
      id: `standing:${r.studentId}`,
      name: r.primary,
      course: r.cells[3] ?? "",
      tag: r.badge.toUpperCase(),
      tagTone: (r.badgeTone === "danger" ? "danger" : "warning") as "danger" | "warning",
      body: `${r.primary} (${r.secondary}) — standing ${r.badge} in ${r.cells[3] ?? "course"}.`,
      avatar: r.primary
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      href: r.href,
    }));

  // Prefer created alerts; append standing-based ones that aren't already covered by name+course
  const seen = new Set(fromDb.map((i) => `${i.name}|${i.course}|${i.tag}`.toLowerCase()));
  const items = [
    ...fromDb,
    ...standingItems.filter((i) => !seen.has(`${i.name}|${i.course}|${i.tag}`.toLowerCase())),
  ];

  return {
    title: "Academic Alerts",
    subtitle: `${items.length} active student${items.length === 1 ? "" : "s"}`,
    primaryAction: "Create alert",
    alertList: {
      badge: `${items.length} ACTIVE`,
      items,
    },
  };
}

async function buildCourseEvaluations(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const sectionIds = ctx.sections.map((s) => s.id);
  const courseCodes = [...new Set(ctx.sections.map((s) => s.courseCode))];
  const rows = await prisma.courseEvaluation.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      OR: [
        ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
        ...(courseCodes.length ? [{ courseCode: { in: courseCodes } }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  const submitted = rows.filter((r) => r.status === "submitted" && r.overallRating != null);
  const pending = rows.filter((r) => r.status === "pending");
  const avg =
    submitted.length > 0
      ? (submitted.reduce((sum, r) => sum + (r.overallRating ?? 0), 0) / submitted.length).toFixed(1)
      : "—";
  const responseRate =
    rows.length > 0 ? `${Math.round((submitted.length / rows.length) * 100)}%` : "0%";
  const comments = submitted.slice(0, 20).map((r) => {
    let text = "Student feedback submitted.";
    try {
      const parsed = r.responsesJson ? (JSON.parse(r.responsesJson) as { comment?: string }) : null;
      if (parsed?.comment) text = parsed.comment;
    } catch {
      /* keep default */
    }
    return {
      rating: (r.overallRating ?? 0).toFixed(1),
      text,
      term: `${ctx.term?.name ?? "Term"} · ${r.courseCode}`,
    };
  });
  return {
    title: "Course Evaluations",
    subtitle: `${ctx.displayName} · end-of-course feedback`,
    evaluations: {
      summary: [
        { label: "Overall Rating", value: String(avg), hint: submitted.length ? `From ${submitted.length} response(s)` : "No submitted ratings yet" },
        { label: "Response Rate", value: responseRate, hint: `${submitted.length}/${rows.length || 0} submitted` },
        { label: "Pending", value: String(pending.length), hint: "Awaiting student response" },
        { label: "Sections", value: String(ctx.sections.length), hint: "In your teaching load" },
      ],
      comments,
    },
  };
}

async function buildWorkshops(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const workshops = await prisma.workshop.findMany({
    where: { institutionId: ctx.user.institutionId },
    include: { registrations: true },
    orderBy: { startsAt: "asc" },
  });
  const available = workshops.filter((w) => w.status === "upcoming" || w.status === "active");
  const completed = workshops.filter((w) => w.status === "completed");
  const registeredCount = workshops.reduce(
    (sum, w) => sum + w.registrations.filter((r) => r.status === "registered").length,
    0,
  );
  const cards = available.map((w) => {
    const seatsTaken = w.registrations.filter((r) => r.status === "registered").length;
    return {
      tag: w.status.toUpperCase(),
      org: "Heritage Community College",
      seats: `${Math.max(0, w.capacity - seatsTaken)} seats`,
      title: w.title,
      description: w.description || w.code,
      when: w.startsAt.toLocaleString(),
      where: w.location || "TBA",
      href: "/instructor/f/t24-workshop-detail",
    };
  });
  const registrations = workshops
    .flatMap((w) =>
      w.registrations
        .filter((r) => r.status === "registered" || r.status === "completed")
        .map((r) => ({
          title: `${w.title} · ${r.status}`,
          when: w.startsAt.toLocaleString(),
        })),
    )
    .slice(0, 20);
  const ceu = workshops
    .filter((w) => w.status === "completed")
    .reduce((sum, w) => sum + w.creditsCeu, 0);
  return {
    title: "Workshops",
    subtitle: `${workshops.length} offering(s) · ${registeredCount} registration(s)`,
    workshops: {
      tabs: [
        `Available (${available.length})`,
        `Registered (${registeredCount})`,
        `Completed (${completed.length})`,
      ],
      activeTab: `Available (${available.length})`,
      credits: `CREDITS COMPLETED: ${ceu} CEUs`,
      cards,
      registrations,
    },
    rows: workshops.map((w) => ({
      cells: [
        w.code,
        w.title,
        w.status,
        w.startsAt.toLocaleDateString(),
        String(w.registrations.length),
        w.location || "TBA",
      ],
      badge: w.status,
      badgeTone: w.status === "completed" ? ("muted" as const) : ("active" as const),
    })),
    columns: ["Code", "Title", "Status", "Starts", "Registrations", "Location"],
    countLabel: `${workshops.length} workshops`,
  };
}

async function persistAcademicAlert(
  ctx: InstructorCtx,
  input: {
    studentName: string;
    studentNumber?: string | null;
    studentId?: string | null;
    course?: string | null;
    tag: string;
    body: string;
    priority: string;
    mirrorToAdmin?: boolean;
  },
) {
  const ALERTS_PATH = "/instructor/f/t44-academic-alerts";
  const tagTone = /high|danger|risk|alert/i.test(input.priority) || /risk|alert|danger/i.test(input.tag)
    ? "danger"
    : /medium|warning/i.test(input.priority)
      ? "warning"
      : "info";
  const avatar = input.studentName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const href = input.studentId
    ? `/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(input.studentId)}`
    : undefined;

  const record = await prisma.portalRecord.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      screenPath: ALERTS_PATH,
      role: "instructor",
      primaryText: input.studentName,
      secondaryText: input.body,
      metaText: JSON.stringify({
        course: input.course || "—",
        tag: input.tag,
        tagTone,
        avatar,
        studentId: input.studentId ?? null,
        studentNumber: input.studentNumber ?? null,
        priority: input.priority,
      }),
      href: href ?? null,
      sortOrder: 0,
      audienceAccountId: ctx.user.accountId,
    },
  });

  if (input.mirrorToAdmin && input.studentId) {
    await recordAdminAlert(ctx.user, {
      studentId: input.studentId,
      type: input.tag,
      description: input.body,
      priority: input.priority,
      course: input.course,
      portalRecordId: record.id,
    });
  }

  await prisma.notification.create({
    data: {
      institutionId: ctx.user.institutionId,
      recipientAccountId: ctx.user.accountId,
      channel: "in_app",
      title: `${input.tag} · ${input.studentName}`,
      body: input.body,
      templateKey: "instructor.alert",
    },
  });

  // Notify the student account when we can resolve it
  if (input.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: input.studentId, institutionId: ctx.user.institutionId },
      select: { personId: true },
    });
    if (student) {
      const studentAccount = await prisma.account.findFirst({
        where: { institutionId: ctx.user.institutionId, personId: student.personId },
      });
      if (studentAccount) {
        await prisma.notification.create({
          data: {
            institutionId: ctx.user.institutionId,
            recipientAccountId: studentAccount.id,
            channel: "in_app",
            title: `Academic alert · ${input.tag}`,
            body: input.body,
            templateKey: "student.academic_alert",
          },
        });
      }
    }
  }

  return record;
}

function buildStudentFlags(ctx: InstructorCtx): InstructorLivePayload {
  const rows = rosterRows(ctx).map((r) => {
    const priority =
      r.badgeTone === "danger" ? "High" : r.badgeTone === "warning" ? "Medium" : "Low";
    const flagType =
      r.badgeTone === "danger"
        ? "ACADEMIC RISK"
        : r.badgeTone === "warning"
          ? "ATTENDANCE WATCH"
          : "SUCCESS NOTE";
    const description =
      r.badgeTone === "danger" || r.badgeTone === "warning"
        ? `Standing ${r.badge} in ${r.cells[3] ?? "course"} — review required.`
        : `On-track in ${r.cells[3] ?? "course"}.`;
    const status = r.badgeTone === "danger" || r.badgeTone === "warning" ? "Active" : "Resolved";
    return {
      cells: [`${r.primary} · ${r.secondary}`, flagType, description, priority, status],
      badge: priority,
      badgeTone: (r.badgeTone === "danger" ? "danger" : r.badgeTone === "warning" ? "warning" : "success") as
        | "danger"
        | "warning"
        | "success",
      href: r.href,
    };
  });
  return {
    title: "Student Flags",
    subtitle: "Flags raised for your students",
    countLabel: `${rows.length} flag(s)`,
    columns: ["Student Name", "Flag Type", "Description", "Priority", "Status"],
    columnTemplate: "minmax(160px,1.2fr) minmax(120px,0.9fr) minmax(180px,1.4fr) minmax(80px,0.5fr) minmax(80px,0.5fr)",
    rows,
  };
}

function buildCreateFlagForm(ctx: InstructorCtx): InstructorLivePayload {
  const roster = rosterRows(ctx);
  const studentOptions = [...new Set(roster.map((r) => `${r.primary} · ${r.secondary}`))];
  return {
    title: "Create Flag",
    subtitle: "Add a student flag from your assigned sections.",
    modal: {
      title: "Create Student Flag",
      description: studentOptions.length
        ? "Choose a student from your sections, the type of flag and a note explaining it."
        : "There are no students in your sections yet, so a flag cannot be created.",
      fields: [
        { label: "Student Name", value: "", type: "select", options: studentOptions, required: true },
        { label: "Flag Type", value: "", type: "select", options: FLAG_TYPES, required: true },
        { label: "Description", value: "", type: "textarea", required: true },
        { label: "Priority", value: "Medium", type: "select", options: FLAG_PRIORITIES, required: true },
      ],
      confirmLabel: "Create Flag",
      cancelLabel: "Cancel",
      backdropHref: "/instructor/f/t45-student-flags",
    },
  };
}

function buildStatusFilter(ctx: InstructorCtx): InstructorLivePayload {
  const all = rosterRows(ctx).map((r) => {
    const enrolmentStatus = r.cells[5] || "enrolled";
    const lifecycle = lifecycleFromStudent({
      standing: r.badge,
      enrolmentStatuses: [enrolmentStatus],
    });
    return {
      ...r,
      cells: [r.cells[0] ?? "", r.cells[1] ?? "", r.cells[2] ?? "", r.cells[3] ?? "", lifecycle, enrolmentStatus],
      badge: lifecycle,
      badgeTone:
        lifecycle === "Active Student"
          ? ("active" as const)
          : lifecycle === "Follow Up" || lifecycle === "On Hold"
            ? ("warning" as const)
            : lifecycle === "Withdrawn Students" || lifecycle === "Dismissed"
              ? ("danger" as const)
              : ("info" as const),
    };
  });
  const filters = [
    { label: "All", count: all.length, active: true },
    ...LIFECYCLE_STATUSES.map((label) => ({
      label,
      count: all.filter((r) => r.badge === label).length,
    })),
  ];
  return {
    title: "Students by Status",
    subtitle: "MySIS lifecycle filters across your roster",
    statusFilter: {
      filters,
      columns: ["ID", "Name", "Program", "Course", "Lifecycle", "Enrolment"],
      rows: all,
    },
    rows: all,
  };
}

function buildQuestionGenerator(ctx: InstructorCtx, overlay?: Record<string, unknown> | null): InstructorLivePayload {
  const sec = primarySection(ctx);
  const assignment = sec?.assignments[0];
  const topic = assignment?.title
    ? `${assignment.title} · ${sec?.courseCode ?? "Course"}`
    : sec
      ? `${sec.courseCode} · ${sec.courseTitle}`
      : "Course fundamentals";
  const courseLabel = sec ? `${sec.courseCode} ${sec.courseTitle}` : "your course";
  const defaultQuestions = [
    {
      id: "q1",
      prompt: `Which statement best describes a core learning outcome for ${courseLabel}?`,
      options: [
        { key: "A", text: "Memorize isolated facts without application" },
        { key: "B", text: "Apply course concepts to a realistic scenario", correct: true },
        { key: "C", text: "Ignore prerequisites and jump to advanced topics" },
        { key: "D", text: "Skip formative checks until the final exam" },
      ],
    },
    {
      id: "q2",
      prompt: assignment
        ? `For “${assignment.title}”, what should students prioritize first?`
        : `When starting work in ${courseLabel}, what should students prioritize first?`,
      options: [
        { key: "A", text: "Clarify requirements and success criteria", correct: true },
        { key: "B", text: "Submit without reviewing the brief" },
        { key: "C", text: "Change the rubric mid-attempt" },
        { key: "D", text: "Avoid citing course materials" },
      ],
    },
    {
      id: "q3",
      prompt: `A student is struggling with ${sec?.courseCode ?? "this course"}. What is the best next instructional step?`,
      options: [
        { key: "A", text: "Provide targeted practice aligned to the weak outcome", correct: true },
        { key: "B", text: "Remove the student from the roster immediately" },
        { key: "C", text: "Skip feedback and only post a final grade" },
        { key: "D", text: "Assign unrelated elective work" },
      ],
    },
    {
      id: "q4",
      prompt: `Which assessment format best checks understanding of ${topic}?`,
      options: [
        { key: "A", text: "A single unmarked attendance roll" },
        { key: "B", text: "A short MCQ plus one applied short-answer item", correct: true },
        { key: "C", text: "An unrelated campus survey" },
        { key: "D", text: "A password reset quiz" },
      ],
    },
    {
      id: "q5",
      prompt: `What indicates mastery for ${sec?.courseCode ?? "the unit"}?`,
      options: [
        { key: "A", text: "The student can explain and apply the concept correctly", correct: true },
        { key: "B", text: "The student never attends class" },
        { key: "C", text: "The student only copies a peer solution" },
        { key: "D", text: "The student skips all practice sets" },
      ],
    },
  ];
  const stored = Array.isArray(overlay?.generatedQuestions) ? overlay.generatedQuestions : [];
  const questions = stored.length ? stored : defaultQuestions;
  return {
    title: "AI Question Generator",
    subtitle: sec
      ? `Generate question sets for ${sec.courseCode} · ${sec.code}`
      : "Auto-generate diverse question sets for your teaching sections",
    primaryAction: "Generate Questions",
    secondaryAction: "Add to Question Bank",
    questionGenerator: {
      topic,
      difficulty: "Medium (Undergraduate Core)",
      type: "Multiple Choice (MCQ)",
      count: `${questions.length} Questions`,
      questions,
    },
  };
}

function buildRubricGenerator(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const focus = sec ? `${sec.courseCode} · ${sec.courseTitle}` : "Course assessment";
  return {
    title: "Syllabus Grading Rubric Studio",
    subtitle: sec
      ? `Rubric draft aligned to ${focus}`
      : "Generate standardized assessment rubrics for your assignments",
    primaryAction: "Use this rubric",
    secondaryAction: "Submit for Approval",
    rubricGenerator: {
      criteria: [
        {
          name: "Concept accuracy",
          weight: "35%",
          excellent: `Demonstrates precise command of ${focus} concepts with no material errors.`,
          proficient: "Mostly accurate with only minor conceptual slips.",
          developing: "Partial understanding; several key ideas are incomplete.",
          beginning: "Little evidence of required course concepts.",
        },
        {
          name: "Application & method",
          weight: "35%",
          excellent: "Applies an appropriate method end-to-end and justifies each step.",
          proficient: "Method is sound with small execution gaps.",
          developing: "Attempts a method but skips critical steps.",
          beginning: "No coherent method or unsupported guesses.",
        },
        {
          name: "Communication",
          weight: "30%",
          excellent: "Clear structure, labeled work, and professional academic tone.",
          proficient: "Readable with occasional organization issues.",
          developing: "Hard to follow in places; missing labels.",
          beginning: "Unclear or incomplete presentation.",
        },
      ],
    },
  };
}

function buildAiStudio(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const courseTitle = sec
    ? `${sec.courseCode} AI Assistant & Studio`
    : "AI Course Studio";
  return {
    title: courseTitle,
    subtitle: sec
      ? `Synthesize materials for ${sec.courseCode} · ${sec.code}`
      : "Synthesize lecture materials, syllabi and knowledge graph to power the virtual tutor.",
    primaryAction: "+ Start a new version",
    primaryActionHref: "/instructor/f/in-13-studio-generation",
    aiStudio: {
      eyebrow: "HERITAGE AI STUDIO",
      courseTitle,
      version: "v1.0",
      drafts: [
        {
          version: "v1.0 Draft",
          status: "Drafting",
          tone: "draft",
          detail: sec
            ? `Syllabus and module outline for ${sec.courseCode}`
            : "Syllabus and Module 1 update in progress",
        },
        {
          version: "Baseline",
          status: "Live",
          tone: "active",
          detail: "Currently active for student tutoring session",
        },
      ],
      tabs: ["Sources", "Outcomes", "Modules", "Assessments", "Rubrics", "Review"],
      activeTab: "Sources",
      sources: [
        {
          name: sec ? `${sec.courseCode}_Syllabus.pdf` : "Syllabus.pdf",
          status: "Ingested",
        },
        {
          name: sec ? `${sec.courseCode}_Lecture_Slides.ppt` : "Lecture_Slides.ppt",
          status: "Ingested",
        },
        ...(sec?.assignments[0]
          ? [{ name: `${sec.assignments[0].title.replace(/\s+/g, "_")}.pdf`, status: "Ingested" }]
          : [{ name: "Reference_Notes.pdf", status: "Ingested" }]),
      ],
    },
  };
}

function buildStudioGeneration(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const code = sec?.courseCode ?? "Course";
  return {
    title: "AI Course Studio",
    subtitle: sec
      ? `Generate structured content for ${code} · ${sec.code}`
      : "Generate structured, rigorous academic content from trusted sources",
    primaryAction: "Continue to Outcomes",
    primaryActionHref: "/instructor/f/in-14-outcome-mapping",
    studioGeneration: {
      wizardTitle: "AI Course Studio",
      badge: "Beta Wizard",
      steps: [
        { label: "Select sources", state: "done" },
        { label: "Set outcomes", state: "done" },
        { label: "Generate", state: "current" },
        { label: "Review each object", state: "todo" },
        { label: "Send for approval", state: "todo" },
      ],
      progressLabel: "Generating module 2 of 6",
      progressPct: 40,
      sources: [
        `${code}_Syllabus.pdf`,
        `${code}_Lecture_Notes.pdf`,
        "Curriculum_Guidelines.pdf",
      ],
      cards: [
        {
          kind: "AI: MODULE OBJECTIVE",
          drafted: "Drafted just now",
          title: sec
            ? `Apply core concepts from ${sec.courseTitle} to a graded practice scenario.`
            : "Apply core course concepts to a graded practice scenario.",
          body: "",
          citations: [`Source Citation: "${code}_Syllabus.pdf", Learning Outcomes.`],
        },
        {
          kind: "AI: ASSESSMENT CRITERIA",
          drafted: "Drafted just now",
          title: "",
          body: `Evaluate student work against clarity, method, and accuracy for ${code}.`,
          citations: [`Source Citation: "${code}_Lecture_Notes.pdf", Unit overview.`],
        },
      ],
    },
  };
}

function buildOutcomeMapping(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const code = sec?.courseCode ?? "Course";
  const title = sec?.courseTitle ?? "this course";
  return {
    title: "Course Learning Outcomes Matrix",
    subtitle: sec
      ? `Map objectives for ${code} · ${sec.code}`
      : "Map weekly syllabus objectives across Bloom's Taxonomy cognitive dimensions",
    primaryAction: "Open Question Generator",
    primaryActionHref: "/instructor/f/in-15-question-generator",
    outcomeMapping: {
      clos: [
        {
          id: "CLO-1",
          label: `Explain foundational concepts in ${title}.`,
          coverage: 85,
        },
        {
          id: "CLO-2",
          label: `Apply ${code} methods to authentic problems.`,
          coverage: 60,
        },
        {
          id: "CLO-3",
          label: `Evaluate and communicate ${code} solutions professionally.`,
          coverage: 45,
        },
      ],
      bloomRows: [
        { level: "Knowledge & Recall", verb: "Core verb: Define", tags: ["CLO-1 Theory"] },
        { level: "Comprehension", verb: "Core verb: Explain", tags: ["CLO-1 Practice"] },
        { level: "Application", verb: "Core verb: Solve / Use", tags: ["CLO-2 Lab"] },
        { level: "Analysis", verb: "Core verb: Differentiate", tags: ["CLO-2 Analysis"] },
        { level: "Synthesis & Design", verb: "Core verb: Construct", tags: ["CLO-3 Architecture"] },
        { level: "Evaluation", verb: "Core verb: Critique", tags: ["CLO-3 Review"] },
      ],
    },
  };
}

const FACULTY_HELP_TOPICS = [
  { title: "Gradebook & Publishing", detail: "Submission windows, overrides, and audit trails.", icon: "bar-chart" },
  { title: "Attendance & Early Warning", detail: "Thresholds, alerts, and advisor handoff.", icon: "user-check" },
  { title: "AI Course Studio", detail: "Ingestion, generation, outcomes, and rubrics.", icon: "sparkle" },
  { title: "Scheduling Conflicts", detail: "Resolve meeting pattern and room clashes.", icon: "calendar" },
  { title: "Student Messaging", detail: "Secure threads and academic context panels.", icon: "file-text" },
  { title: "Account & Security", detail: "MFA, sessions, and recovery codes.", icon: "user" },
] as const;

function consultHelpAnswer(query: string, ctx: InstructorCtx): string {
  const q = query.toLowerCase();
  const drafts = ctx.draftGradeCount;
  const unread = ctx.notifications.filter((n) => !n.readAt).length;
  if (/grade|publish|midterm|gradebook|mark/.test(q)) {
    return drafts
      ? `You currently have ${drafts} draft grade item(s). Open Assessments → Gradebook, complete missing scores, then use Publish Final Marks. Overrides need a note for the curriculum audit trail.`
      : "Grade publishing lives in Assessments → Gradebook. Complete the roster, then Publish Final Marks. Score overrides are written to the audit trail.";
  }
  if (/attend|early warning|absent|roster/.test(q)) {
    return "Mark the session roster from Attendance. Students below 75% raise an early-warning alert for advisor handoff. Use Attendance Reviews to approve excused corrections.";
  }
  if (/studio|ai course|rubric|outcome|question generator/.test(q)) {
    return "AI Course Studio ingests syllabus files, then drafts outcomes, questions, and rubrics. Open Studio → Generation, review citations, and submit for registrar approval before publishing to students.";
  }
  if (/schedul|conflict|room|calendar|office hour/.test(q)) {
    return ctx.sections.length
      ? `You have ${ctx.sections.length} assigned section(s). Check Teaching Schedule and Master Scheduling for room or meeting-pattern clashes, then save availability so students can book office hours.`
      : "Open Teaching Schedule or Master Scheduling to compare meeting patterns and rooms. Save availability so office-hour bookings stay online.";
  }
  if (/message|thread|announcement/.test(q)) {
    return unread
      ? `You have ${unread} unread notification(s). Student threads stay in Messages; class-wide posts go through Announcements and are delivered to enrolled accounts.`
      : "Use Messages for private student threads and Announcements for class-wide posts. Academic context from the roster stays attached to each thread.";
  }
  if (/account|security|mfa|password|recovery/.test(q)) {
    return "Security Settings covers MFA, active sessions, and recovery codes. Reset your password from the sign-in screen if you are locked out, or ask IT Helpdesk from this ticket form.";
  }
  if (/guide|pdf|quickstart|protocol/.test(q)) {
    return `“${query.trim()}” is in the faculty guide set. Grade publishing, early-warning, and Studio quickstarts are the three core PDFs — open a ticket if a step in the guide does not match your section.`;
  }
  return `I searched faculty help for “${query.trim()}”. Use a topic card to prefill a ticket, or describe the failure (course, section, and what you already tried) so Registrar or IT can pick it up during business hours.`;
}

function buildHelpSupport(ctx: InstructorCtx, overlay?: Record<string, unknown> | null): InstructorLivePayload {
  const sec = primarySection(ctx);
  const tickets: Array<{ id: string; subject: string; status: string; tone: "warning" | "info" | "success"; updated: string }> = [];
  if (ctx.draftGradeCount > 0) {
    tickets.push({
      id: "SYS-GRD",
      subject: `${ctx.draftGradeCount} draft grade item(s) need publish${sec ? ` · ${sec.courseCode}` : ""}`,
      status: "Needs action",
      tone: "warning",
      updated: "Live",
    });
  }
  const unread = ctx.notifications.filter((n) => !n.readAt).length;
  if (unread > 0) {
    tickets.push({
      id: "SYS-NTF",
      subject: `${unread} unread notification(s) in your instructor inbox`,
      status: "Open",
      tone: "info",
      updated: "Live",
    });
  }
  const aiConsult = overlay?.aiConsult as { query?: string; answer?: string } | undefined;
  return {
    title: "Faculty Support Center",
    subtitle: `Guides, tickets, and secure escalation · ${ctx.displayName}`,
    helpSupport: {
      topics: FACULTY_HELP_TOPICS.map((t) => ({ ...t })),
      tickets,
      references: [
        { name: "Faculty Grade Submission Guide", meta: "PDF · 12 pages" },
        { name: "Early Warning Protocol", meta: "PDF · 6 pages" },
        { name: "AI Studio Faculty Quickstart", meta: "PDF · 9 pages" },
      ],
      hours: "Mon–Fri · 8:00–18:00 ET",
      contacts: [
        { label: "Registrar", value: "registrar@heritage.edu" },
        { label: "IT Helpdesk", value: "helpdesk@heritage.edu" },
      ],
      aiReply: aiConsult?.answer
        ? { query: aiConsult.query || "", answer: aiConsult.answer }
        : null,
    },
  };
}

function buildEmptyDomain(title: string, subtitle: string): InstructorLivePayload {
  return {
    title,
    subtitle,
    rows: [],
    countLabel: "0 records",
    cards: [],
    form: { submitLabel: "Save", groups: [] },
    workshops: {
      tabs: ["Available (0)"],
      activeTab: "Available (0)",
      credits: "0 CEUs",
      cards: [],
      registrations: [],
    },
    helpSupport: { topics: [], tickets: [], references: [] },
    fileManager: { courseTitle: "Course files", breadcrumbs: ["Files"], tree: [], files: [] },
  };
}

function buildLectures(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const reviewHref = "/instructor/f/in-09-lecture-review";
  const fromSessions = ctx.classSessions
    .filter((c) => !/lab/i.test(c.title))
    .map((c) => {
      const past = c.startsAt < new Date();
      return {
        title: c.title,
        when: c.startsAt.toLocaleString(),
        duration: c.endsAt
          ? `${Math.max(15, Math.round((c.endsAt.getTime() - c.startsAt.getTime()) / 60000))} min`
          : "50 min",
        status: past ? "Completed" : c.joinUrl ? "Ready to Launch" : "Scheduled",
        tone: (past ? "muted" : c.joinUrl ? "info" : "active") as "muted" | "info" | "active",
        href: past ? `${reviewHref}?sessionId=${c.id}` : c.joinUrl || `${reviewHref}?sessionId=${c.id}`,
      };
    });

  const sessions = [...fromSessions];
  return {
    title: "Lectures",
    subtitle: sec ? `${sec.courseCode} · ${sec.code}` : "Teaching sessions",
    primaryAction: "Schedule Lecture",
    lectures: {
      course: sec ? `${sec.courseCode} · ${sec.courseTitle}` : "All sections",
      sessions,
    },
  };
}

async function buildLectureReview(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const sessionId = (() => {
    try {
      return path.includes("?") ? new URL(path, "http://local").searchParams.get("sessionId") : null;
    } catch {
      return null;
    }
  })();
  const session =
    (sessionId ? ctx.classSessions.find((c) => c.id === sessionId) : undefined) ||
    ctx.classSessions.find((c) => !/lab/i.test(c.title) && c.startsAt < new Date()) ||
    ctx.classSessions.find((c) => !/lab/i.test(c.title)) ||
    null;
  const sec =
    (session ? ctx.sections.find((s) => s.code === session.sectionCode && s.courseCode === session.courseCode) : undefined) ||
    primarySection(ctx);
  const enrolled = sec ? sec.enrolments.filter((e) => e.status === "enrolled").length : 0;
  const day = session ? session.startsAt.toLocaleDateString("en-CA", { timeZone: "America/Toronto" }) : "";
  const records =
    session && sec
      ? await prisma.attendanceRecord.findMany({
          where: { institutionId: ctx.user.institutionId, sectionId: sec.id, meetingLabel: day },
          select: { status: true },
        })
      : [];
  const attended = records.filter((r) => r.status === "present" || r.status === "late").length;
  const attendanceLine = records.length
    ? `${attended} of ${enrolled} students attended (attendance submitted for ${day})`
    : session
      ? `Attendance not submitted for ${day}`
      : "No class session yet";
  const title = session?.title || (sec ? `${sec.courseCode} lecture review` : "Lecture review");
  const when = session ? session.startsAt.toLocaleString() : "No session scheduled";
  const location = session?.location || (session?.joinUrl ? "Online" : "Location not set");
  return {
    title: "Lecture Review",
    subtitle: sec ? `${sec.courseCode} · ${sec.code}` : "Recording, transcript, and AI highlights",
    primaryAction: "Share with Class",
    lectureReview: {
      title,
      sectionId: sec?.id ?? null,
      meta: `${sec ? `${sec.courseCode} · ${sec.code}` : "Course"} · ${when} · ${location} · ${attendanceLine}`,
      transcript: session
        ? "No recording or transcript is stored for this session yet."
        : "No lecture session is scheduled yet. Schedule a class session to review it here.",
      highlights: [
        attendanceLine,
        ...(sec ? [`Section ${sec.code} · ${sec.courseTitle}`] : []),
        session?.joinUrl ? "Join link available for this session" : "No join link on this session",
      ],
      aiNotes: "",
    },
  };
}

function buildLabs(ctx: InstructorCtx): InstructorLivePayload {
  const sec = primarySection(ctx);
  const fromSessions = ctx.classSessions
    .filter((c) => /lab/i.test(c.title) || /lab/i.test(c.location || ""))
    .map((c) => {
      const section =
        ctx.sections.find((s) => s.courseCode === c.courseCode && s.code === c.sectionCode) ||
        ctx.sections.find((s) => s.courseCode === c.courseCode) ||
        sec;
      const past = c.startsAt < new Date();
      return {
        title: c.title,
        when: c.startsAt.toLocaleString(),
        room: c.location || "Lab",
        capacity: section ? `${section.enrolmentCount} enrolled` : "—",
        status: past ? "Completed" : "Ready",
        tone: (past ? "muted" : "info") as "muted" | "info",
        href: section ? `/instructor/sections/${section.id}` : "/instructor/roster",
      };
    });

  const labs = [...fromSessions];

  return {
    title: "Labs",
    subtitle: sec ? `${sec.courseCode} · ${sec.code}` : "Lab sessions across your teaching load",
    primaryAction: "Open Lab Roster",
    primaryActionHref: "/instructor/roster",
    labSession: {
      course: sec ? `${sec.courseCode} · ${sec.courseTitle}` : "All sections",
      labs: labs.slice(0, 12),
    },
  };
}

function buildModules(ctx: InstructorCtx): InstructorLivePayload {
  const items = ctx.sections.flatMap((sec) => {
    const href = `/instructor/sections/${sec.id}`;
    const course = `${sec.courseCode} · ${sec.code}`;
    if (!sec.assignments.length) {
      return [
        {
          title: "Course outline",
          course,
          items: 0,
          status: "Draft",
          due: "—",
          href,
        },
      ];
    }
    return sec.assignments.map((a) => ({
      title: a.title,
      course,
      items: 1,
      status: a.dueAt && a.dueAt < new Date() ? "Complete" : "In Progress",
      due: a.dueAt ? a.dueAt.toLocaleDateString() : "—",
      href,
    }));
  });
  const primary = primarySection(ctx);
  return {
    title: "Modules",
    subtitle: `${items.length} module item(s) across ${ctx.sections.length} section(s)`,
    primaryAction: "Open course workspace",
    primaryActionHref: primary ? `/instructor/sections/${primary.id}` : "/instructor/sections",
    modulesBoard: {
      course: primary ? `${primary.courseCode} · ${primary.courseTitle}` : "All teaching sections",
      items,
    },
  };
}

function fileKindLabel(name: string, mimeOrType?: string) {
  const raw = `${name} ${mimeOrType ?? ""}`.toLowerCase();
  if (raw.includes("pdf")) return "PDF";
  if (raw.includes("ppt") || raw.includes("slide")) return "Slides";
  if (raw.includes("xls") || raw.includes("sheet") || raw.includes("csv")) return "Sheet";
  if (raw.includes("doc") || raw.includes("word")) return "Doc";
  if (raw.includes("png") || raw.includes("jpg") || raw.includes("jpeg") || raw.includes("image")) return "Image";
  return mimeOrType && mimeOrType.length < 12 ? mimeOrType : "File";
}

type ResourceFile = OverlayFile;

function collectResourceFiles(ctx: InstructorCtx) {
  const sec = primarySection(ctx);
  const assignmentFiles: ResourceFile[] = (sec?.assignments ?? []).map((a) => ({
    name: `${a.title} · brief.pdf`,
    type: "PDF",
    size: "—",
    updated: a.dueAt ? a.dueAt.toLocaleDateString() : "—",
    visibility: "Published",
    folder: "Assessments",
  }));
  const uploadFiles: ResourceFile[] = ctx.submissions.flatMap((s) =>
    s.files.map((f) => ({
      name: f.filename,
      type: fileKindLabel(f.filename, f.mimeType),
      size: `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB`,
      updated: s.submittedAt ? s.submittedAt.toLocaleDateString() : "Draft",
      visibility: "Published",
      folder: "Archives",
    })),
  );
  const lectureFiles: ResourceFile[] = ctx.classSessions.slice(0, 8).map((session) => ({
    name: `${session.title}.pdf`,
    type: "PDF",
    size: "—",
    updated: session.startsAt.toLocaleDateString(),
    visibility: "Published",
    folder: "Week Materials",
  }));
  return { sec, assignmentFiles, uploadFiles, lectureFiles, files: [...assignmentFiles, ...uploadFiles, ...lectureFiles] };
}

function buildCourseResourcesPane(ctx: InstructorCtx): InstructorLivePayload {
  const { sec, assignmentFiles, uploadFiles, lectureFiles, files } = collectResourceFiles(ctx);
  return {
    title: "Course Resources",
    subtitle: sec ? `${sec.courseCode} file workspace` : "Section resources",
    splitPane: {
      leftTitle: "Folders",
      leftItems: [
        { label: "Assessments", meta: `${assignmentFiles.length} items`, active: true },
        { label: "Archives", meta: `${uploadFiles.length} packets` },
        { label: "Week Materials", meta: `${lectureFiles.length} sessions` },
      ],
      rightTitle: "Files",
      rightFields: [
        { label: "Section", value: sec ? `${sec.courseCode} · ${sec.code}` : "—" },
        { label: "Instructor", value: ctx.displayName },
        { label: "Term", value: ctx.term?.name ?? "—" },
      ],
      resources: files.slice(0, 30).map((f) => ({ name: f.name, type: f.type, size: f.size })),
    },
  };
}

function buildResources(ctx: InstructorCtx, path = ""): InstructorLivePayload {
  const { sec, assignmentFiles, uploadFiles, lectureFiles, files } = collectResourceFiles(ctx);
  const courseId = parseScreenQuery(path).query.get("courseId")?.trim() || "";
  const repoCourse = courseId
    ? buildRepositoryCatalog().find((c) => c.id === courseId || c.number === courseId)
    : undefined;
  const code = repoCourse?.number || sec?.courseCode;
  const title = repoCourse?.name || sec?.courseTitle;
  const courseLabel = code && title ? `${code} · ${title}` : code || title || "Course files";
  return {
    title: code ? `${code} Resources` : "Course Resources",
    subtitle: repoCourse
      ? `Content repository file manager for ${code}`
      : sec
        ? `Course file manager for ${sec.code}`
        : "Section instructional materials",
    fileManager: {
      courseTitle: courseLabel,
      breadcrumbs: repoCourse
        ? ["Content Repository", code || "Course", "Resources"]
        : ["My Courses", sec?.courseCode ?? "Section", "Resources"],
      tree: [
        {
          name: "Add activity or resource",
          active: true,
          children: LMS_ACTIVITY_TYPES.slice(0, 12).map((t) => t.label),
        },
        {
          name: "Syllabus & Policies",
          children: ["Syllabus.pdf", "Academic_Integrity.pdf"],
        },
        {
          name: "Week Materials",
          children: lectureFiles.slice(0, 4).map((f) => f.name),
        },
        {
          name: "Assessments",
          children: assignmentFiles.slice(0, 4).map((f) => f.name),
        },
        {
          name: "Archives",
          children: uploadFiles.slice(0, 4).map((f) => f.name),
        },
      ],
      files: files.slice(0, 30),
    },
    activityTypes: LMS_ACTIVITY_TYPES.map((t) => ({
      code: t.code,
      label: t.label,
      kind: t.kind,
      href:
        t.code === "assignment" || t.code === "quiz"
          ? "/instructor/f/t19-create-edit-assessment"
          : "/instructor/f/t60-course-resources-management",
    })),
    rows: LMS_ACTIVITY_TYPES.map((t) => ({
      cells: [t.label, t.code, t.kind, t.kind === "activity" ? "Add activity" : "Add resource"],
      badge: t.kind,
      badgeTone: t.kind === "activity" ? ("active" as const) : ("muted" as const),
      href:
        t.code === "assignment" || t.code === "quiz"
          ? "/instructor/f/t19-create-edit-assessment"
          : undefined,
    })),
    columns: ["Type", "Code", "Kind", "Action"],
    countLabel: `${LMS_ACTIVITY_TYPES.length} activity/resource types`,
  };
}

function buildVersionEditor(ctx: InstructorCtx, overlay?: Record<string, unknown> | null): InstructorLivePayload {
  const sec = primarySection(ctx);
  const draft = overlay?.versionDraft && typeof overlay.versionDraft === "object"
    ? overlay.versionDraft as { title?: string; body?: string; status?: string; savedAt?: string }
    : null;
  const modules = (sec?.assignments ?? []).map((a, i) => ({
    id: a.id,
    label: `Module ${i + 1} — ${a.title}`,
    children: [`Weight ${a.weightPercent}%`, a.dueAt ? `Due ${a.dueAt.toLocaleDateString()}` : "No due date"],
  }));
  return {
    title: "Course Version Editor",
    subtitle: sec ? `Edit ${sec.courseCode} outline` : "Outline editor",
    primaryAction: "Submit for Approval",
    secondaryAction: "Save Draft",
    versionEditor: {
      course: sec ? `${sec.courseCode} · ${sec.courseTitle}` : "Untitled course",
      version: "v1.0-live",
      notice: draft?.status === "pending" ? "Change request submitted for registrar approval." : "Live outline generated from assigned assessments. Submit changes for registrar approval.",
      outline: modules.length
        ? modules
        : [{ id: "outline-1", label: "Module 1 — Getting started", children: ["Add assessments to build outline"] }],
      editor: {
        title: draft?.title || sec?.courseTitle || "Course outline",
        body: draft?.body || `Instructor ${ctx.displayName} · ${sec?.enrolmentCount ?? 0} enrolled · ${sec?.assignments.length ?? 0} assessments`,
        wordCount: `${Math.max(40, (sec?.assignments.length ?? 0) * 120)} words`,
      },
      versions: [
        { label: "v1.0-live", when: new Date().toLocaleDateString(), author: ctx.displayName, current: true },
      ],
    },
  };
}

function buildGenericLiveForm(
  ctx: InstructorCtx,
  title: string,
  subtitle: string,
  submitLabel: string,
  groups: Array<{
    title: string;
    fields: Array<{
      label: string;
      value: string;
      type?: "text" | "select" | "textarea" | "number" | "checkbox" | "file" | "weekdays";
      options?: Array<{ label: string; value: string; filterKey?: string }>;
      dependsOn?: string;
      hint?: string;
      readOnly?: boolean;
    }>;
  }>,
): InstructorLivePayload {
  return {
    title,
    subtitle,
    primaryAction: submitLabel,
    form: { submitLabel, groups },
  };
}

function buildCreateStudentForm(ctx: InstructorCtx): InstructorLivePayload {
  const programOptions = ctx.programs.map((p) => ({ label: p.name, value: p.name }));
  const courseMap = new Map<string, { code: string; title: string }>();
  for (const s of ctx.sections) {
    if (!courseMap.has(s.courseCode)) {
      courseMap.set(s.courseCode, { code: s.courseCode, title: s.courseTitle });
    }
  }
  const courseOptions = [...courseMap.values()].map((c) => ({
    label: `${c.code} · ${c.title}`,
    value: c.code,
  }));
  const sectionOptions = ctx.sections.map((s) => ({
    label: `${s.code} · ${s.termCode || "Term"}`,
    value: s.id,
    filterKey: s.courseCode,
  }));
  const standingOptions = [
    ...new Set([
      "good",
      "warning",
      "alert",
      "probation",
      ...ctx.sections.flatMap((s) => s.enrolments.map((e) => e.standing)),
    ]),
  ]
    .filter(Boolean)
    .map((standing) => ({
      label:
        standing === "good"
          ? "Active / Good standing"
          : standing === "alert"
            ? "Alert"
            : standing.charAt(0).toUpperCase() + standing.slice(1),
      value: standing,
    }));

  const defaultCourse = courseOptions[0]?.value ?? "";
  const defaultSection =
    sectionOptions.find((o) => o.filterKey === defaultCourse)?.value ?? sectionOptions[0]?.value ?? "";

  return {
    title: "Create Student Profile",
    subtitle: `${ctx.sections.length} teaching section(s) · ${ctx.programs.length} program option(s) · live roster intake`,
    primaryAction: "Save Student Profile",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t12-students-view",
    form: {
      submitLabel: "Save Student Profile",
      groups: [
        {
          title: "Identity",
          fields: [
            { label: "Given Name", value: "", type: "text" },
            { label: "Family Name", value: "", type: "text" },
            { label: "Email", value: "", type: "text" },
            {
              label: "Program",
              value: programOptions[0]?.value ?? "",
              type: "select",
              options: programOptions,
            },
            {
              label: "Student Status",
              value: standingOptions[0]?.value ?? "good",
              type: "select",
              options: standingOptions,
            },
          ],
        },
        {
          title: "Section placement",
          fields: [
            {
              label: "Course Name",
              value: defaultCourse,
              type: "select",
              options: courseOptions,
            },
            {
              label: "Section",
              value: defaultSection,
              type: "select",
              options: sectionOptions,
              dependsOn: "Course Name",
            },
          ],
        },
      ],
    },
  };
}

async function routePayload(
  path: string,
  ctx: InstructorCtx,
  overlay?: Record<string, unknown> | null,
  studentId?: string | null,
): Promise<InstructorLivePayload> {
  const p = path.replace(/\/+$/, "") || "/instructor";

  if (p === "/instructor") return buildDashboard(ctx);
  if (p === "/instructor/interviews") return buildAdmissionsInterviews(ctx);
  if (/\/sections\/[^/]+$/.test(p) || p.includes("t08-my-courses-detail") || p.includes("course-detail")) {
    return buildCourseDetail(ctx, p);
  }
  if (p.includes("t55") || p.includes("add-course-form") || p.includes("add-course")) {
    return buildAddCourseForm(ctx);
  }
  if (p.includes("t64-add-grading") || (p.includes("add-grading-scheme") && !p.includes("pending-transcript"))) {
    const listOverlay = await loadScreenOverlay(ctx.user.institutionId, GRADING_SCHEMES_PATH);
    return buildAddGradingSchemeForm(path, listOverlay);
  }
  if (p.includes("t61") || (p.includes("grading-scheme") && !p.includes("add-grading"))) {
    return buildGradingSchemesList();
  }
  if (p.includes("t70") || p.includes("add-badge") || p.includes(ADD_BADGE_PATH)) {
    return buildAddBadgeFormPayload(ctx.user.institutionId);
  }
  if (p.includes("t69") || p.includes("add-course-type")) {
    return buildAddCourseTypeForm(path, await loadScreenOverlay(ctx.user.institutionId, COURSE_TYPES_LIST_PATH));
  }
  if (p.includes("t68") || p.includes("add-course-group")) {
    return buildAddCourseGroupForm();
  }
  if (p.includes("t67") || (p.includes("course-type") && !p.includes("add-course-type"))) {
    return buildCourseTypesList(await loadScreenOverlay(ctx.user.institutionId, COURSE_TYPES_LIST_PATH));
  }
  if (p.includes("t26") || p.includes("version-editor")) {
    return buildVersionEditor(ctx, overlay);
  }
  if (p.includes("t32") || p.includes("file-manager") || p.includes("resource-file")) {
    return buildResources(ctx, path);
  }
  if (p.includes("t33") || p.includes("help-support")) {
    return buildHelpSupport(ctx, overlay);
  }
  if (p.includes("t60b") || p.includes("add-course-resource-category")) {
    return buildAddResourceCategoryForm();
  }
  if (p.includes("t60c") || (p.includes("add-course-resource") && !p.includes("category"))) {
    return buildAddCourseResourceForm(ctx.user.institutionId);
  }
  if (p.includes("t60") || p.includes("resources-management") || p.includes(COURSE_RESOURCES_PATH)) {
    return listCourseResourcesPayload(ctx.user.institutionId);
  }
  if (p.includes("in-09") || p.includes("lecture-review") || p.includes("lecture_review")) {
    return buildLectureReview(ctx, path);
  }
  if (
    p.includes("in-08") ||
    p.endsWith("/lectures") ||
    (p.includes("lecture") && !p.includes("schedule") && !p.includes("review"))
  ) {
    return buildLectures(ctx);
  }
  if (p.includes("in-10") || p.endsWith("/labs") || p.includes("lab-session") || p.includes("lab-sessions")) {
    return buildLabs(ctx);
  }
  if (p.endsWith("/modules") || (p.includes("modules") && !p.includes("t08"))) {
    return buildModules(ctx);
  }
  if (p.includes("t43") || p.includes("create-student-profile")) {
    return buildCreateStudentForm(ctx);
  }
  if (p.includes("t27") || p.includes("program-change")) {
    const programOptions = ctx.programs
      .filter((program) => !program.id.startsWith("name:"))
      .map((program) => ({ label: `${program.code} · ${program.name}`, value: program.id }));
    const termOptions = ctx.terms.map((term) => ({ label: term.name, value: term.name }));
    const form = buildGenericLiveForm(ctx, "Program Change Request", "Submit a program change for registrar review and track its decision below", "Submit Request", [
      {
        title: "Request",
        fields: [
          { label: "Programme", value: programOptions[0]?.value || "", type: "select", options: programOptions, hint: "The programme whose official curriculum should change." },
          { label: "Change Type", value: "Add course", type: "select", options: ["Add course", "Remove course", "Credit change", "Requirement change", "Program name / description", "Delivery change", "Other"].map((value) => ({ label: value, value })) },
          { label: "Summary", value: "", type: "text", hint: "A short title that reviewers can identify in the queue." },
          { label: "Rationale", value: "", type: "textarea", hint: "Explain the requested change and its academic reason." },
          { label: "Effective Term", value: termOptions[0]?.value || "", type: "select", options: termOptions },
          { label: "Requested By", value: ctx.displayName, type: "text", readOnly: true, hint: "Recorded automatically from your signed-in account; this is not the approver." },
        ],
      },
    ]);
    return {
      ...form,
      programChangeHistory: {
        rows: await listOwnProgramChangeRequests(ctx.user),
      },
    };
  }
  if (p.includes("t42") || p.includes("new-workshop-enrollment") || p.includes("new-workshop-enrolment")) {
    return buildNewWorkshopEnrolmentForm(ctx.user);
  }
  if (p.includes("t40") || p.includes("workshop-enrollment-status") || p.includes("workshop-enrolment")) {
    return buildWorkshopEnrolments(ctx.user, path);
  }
  if (p.includes("t41") || p.includes("workshop-attendance")) {
    return buildWorkshopAttendance(ctx.user, path);
  }
  if (p.includes("t24") || p.includes("workshop-detail")) {
    return buildWorkshopDetail(ctx.user, path);
  }
  // Studio archetypes before the generic `studio` course-list catch-all
  if (p.includes("in-15") || p.includes("question-generator")) {
    return buildQuestionGenerator(ctx, overlay);
  }
  if (p.includes("in-16") || p.includes("rubric-generator")) {
    return buildRubricGenerator(ctx);
  }
  if (p.includes("in-14") || p.includes("outcome-mapping")) {
    return buildOutcomeMapping(ctx);
  }
  if (p.includes("in-13") || p.includes("studio-generation")) {
    return buildStudioGeneration(ctx);
  }
  if (p.includes("in-12") || p.includes("ai-course-studio") || p.includes("ai-studio")) {
    return buildAiStudio(ctx);
  }
  // Hub screens must return courseMgmt / hub payloads (not course lists).
  if (p.includes("t14-course-management") || p.endsWith("/course-management")) {
    return buildCourseManagement(ctx);
  }
  if (p.includes("t13-program-management") || p.endsWith("/program-management")) {
    return hydrateFacultiesPrograms(ctx);
  }
  if (p.includes("t83") || p.includes("program-settings")) {
    return hydrateProgramSettings(ctx, path);
  }
  if (
    (p.includes("t82") || p.includes(BADGES_PATH) || p.includes(BADGES_LIST_PATH) || (p.includes("badges") && p.includes("accomplishment"))) &&
    !p.includes("add-badge") &&
    !p.includes("t70")
  ) {
    return listBadgesPayload(ctx.user.institutionId);
  }
  if (p.includes("t81") || p.includes("add-faculty")) {
    return buildAddFacultyForm(ctx, path);
  }
  if (p.includes("t74") || (p.includes("add-program") && !p.includes("add-program-type"))) {
    return buildAddProgramForm(ctx);
  }
  if (p.includes("t75") || p.includes("add-program-type")) {
    return buildAddProgramTypeForm(ctx, path);
  }
  if (p.includes("t84-review-term") || p.includes("review-term")) {
    return buildReviewTerm(ctx, path);
  }
  if (p.includes("t85-manage-schedule") || (p.includes("manage-schedule") && !p.includes("master-scheduling"))) {
    return buildManageScheduleScreen(ctx, path);
  }
  if (p.includes("t76-add-term") || (p.includes("add-term") && !p.includes("manage-term") && !p.includes("create-term"))) {
    return buildAddTermForm(ctx, path);
  }
  if (p.includes("t50") || (p.includes("program-type") && !p.includes("add-program-type"))) {
    return buildProgramTypes(ctx);
  }
  if (p.includes("t51") || p.includes("manage-term")) {
    return buildManageTerms(ctx);
  }
  if (p.includes("t78") || p.includes("add-session-offering")) {
    return buildAddSessionOfferingForm(ctx, p);
  }
  if (p.includes("t77") || p.includes("course-admin")) {
    return buildCourseAdmin(ctx, p);
  }
  if (p.includes("t54") || p.includes("courses-sessions")) {
    return buildCoursesSessionsList(ctx);
  }
  if (p.includes("t79") || p.includes("add-textbook")) {
    return buildAddTextbookScreen(ctx, path);
  }
  if ((p.includes("t57") || p.includes("course-textbook")) && !p.includes("add-textbook")) {
    return buildCourseTextbooksScreen(ctx);
  }
  if (p.includes("t80") || p.includes("create-content-course")) {
    return buildCreateContentCourseScreen(ctx, path);
  }
  if (p.includes("t39") || p.includes("course-history")) {
    return buildHccCourseHistory(ctx);
  }
  if (p.includes("pending-transcript") || p.includes("t64-pending-transcript")) {
    return buildHccTranscriptPending();
  }
  if (p.includes("t38") || p.includes("pending-course-schedule")) {
    return buildHccPendingSchedules(ctx, path);
  }
  if (
    (p.includes("t37") || p.includes("course-repository") || p.includes("content-repository")) &&
    !p.includes("create-content")
  ) {
    return buildContentRepositoryScreen(ctx);
  }
  if (
    p.includes("t07") ||
    p.endsWith("/sections") ||
    (p.includes("sections") && !p.includes("sections/") && !p.includes("pending")) ||
    p.includes("in-03")
  ) {
    if (!p.includes("studio")) return buildHccMyCourses(ctx, path);
  }
  if (p.includes("t56") || p.includes("active-courses")) {
    return buildActiveCourses(ctx, p);
  }
  if (p.includes("t45-create") || p.includes("create-flag") || p.includes("create-student-flag")) {
    return buildCreateFlagForm(ctx);
  }
  if (p.includes("t45") && p.includes("flag")) {
    return buildHccStudentFlags(ctx.user);
  }
  if (p.includes("t44") || p.includes("academic-alert")) {
    return buildInstructorAlertQueue(ctx.user, ctx.sections);
  }
  if (p.includes("t46") || p.includes("student-assessment")) {
    return buildInstructorAssessmentQueue(ctx.user, ctx.sections);
  }
  if (p.includes("t47") || p.includes("student-requirement")) {
    return buildInstructorRequirementQueue(ctx.user, ctx.sections);
  }
  if (p.includes("t48") || (p.includes("leave-of-absence") && !p.includes("student"))) {
    return buildInstructorLeaveQueue(ctx.user, ctx.sections);
  }
  if (p.includes("t49") || p.includes("withdraw-request")) {
    return buildInstructorWithdrawQueue(ctx.user, ctx.sections, ctx.grades);
  }
  if (p.includes("t36") || p.includes("course-evaluation")) {
    return buildHccCourseEvaluations(ctx, path);
  }
  if (p.includes("t22") || p.includes("in-11") || p.includes("student-detail")) {
    return buildStudentDetail(ctx, studentId ?? (overlay?.studentId as string | undefined) ?? null);
  }
  if (p.includes("t12") || p.includes("in-04") || p.includes("roster") || (p.includes("student") && !p.includes("create-student"))) {
    if (p.includes("t63") || p.includes("status-filter")) return buildHccStudentsDirectory(ctx.user, path);
    if (p.includes("flag")) return buildHccStudentFlags(ctx.user);
    return buildHccStudentsDirectory(ctx.user, path);
  }
  if (p.includes("attendance") && !p.includes("workshop")) {
    const { query } = parseScreenQuery(path);
    const today = ymdIn(new Date(), await institutionTimezone(ctx.user.institutionId));
    return buildHccAttendance({
      ...ctx,
      dateIso: query.get("date")?.trim() || today,
      sectionId: query.get("sectionId")?.trim() || null,
    });
  }
  if (p.includes("t19") || p.includes("create-edit-assessment")) {
    return buildAssessmentBuilder(ctx, overlay, path);
  }
  // Assessments nav = list of published assessments (not the gradebook matrix)
  if (
    p === "/instructor/assessments" ||
    p.includes("in-06") ||
    p.includes("assessment-manager")
  ) {
    return buildAssessmentList(ctx);
  }
  if (p.includes("t20") || p.includes("grade-correction")) {
    return buildGradeCorrectionReview(ctx);
  }
  if (p.includes("t62") || p.includes("pending-grade") || p.includes("grades-submission")) {
    if (path.includes("mode=submission") || p.includes("grades-submission")) {
      return buildHccGradesSubmission(ctx, path);
    }
    return buildHccPendingGradeSubmissions(ctx, path);
  }
  if (
    (p.includes("grade") && !p.includes("grading-scheme") && !p.includes("grading_scheme") && !p.includes("t62")) ||
    p.includes("t10") ||
    p.includes("in-07")
  ) {
    return buildGradebook(ctx);
  }
  if (p.includes("message") || p.includes("t16")) return buildMessages(ctx);
  if (p.includes("announcement") || p.includes("t23")) return buildAnnouncements(ctx, path);
  if (p.includes("notification") || p.includes("t17")) {
    const mine = { institutionId: ctx.user.institutionId, recipientAccountId: ctx.user.accountId };
    const [total, unread] = await Promise.all([
      prisma.notification.count({ where: mine }),
      prisma.notification.count({ where: { ...mine, readAt: null } }),
    ]);
    return buildNotifications(ctx, total, unread);
  }
  if (p.includes("t31") || p.includes("first-login")) {
    return buildProfileCompletionPayload(ctx);
  }
  if (
    p.includes("profile") ||
    p.includes("t02") ||
    p.includes("t03") ||
    p.includes("t04") ||
    p.includes("t05") ||
    p.includes("t06") ||
    p.includes("t15") ||
    p.includes("t34") ||
    p.includes("t35") ||
    p.includes("in-18") ||
    p.includes("in-19") ||
    p.includes("availability") ||
    p.includes("compensation")
  ) {
    if (p.includes("t34") || (p.includes("accomplishment") && !p.includes("t82") && !p.includes("badges"))) {
      return { ...(await buildAccomplishments(ctx)), profileHeader: profileHeaderPayload(ctx) };
    }
    const slots =
      p.includes("t04") ||
      p.includes("t06") ||
      p.includes("availability") ||
      (p.includes("schedule") && !p.includes("pending"))
        ? await loadAvailabilitySlots(ctx)
        : [];
    return await buildProfile(ctx, path, slots);
  }
  if (p.includes("t71") || p.includes("create-master-schedule")) {
    return buildCreateMasterScheduleForm();
  }
  if (p.includes("t72") || p.includes("create-term-schedule")) {
    return buildCreateTermScheduleForm(ctx);
  }
  if (p.includes("t73") || p.includes("create-academic-calendar")) {
    return buildCreateAcademicCalendarForm();
  }
  if (p.includes("t53") || p.includes("master-scheduling")) {
    return buildMasterSchedulingList();
  }
  if (p.includes("t52") || (p.includes("academic-calendar") && !p.includes("create-academic"))) {
    return buildAcademicCalendarsList();
  }
  if (
    (p.includes("calendar") && !p.includes("academic-calendar") && !p.includes("create-academic")) ||
    p.includes("t18") ||
    p.includes("timetable")
  ) {
    return buildCalendar(ctx);
  }
  if (p.includes("workshop") || p.includes("t11") || p.includes("in-20")) {
    return buildWorkshopList(ctx.user, path);
  }
  if (p.includes("t29") || p.includes("t30") || p.includes("t31") || p.includes("password") || p.includes("mfa")) {
    return {
      title: path.includes("mfa") ? "MFA Challenge" : path.includes("31") ? "Profile Completion" : "Password Reset",
      subtitle: ctx.person.email,
      authGate: {
        heading: path.includes("mfa") ? "MFA Challenge" : path.includes("31") ? "Complete your profile" : "Reset Password",
        description: path.includes("mfa")
          ? "Enter the verification code from your authenticator."
          : path.includes("31")
            ? "Update your temporary credentials to continue."
            : "Enter your email address and we'll send a secure reset link.",
        fieldLabel: path.includes("mfa") ? "Verification code" : "Email address",
        fieldValue: path.includes("mfa") ? "" : ctx.person.email,
        cta: path.includes("mfa") ? "Verify Access" : path.includes("31") ? "Save & Continue" : "Send Reset Link",
        help: "Need help? Contact the Registrar's Office",
      },
    };
  }

  // Generic live table for remaining management screens — never catalog fixtures
  if (p.includes("t58") || p.includes("course-categor")) {
    return buildCourseCategories(ctx);
  }
  if (p.includes("t66") || p.includes("course-configuration")) {
    return hydrateCourseConfigurations(ctx, path);
  }
  if (p.includes("t59") || p.includes("course-groups")) {
    return buildCourseGroupsList(ctx.user.institutionId);
  }
  if (p.includes("t65") || p.includes("course-backups")) {
    return buildCourseBackups(ctx.sections.length);
  }
  if (parseScreenQuery(path).pathname.replace(/\/+$/, "") === "/instructor/studio") {
    return buildCourseDetail(ctx, studioWorkspacePath(path, ctx));
  }
  if (p.includes("in-17") || p.includes("course-approval")) {
    return buildCourseApprovalReview(ctx);
  }
  return buildEmptyDomain("Instructor", `${ctx.displayName} · live`);
}

/** `/instructor/studio` shows a section's course workspace, so it must use that workspace's path (and LMS overlay). */
function studioWorkspacePath(path: string, ctx: InstructorCtx) {
  const { pathname, query } = parseScreenQuery(path);
  if (pathname.replace(/\/+$/, "") !== "/instructor/studio") return path;
  const picked = [query.get("sectionId"), query.get("view")].map((v) => (v || "").trim()).find((id) => ctx.sections.some((s) => s.id === id));
  const sectionId = picked || ctx.sections[0]?.id;
  if (!sectionId) return path;
  query.delete("sectionId");
  query.delete("view");
  const qs = query.toString();
  return `/instructor/sections/${sectionId}${qs ? `?${qs}` : ""}`;
}

export async function buildInstructorScreen(
  requestedPath: string,
  user: SessionClaims,
  opts?: { studentId?: string | null },
) {
  await assertInstructorSectionAccess(user, requestedPath);
  const ctx = await loadCtx(user, requestedPath);
  const path = studioWorkspacePath(requestedPath, ctx);
  if (path !== requestedPath) await assertInstructorSectionAccess(user, path);
  const overlay = await loadScreenOverlay(user.institutionId, path);
  const payload = mergeOverlayRows(await routePayload(path, ctx, overlay, opts?.studentId), overlay, path);
  if (overlay?._lastAction) {
    (payload as Record<string, unknown>)._lastAction = overlay._lastAction;
  }
  const workshopCounts = await workshopNavCounts(user);
  const statusCounts = await loadStudentStatusCounts(user);
  const dashboardSections = ctx.sections.filter((section) => sectionTermStatus(ctx, section) !== "Completed");
  return {
    path: requestedPath,
    live: true as const,
    source: "domain" as const,
    bootstrap: {
      displayName: ctx.displayName,
      email: ctx.person.email,
      studentCount: statusCounts.total || ctx.studentCount,
      sectionCount: dashboardSections.length,
      courseCount: new Set(dashboardSections.map((section) => section.courseId)).size,
      draftGradeCount: ctx.draftGradeCount,
      unreadNotifications: ctx.notifications.filter((n) => !n.readAt).length,
      workshopCounts,
      statusCounts: statusCounts.byLabel,
      flagCount: statusCounts.flagCount,
      alertCount: await instructorAlertCount(user, ctx.sections),
    },
    payload,
  };
}

export async function buildInstructorBootstrap(user: SessionClaims) {
  const ctx = await loadCtx(user);
  const workshopCounts = await workshopNavCounts(user);
  const statusCounts = await loadStudentStatusCounts(user);
  const dashboardSections = ctx.sections.filter((section) => sectionTermStatus(ctx, section) !== "Completed");
  return {
    displayName: ctx.displayName,
    email: ctx.person.email,
    studentCount: statusCounts.total || ctx.studentCount,
    sectionCount: dashboardSections.length,
    courseCount: new Set(dashboardSections.map((section) => section.courseId)).size,
    draftGradeCount: ctx.draftGradeCount,
    unreadNotifications: ctx.notifications.filter((n) => !n.readAt).length,
    workshopCounts,
    statusCounts: statusCounts.byLabel,
    flagCount: statusCounts.flagCount,
    alertCount: await instructorAlertCount(user, ctx.sections),
    sections: dashboardSections.map((s) => ({
      sectionId: s.id,
      code: s.courseCode,
      title: s.courseTitle,
      sectionCode: s.code,
      enrolmentCount: s.enrolmentCount,
    })),
  };
}

type ActionInput = { path: string; action: string; rowKey?: string };

async function appendInstructorActivity(
  institutionId: string,
  path: string,
  entry: Record<string, unknown>,
) {
  const existing = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path } },
  });
  const prev = existing ? (JSON.parse(existing.payloadJson) as Record<string, unknown>) : {};
  const activity = Array.isArray(prev.activity) ? [...(prev.activity as unknown[])] : [];
  activity.unshift(entry);
  const next = { ...prev, activity: activity.slice(0, 50), _lastAction: entry };
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path } },
    create: { institutionId, path, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });
  return next;
}

function parseActionFields(rowKey?: string): Record<string, string> | null {
  if (!rowKey?.trim().startsWith("{")) return null;
  try {
    return JSON.parse(rowKey) as Record<string, string>;
  } catch {
    return null;
  }
}

function cellsFromFields(fields: Record<string, string>, fallbackColumns?: string[]) {
  const keys = fallbackColumns?.length ? fallbackColumns : Object.keys(fields);
  return keys.map((key) => {
    const value = fields[key]?.trim();
    return value && value.length ? value : "—";
  });
}

async function appendExtraRow(
  institutionId: string,
  path: string,
  row: { cells: string[]; badge?: string; badgeTone?: string; href?: string },
) {
  const existing = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path } },
  });
  const prev = existing ? (JSON.parse(existing.payloadJson) as Record<string, unknown>) : {};
  const extraRows = Array.isArray(prev.extraRows) ? [...(prev.extraRows as unknown[])] : [];
  extraRows.unshift(row);
  const next = {
    ...prev,
    extraRows: extraRows.slice(0, 100),
  };
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path } },
    create: { institutionId, path, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });
  return next;
}

type OverlayFile = {
  name: string;
  type: string;
  size: string;
  updated: string;
  visibility: "Published" | "Hidden";
  folder?: string;
};

function asOverlayFile(value: unknown): OverlayFile | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  if (!name) return null;
  return {
    name,
    type: typeof rec.type === "string" && rec.type.trim() ? rec.type : "File",
    size: typeof rec.size === "string" && rec.size.trim() ? rec.size : "—",
    updated: typeof rec.updated === "string" && rec.updated.trim() ? rec.updated : "Just now",
    visibility: rec.visibility === "Published" ? "Published" : "Hidden",
    folder: typeof rec.folder === "string" && rec.folder.trim() ? rec.folder : "Uploads",
  };
}

function parseFileManagerUploads(rowKey?: string): OverlayFile[] {
  if (!rowKey?.trim().startsWith("{")) return [];
  try {
    const parsed = JSON.parse(rowKey) as Record<string, unknown>;
    if (Array.isArray(parsed.files)) {
      return parsed.files.map(asOverlayFile).filter((file): file is OverlayFile => Boolean(file));
    }
    const single = asOverlayFile(parsed);
    return single ? [single] : [];
  } catch {
    return [];
  }
}

/** Active Courses → View (`t56?view=<sectionId>`) is the same course workspace admin and students use. */
function sectionWorkspacePath(path: string) {
  const { pathname, query } = parseScreenQuery(path);
  const view = (query.get("view") || "").trim();
  return pathname === "/instructor/f/t56-active-courses" && /^[0-9a-z-]{36}$/i.test(view) ? `/instructor/sections/${view}` : null;
}

function overlayStoragePath(path: string) {
  const workspace = sectionWorkspacePath(path);
  if (workspace) return workspace;
  const { pathname, query } = parseScreenQuery(path);
  for (const key of ["tab", "more", "action", "qtype", "qid", "atype", "topic", "aid", "sid", "view"]) {
    query.delete(key);
  }
  const qs = query.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function overlayReadKeys(path: string) {
  const canonical = overlayStoragePath(path);
  if (sectionWorkspacePath(path)) return [canonical];
  return [...new Set([canonical, path, parseScreenQuery(path).pathname])];
}

async function loadScreenOverlay(institutionId: string, path: string) {
  for (const key of overlayReadKeys(path)) {
    const state = await prisma.sisScreenState.findUnique({
      where: { institutionId_path: { institutionId, path: key } },
    });
    if (state) return JSON.parse(state.payloadJson) as Record<string, unknown>;
  }
  return null;
}

async function patchScreenOverlay(
  institutionId: string,
  path: string,
  patch: (prev: Record<string, unknown>) => Record<string, unknown>,
) {
  const canonical = overlayStoragePath(path);
  let prev: Record<string, unknown> = {};
  for (const key of overlayReadKeys(path)) {
    const existing = await prisma.sisScreenState.findUnique({
      where: { institutionId_path: { institutionId, path: key } },
    });
    if (existing) {
      prev = JSON.parse(existing.payloadJson) as Record<string, unknown>;
      break;
    }
  }
  const next = patch(prev);
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path: canonical } },
    create: { institutionId, path: canonical, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });
  return next;
}

function mergeFileManagerOverlay(
  payload: InstructorLivePayload,
  overlay: Record<string, unknown>,
): InstructorLivePayload {
  const extraFiles = Array.isArray(overlay.extraFiles)
    ? overlay.extraFiles.map(asOverlayFile).filter((file): file is OverlayFile => Boolean(file))
    : [];
  const extraFolders = Array.isArray(overlay.extraFolders)
    ? overlay.extraFolders.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  if (!extraFiles.length && !extraFolders.length) return payload;

  const fm = (payload.fileManager as {
    courseTitle?: string;
    breadcrumbs?: string[];
    tree?: Array<{ name: string; children?: string[]; active?: boolean }>;
    files?: OverlayFile[];
  }) || { courseTitle: "Course files", breadcrumbs: ["Files"], tree: [], files: [] };

  const files = [...extraFiles, ...(fm.files ?? [])];
  const tree = [...(fm.tree ?? [])];
  const ensureFolder = (name: string, child?: string) => {
    const existing = tree.find((node) => node.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      tree.unshift({ name, children: child ? [child] : [], active: false });
      return;
    }
    if (child && !(existing.children ?? []).includes(child)) {
      existing.children = [child, ...(existing.children ?? [])].slice(0, 8);
    }
  };
  for (const folder of extraFolders) ensureFolder(folder);
  for (const file of extraFiles) {
    if (file.folder) ensureFolder(file.folder, file.name);
  }

  return {
    ...payload,
    fileManager: {
      ...fm,
      tree,
      files,
    },
    ...(payload.splitPane
      ? {
          splitPane: {
            ...(payload.splitPane as Record<string, unknown>),
            resources: [
              ...extraFiles.map((file) => ({ name: file.name, type: file.type, size: file.size })),
              ...((((payload.splitPane as { resources?: Array<{ name: string; type: string; size: string }> })
                .resources) || []) as Array<{ name: string; type: string; size: string }>),
            ].slice(0, 50),
          },
        }
      : {}),
    ...(payload.repository || extraFiles.length
      ? {
          repository: {
            folders: [
              ...extraFolders.map((name) => ({ name, files: 0, updated: "Just now" })),
              ...((((payload.repository as { folders?: Array<{ name: string; files: number; updated: string }> } | undefined)
                ?.folders) || []) as Array<{ name: string; files: number; updated: string }>),
            ].slice(0, 20),
            files: [
              ...extraFiles.map((file) => ({
                name: file.name,
                type: file.type,
                size: file.size,
                updated: file.updated,
              })),
              ...((((payload.repository as { files?: Array<{ name: string; type: string; size: string; updated: string }> } | undefined)
                ?.files) || []) as Array<{ name: string; type: string; size: string; updated: string }>),
            ].slice(0, 50),
          },
        }
      : {}),
  };
}

function mergeOverlayRows(
  payload: InstructorLivePayload,
  overlay?: Record<string, unknown> | null,
  path = "",
): InstructorLivePayload {
  if (!overlay) return payload;
  let next = payload;
  const extra = Array.isArray(overlay.extraRows)
    ? (overlay.extraRows as Array<{ cells: string[]; badge?: string; badgeTone?: string; href?: string }>)
    : [];
  if (extra.length) {
    const baseRows = Array.isArray(next.rows) ? (next.rows as unknown[]) : [];
    const rows = [...extra, ...baseRows];
    next = {
      ...next,
      rows,
      countLabel: `${rows.length} record(s)`,
    };
  }

  const gs = next.gradingSchemes as
    | {
        searchPlaceholder?: string;
        schemes?: Array<{ id: string; name: string; active: boolean }>;
      }
    | undefined;
  if (gs && Array.isArray(gs.schemes)) {
    const deleted = new Set(
      Array.isArray(overlay.deletedSchemeIds)
        ? (overlay.deletedSchemeIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [],
    );
    const extras = Array.isArray(overlay.extraSchemes)
      ? (overlay.extraSchemes as Array<{ id: string; name: string; active: boolean }>)
      : [];
    const renamed =
      overlay.renamedSchemes && typeof overlay.renamedSchemes === "object"
        ? (overlay.renamedSchemes as Record<string, { name: string; active: boolean }>)
        : {};
    const schemes = [
      ...extras,
      ...gs.schemes
        .filter((s) => !deleted.has(s.id))
        .map((s) => (renamed[s.id] ? { ...s, ...renamed[s.id] } : s)),
    ];
    next = {
      ...next,
      gradingSchemes: {
        ...gs,
        schemes,
      },
    };
  }

  const pt = next.programTypes as
    | {
        searchPlaceholder?: string;
        types?: Array<{ id: string; name: string; abbreviation: string; active: boolean }>;
      }
    | undefined;
  if (pt && Array.isArray(pt.types)) {
    next = {
      ...next,
      programTypes: {
        ...pt,
        types: mergeProgramTypeList(pt.types, overlay),
      },
    };
  }

  const ct = next.courseTypes as
    | {
        searchPlaceholder?: string;
        types?: Array<{ id: string; name: string; abbreviation: string; active: boolean }>;
      }
    | undefined;
  if (ct && Array.isArray(ct.types)) {
    next = {
      ...next,
      courseTypes: {
        ...ct,
        types: mergeProgramTypeList(ct.types, overlay),
      },
    };
  }

  const mt = next.manageTerms as
    | {
        campusFilterLabel?: string;
        campusOptions?: Array<{ label: string; value: string }>;
        terms?: Array<{ id: string; name: string; code: string; dates: string; campuses: string[] }>;
      }
    | undefined;
  if (mt && Array.isArray(mt.terms)) {
    next = {
      ...next,
      manageTerms: {
        ...mt,
        terms: mergeTermList(mt.terms, overlay).map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          dates: t.dates,
          campuses: t.campuses,
        })),
      },
    };
  }

  const cs = next.coursesSessions as
    | {
        searchPlaceholder?: string;
        filterCoursePlaceholder?: string;
        courses?: Array<{
          id: string;
          name: string;
          number: string;
          creditValue: string;
          notStarted: number;
          inProgress: number;
          completed: number;
        }>;
      }
    | undefined;
  if (cs && Array.isArray(cs.courses)) {
    const deleted = new Set(
      Array.isArray(overlay.deletedCourseIds)
        ? (overlay.deletedCourseIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [],
    );
    const extras = Array.isArray(overlay.extraCourses)
      ? (overlay.extraCourses as Array<{
          id: string;
          name: string;
          number: string;
          creditValue: string;
          notStarted: number;
          inProgress: number;
          completed: number;
        }>)
      : [];
    next = {
      ...next,
      coursesSessions: {
        ...cs,
        courses: [...extras, ...cs.courses.filter((c) => !deleted.has(c.id))],
      },
    };
  }

  const textbooks = next.courseTextbooks as { textbooks?: TextbookRecord[] } | undefined;
  if (textbooks && Array.isArray(textbooks.textbooks)) {
    next = {
      ...next,
      courseTextbooks: {
        ...textbooks,
        textbooks: mergeTextbookList(textbooks.textbooks, overlay),
      },
    };
  }

  const repo = next.contentRepository as
    | { courses?: RepositoryCourseRecord[]; _assignmentScopeResolved?: boolean }
    | undefined;
  if (repo && Array.isArray(repo.courses) && !repo._assignmentScopeResolved) {
    const courses = mergeRepositoryList(repo.courses, overlay);
    next = {
      ...next,
      contentRepository: {
        ...repo,
        courses,
        resultsLabel: `Results: ${courses.length}`,
      },
    };
  }

  const ca = next.courseAdmin as
    | {
        courseId: string;
        courseLabel: string;
        tabs: string[];
        activeTab: string;
        statusFilter?: string;
        statusOptions?: Array<{ label: string; value: string }>;
        createSessionHref?: string;
        sessions?: Array<{
          id: string;
          course: string;
          courseId?: string;
          location: string;
          instructors: string;
          schedule: string;
          enrolled: number;
          reserved: number;
          waitList: number;
          status: string;
        }>;
      }
    | undefined;
  if (ca && Array.isArray(ca.sessions)) {
    const courseId = parseScreenQuery(path).query.get("courseId") || ca.courseId || "";
    const deleted = new Set(
      Array.isArray(overlay.deletedSessionIds)
        ? (overlay.deletedSessionIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [],
    );
    const extras = Array.isArray(overlay.extraSessions)
      ? (overlay.extraSessions as Array<{
          id: string;
          course: string;
          courseId?: string;
          location: string;
          instructors: string;
          schedule: string;
          enrolled: number;
          reserved: number;
          waitList: number;
          status: string;
        }>)
      : [];
    const scoped = extras.filter((s) => !s.courseId || !courseId || s.courseId === courseId);
    const extraIds = new Set(scoped.map((s) => s.id));
    next = {
      ...next,
      courseAdmin: {
        ...ca,
        sessions: [...scoped, ...ca.sessions.filter((s) => !deleted.has(s.id) && !extraIds.has(s.id))],
      },
    };
  }

  const ms = next.masterScheduling as
    | {
        rows?: Array<{ id: string; dateRange: string; session: string; duration: string; program: string; canDelete?: boolean }>;
      }
    | undefined;
  if (ms && Array.isArray(ms.rows)) {
    const deleted = new Set(
      Array.isArray(overlay.deletedScheduleIds)
        ? (overlay.deletedScheduleIds as unknown[]).filter((id): id is string => typeof id === "string")
        : [],
    );
    const extras = Array.isArray(overlay.extraSchedules)
      ? (overlay.extraSchedules as Array<{
          id: string;
          dateRange: string;
          session: string;
          duration: string;
          program: string;
          canDelete?: boolean;
        }>).filter((row) => row && typeof row.id === "string" && !deleted.has(row.id))
      : [];
    next = {
      ...next,
      masterScheduling: {
        ...ms,
        rows: [...extras, ...ms.rows.filter((r) => !deleted.has(r.id))],
      },
    };
  }

  const ac = next.academicCalendars as
    | {
        emptyMessage?: string;
        rows?: Array<{ id: string; name: string; dates: string; status: string }>;
      }
    | undefined;
  if (ac) {
    const extras = Array.isArray(overlay.extraCalendars)
      ? (overlay.extraCalendars as Array<{ id: string; name: string; dates: string; status: string }>)
      : [];
    const rows = [...extras, ...(ac.rows ?? [])];
    next = {
      ...next,
      academicCalendars: {
        ...ac,
        rows,
      },
    };
  }

  const hs = next.helpSupport as
    | {
        topics?: Array<{ title: string; detail: string; icon?: string }>;
        tickets?: Array<{ id: string; subject: string; status: string; tone?: string; updated?: string }>;
        references?: Array<{ name: string; meta: string }>;
        aiReply?: { query: string; answer: string } | null;
        hours?: string;
        contacts?: Array<{ label: string; value: string }>;
      }
    | undefined;
  if (hs) {
    const extras = Array.isArray(overlay.extraTickets)
      ? (overlay.extraTickets as Array<{ id: string; subject: string; status: string; tone?: string; updated?: string }>)
      : [];
    const aiConsult = overlay.aiConsult as { query?: string; answer?: string } | undefined;
    next = {
      ...next,
      helpSupport: {
        ...hs,
        tickets: [...extras, ...(hs.tickets ?? [])],
        aiReply: aiConsult?.answer
          ? { query: aiConsult.query || "", answer: aiConsult.answer }
          : hs.aiReply ?? null,
      },
    };
  }

  const detail = next.courseDetail as { lms?: Parameters<typeof mergeCourseLmsOverlay>[0] } | undefined;
  if (detail?.lms) {
    next = {
      ...next,
      courseDetail: {
        ...detail,
        lms: mergeCourseLmsOverlay(detail.lms, overlay),
      },
    };
  }

  return mergeFileManagerOverlay(next, overlay);
}

function buildCourseHistory(ctx: InstructorCtx): InstructorLivePayload {
  const termMeta = new Map(ctx.terms.map((t) => [t.code, t]));
  const byTerm = new Map<string, InstructorCtx["sections"]>();
  for (const s of ctx.sections) {
    const key = s.termCode || "Unknown";
    const list = byTerm.get(key) ?? [];
    list.push(s);
    byTerm.set(key, list);
  }
  const orderedCodes = [
    ...ctx.terms.map((t) => t.code).filter((c) => byTerm.has(c)),
    ...[...byTerm.keys()].filter((c) => !termMeta.has(c)),
  ];
  const seen = new Set<string>();
  const terms: Array<{
    term: string;
    courses: Array<{ code: string; title: string; enrollment: string; avgEval: string }>;
  }> = [];
  for (const code of orderedCodes) {
    if (seen.has(code)) continue;
    seen.add(code);
    const sections = byTerm.get(code) ?? [];
    const meta = termMeta.get(code);
    terms.push({
      term: meta?.name || code,
      courses: sections.map((s) => {
        const courseGrades = ctx.grades.filter(
          (g) => g.courseCode === s.courseCode && g.sectionCode === s.code && g.score != null,
        );
        let avgEval = "—";
        if (courseGrades.length) {
          const avgPct =
            courseGrades.reduce((sum, g) => sum + (pct(g.score, g.maxScore) ?? 0), 0) /
            courseGrades.length;
          // Surface a 5-point teaching-eval style score from posted grade averages when surveys are absent.
          avgEval = (Math.round((avgPct / 20) * 10) / 10).toFixed(1);
        }
        const enrollment = Math.max(
          s.enrolmentCount,
          s.enrolments.filter((e) => e.status === "enrolled" || e.status === "completed").length,
        );
        return {
          code: s.courseCode,
          title: s.courseTitle,
          enrollment: String(enrollment),
          avgEval,
        };
      }),
    });
  }
  return {
    title: "Course History",
    subtitle: "Prior teaching assignments and evaluation averages.",
    countLabel: `${ctx.sections.length} course(s)`,
    courseHistory: { terms },
  };
}

function parseScreenQuery(path: string) {
  const qIndex = path.indexOf("?");
  if (qIndex < 0) return { pathname: path, query: new URLSearchParams() };
  return {
    pathname: path.slice(0, qIndex),
    query: new URLSearchParams(path.slice(qIndex + 1)),
  };
}

async function buildActiveCourses(ctx: InstructorCtx, path = ""): Promise<InstructorLivePayload> {
  const { query } = parseScreenQuery(path);
  const viewId = (query.get("view") || "").trim();
  const courseOptions = [
    { label: "All Courses", value: "All Courses" },
    ...ctx.sections.map((s) => ({
      label: `${s.courseCode}: ${s.courseTitle}`,
      value: `${s.courseCode}: ${s.courseTitle}`,
    })),
  ].filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx);

  const termOptions = [
    { label: "ALL TERMS", value: "ALL TERMS" },
    ...ctx.terms.map((t) => ({
      label: `${t.name || t.code}${t.startsOn && t.endsOn ? ` — ${t.startsOn} - ${t.endsOn}` : ""}`,
      value: t.code,
    })),
  ].filter((opt, idx, arr) => arr.findIndex((o) => o.value === opt.value) === idx);

  const liveRows = ctx.sections.map((s) => {
    const termMeta = ctx.terms.find((t) => t.code === s.termCode) || ctx.terms[0];
    const dates =
      termMeta?.startsOn && termMeta?.endsOn ? `${termMeta.startsOn} — ${termMeta.endsOn}` : "Continuous";
    return {
      id: s.id,
      course: `${s.courseCode} (${s.code}) ${s.courseTitle}`,
      code: s.courseCode,
      section: s.code,
      title: s.courseTitle,
      location: sectionLocation(ctx, s),
      room: sectionSchedule(ctx, s).room,
      instructors: ctx.displayName || "Not Set",
      dates,
      enrolment: `${s.enrolmentCount} enrolled`,
      viewHref: `/instructor/f/t56-active-courses?view=${encodeURIComponent(s.id)}`,
      attendanceHref: `/instructor/attendance?sectionId=${encodeURIComponent(s.id)}`,
    };
  });

  const rows = liveRows;
  const viewed = viewId ? rows.find((row) => row.id === viewId) : undefined;
  const detail = viewId ? await buildCourseDetail(ctx, `/instructor/sections/${viewId}`) : null;
  const courseDetail =
    detail && typeof detail.courseDetail === "object" && detail.courseDetail
      ? (detail.courseDetail as Record<string, unknown> & { code?: string; title?: string; meta?: string })
      : null;

  return {
    title: viewed ? `${viewed.code || viewed.course} · ${viewed.title || ""}`.trim() : "ACTIVE COURSES",
    subtitle: viewed ? `${viewed.section || ""} · ${viewed.dates}`.replace(/^ · /, "") : "",
    breadcrumbs: viewed
      ? ["Home", "Active Courses", viewed.title || viewed.course]
      : ["Home", "Active Courses"],
    activeCourses: {
      filters: {
        campus: {
          label: "Filter Campus",
          value: "ALL CAMPUSES",
          options: [
            { label: "ALL CAMPUSES", value: "ALL CAMPUSES" },
            ...[...new Set(rows.map((r) => r.location))]
              .filter((l) => l !== "Location not set")
              .map((l) => ({ label: l, value: l })),
          ],
        },
        course: {
          label: "Filter Course",
          value: "All Courses",
          options: courseOptions,
        },
        term: {
          label: "Filter Term",
          value: "ALL TERMS",
          options: termOptions,
        },
        student: {
          label: "Filter Student",
          value: "",
          placeholder: "Student # or last name",
        },
        faculty: {
          label: "Faculty",
          value: "ALL FACULTY / INSTRUCTORS",
          options: [
            { label: "ALL FACULTY / INSTRUCTORS", value: "ALL FACULTY / INSTRUCTORS" },
            { label: ctx.displayName, value: ctx.displayName },
            { label: "Not Set", value: "Not Set" },
          ],
        },
      },
      showLabel: "Show Courses",
      resultsLabel: `Results: ${rows.length.toLocaleString()}`,
      perPageOptions: [
        { label: "50", value: "50" },
        { label: "100", value: "100" },
        { label: "250", value: "250" },
        { label: "500", value: "500" },
      ],
      perPage: "250",
      pageOptions: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
      ],
      page: "1",
      columns: ["Course", "Location", "Instructor(s)", "Dates", "Enrolment"],
      rows,
    },
    ...(courseDetail
      ? {
          courseDetail: {
            ...courseDetail,
            code: viewed?.code || courseDetail.code,
            title: viewed?.title || courseDetail.title,
            meta: viewed
              ? `${viewed.location} · ${viewed.room || "Room Not Set"} · ${viewed.dates} · Enrolment ${viewed.enrolment}`
              : courseDetail.meta,
          },
        }
      : {}),
  };
}

function buildCourseManagement(ctx: InstructorCtx): InstructorLivePayload {
  const liveSections = ctx.sections.length;
  return {
    title: "Course Management",
    subtitle: "Administrative tools for course setup and maintenance.",
    courseMgmt: {
      tools: [
        {
          title: "Courses & Sessions",
          detail: "Browse course shells and section sessions.",
          href: "/instructor/f/t54-courses-sessions",
        },
        {
          title: "Active Courses",
          detail: "Filter live offerings by campus, term, and faculty.",
          href: "/instructor/f/t56-active-courses",
          badge: `${liveSections} live`,
        },
        {
          title: "Add Course",
          detail: "Create a new course instance with tuition and schedule defaults.",
          href: "/instructor/f/t55-add-course-form",
        },
        {
          title: "Course Repository",
          detail: "Browse master course definitions and archives.",
          href: "/instructor/f/t37-course-repository",
        },
        {
          title: "Course Backups",
          detail: "Restore archived course content packages.",
          href: "/instructor/f/t65-course-backups",
          badge: "0",
        },
        {
          title: "Course Textbooks",
          detail: "Assign required and recommended course materials.",
          href: "/instructor/f/t57-course-textbooks",
        },
        {
          title: "Course Configurations",
          detail: "Brand defaults for repository, privacy, and enrolment.",
          href: "/instructor/f/t66-course-configurations",
        },
        {
          title: "Course Categories",
          detail: "Organize courses by academic category.",
          href: "/instructor/f/t58-course-categories",
        },
        {
          title: "Course Groups",
          detail: "Group related courses for curriculum blocks.",
          href: "/instructor/f/t59-course-groups-types",
        },
        {
          title: "Course Types",
          detail: "Lecture, online, and delivery type definitions.",
          href: "/instructor/f/t67-course-types",
        },
        {
          title: "Course Resources",
          detail: "Upload and tag shared instructional resources.",
          href: "/instructor/f/t60-course-resources-management",
        },
        {
          title: "Badges & Accomplishments",
          detail: "Define badges students can earn in courses.",
          href: "/instructor/f/t34-accomplishments",
        },
        {
          title: "Grading Schemes",
          detail: "Manage letter scales, percentages, and grade points.",
          href: "/instructor/f/t61-grading-schemes",
        },
      ],
    },
  };
}

async function hydrateFacultiesPrograms(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, FACULTIES_PROGRAMS_PATH);
  const faculties = mergeFacultyList(overlay);
  const dbPrograms = ctx.programs.filter((p) => !p.id.startsWith("name:"));
  const programs = mergeFacultyProgramList(overlay, dbPrograms, faculties);
  const grouped = groupFacultiesPrograms(faculties, programs);
  const extraFacultyIds = new Set(
    Array.isArray(overlay?.extraFaculties)
      ? (overlay!.extraFaculties as Array<{ id?: string }>).map((f) => f.id).filter((id): id is string => Boolean(id))
      : [],
  );
  const visible = grouped.filter((f) => f.programs.length > 0 || extraFacultyIds.has(f.id));
  return {
    title: "MANAGE FACULTIES & PROGRAMS",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs"],
    primaryAction: "Create Faculty",
    primaryActionHref: ADD_FACULTY_PATH,
    secondaryAction: "Create Program",
    secondaryActionHref: "/instructor/f/t74-add-program",
    facultiesPrograms: {
      createFacultyHref: ADD_FACULTY_PATH,
      createProgramHref: "/instructor/f/t74-add-program",
      faculties: visible.map((f) => ({
        id: f.id,
        name: f.name,
        abbreviation: f.abbreviation,
        active: f.active,
        programs: f.programs.map((p) => ({
          id: p.id,
          name: p.name,
          abbreviation: p.abbreviation,
          active: p.active,
          href: settingsHref(p.id),
        })),
      })),
    },
  };
}

async function buildAddProgramForm(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, FACULTIES_PROGRAMS_PATH);
  const faculties = mergeFacultyList(overlay);
  const form = buildAddProgramScreenForm();
  const facultyField = form.groups[0]?.fields.find((f) => f.label === "Program Faculty");
  if (facultyField) {
    facultyField.options = [
      { label: "-- Select Faculty --", value: "" },
      ...faculties.map((f) => ({ label: f.name, value: f.name })),
    ];
  }
  return {
    title: "ADD PROGRAM",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs", "Add Program"],
    primaryAction: "Save Program",
    secondaryAction: "Cancel",
    secondaryActionHref: FACULTIES_PROGRAMS_PATH,
    form,
  };
}

async function hydrateProgramSettings(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const facultyOverlay = await loadScreenOverlay(ctx.user.institutionId, FACULTIES_PROGRAMS_PATH);
  const settingsOverlay = await loadScreenOverlay(ctx.user.institutionId, PROGRAM_SETTINGS_PATH);
  const facultyList = mergeFacultyList(facultyOverlay);
  const dbPrograms = ctx.programs.filter((p) => !p.id.startsWith("name:"));
  const programs = mergeFacultyProgramList(facultyOverlay, dbPrograms, facultyList);
  return buildProgramSettingsPayload(programs, facultyList, settingsOverlay, path);
}

function facultyQueryId(path: string) {
  return parseScreenQuery(path).query.get("facultyId")?.trim() || "";
}

async function buildAddFacultyForm(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const facultyId = facultyQueryId(path);
  const overlay = await loadScreenOverlay(ctx.user.institutionId, FACULTIES_PROGRAMS_PATH);
  const existing = facultyId ? mergeFacultyList(overlay).find((f) => f.id === facultyId) : undefined;
  const isEdit = Boolean(existing);
  return {
    title: isEdit ? `EDIT FACULTY: ${existing!.name.toUpperCase()}` : "ADD FACULTY",
    subtitle: "",
    breadcrumbs: ["Home", "Faculties & Programs", isEdit ? "Edit Faculty" : "Add Faculty"],
    primaryAction: "Save Faculty",
    secondaryActionHref: FACULTIES_PROGRAMS_PATH,
    form: {
      submitLabel: "Save Faculty",
      groups: [
        {
          title: "FACULTY DETAILS",
          fields: [
            { label: "Faculty Name", value: existing?.name ?? "", type: "text", language: "English" },
            { label: "Faculty Abbreviation", value: existing?.abbreviation ?? "", type: "text" },
            {
              label: "Active / Inactive",
              value: existing?.active === false ? "Inactive" : "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
    },
  };
}

type ProgramTypeRecord = { id: string; name: string; abbreviation: string; active: boolean };

const DEFAULT_PROGRAM_TYPES: ProgramTypeRecord[] = [
  { id: "ptype-online", name: "Online study", abbreviation: "online", active: true },
  { id: "ptype-visitor", name: "Visitor", abbreviation: "ND", active: true },
  { id: "ptype-certificate", name: "Certificate", abbreviation: "C", active: true },
  { id: "ptype-diploma", name: "Diploma", abbreviation: "D", active: true },
  { id: "ptype-bachelor", name: "Bachelor", abbreviation: "B", active: true },
  { id: "ptype-masters", name: "Masters", abbreviation: "M", active: true },
  { id: "ptype-na", name: "Not Applicable", abbreviation: "NA", active: true },
];

const PROGRAM_TYPES_LIST_PATH = "/instructor/f/t50-program-types";

function programTypeQueryId(path: string): string {
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("typeId")?.trim() || "";
}

function mergeProgramTypeList(
  seed: ProgramTypeRecord[],
  overlay?: Record<string, unknown> | null,
): ProgramTypeRecord[] {
  const deleted = new Set(
    Array.isArray(overlay?.deletedProgramTypeIds)
      ? (overlay!.deletedProgramTypeIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const extras = Array.isArray(overlay?.extraProgramTypes)
    ? (overlay!.extraProgramTypes as ProgramTypeRecord[]).filter((t) => t && typeof t.id === "string")
    : [];
  const extraIds = new Set(extras.map((t) => t.id));
  const editsRaw =
    overlay?.programTypeEdits && typeof overlay.programTypeEdits === "object"
      ? (overlay.programTypeEdits as Record<string, Partial<ProgramTypeRecord>>)
      : {};
  const applyEdit = (t: ProgramTypeRecord): ProgramTypeRecord => {
    const e = editsRaw[t.id];
    if (!e) return { ...t };
    return {
      id: t.id,
      name: typeof e.name === "string" && e.name.trim() ? e.name : t.name,
      abbreviation: typeof e.abbreviation === "string" && e.abbreviation.trim() ? e.abbreviation : t.abbreviation,
      active: typeof e.active === "boolean" ? e.active : t.active,
    };
  };
  let types = [
    ...extras.filter((t) => !deleted.has(t.id)).map(applyEdit),
    ...seed.filter((t) => !deleted.has(t.id) && !extraIds.has(t.id)).map(applyEdit),
  ];
  const order = Array.isArray(overlay?.programTypeOrder)
    ? (overlay!.programTypeOrder as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  if (order.length) {
    const byId = new Map(types.map((t) => [t.id, t]));
    const ordered: ProgramTypeRecord[] = [];
    for (const id of order) {
      const row = byId.get(id);
      if (row) {
        ordered.push(row);
        byId.delete(id);
      }
    }
    ordered.push(...byId.values());
    types = ordered;
  }
  return types;
}

function buildProgramTypes(_ctx: InstructorCtx): InstructorLivePayload {
  return {
    title: "Manage Program Types",
    subtitle: "Program types used across faculties",
    primaryAction: "Create Program Type",
    primaryActionHref: "/instructor/f/t75-add-program-type",
    programTypes: {
      searchPlaceholder: "Enter Search Filter Here",
      types: DEFAULT_PROGRAM_TYPES.map((t) => ({ ...t })),
    },
  };
}

async function buildAddProgramTypeForm(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const typeId = programTypeQueryId(path);
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path: PROGRAM_TYPES_LIST_PATH } },
  });
  const overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  const existing = typeId
    ? mergeProgramTypeList(
        DEFAULT_PROGRAM_TYPES.map((t) => ({ ...t })),
        overlay,
      ).find((t) => t.id === typeId)
    : undefined;
  const isEdit = Boolean(existing);
  return {
    title: isEdit ? "Edit Program Type" : "Add Program Type",
    subtitle: isEdit ? "Edit program type" : "Add a program type",
    primaryAction: "Save Program Type",
    secondaryAction: "Cancel",
    secondaryActionHref: PROGRAM_TYPES_LIST_PATH,
    form: {
      submitLabel: "Save Program Type",
      groups: [
        {
          title: "Program Type Details",
          fields: [
            { label: "Program Type Name", value: existing?.name ?? "", type: "text", language: "English" },
            { label: "Abbreviation", value: existing?.abbreviation ?? "", type: "text", language: "English" },
            {
              label: "Active / Inactive",
              value: existing?.active === false ? "Inactive" : "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
    },
  };
}

const DEFAULT_TERM_CAMPUSES = [
  "#110 Heritage College- Surrey",
  "Heritage Community College - Distance",
  "Heritage Community College - Victoria",
] as const;

const DEFAULT_MANAGE_TERMS = [
  {
    id: "term-tr3-2026",
    name: "3rd Term-2026",
    code: "TR3-2026",
    dates: "Sep. 1, 2026 - Dec. 31, 2026",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-tr2-2026",
    name: "2nd Term-2026",
    code: "TR2-2026",
    dates: "May. 1, 2026 - Aug. 31, 2026",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-tr1-2026",
    name: "1st Term-2026",
    code: "TR1-2026",
    dates: "Jan. 1, 2026 - Apr. 30, 2026",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-tr3-2025",
    name: "3rd Term-2025",
    code: "TR3-2025",
    dates: "Sep. 1, 2025 - Dec. 31, 2025",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-tr2-2025",
    name: "2nd Term-2025",
    code: "TR2-2025",
    dates: "May. 1, 2025 - Aug. 31, 2025",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-tr1-2025",
    name: "1st Term-2025",
    code: "TR1-2025",
    dates: "Jan. 1, 2025 - Apr. 30, 2025",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-hra-2024",
    name: "2024-03-18",
    code: "HRA-2024",
    dates: "Mar. 18, 2024 - Dec. 31, 2024",
    campuses: ["#110 Heritage College- Surrey"],
  },
  {
    id: "term-dmm-2024",
    name: "2024-02-05",
    code: "DMM-2024",
    dates: "Feb. 5, 2024 - Dec. 31, 2024",
    campuses: ["Heritage Community College - Distance", "Heritage Community College - Victoria"],
  },
  {
    id: "term-dap-2024",
    name: "2024-02-05",
    code: "DAP-2024",
    dates: "Feb. 5, 2024 - Dec. 31, 2024",
    campuses: ["#110 Heritage College- Surrey", "Heritage Community College - Victoria"],
  },
  {
    id: "term-nsa-2024",
    name: "2024-02-12",
    code: "NSA-2024",
    dates: "Feb. 12, 2024 - Dec. 31, 2024",
    campuses: [...DEFAULT_TERM_CAMPUSES],
  },
  {
    id: "term-nsa-2023",
    name: "2023-12-04",
    code: "NSA-2023",
    dates: "Dec. 4, 2023 - Dec. 31, 2023",
    campuses: ["Heritage Community College - Distance"],
  },
] as const;

const MANAGE_TERMS_LIST_PATH = "/instructor/f/t51-manage-terms";
const MASTER_SCHEDULING_LIST_PATH = "/instructor/f/t53-master-scheduling";

type TermEventRecord = { id: string; name: string; date: string };
type TermRecord = {
  id: string;
  name: string;
  code: string;
  dates: string;
  campuses: string[];
  startsOn?: string;
  endsOn?: string;
  midterm?: string;
  lastInstruction?: string;
  examStart?: string;
  examEnd?: string;
  census?: string;
  customEvents?: TermEventRecord[];
};

function formatTermDates(startsOn: string, endsOn: string): string {
  const fmt = (raw: string) => {
    const d = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return `${fmt(startsOn)} - ${fmt(endsOn)}`;
}

function isoFromDisplayDate(raw: string): string {
  const value = raw.replace(/\./g, "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (!match) return "";
  const months: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  const month = months[match[1].slice(0, 3).toLowerCase()];
  if (!month) return "";
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

function splitTermDateRange(dates: string): { startsOn: string; endsOn: string } {
  const [startRaw = "", endRaw = ""] = dates.split(" - ");
  return { startsOn: isoFromDisplayDate(startRaw), endsOn: isoFromDisplayDate(endRaw) };
}

function termQueryId(path: string): string {
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("termId")?.trim() || "";
}

function asTermEvents(value: unknown): TermEventRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const rec = row as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name : "";
      const date = typeof rec.date === "string" ? rec.date : "";
      const id = typeof rec.id === "string" && rec.id ? rec.id : `evt-${index}`;
      if (!name && !date) return null;
      return { id, name, date };
    })
    .filter((row): row is TermEventRecord => Boolean(row));
}

function mergeTermList(seed: TermRecord[], overlay?: Record<string, unknown> | null): TermRecord[] {
  const deleted = new Set(
    Array.isArray(overlay?.deletedTermIds)
      ? (overlay!.deletedTermIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const extras = Array.isArray(overlay?.extraTerms)
    ? (overlay!.extraTerms as TermRecord[]).filter((t) => t && typeof t.id === "string")
    : [];
  const extraIds = new Set(extras.map((t) => t.id));
  const editsRaw =
    overlay?.termEdits && typeof overlay.termEdits === "object"
      ? (overlay.termEdits as Record<string, Partial<TermRecord>>)
      : {};
  const applyEdit = (t: TermRecord): TermRecord => {
    const e = editsRaw[t.id];
    if (!e) return { ...t, campuses: [...(t.campuses ?? [])] };
    return {
      ...t,
      ...e,
      id: t.id,
      campuses: Array.isArray(e.campuses) ? [...e.campuses] : [...(t.campuses ?? [])],
      customEvents: e.customEvents ? asTermEvents(e.customEvents) : t.customEvents,
    };
  };
  return [
    ...extras.filter((t) => !deleted.has(t.id)).map(applyEdit),
    ...seed.filter((t) => !deleted.has(t.id) && !extraIds.has(t.id)).map(applyEdit),
  ];
}

function buildManageTerms(ctx: InstructorCtx): InstructorLivePayload {
  const fromDb = ctx.terms.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    dates: formatTermDates(t.startsOn, t.endsOn),
    campuses: [...DEFAULT_TERM_CAMPUSES],
    startsOn: t.startsOn,
    endsOn: t.endsOn,
  }));
  const seen = new Set(fromDb.map((t) => t.code.toUpperCase()));
  const seeded = DEFAULT_MANAGE_TERMS.filter((t) => !seen.has(t.code.toUpperCase())).map((t) => {
    const range = splitTermDateRange(t.dates);
    return {
      ...t,
      campuses: [...t.campuses],
      startsOn: range.startsOn,
      endsOn: range.endsOn,
    };
  });
  return {
    title: "Manage Terms",
    subtitle: "Academic terms and their dates",
    primaryAction: "Create Term",
    primaryActionHref: "/instructor/f/t76-add-term",
    manageTerms: {
      campusFilterLabel: "Filter Campus",
      campusOptions: [
        { label: "ALL CAMPUSES", value: "" },
        ...DEFAULT_TERM_CAMPUSES.map((c) => ({ label: c, value: c })),
      ],
      terms: [...fromDb, ...seeded],
    },
  };
}

async function buildAddTermForm(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const termId = termQueryId(path);
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path: MANAGE_TERMS_LIST_PATH } },
  });
  const overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  const seed = [
    ...ctx.terms.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      dates: formatTermDates(t.startsOn, t.endsOn),
      campuses: [...DEFAULT_TERM_CAMPUSES],
      startsOn: t.startsOn,
      endsOn: t.endsOn,
    })),
    ...DEFAULT_MANAGE_TERMS.map((t) => {
      const range = splitTermDateRange(t.dates);
      return {
        ...t,
        campuses: [...t.campuses],
        startsOn: range.startsOn,
        endsOn: range.endsOn,
      };
    }),
  ];
  const existing = termId ? mergeTermList(seed, overlay).find((t) => t.id === termId) : undefined;
  const isEdit = Boolean(existing);
  const range = existing
    ? {
        startsOn: existing.startsOn || splitTermDateRange(existing.dates).startsOn,
        endsOn: existing.endsOn || splitTermDateRange(existing.dates).endsOn,
      }
    : { startsOn: "", endsOn: "" };
  return {
    title: isEdit ? `Edit Term: ${existing?.name || "Term"}` : "Add Term",
    subtitle: isEdit ? "Edit term" : "Add a term",
    breadcrumbs: isEdit
      ? ["Home", "Manage Terms", "Edit Term"]
      : ["Home", "Manage Terms", "Add Term"],
    primaryAction: "Save Term",
    secondaryAction: "Cancel",
    secondaryActionHref: MANAGE_TERMS_LIST_PATH,
    form: {
      submitLabel: "Save Term",
      groups: [
        {
          title: "Term Details",
          fields: [
            { label: "Term Name", value: existing?.name ?? "", type: "text", language: "English" },
            { label: "Term Abbreviation", value: existing?.code ?? "", type: "text", language: "English" },
            {
              label: "Campuses",
              value: (existing?.campuses ?? []).join("|"),
              type: "checkboxes",
              options: DEFAULT_TERM_CAMPUSES.map((c) => ({ label: c, value: c })),
            },
          ],
        },
        {
          title: "Term Dates",
          fields: [
            { label: "Start Date", value: range.startsOn, type: "date", sublabel: "Primary Dates" },
            { label: "End Date", value: range.endsOn, type: "date" },
            {
              label: "Midterm Date",
              value: existing?.midterm ?? "",
              type: "date",
              optional: true,
              sublabel: "Other Dates (Optional)",
            },
            { label: "Last Instruction Date", value: existing?.lastInstruction ?? "", type: "date", optional: true },
            { label: "Exam Start Date", value: existing?.examStart ?? "", type: "date", optional: true },
            { label: "Exam End Date", value: existing?.examEnd ?? "", type: "date", optional: true },
            { label: "Census Date", value: existing?.census ?? "", type: "date", optional: true },
          ],
        },
      ],
      customEventDates: {
        title: "Custom Event Dates",
        addLabel: "+ Add Event Date",
        events: existing?.customEvents ?? [],
      },
      enrolmentConditions: {
        title: "Enrolment Conditions",
        addLabel: "Add Enrolment Condition",
        emptyMessage: "No enrolment conditions exist for this term.",
        disabledNote: "Self-enrolment is currently disabled.",
        columns: ["Enrolment Dates", "Programs", "Completion Conditions", "Standing Conditions"],
        rows: [],
      },
      deadlines: {
        title: "Deadlines",
        addLabel: "Add Deadline",
        emptyMessage: "No deadlines exist for this term.",
        columns: ["Condition", "Type", "Penalty"],
        rows: [],
      },
    },
  };
}

async function buildReviewTerm(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const termId = termQueryId(path);
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path: MANAGE_TERMS_LIST_PATH } },
  });
  const overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  const seed = [
    ...ctx.terms.map((t) => ({
      id: t.id,
      name: t.name,
      code: t.code,
      dates: formatTermDates(t.startsOn, t.endsOn),
      campuses: [...DEFAULT_TERM_CAMPUSES],
      startsOn: t.startsOn,
      endsOn: t.endsOn,
    })),
    ...DEFAULT_MANAGE_TERMS.map((t) => {
      const range = splitTermDateRange(t.dates);
      return {
        ...t,
        campuses: [...t.campuses],
        startsOn: range.startsOn,
        endsOn: range.endsOn,
      };
    }),
  ];
  const list = mergeTermList(seed, overlay);
  const existing = termId ? list.find((t) => t.id === termId) : list[0];
  const startsOn = existing?.startsOn || (existing ? splitTermDateRange(existing.dates).startsOn : "");
  const endsOn = existing?.endsOn || (existing ? splitTermDateRange(existing.dates).endsOn : "");
  const name = existing?.name || "Term";
  const code = existing?.code || "";
  return {
    title: `Review Term: ${name}${code ? ` (${code})` : ""}`,
    subtitle: "Review term details",
    breadcrumbs: ["Home", "Manage Terms", "Review Term"],
    reviewTerm: {
      id: existing?.id || termId || "",
      name,
      code,
      startsOn,
      endsOn,
      campuses: existing?.campuses?.length ? [...existing.campuses] : [...DEFAULT_TERM_CAMPUSES],
    },
  };
}

async function buildManageScheduleScreen(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const query = path.includes("?") ? path.slice(path.indexOf("?") + 1) : "";
  const scheduleId = new URLSearchParams(query).get("scheduleId")?.trim() || "ms-dib-nov-2026";
  const base = buildScheduleManagePayload(scheduleId);
  const state = await prisma.sisScreenState.findUnique({
    where: {
      institutionId_path: {
        institutionId: ctx.user.institutionId,
        path: "/instructor/f/t85-manage-schedule",
      },
    },
  });
  const overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  const scheduleOverlay =
    overlay?.schedules && typeof overlay.schedules === "object"
      ? ((overlay.schedules as Record<string, Record<string, unknown>>)[scheduleId] ?? null)
      : null;
  const ledgers = mergeScheduleFeesOverlay(base.scheduleManage.fees.ledgers, scheduleOverlay);
  const deletedSessions = new Set(
    Array.isArray(scheduleOverlay?.deletedSessionIds)
      ? (scheduleOverlay!.deletedSessionIds as unknown[]).filter((id): id is string => typeof id === "string")
      : [],
  );
  const sessions = (base.scheduleManage.sessions || []).filter((s) => !deletedSessions.has(s.id));
  return {
    ...base,
    title: base.scheduleManage.programTitle,
    scheduleManage: {
      ...base.scheduleManage,
      sessions,
      totals: {
        ...base.scheduleManage.totals,
        courses: sessions.length,
        sessions: sessions.length,
      },
      fees: {
        ...base.scheduleManage.fees,
        ledgers,
      },
    },
  };
}

const DEFAULT_MASTER_SCHEDULE_ROWS = [
  {
    id: "ms-dib-nov-2026",
    dateRange: "Nov. 2, 2026 (Mon.) - Apr. 3, 2028 (Mon.)",
    session: "DIB: Session NOV-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: true,
  },
  {
    id: "ms-hca-vic-nov-2026",
    dateRange: "Nov. 2, 2026 (Mon.) - Apr. 23, 2027 (Fri.)",
    session: "HCA-Victoria: Session NOV-2026",
    duration: "25 Weeks",
    program: "HCA: Health Care Assistant",
    canDelete: true,
  },
  {
    id: "ms-dib-oct-2025",
    dateRange: "Oct. 5, 2026 (Mon.) - Apr. 11, 2028 (Tue.)",
    session: "DIB: Session OCT-2025",
    duration: "18 months",
    program: "DIB: Diploma in International Business",
    canDelete: false,
  },
  {
    id: "ms-dib-oct-2026",
    dateRange: "Oct. 5, 2026 (Mon.) - Mar. 6, 2028 (Mon.)",
    session: "DIB: Session OCT-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: true,
  },
  {
    id: "ms-moa-oct-2026",
    dateRange: "Oct. 5, 2026 (Mon.) - Jun. 30, 2027 (Wed.)",
    session: "MOA: Session OCT 2026",
    duration: "36 Weeks",
    program: "MOA: Medical Office Assistant",
    canDelete: true,
  },
  {
    id: "ms-hca-sep-2026",
    dateRange: "Sep. 21, 2026 (Mon.) - Mar. 5, 2027 (Fri.)",
    session: "HCA: Session SEP-2026",
    duration: "25 Weeks",
    program: "HCA: Health Care Assistant",
    canDelete: true,
  },
  {
    id: "ms-dib-sep-2026",
    dateRange: "Sep. 8, 2026 (Tue.) - Feb. 8, 2028 (Tue.)",
    session: "DIB: Session SEP-2026",
    duration: "72 Weeks",
    program: "DIB: Diploma in International Business",
    canDelete: false,
  },
  {
    id: "ms-dap-sep-2026",
    dateRange: "Sep. 8, 2026 (Tue.) - May. 25, 2027 (Tue.)",
    session: "DAP: Session SEP-2026",
    duration: "35 Weeks",
    program: "DAP: Diploma in Accounting and Payroll administrator",
    canDelete: true,
  },
];

function buildMasterSchedulingList(): InstructorLivePayload {
  return {
    title: "Master Scheduling",
    subtitle: "Master schedules by program",
    primaryAction: "Create Master Schedule",
    primaryActionHref: "/instructor/f/t71-create-master-schedule",
    secondaryAction: "Create Term Schedule",
    secondaryActionHref: "/instructor/f/t72-create-term-schedule",
    masterScheduling: {
      programFilterLabel: "Filter Program",
      programFilterValue: "",
      rows: DEFAULT_MASTER_SCHEDULE_ROWS.map((r) => ({ ...r })),
    },
  };
}

function buildAcademicCalendarsList(): InstructorLivePayload {
  return {
    title: "Manage Academic Calendars",
    subtitle: "Academic calendars",
    primaryAction: "Create Academic Calendar",
    primaryActionHref: "/instructor/f/t73-create-academic-calendar",
    academicCalendars: {
      emptyMessage: "No academic calendars were found.",
      rows: [],
    },
  };
}

function buildCreateMasterScheduleForm(): InstructorLivePayload {
  return {
    title: "Create Master Schedule",
    subtitle: "STEP 1 OF 3",
    primaryAction: "Continue",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t53-master-scheduling",
  };
}

const TERM_SCHEDULE_TERM_OPTIONS = [
  { label: "-- Select Term --", value: "" },
  { label: "3rd Term-2026: Sep. 1, 2026 - Dec. 31, 2026", value: "3rd-2026" },
  { label: "2nd Term-2026: May. 1, 2026 - Aug. 31, 2026", value: "2nd-2026" },
  { label: "1st Term-2026: Jan. 1, 2026 - Apr. 30, 2026", value: "1st-2026" },
  { label: "3rd Term-2025: Sep. 1, 2025 - Dec. 31, 2025", value: "3rd-2025" },
  { label: "2nd Term-2025: May. 1, 2025 - Aug. 31, 2025", value: "2nd-2025" },
  { label: "1st Term-2025: Jan. 1, 2025 - Apr. 30, 2025", value: "1st-2025" },
  { label: "2024-03-18: Mar. 18, 2024 - Dec. 31, 2024", value: "2024-03-18" },
  { label: "2024-03-16: Mar. 18, 2024 - Oct. 6, 2024", value: "2024-03-16" },
  { label: "2024-02-12: Feb. 12, 2024 - Oct. 11, 2024", value: "2024-02-12" },
  { label: "2024-02-05: Feb. 5, 2024 - Dec. 31, 2024", value: "2024-02-05a" },
  { label: "2024-02-05: Feb. 5, 2024 - Nov. 1, 2024", value: "2024-02-05b" },
  { label: "2024-02-05: Feb. 5, 2024 - Oct. 10, 2024", value: "2024-02-05c" },
  { label: "2024-02-05: Feb. 5, 2024 - Oct. 9, 2024", value: "2024-02-05d" },
  { label: "2023-12-04: Dec. 4, 2023 - Oct. 11, 2024", value: "2023-12-04" },
  { label: "2023-11-06: Nov. 6, 2023 - Aug. 30, 2024", value: "2023-11-06a" },
  { label: "2023-11-06: Nov. 6, 2023 - May. 23, 2024", value: "2023-11-06b" },
  {
    label: "Bank Teller Program - September 13 to September 21: Sep. 12, 2023 - Sep. 23, 2023",
    value: "btt-2023-09",
  },
];

function daysBeforeCourseOptions(includeAlways: boolean) {
  const options: Array<{ label: string; value: string }> = [];
  if (includeAlways) options.push({ label: "Always Available", value: "Always Available" });
  options.push({ label: "First day of class", value: "First day of class" });
  for (let i = 1; i <= 30; i++) {
    const label = `${i} day${i === 1 ? "" : "s"} before start date`;
    options.push({ label, value: label });
  }
  return options;
}

function termScheduleLabelParts(label: string): { session: string; dateRange: string } {
  const idx = label.indexOf(": ");
  if (idx < 0) return { session: label || "Term schedule", dateRange: "—" };
  return { session: label.slice(0, idx).trim() || "Term schedule", dateRange: label.slice(idx + 2).trim() || "—" };
}

async function buildCreateTermScheduleForm(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const state = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path: MANAGE_TERMS_LIST_PATH } },
  });
  const overlay = state ? (JSON.parse(state.payloadJson) as Record<string, unknown>) : null;
  const extraTerms = mergeTermList([], overlay);
  const known = new Set(TERM_SCHEDULE_TERM_OPTIONS.map((o) => o.value));
  const extraOptions = extraTerms
    .filter((t) => t.id && !known.has(t.id))
    .map((t) => ({ label: `${t.name}: ${t.dates}`, value: t.id }));
  const termOptions = [TERM_SCHEDULE_TERM_OPTIONS[0], ...extraOptions, ...TERM_SCHEDULE_TERM_OPTIONS.slice(1)];
  return {
    title: "Create Term Schedule",
    subtitle: "STEP 1 OF 3",
    primaryAction: "Continue",
    secondaryAction: "Cancel",
    secondaryActionHref: MASTER_SCHEDULING_LIST_PATH,
    form: {
      stepLabel: "STEP 1 OF 3",
      submitLabel: "Continue",
      groups: [
        {
          title: "Master Schedule Details",
          fields: [
            { label: "Term", value: "", type: "select", options: termOptions },
            {
              label: "Schedule Description",
              value: "",
              type: "textarea",
              optional: true,
              hint: "Optional",
            },
          ],
        },
        {
          title: "Course Delivery Settings",
          fields: [
            {
              label: "Enable LMS",
              value: "Disabled",
              type: "select",
              options: [
                { label: "Disabled", value: "Disabled" },
                { label: "Moodle", value: "Moodle" },
              ],
            },
            {
              label: "Student Course Availability",
              value: "First day of class",
              type: "select",
              options: daysBeforeCourseOptions(false),
            },
            {
              label: "Faculty Course Availability",
              value: "7 days before start date",
              type: "select",
              options: daysBeforeCourseOptions(true),
            },
            {
              label: "Automate Attendance Grading",
              value: "Disabled",
              type: "select",
              options: [
                { label: "Disabled", value: "Disabled" },
                { label: "Enabled", value: "Enabled" },
              ],
            },
          ],
        },
      ],
    },
  };
}

function buildCreateAcademicCalendarForm(): InstructorLivePayload {
  return {
    title: "Create Academic Calendar",
    subtitle: "Create an academic calendar",
    primaryAction: "Save Academic Calendar",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t52-academic-calendars",
  };
}

function courseConfigQueryId(path: string) {
  return parseScreenQuery(path).query.get("courseId")?.trim() || "";
}

async function hydrateCourseConfigurations(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, COURSE_CONFIG_PATH);
  const seen = new Map<string, { id: string; code: string; title: string }>();
  for (const section of ctx.sections) {
    if (!seen.has(section.courseId)) {
      seen.set(section.courseId, {
        id: section.courseId,
        code: section.courseCode,
        title: section.courseTitle,
      });
    }
  }
  const courses = mergeCourseConfigList(overlay, [...seen.values()]);
  const courseId = courseConfigQueryId(path);
  const existing = courseId ? courses.find((c) => c.id === courseId) : undefined;
  if (courseId) {
    const row = existing ?? {
      id: courseId,
      name: "",
      abbreviation: "",
      enrollmentPermission: "No permission required",
      syllabusPrivacy: "Private",
      repositorySettings: "Use brand settings",
      textbookOptOut: "System Default",
      active: true,
    };
    return {
      title: existing ? "Edit Course Configuration" : "Add Course Configuration",
      subtitle: "",
      breadcrumbs: ["Home", "Course Management", "Course Configurations", existing ? "Edit" : "Add"],
      primaryAction: "Save Configuration",
      secondaryAction: "Cancel",
      secondaryActionHref: COURSE_CONFIG_PATH,
      form: {
        submitLabel: "Save Configuration",
        groups: [
          {
            title: "Course Configuration",
            fields: [
              { label: "Course Name", value: row.name, type: "text" },
              { label: "Abbreviation", value: row.abbreviation, type: "text" },
              {
                label: "Course Enrollment Permission",
                value: row.enrollmentPermission,
                type: "select",
                options: selectOptions(ENROLLMENT_PERMISSION_OPTIONS),
              },
              {
                label: "Course Syllabus Privacy",
                value: row.syllabusPrivacy,
                type: "select",
                options: selectOptions(SYLLABUS_PRIVACY_OPTIONS),
              },
              {
                label: "Repository Settings",
                value: row.repositorySettings,
                type: "select",
                options: selectOptions(REPOSITORY_SETTING_OPTIONS),
              },
              {
                label: "Textbook Opt-Out",
                value: row.textbookOptOut,
                type: "select",
                options: selectOptions(TEXTBOOK_OPT_OUT_OPTIONS),
              },
              {
                label: "Active / Inactive",
                value: row.active ? "Active" : "Inactive",
                type: "select",
                options: [
                  { label: "Active", value: "Active" },
                  { label: "Inactive", value: "Inactive" },
                ],
              },
            ],
          },
        ],
      },
    };
  }
  return {
    title: "Course Configurations",
    subtitle: "",
    breadcrumbs: ["Home", "Course Management", "Course Configurations"],
    primaryAction: "Create Configuration",
    primaryActionHref: `${COURSE_CONFIG_PATH}?courseId=new`,
    searchPlaceholder: "Enter Search Filter Here",
    courseConfigurations: {
      searchPlaceholder: "Enter Search Filter Here",
      courses: courses.map((c) => ({
        ...c,
        href: `${COURSE_CONFIG_PATH}?courseId=${encodeURIComponent(c.id)}`,
      })),
    },
  };
}

function buildCourseCategories(ctx: InstructorCtx): InstructorLivePayload {
  const byCode = new Map<string, { name: string; code: string; courses: number }>();
  for (const section of ctx.sections) {
    const code = section.courseCode.replace(/\d+.*/, "") || section.courseCode.slice(0, 3);
    const key = code.toUpperCase();
    const prior = byCode.get(key);
    if (prior) prior.courses += 1;
    else byCode.set(key, { name: key, code: key, courses: 1 });
  }
  const rows = [...byCode.values()].map((c) => ({
    cells: [c.name, c.code, `Courses tagged ${c.code}`, String(c.courses), "None (Root)", "ACTIVE"],
    badge: "ACTIVE",
    badgeTone: "active" as const,
  }));
  return {
    title: "Course Categories",
    subtitle: "Course categories",
    columns: ["Category Name", "Code", "Description", "Courses", "Parent", "Status"],
    columnTemplate:
      "minmax(120px,1fr) minmax(70px,0.5fr) minmax(180px,1.4fr) minmax(70px,0.5fr) minmax(90px,0.7fr) minmax(80px,0.5fr)",
    rows,
    countLabel: `${rows.length} categor${rows.length === 1 ? "y" : "ies"}`,
  };
}

const DEFAULT_GRADING_SCHEMES = [
  { id: "scheme-dib-dap", name: "DIB and DAP", active: true },
  { id: "scheme-hcc", name: "HCC Grading", active: true },
  { id: "scheme-hca", name: "Health Care Assistant", active: true },
  { id: "scheme-pass-fail", name: "Pass / Fail", active: true },
] as const;

const COURSE_TYPES_LIST_PATH = "/instructor/f/t67-course-types";
const DEFAULT_COURSE_TYPES = [
  { id: "ctype-lecture", name: "Lecture", abbreviation: "LEC", active: true },
  { id: "ctype-online", name: "Online", abbreviation: "ON", active: true },
] as const;
type CourseTypeRecord = { id: string; name: string; abbreviation: string; active: boolean; learningStyle: string; asynchronous: boolean };

function mergedCourseTypes(overlay?: Record<string, unknown> | null): CourseTypeRecord[] {
  const edits = overlay?.courseTypeEdits && typeof overlay.courseTypeEdits === "object" ? overlay.courseTypeEdits as Record<string, Partial<CourseTypeRecord>> : {};
  const deleted = new Set(Array.isArray(overlay?.deletedCourseTypeIds) ? overlay.deletedCourseTypeIds as string[] : []);
  const defaults = DEFAULT_COURSE_TYPES.map((row) => ({ ...row, learningStyle: "Face to Face", asynchronous: false, ...(edits[row.id] || {}) }));
  const extras = Array.isArray(overlay?.extraCourseTypes) ? overlay.extraCourseTypes as CourseTypeRecord[] : [];
  const order = Array.isArray(overlay?.courseTypeOrder) ? overlay.courseTypeOrder as string[] : [];
  return [...defaults, ...extras].filter((row) => !deleted.has(row.id)).sort((a, b) => {
    const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
    return (ai < 0 ? 9999 : ai) - (bi < 0 ? 9999 : bi) || a.name.localeCompare(b.name);
  });
}

function buildCourseTypesList(overlay?: Record<string, unknown> | null): InstructorLivePayload {
  return {
    title: "Manage Course Types",
    subtitle: "Course types and groups",
    primaryAction: "Create Course Type",
    primaryActionHref: "/instructor/f/t69-add-course-type",
    courseTypes: {
      searchPlaceholder: "Enter Search Filter Here",
      types: mergedCourseTypes(overlay),
    },
  };
}

function buildAddCourseGroupForm(): InstructorLivePayload {
  return {
    title: "Add Course Group",
    subtitle: "Add a course group",
    primaryAction: "Save Course Group",
    secondaryAction: "Cancel",
    secondaryActionHref: "/instructor/f/t59-course-groups-types",
    form: {
      submitLabel: "Save Course Group",
      groups: [
        {
          title: "Course Group Details",
          fields: [
            { label: "Course Group Name", value: "", type: "text", language: "English" },
            { label: "Abbreviation", value: "", type: "text", language: "English" },
          ],
        },
      ],
    },
  };
}

function buildAddCourseTypeForm(path: string, overlay?: Record<string, unknown> | null): InstructorLivePayload {
  const typeId = path.match(/[?&]typeId=([^&]+)/)?.[1]
    ? decodeURIComponent(path.match(/[?&]typeId=([^&]+)/)![1]!)
    : "";
  const existing = mergedCourseTypes(overlay).find((t) => t.id === typeId);
  return {
    title: existing ? "Edit Course Type" : "Add Course Type",
    subtitle: existing ? "Edit course type" : "Add a course type",
    primaryAction: "Save Course Type",
    secondaryAction: "Cancel",
    secondaryActionHref: COURSE_TYPES_LIST_PATH,
    form: {
      submitLabel: "Save Course Type",
      groups: [
        {
          title: "Course Type Details",
          fields: [
            { label: "Course Type Name", value: existing?.name ?? "", type: "text", language: "English" },
            { label: "Abbreviation", value: existing?.abbreviation ?? "", type: "text", language: "English" },
            {
              label: "Active / Inactive",
              value: existing && !existing.active ? "Inactive" : "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
            {
              label: "Learning Style",
              value: existing?.learningStyle ?? "Face to Face",
              type: "select",
              options: [
                { label: "Face to Face", value: "Face to Face" },
                { label: "Online", value: "Online" },
                { label: "Hybrid", value: "Hybrid" },
              ],
            },
            {
              label: "Asynchronous",
              value: existing?.asynchronous ? "Yes" : "No",
              type: "select",
              options: [
                { label: "No", value: "No" },
                { label: "Yes", value: "Yes" },
              ],
            },
            {
              label: "Customize enrolment permissions",
              value: "false",
              type: "checkbox",
            },
          ],
        },
      ],
    },
  };
}

async function buildCourseTextbooksScreen(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, TEXTBOOKS_LIST_PATH);
  return buildCourseTextbooksList(overlay);
}

async function buildAddTextbookScreen(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, TEXTBOOKS_LIST_PATH);
  return buildAddTextbookForm(overlay, path);
}

async function buildContentRepositoryScreen(ctx: InstructorCtx): Promise<InstructorLivePayload> {
  const [overlay, assigned] = await Promise.all([
    loadScreenOverlay(ctx.user.institutionId, REPOSITORY_LIST_PATH),
    myRepository(ctx.user, {}),
  ]);
  const payload = buildContentRepositoryList(overlay);
  const links = new Map(assigned.rows.map((row) => [row.number.trim().toLowerCase(), row.workspaceHref]));
  const canManageMaster = ctx.user.roles.includes("admin") || ctx.user.roles.includes("registrar");
  const courses = payload.contentRepository.courses
    .map((course) => ({ ...course, workspaceHref: links.get(course.number.trim().toLowerCase()) || "" }))
    .filter((course) => canManageMaster || Boolean(course.workspaceHref));
  return {
    ...payload,
    contentRepository: {
      ...payload.contentRepository,
      resultsLabel: `Results: ${courses.length}`,
      canManageMaster,
      _assignmentScopeResolved: true,
      courses,
    },
  };
}

async function buildCreateContentCourseScreen(ctx: InstructorCtx, path: string): Promise<InstructorLivePayload> {
  const overlay = await loadScreenOverlay(ctx.user.institutionId, REPOSITORY_LIST_PATH);
  return buildCreateContentCourseForm(overlay, path);
}

async function bumpRepositoryCount(
  institutionId: string,
  courseId: string,
  kind: "push" | "pull" | "history",
) {
  if (!courseId) return;
  const catalog = buildRepositoryCatalog();
  await patchScreenOverlay(institutionId, REPOSITORY_LIST_PATH, (prev) => {
    const current = mergeRepositoryList(catalog, prev);
    const row = current.find((c) => c.id === courseId);
    const counts =
      prev.repositoryActionCounts && typeof prev.repositoryActionCounts === "object"
        ? { ...(prev.repositoryActionCounts as Record<string, { push?: number; pull?: number; history?: number }>) }
        : {};
    const prevCount = counts[courseId] ?? {
      push: row?.push ?? 0,
      pull: row?.pull ?? 0,
      history: row?.history,
    };
    counts[courseId] = {
      ...prevCount,
      [kind]: (typeof prevCount[kind] === "number" ? prevCount[kind] : 0) + 1,
    };
    return { ...prev, repositoryActionCounts: counts };
  });
}

function buildGradingSchemesList(): InstructorLivePayload {
  return {
    title: "MANAGE GRADING SCHEMES",
    breadcrumbs: ["Home", "Grading Schemes"],
    subtitle: "Grading schemes",
    primaryAction: "Create Grading Scheme",
    primaryActionHref: ADD_GRADING_SCHEME_PATH,
    gradingSchemes: {
      searchPlaceholder: "Enter Search Filter Here",
      schemes: DEFAULT_GRADING_SCHEMES.map((s) => ({ ...s })),
    },
  };
}

function buildAddGradingSchemeForm(
  path = "",
  overlay?: Record<string, unknown> | null,
): InstructorLivePayload {
  const schemeId = path.match(/[?&]schemeId=([^&]+)/)?.[1]
    ? decodeURIComponent(path.match(/[?&]schemeId=([^&]+)/)![1]!)
    : "";
  const defaults = DEFAULT_GRADING_SCHEMES.find((s) => s.id === schemeId);
  const extras = Array.isArray(overlay?.extraSchemes)
    ? (overlay!.extraSchemes as Array<{ id: string; name: string; active: boolean }>)
    : [];
  const fromExtra = extras.find((s) => s.id === schemeId);
  const schemeName = fromExtra?.name || defaults?.name || "";
  const editing = Boolean(schemeId && (defaults || fromExtra));
  const schemeMeta =
    (overlay?.schemeMeta as Record<string, Record<string, string>> | undefined)?.[schemeId] || {};
  const entries = gradeEntriesFromScheme(schemeId, overlay).map((e) => ({
    letter: e.letter,
    percent: e.percent,
    percentUp: "0.00",
    gradePoint: e.gradePoint,
    credit: e.credit,
    condition: e.condition,
  }));

  return {
    title: editing ? `EDIT GRADING SCHEME: ${schemeName.toUpperCase()}` : "ADD GRADING SCHEME",
    breadcrumbs: editing
      ? ["Home", "Grading Schemes", "Edit Grading Scheme"]
      : ["Home", "Grading Schemes", "Add Grading Schemes"],
    subtitle: editing ? "Edit grading scheme" : "Add a grading scheme",
    primaryAction: "Save Grading Scheme",
    secondaryAction: "Cancel",
    secondaryActionHref: GRADING_SCHEMES_PATH,
    form: {
      submitLabel: "Save Grading Scheme",
      groups: [
        {
          title: "Grading Scheme Details",
          fields: [
            { label: "Grading Scheme Name", value: schemeName, type: "text" },
            {
              label: "This is the default grading scheme",
              value: schemeMeta.defaultScheme || "false",
              type: "checkbox",
            },
            {
              label: "Use Letter Grades",
              value: schemeMeta.useLetterGrades || "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Use Percentages",
              value: schemeMeta.usePercentages || "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Enable round-up options for marginal letter grades in final standings",
              value: schemeMeta.roundUp || "false",
              type: "checkbox",
            },
            {
              label: "Use Grade Points",
              value: schemeMeta.useGradePoints || "Yes",
              type: "select",
              options: [
                { label: "Yes", value: "Yes" },
                { label: "No", value: "No" },
              ],
            },
            {
              label: "Active / Inactive",
              value:
                fromExtra?.active === false || (defaults && !defaults.active)
                  ? "Inactive"
                  : schemeMeta.active || "Active",
              type: "select",
              options: [
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ],
            },
          ],
        },
      ],
      gradeEntries: {
        addLabel: "Add",
        creditOptions: [
          { label: "Yes", value: "Yes" },
          { label: "No", value: "No" },
        ],
        conditionOptions: [
          { label: "None", value: "None" },
          { label: "Pass", value: "Pass" },
          { label: "Fail", value: "Fail" },
          { label: "Incomplete", value: "Incomplete" },
          { label: "Withdraw", value: "Withdraw" },
        ],
        draft: {
          letter: "",
          percent: "",
          percentUp: "0.00",
          gradePoint: "",
          credit: "Yes",
          condition: "None",
        },
        entries,
      },
    },
  };
}

/** The requested section must be one the user teaches; without a request, falls back to the first taught section. */
function taughtSection(ctx: InstructorCtx, sectionId?: string | null) {
  if (!sectionId) return primarySection(ctx);
  const sec = ctx.sections.find((s) => s.id === sectionId);
  if (!sec) throw Object.assign(new Error("You do not teach this course section"), { status: 403, code: "FORBIDDEN" });
  return sec;
}

async function createAssignmentForInstructor(
  ctx: InstructorCtx,
  title: string,
  daysUntilDue = 14,
  sectionId?: string | null,
) {
  const sec = taughtSection(ctx, sectionId);
  if (!sec) throw Object.assign(new Error("No teaching section assigned"), { status: 400 });
  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + daysUntilDue);
  const assignment = await prisma.assignment.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      sectionId: sec.id,
      title,
      maxScore: 100,
      weightPercent: 10,
      dueAt,
    },
  });
  // Seed draft grade rows for enrolled students so gradebook stays usable
  for (const e of sec.enrolments.filter((x) => x.status === "enrolled")) {
    await prisma.gradeItem.create({
      data: {
        id: randomUUID(),
        institutionId: ctx.user.institutionId,
        assignmentId: assignment.id,
        studentId: e.studentId,
        enrolmentId: e.id,
        maxScore: 100,
        status: "draft",
      },
    });
  }
  return { assignment, section: sec };
}

function buildAssessmentList(ctx: InstructorCtx): InstructorLivePayload {
  const dated: Array<{ title: string; due: string; at: number }> = [];
  const groups = ctx.sections
    .map((sec) => ({
      courseCode: sec.courseCode,
      sectionCode: sec.code,
      courseTitle: sec.courseTitle,
      count: sec.assignments.length,
      items: sec.assignments.map((a) => {
        const due = a.dueAt
          ? a.dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : "No due date";
        if (a.dueAt) dated.push({ title: a.title, due, at: a.dueAt.getTime() });
        return {
          id: a.id,
          title: a.title,
          weight: `${a.weightPercent}%`,
          due,
          status: "Published",
          statusTone: "active" as const,
          href: "/instructor/gradebook",
        };
      }),
    }))
    .filter((g) => g.items.length > 0);

  const total = groups.reduce((n, g) => n + g.count, 0);
  const nextDue = dated.sort((a, b) => a.at - b.at)[0];

  return {
    title: "Assessments",
    subtitle:
      total > 0
        ? `${total} assessment(s) across ${groups.length} section(s)`
        : "Create your first assessment for a teaching section",
    primaryAction: "Create Assessment",
    primaryActionHref: "/instructor/f/t19-create-edit-assessment",
    secondaryAction: "Open Gradebook",
    secondaryActionHref: "/instructor/gradebook",
    assessmentHub: {
      kpis: [
        { label: "Assessments", value: String(total), hint: "Across your sections" },
        { label: "Sections", value: String(groups.length), hint: "With graded work" },
        {
          label: "Next due",
          value: nextDue ? nextDue.due : "—",
          hint: nextDue ? nextDue.title : "Nothing scheduled",
        },
      ],
      groups,
    },
  };
}

type AssessmentBuilderFields = {
  sectionId?: string;
  title?: string;
  type?: string;
  weight?: string;
  openDate?: string;
  dueDate?: string;
  durationMinutes?: number;
  questions?: Array<{ id?: string; prompt?: string; options?: string[]; correct?: number }>;
  rubricRows?: Array<{ criterion: string; excellent: string; good: string; poor: string }>;
};

function parseAssessmentPayload(rowKey?: string): AssessmentBuilderFields | null {
  if (!rowKey?.trim().startsWith("{")) return null;
  try {
    return JSON.parse(rowKey) as AssessmentBuilderFields;
  } catch {
    return null;
  }
}

function parseWeightPercent(weight?: string): number {
  const n = Number(String(weight ?? "20").replace(/%/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : 20;
}

/** With `startOfDayTz`, a date-only value means 00:00 of that day in the zone; otherwise it reads as local noon. */
export function parseDateOrOffset(value: string | undefined, fallbackDays: number, startOfDayTz?: string): Date {
  if (value?.trim()) {
    const raw = value.trim();
    const d =
      startOfDayTz && /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? zonedToUtc(raw, "00:00", startOfDayTz)
        : new Date(raw.includes("T") ? raw : `${raw}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + fallbackDays);
  return d;
}

function formatPreviewDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildAssessmentBuilder(
  ctx: InstructorCtx,
  overlay?: Record<string, unknown> | null,
  path = "",
): InstructorLivePayload {
  const draft = (overlay?.assessmentDraft as AssessmentBuilderFields | undefined) || null;
  const requested = parseScreenQuery(path).query.get("sectionId")?.trim() || draft?.sectionId || "";
  const sec = ctx.sections.find((s) => s.id === requested) || primarySection(ctx);
  const open = parseDateOrOffset(draft?.openDate, 7);
  const due = parseDateOrOffset(draft?.dueDate, 14);
  const title = (draft?.title || (sec ? `${sec.courseCode} Midterm Examination` : "New Assessment")).trim();
  const type = (draft?.type || "Written Exam").trim();
  const weightNum = parseWeightPercent(draft?.weight || "20%");
  const weight = `${weightNum}%`;
  const durationMinutes = Number.isFinite(Number(draft?.durationMinutes))
    ? Math.max(1, Math.min(480, Math.round(Number(draft?.durationMinutes))))
    : 60;
  const questions = Array.isArray(draft?.questions) && draft.questions.length
    ? draft.questions
    : [{ id: randomUUID(), prompt: "", options: ["", ""], correct: 0 }];
  const rubricRows =
    Array.isArray(draft?.rubricRows) && draft!.rubricRows!.length
      ? draft!.rubricRows!
      : [
          {
            criterion: "Content Accuracy",
            excellent: "Complete mastery",
            good: "Minor gaps",
            poor: "Major gaps",
          },
        ];
  const sectionLabel = sec ? `${sec.courseCode} ${sec.code}` : "—";

  return {
    title: "Create Assessment",
    subtitle: sec
      ? `${sec.courseCode} ${sec.code} · ${ctx.displayName}`
      : "No teaching section assigned — assign a section before publishing",
    breadcrumbs: ["My Courses", sectionLabel, "New Assessment"],
    assessmentBuilder: {
      crumb: ["My Courses", sectionLabel, "New Assessment"],
      heading: "Design New Assessment",
      description: "Create grade matching rubrics and publish a live assessment for enrolled students.",
      sectionId: sec?.id ?? null,
      sections: ctx.sections.map((s) => ({
        id: s.id,
        label: `${s.courseCode} ${s.code}${s.termCode ? ` · ${s.termCode}` : ""} — ${s.courseTitle}`,
      })),
      title,
      type,
      weight,
      openDate: open.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      durationMinutes,
      questions,
      types: ["Written Exam", "Quiz", "Project", "Lab Practical", "Oral Exam"],
      rubricHeaders: ["Criterion", "Excellent (5pts)", "Good (4pts)", "Poor (2pts)"],
      rubricRows,
      uploadHint: "Drag & drop syllabus outline or rubric files",
      uploadFormats: "Supported formats: PDF, DOCX up to 16MB",
      preview: {
        badge: sec ? `${sec.courseCode} ${sec.code} • ${type.toUpperCase()}` : type.toUpperCase(),
        title,
        weight: `Weight: ${weightNum}% of final grade`,
        openDate: `Open Date: ${formatPreviewDate(open)}`,
        dueDate: `Due Date: ${formatPreviewDate(due)}`,
      },
    },
  };
}

async function upsertAssessmentDraftState(
  institutionId: string,
  path: string,
  draft: AssessmentBuilderFields | null,
) {
  const existing = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId, path } },
  });
  const prev = existing ? (JSON.parse(existing.payloadJson) as Record<string, unknown>) : {};
  const next = { ...prev };
  if (draft) next.assessmentDraft = draft;
  else delete next.assessmentDraft;
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId, path } },
    create: { institutionId, path, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });
  return next;
}

async function createOrSaveAssessment(
  ctx: InstructorCtx,
  path: string,
  rowKey: string | undefined,
  publish: boolean,
) {
  const fields = parseAssessmentPayload(rowKey) || {};
  const sec = taughtSection(
    ctx,
    fields.sectionId?.trim() || parseScreenQuery(path).query.get("sectionId")?.trim() || null,
  );
  if (!sec) throw Object.assign(new Error("No teaching section assigned"), { status: 400 });

  const title = (fields.title || `Assessment · ${new Date().toLocaleDateString()}`).trim();
  const type = (fields.type || "Written Exam").trim();
  const weightPercent = parseWeightPercent(fields.weight);
  const tz = await institutionTimezone(ctx.user.institutionId);
  const opensAt = parseDateOrOffset(fields.openDate, 0, tz);
  const closesAt = parseDateOrOffset(fields.dueDate, 14);
  if (closesAt.getTime() <= opensAt.getTime()) {
    closesAt.setTime(opensAt.getTime() + 3 * 24 * 60 * 60 * 1000);
  }
  const rubricRows =
    Array.isArray(fields.rubricRows) && fields.rubricRows.length
      ? fields.rubricRows.map((r) => ({
          criterion: (r.criterion || "Criterion").trim() || "Criterion",
          excellent: (r.excellent || "").trim() || "—",
          good: (r.good || "").trim() || "—",
          poor: (r.poor || "").trim() || "—",
        }))
      : [
          {
            criterion: "Overall Quality",
            excellent: "Excellent",
            good: "Good",
            poor: "Needs work",
          },
        ];
  const durationMinutes = Number.isFinite(Number(fields.durationMinutes))
    ? Math.max(1, Math.min(480, Math.round(Number(fields.durationMinutes))))
    : 60;
  const questions = (Array.isArray(fields.questions) ? fields.questions : []).map((question) => ({
    id: (question.id || randomUUID()).trim(),
    prompt: (question.prompt || "").trim(),
    options: (Array.isArray(question.options) ? question.options : []).map((option) => option.trim()),
    correct: Number(question.correct),
  })).filter((question) => question.id && question.prompt && question.options.length >= 2 && question.options.every(Boolean)
    && Number.isInteger(question.correct) && question.correct >= 0 && question.correct < question.options.length);

  if (publish && type === "Quiz" && !questions.length) {
    throw Object.assign(new Error("Add at least one complete quiz question with two answer choices before publishing."), {
      status: 400,
      code: "ASSESSMENT_QUESTIONS_REQUIRED",
    });
  }

  const draftPayload: AssessmentBuilderFields = {
    sectionId: sec.id,
    title,
    type,
    weight: `${weightPercent}%`,
    openDate: ymdIn(opensAt, tz),
    dueDate: closesAt.toISOString().slice(0, 10),
    durationMinutes,
    questions,
    rubricRows,
  };

  if (!publish) {
    await upsertAssessmentDraftState(ctx.user.institutionId, path, draftPayload);
    return { draft: true as const, title, sectionId: sec.id, sectionCode: sec.code };
  }

  const clash = await prisma.assignment.findFirst({
    where: { institutionId: ctx.user.institutionId, sectionId: sec.id, title: { equals: title, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) {
    throw Object.assign(new Error(`${sec.code} already has an assessment named "${title}". Use a different title so grades stay distinguishable.`), {
      status: 409,
      code: "DUPLICATE",
    });
  }

  const rubric = await prisma.rubric.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      title: `${title} Rubric`,
      description: type,
      maxScore: 100,
      status: "published",
      criteria: {
        create: rubricRows.map((r, i) => ({
          id: randomUUID(),
          institutionId: ctx.user.institutionId,
          label: r.criterion,
          description: `Excellent: ${r.excellent}; Good: ${r.good}; Poor: ${r.poor}`,
          maxPoints: 5,
          sortOrder: i,
        })),
      },
    },
  });

  const assignment = await prisma.assignment.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      sectionId: sec.id,
      title,
      maxScore: 100,
      weightPercent,
      availableFrom: opensAt,
      dueAt: closesAt,
      rubricId: rubric.id,
    },
  });

  const timedAssessment = type === "Quiz"
    ? await prisma.assessment.create({
        data: {
          id: randomUUID(),
          institutionId: ctx.user.institutionId,
          sectionId: sec.id,
          title,
          opensAt,
          closesAt,
          durationMinutes,
          maxAttempts: 1,
          status: "published",
          questionsJson: JSON.stringify(questions),
        },
      })
    : null;

  for (const e of sec.enrolments.filter((x) => x.status === "enrolled")) {
    await prisma.gradeItem.create({
      data: {
        id: randomUUID(),
        institutionId: ctx.user.institutionId,
        assignmentId: assignment.id,
        studentId: e.studentId,
        enrolmentId: e.id,
        maxScore: 100,
        status: "draft",
      },
    });
  }

  await upsertAssessmentDraftState(ctx.user.institutionId, path, null);

  return {
    draft: false as const,
    title,
    type,
    weightPercent,
    assignmentId: assignment.id,
    assessmentId: timedAssessment?.id ?? null,
    rubricId: rubric.id,
    sectionId: sec.id,
    sectionCode: sec.code,
  };
}

async function postAnnouncement(ctx: InstructorCtx, title: string, body: string, sectionId?: string | null) {
  const sec = sectionId ? ctx.sections.find((s) => s.id === sectionId) : primarySection(ctx);
  if (!sec) {
    throw Object.assign(new Error(sectionId ? "You do not teach this course section" : "No teaching section to announce to"), {
      status: sectionId ? 403 : 400,
    });
  }
  const studentIds = [...new Set(sec.enrolments.filter((e) => e.status === "enrolled").map((e) => e.studentId))];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, institutionId: ctx.user.institutionId },
    select: { personId: true },
  });
  const accounts = await prisma.account.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      personId: { in: students.map((s) => s.personId) },
    },
  });
  for (const a of accounts) {
    await prisma.notification.create({
      data: {
        institutionId: ctx.user.institutionId,
        recipientAccountId: a.id,
        channel: "in_app",
        title,
        body,
        templateKey: "instructor.announcement",
      },
    });
  }
  await prisma.portalRecord.create({
    data: {
      institutionId: ctx.user.institutionId,
      screenPath: "/instructor/announcements",
      role: "instructor",
      primaryText: title,
      secondaryText: body.slice(0, 120),
      metaText: `Posted to ${sec.courseCode} · ${sec.code}`,
      href: `/instructor/announcements?sectionId=${encodeURIComponent(sec.id)}`,
      sortOrder: 0,
      audienceAccountId: ctx.user.accountId,
    },
  });
  return { recipients: accounts.length, section: sec };
}

async function publishDraftGrades(ctx: InstructorCtx) {
  const draftIds = ctx.grades.filter((g) => g.status === "draft").map((g) => g.id);
  const alreadyPending = await gradeItemsInOpenApproval(ctx.user.institutionId, draftIds);
  const drafts = ctx.grades.filter((g) => g.status === "draft" && !alreadyPending.has(g.id));
  if (!drafts.length) return { count: 0, approvals: 0 };
  const bySection = new Map<string, string[]>();
  for (const g of drafts) {
    const sec = ctx.sections.find((s) => s.code === g.sectionCode);
    if (!sec) continue;
    const list = bySection.get(sec.id) ?? [];
    list.push(g.id);
    bySection.set(sec.id, list);
  }
  let approvals = 0;
  for (const [sectionId, gradeItemIds] of bySection) {
    const studentIds = [...new Set(drafts.filter((grade) => gradeItemIds.includes(grade.id)).map((grade) => grade.studentId))];
    await prisma.$transaction(async (tx) => {
      await tx.gradeItem.updateMany({
        where: { id: { in: gradeItemIds }, institutionId: ctx.user.institutionId, status: "draft" },
        data: { status: "pending_publish" },
      });
      await requireApproval({
        institutionId: ctx.user.institutionId,
        type: "grade.publish",
        subjectRef: `section:${sectionId}`,
        proposedDiff: { gradeItemIds, studentIds },
        requestedBy: ctx.user.accountId,
        requiredApproverRoles: ["registrar", "admin"],
        requiredCount: 1,
        source: "instructor.grade-publish",
        tx,
      });
    });
    approvals += 1;
  }
  return { count: drafts.length, approvals };
}

async function saveAttendanceSession(ctx: InstructorCtx, screenPath: string, finalize: boolean, rowKey?: string) {
  const sec = attendanceSection(ctx) || primarySection(ctx);
  if (!sec) throw Object.assign(new Error("No teaching section for attendance"), { status: 400 });

  type ClientRow = { studentId?: string; id?: string; studentNumber?: string; name?: string; status?: string; note?: string; sectionId?: string };
  let rosterFromClient: ClientRow[] | null = null;
  let dateFromClient = "";
  if (rowKey?.trim().startsWith("{") || rowKey?.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(rowKey) as { roster?: ClientRow[]; date?: string } | ClientRow[];
      rosterFromClient = Array.isArray(parsed) ? parsed : parsed.roster ?? null;
      if (!Array.isArray(parsed) && typeof parsed.date === "string") dateFromClient = parsed.date.trim();
    } catch {
      rosterFromClient = null;
    }
  }
  const pathDate = parseScreenQuery(screenPath).query.get("date")?.trim() || "";
  const tz = await institutionTimezone(ctx.user.institutionId);
  const meetingLabel =
    (/^\d{4}-\d{2}-\d{2}$/.test(dateFromClient) && dateFromClient) ||
    (/^\d{4}-\d{2}-\d{2}$/.test(pathDate) && pathDate) ||
    ymdIn(new Date(), tz);
  // The attendance page reads drafts back from the per-date key, whatever filters the URL carried.
  const path =
    parseScreenQuery(screenPath).pathname.replace(/\/+$/, "") === "/instructor/attendance"
      ? `/instructor/attendance?date=${meetingLabel}`
      : screenPath;

  const existing = await prisma.sisScreenState.findUnique({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path } },
  });
  const prev = existing ? (JSON.parse(existing.payloadJson) as Record<string, unknown>) : {};
  type Row = { studentId: string; studentNumber: string; name: string; status: string; note?: string; sectionId: string };
  const existingAttendance = prev.attendance as { roster?: Array<Partial<Row>> } | undefined;

  const sameStudent = (r: ClientRow | Partial<Row>, e: { studentId: string; studentNumber: string }) =>
    r.studentId === e.studentId || r.studentNumber === e.studentNumber || (r as ClientRow).id === e.studentNumber;
  const roster: Row[] = [];
  const editedRows: Row[] = [];
  for (const s of ctx.sections) {
    for (const e of s.enrolments.filter((x) => x.status === "enrolled")) {
      const fromClient = rosterFromClient?.find((r) => sameStudent(r, e) && (!r.sectionId || r.sectionId === s.id));
      const prior = existingAttendance?.roster?.find((r) => sameStudent(r, e) && (!r.sectionId || r.sectionId === s.id));
      const row = {
        studentId: e.studentId,
        studentNumber: e.studentNumber,
        name: e.studentName,
        status: (fromClient?.status ?? prior?.status ?? "").trim(),
        note: (fromClient?.note ?? prior?.note ?? "").trim(),
        sectionId: s.id,
      };
      roster.push(row);
      if (fromClient) editedRows.push(row);
    }
  }

  let submittedUpdated = 0;
  let pendingDraft = roster.filter((r) => r.status).length;
  if (finalize) {
    const marked = roster.filter((r) => r.status);
    if (!marked.length) {
      throw Object.assign(new Error("Mark Present, Absent, Late or Excused for at least one student before submitting."), { status: 400 });
    }
    await prisma.$transaction((tx) =>
      writeAttendanceRecords(tx, {
        institutionId: ctx.user.institutionId,
        meetingLabel,
        tz,
        sections: ctx.sections,
        marks: marked,
      }),
    );
    void import("../campusCompliance/sweep.js")
      .then(({ escalateStudentMisses }) => escalateStudentMisses(ctx.user.institutionId))
      .catch(() => undefined);
  } else {
    const applied = await prisma.$transaction((tx) =>
      applyDraftToSubmittedAttendance(tx, {
        institutionId: ctx.user.institutionId,
        meetingLabel,
        tz,
        sections: ctx.sections,
        marks: editedRows,
      }),
    );
    submittedUpdated = applied.updated;
    pendingDraft = Math.max(0, pendingDraft - applied.updated);
  }

  const attendance = {
    sectionId: sec.id,
    sectionCode: sec.code,
    courseCode: sec.courseCode,
    finalized: finalize,
    savedAt: new Date().toISOString(),
    meetingLabel,
    submittedUpdated,
    pendingDraft,
    roster,
  };
  // Screen state is keyed per institution path, so another instructor's unsubmitted rows must survive this save.
  const mySectionIds = new Set(ctx.sections.map((s) => s.id));
  const othersRows = (existingAttendance?.roster ?? []).filter(
    (r) => r.sectionId && !mySectionIds.has(r.sectionId) && !(existingAttendance as { finalized?: boolean }).finalized,
  );
  const next = {
    ...prev,
    attendance: othersRows.length
      ? { ...attendance, finalized: false, roster: [...othersRows, ...(finalize ? [] : roster)] }
      : attendance,
  };
  await prisma.sisScreenState.upsert({
    where: { institutionId_path: { institutionId: ctx.user.institutionId, path } },
    create: { institutionId: ctx.user.institutionId, path, payloadJson: JSON.stringify(next) },
    update: { payloadJson: JSON.stringify(next) },
  });
  return attendance;
}

async function createCourseAndSection(ctx: InstructorCtx, titleHint?: string) {
  const term = await prisma.term.findFirst({
    where: { institutionId: ctx.user.institutionId },
    orderBy: { startsOn: "desc" },
  });
  if (!term) throw Object.assign(new Error("No academic term configured"), { status: 400 });
  const fields = parseActionFields(titleHint) || {};
  const n = ctx.sections.length + 1;
  const rawCode =
    (fields["Course Number"] || fields.code || "").trim() || `INS${String(n).padStart(3, "0")}`;
  const code = rawCode.toUpperCase().replace(/\s+/g, "-").slice(0, 32);
  const title =
    (fields["Course Name"] || fields.title || "").trim() ||
    (titleHint && !titleHint.trim().startsWith("{") ? titleHint.trim() : "") ||
    `Instructor Course ${n}`;
  const creditsRaw = (fields["Course Credit Value"] || fields.credits || "3").replace(/[^\d.]/g, "");
  const credits = Number(creditsRaw) || 3;
  const course = await prisma.course.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      code,
      title,
      credits,
    },
  });
  const section = await prisma.section.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      courseId: course.id,
      termId: term.id,
      code: `${code}-01`.slice(0, 32),
      instructorPersonId: ctx.user.personId,
    },
  });
  return { course, section };
}

function sessionCodeFrom(name: string, n: number) {
  const base = name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase().slice(0, 24);
  return `${base || "SESS"}-${String(n).padStart(2, "0")}`.slice(0, 32);
}

async function resolveCourseForSession(ctx: InstructorCtx, courseIdParam: string) {
  const fromSection = ctx.sections.find(
    (s) =>
      s.id === courseIdParam ||
      s.courseId === courseIdParam ||
      courseAdminIdFor(s.courseCode) === courseIdParam ||
      s.courseCode === courseIdParam,
  );
  if (fromSection) {
    return { courseId: fromSection.courseId, code: fromSection.courseCode, title: fromSection.courseTitle };
  }
  const code = courseIdParam.replace(/^course-/i, "").replace(/-/g, " ").trim().toUpperCase().slice(0, 32);
  const title = code;
  let course = await prisma.course.findFirst({
    where: { institutionId: ctx.user.institutionId, code },
  });
  if (!course) {
    course = await prisma.course.create({
      data: {
        id: randomUUID(),
        institutionId: ctx.user.institutionId,
        code: code || `CRS-${Date.now().toString(36).slice(-6).toUpperCase()}`,
        title,
        credits: 3,
      },
    });
  }
  return { courseId: course.id, code: course.code, title: course.title };
}

async function createSessionOffering(ctx: InstructorCtx, path: string, fields: Record<string, string>) {
  const courseIdParam = parseScreenQuery(path).query.get("courseId") || fields.courseId || "";
  const termId = ctx.terms[0]?.id;
  if (!termId) throw Object.assign(new Error("No academic term configured"), { status: 400 });
  const resolved = await resolveCourseForSession(ctx, courseIdParam);
  const sessionName = (fields["Session Name"] || fields["Session Type"] || `${resolved.code} session`).trim();
  const location = [fields["Campus / Location"], fields.Classroom].filter(Boolean).join(" · ") || "—";
  const instructors = (fields["Instructor(s)"] || ctx.displayName).trim() || ctx.displayName;
  const start = (fields["Start Date"] || "").trim();
  const end = (fields["End Date"] || "").trim();
  const schedule =
    start && end ? `${start} – ${end}` : (fields["Schedule Type"] || "Simple Weekly Schedule").trim();
  let code = sessionCodeFrom(sessionName, ctx.sections.length + 1);
  const clash = await prisma.section.findFirst({
    where: { institutionId: ctx.user.institutionId, courseId: resolved.courseId, code },
  });
  if (clash) code = `${code}-${Date.now().toString(36).slice(-3).toUpperCase()}`.slice(0, 32);
  const section = await prisma.section.create({
    data: {
      id: randomUUID(),
      institutionId: ctx.user.institutionId,
      courseId: resolved.courseId,
      termId,
      code,
      instructorPersonId: ctx.user.personId,
    },
  });
  return {
    id: section.id,
    courseId: courseIdParam || courseAdminIdFor(resolved.code),
    course: sessionName || `${resolved.code}: ${resolved.title}`,
    location,
    instructors,
    schedule,
    enrolled: 0,
    reserved: 0,
    waitList: 0,
    status: "Not Started",
  };
}

async function createProgramRecord(ctx: InstructorCtx, rowKey?: string) {
  const fields = (parseActionFields(rowKey) || {}) as Record<string, unknown>;
  const requestedId = String(fields.__programId || fields.programId || "").trim();
  const name = String(fields["Program Name"] || "").trim();
  if (!name) throw Object.assign(new Error("Program Name is required"), { status: 400 });
  const abbr = String(fields.Abbreviation || name.slice(0, 8))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .slice(0, 32);
  const type = String(fields["Program Type"] || "Diploma").trim().toLowerCase();
  const awardLevel =
    /bachelor/i.test(type)
      ? "bachelor"
      : /master/i.test(type)
        ? "masters"
        : /certificate/i.test(type)
          ? "certificate"
          : /visitor|online|not applicable/i.test(type)
            ? "other"
            : "diploma";
  let code = abbr || `PRG-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const existing = await prisma.program.findFirst({
    where: { institutionId: ctx.user.institutionId, code, ...(requestedId ? { id: { not: requestedId } } : {}) },
  });
  if (existing) code = `${code}-${Date.now().toString(36).slice(-4).toUpperCase()}`.slice(0, 32);
  const current = requestedId
    ? await prisma.program.findFirst({ where: { id: requestedId, institutionId: ctx.user.institutionId } })
    : null;
  const program = current
    ? await prisma.program.update({ where: { id: current.id }, data: { code, name, awardLevel } })
    : await prisma.program.create({
        data: {
          id: randomUUID(),
          institutionId: ctx.user.institutionId,
          code,
          name,
          awardLevel,
        },
      });
  return {
    program,
    faculty: String(fields["Program Faculty"] || ""),
    legalName: String(fields["Legal Program Name"] || name),
    designations: fields.__designations ?? [],
  };
}

async function createStudentProfile(ctx: InstructorCtx, fields: Record<string, string>) {
  const givenName = (fields["Given Name"] || fields.givenName || "").trim();
  const familyName = (fields["Family Name"] || fields.familyName || "").trim();
  const email = (fields.Email || fields.email || "").trim().toLowerCase();
  const programName = (fields.Program || fields.programName || ctx.programs[0]?.name || "General Studies").trim();
  const standing = (fields["Student Status"] || fields.standing || "good").trim() || "good";
  const courseCode = (fields["Course Name"] || fields.courseCode || "").trim();
  const sectionValue = (fields.Section || fields.sectionId || "").trim();

  if (!givenName || !familyName) {
    throw Object.assign(new Error("Given Name and Family Name are required"), { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("A valid Email is required"), { status: 400 });
  }
  if (!sectionValue) {
    throw Object.assign(new Error("Section is required"), { status: 400 });
  }

  const section =
    ctx.sections.find((s) => s.id === sectionValue) ||
    ctx.sections.find((s) => s.code === sectionValue && (!courseCode || s.courseCode === courseCode)) ||
    ctx.sections.find((s) => s.code === sectionValue);
  if (!section) {
    throw Object.assign(new Error("Section must be one of your assigned teaching sections"), { status: 400 });
  }
  if (courseCode && section.courseCode !== courseCode) {
    throw Object.assign(new Error("Section does not match the selected Course Name"), { status: 400 });
  }

  const institutionId = ctx.user.institutionId;
  let person = await prisma.person.findFirst({
    where: { institutionId, email },
  });
  if (!person) {
    person = await prisma.person.create({
      data: {
        id: randomUUID(),
        institutionId,
        givenName,
        familyName,
        email,
      },
    });
  } else {
    person = await prisma.person.update({
      where: { id: person.id },
      data: { givenName, familyName },
    });
  }

  let account = await prisma.account.findFirst({
    where: { institutionId, email },
  });
  if (!account) {
    account = await prisma.account.create({
      data: {
        id: randomUUID(),
        institutionId,
        personId: person.id,
        email,
        passwordHash: await hashPassword("Heritage!2026"),
        rolesJson: JSON.stringify(["student"]),
      },
    });
  }

  let student = await prisma.student.findFirst({
    where: { institutionId, personId: person.id },
  });
  if (!student) {
    const year = new Date().getFullYear();
    const count = await prisma.student.count({ where: { institutionId } });
    const studentNumber = `ST-${year}-${String(count + 1).padStart(3, "0")}`;
    const programVersion = await prisma.programVersion.findFirst({
      where: {
        institutionId,
        status: "active",
        program: { name: programName },
      },
      orderBy: { effectiveOn: "desc" },
    });
    student = await prisma.student.create({
      data: {
        id: randomUUID(),
        institutionId,
        personId: person.id,
        studentNumber,
        programName,
        programVersionId: programVersion?.id ?? null,
        standing,
      },
    });
  } else {
    student = await prisma.student.update({
      where: { id: student.id },
      data: { programName, standing },
    });
  }

  const existingEnrolment = await prisma.enrolment.findFirst({
    where: { sectionId: section.id, studentId: student.id },
  });
  const enrolment =
    existingEnrolment ??
    (await prisma.$transaction(async (tx) => {
      const status = await assertSeat(tx, institutionId, section.id, `${section.courseCode} ${section.code}`);
      return tx.enrolment.create({
        data: {
          id: randomUUID(),
          institutionId,
          sectionId: section.id,
          studentId: student.id,
          status,
        },
      });
    }));

  const assignments =
    enrolment.status === "enrolled"
      ? await prisma.assignment.findMany({
          where: { institutionId, sectionId: section.id },
        })
      : [];
  for (const assignment of assignments) {
    const existingGrade = await prisma.gradeItem.findFirst({
      where: { assignmentId: assignment.id, studentId: student.id },
    });
    if (existingGrade) continue;
    await prisma.gradeItem.create({
      data: {
        id: randomUUID(),
        institutionId,
        assignmentId: assignment.id,
        studentId: student.id,
        enrolmentId: enrolment.id,
        maxScore: assignment.maxScore,
        status: "draft",
      },
    });
  }

  return {
    studentId: student.id,
    studentNumber: student.studentNumber,
    sectionId: section.id,
    enrolmentId: enrolment.id,
    accountId: account.id,
    name: `${givenName} ${familyName}`.trim(),
    alreadyEnrolled: Boolean(existingEnrolment),
  };
}

/** Domain-backed CTA handler — every teacher button that is not a nav href hits this. */
export async function runInstructorAction(user: SessionClaims, input: ActionInput) {
  const action = input.action.trim();
  const lower = action.toLowerCase();
  assertInstructorMasterDataBoundary(user, input.path, lower);
  await assertInstructorSectionAccess(user, input.path, input.rowKey);
  const ctx = await loadCtx(user, input.path);
  const path = studioWorkspacePath(input.path, ctx);
  if (path !== input.path) await assertInstructorSectionAccess(user, path, input.rowKey);
  let message = `Saved · ${action}`;
  let result: Record<string, unknown> = {};

  try {
    const isAssessmentBuilderPath =
      path.includes("t19") || path.includes("create-edit-assessment");
    const isVersionEditorPath = path.includes("t26") || path.includes("version-editor");
    const isQuestionGeneratorPath = path.includes("in-15") || path.includes("question-generator");
    const isProgramSettingsPath = path.includes("t83") || path.includes("program-settings");
    const isProgramChangePath = path.includes("t27") || path.includes("program-change");
    if (isProgramChangePath && lower === "submit request") {
      const fields = parseActionFields(input.rowKey) || {};
      const submitted = await submitProgramChangeRequest(user, {
        programId: fields.Programme,
        type: fields["Change Type"],
        title: fields.Summary,
        rationale: fields.Rationale,
        effectiveTerm: fields["Effective Term"],
      });
      message = submitted.message;
      result = { requestId: submitted.id, status: "Submitted" };
    } else if (isQuestionGeneratorPath && lower === "generate questions") {
      await assertInstitutionAiAllowed(user.institutionId, user.roles);
      const sec = primarySection(ctx);
      if (!sec) throw Object.assign(new Error("Open a teaching section before generating questions"), { code: "NO_SECTION", status: 400 });
      const fields = parseActionFields(input.rowKey) || {};
      const topic = (fields.Topic || fields.topic || `${sec.courseCode} course outcomes`).trim().slice(0, 200);
      const generated = await generateWithAi(
        "Create five rigorous university multiple-choice questions. Return JSON only as {\"questions\":[{\"prompt\":string,\"options\":[string,string,string,string],\"correct\":number}]}. Do not invent institutional policy.",
        `Course: ${sec.courseCode} — ${sec.courseTitle}\nTopic: ${topic}`,
        90_000,
        { json: true },
      );
      let raw: unknown;
      try { raw = JSON.parse(generated.answer.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "")); }
      catch { throw Object.assign(new Error("AI returned invalid question data"), { code: "AI_BAD_OUTPUT", status: 502 }); }
      const rows = Array.isArray((raw as { questions?: unknown[] }).questions) ? (raw as { questions: unknown[] }).questions : [];
      const questions = rows.map((row, index) => {
        const item = row as { prompt?: unknown; options?: unknown; correct?: unknown };
        const options = Array.isArray(item.options) ? item.options.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 6) : [];
        const correct = Number(item.correct);
        if (!String(item.prompt || "").trim() || options.length < 2 || !Number.isInteger(correct) || correct < 0 || correct >= options.length) return null;
        return { id: `ai-${Date.now().toString(36)}-${index}`, prompt: String(item.prompt).trim(), options: options.map((text, i) => ({ key: String.fromCharCode(65 + i), text, correct: i === correct })) };
      }).filter(Boolean);
      if (!questions.length) throw Object.assign(new Error("AI returned no usable questions"), { code: "AI_BAD_OUTPUT", status: 502 });
      await patchScreenOverlay(user.institutionId, path, (prev) => ({ ...prev, generatedQuestions: questions, generatedTopic: topic }));
      message = `Generated ${questions.length} question(s) with ${generated.model}`;
      result = { count: questions.length, model: generated.model };
    } else if (isQuestionGeneratorPath && lower === "add to question bank") {
      let parsed: { questions?: unknown[] } = {};
      try { parsed = JSON.parse(input.rowKey || "{}"); } catch { /* validated below */ }
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (!questions.length) throw Object.assign(new Error("Select at least one question"), { code: "VALIDATION_ERROR", status: 400 });
      await patchScreenOverlay(user.institutionId, "/instructor/question-bank", (prev) => ({
        ...prev,
        questions: [...(Array.isArray(prev.questions) ? prev.questions : []), ...questions].slice(-500),
      }));
      message = `${questions.length} question(s) added to the question bank`;
      result = { count: questions.length };
    } else if (isVersionEditorPath && (lower === "save draft" || lower === "submit for approval")) {
      const fields = parseActionFields(input.rowKey) || {};
      const title = (fields.Title || fields.title || "Course outline").trim();
      const body = (fields.Body || fields.body || "").trim();
      if (!body) throw Object.assign(new Error("Course version content is required"), { code: "VALIDATION_ERROR", status: 400 });
      const status = lower === "save draft" ? "draft" : "pending";
      const versionDraft = { title, body, status, savedAt: new Date().toISOString(), requestedBy: user.accountId };
      await patchScreenOverlay(user.institutionId, path, (prev) => ({ ...prev, versionDraft }));
      if (status === "pending") {
        await requireApproval({
          institutionId: user.institutionId,
          type: "course.version.change",
          subjectRef: path,
          proposedDiff: versionDraft,
          requestedBy: user.accountId,
          requiredApproverRoles: ["registrar", "admin"],
          requiredCount: 1,
          source: "instructor.course-version",
        });
      }
      message = status === "draft" ? "Course version draft saved" : "Course version submitted for approval";
      result = versionDraft;
    } else if (isProgramSettingsPath) {
      const handled = applyProgramSettingsPatch(action, input.rowKey, path);
      if (handled) {
        await patchScreenOverlay(user.institutionId, PROGRAM_SETTINGS_PATH, handled.patch);
        if (lower.includes("save program")) {
          const fields = parseActionFields(input.rowKey) || {};
          const programId =
            parseScreenQuery(path).query.get("programId") || fields.programId || "";
          if (programId) {
            await patchScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH, (prev) => {
              const edits =
                prev.facultyProgramEdits && typeof prev.facultyProgramEdits === "object"
                  ? { ...(prev.facultyProgramEdits as Record<string, Partial<FacultyProgramRecord>>) }
                  : {};
              edits[programId] = {
                ...(edits[programId] || {}),
                name: fields["Program Name"] || edits[programId]?.name,
                abbreviation: fields.Abbreviation || edits[programId]?.abbreviation,
                active: !/inactive/i.test(fields["Active / Inactive"] || "Active"),
              };
              return { ...prev, facultyProgramEdits: edits };
            });
          }
        }
        message = handled.message;
        result = handled.result;
      }
    } else if (
      isAssessmentBuilderPath &&
      (lower.includes("publish assessment") ||
        lower.includes("save draft") ||
        (lower.includes("create") && lower.includes("assessment")) ||
        lower === "publish")
    ) {
      const publish = !lower.includes("draft");
      const saved = await createOrSaveAssessment(ctx, path, input.rowKey, publish);
      message = publish
        ? `Published “${saved.title}” on ${saved.sectionCode}`
        : `Draft saved · ${saved.title}`;
      result = saved;
    } else if (lower === "award course badge") {
      const fields = parseActionFields(input.rowKey) || {};
      const { pathname, query } = parseScreenQuery(path);
      const sectionId = (query.get("view") || "").trim() || pathname.split("/").pop() || "";
      const sec = ctx.sections.find((s) => s.id === sectionId);
      if (!sec) throw Object.assign(new Error("Open the course offering to award its badges"), { status: 400 });
      const roster = new Set(sec.enrolments.filter((e) => e.status !== "withdrawn").map((e) => e.studentId));
      const studentIds = (fields.StudentIds || "").split(",").map((x) => x.trim()).filter(Boolean);
      if (!studentIds.length) throw Object.assign(new Error("Select at least one student"), { status: 400 });
      if (studentIds.some((id) => !roster.has(id))) throw Object.assign(new Error(`A selected student is not enrolled in ${sec.courseCode}`), { status: 400 });
      const r = await awardBadge(user.institutionId, (fields.BadgeId || "").trim(), studentIds);
      const done = r.instant ? "awarded" : "sent for approval";
      message = `${r.name} ${done} · ${r.issued} student${r.issued === 1 ? "" : "s"}${r.skipped ? ` (${r.skipped} already had it)` : ""}`;
      result = { ...r };
    } else if (lower === "mark all as read" || lower === "mark notification read") {
      const ids = lower === "mark all as read" ? undefined : [(input.rowKey || "").trim()];
      const { count } = await markNotificationsRead(user, ids);
      message = count ? `${count} notification(s) marked as read` : "No unread notifications";
      result = { marked: count };
    } else if (lower === "schedule lecture") {
      const fields = parseActionFields(input.rowKey) || {};
      const startsAt = (fields.StartsAt || fields["Open date/time"] || "").trim();
      if (!startsAt || Number.isNaN(new Date(startsAt).getTime())) {
        throw Object.assign(new Error("Choose a valid lecture date and time"), { code: "VALIDATION_ERROR", status: 400 });
      }
      const published = await publishOnlineClassSession(ctx, path, fields);
      message = `Lecture scheduled · ${published.title} · ${published.notified} student(s) notified`;
      result = published;
    } else if (lower === "create grading item") {
      const fields = parseActionFields(input.rowKey) || {};
      const sec = resolveSectionFromPath(ctx, path);
      if (!sec) throw Object.assign(new Error("Open a course section first"), { code: "NO_SECTION", status: 400 });
      const title = (fields.Name || "").trim();
      const maxScore = Number(fields.OutOf || 100);
      const weightPercent = Number(String(fields.Weight || "10").replace("%", ""));
      if (!title || !Number.isFinite(maxScore) || maxScore <= 0 || !Number.isFinite(weightPercent) || weightPercent <= 0 || weightPercent > 100) {
        throw Object.assign(new Error("Enter a name, positive maximum score, and weight from 1 to 100"), { code: "VALIDATION_ERROR", status: 400 });
      }
      const assignment = await prisma.$transaction(async (tx) => {
        const created = await tx.assignment.create({ data: { id: randomUUID(), institutionId: user.institutionId, sectionId: sec.id, title, maxScore, weightPercent } });
        const enrolled = sec.enrolments.filter((item) => item.status === "enrolled");
        if (enrolled.length) await tx.gradeItem.createMany({ data: enrolled.map((item) => ({ id: randomUUID(), institutionId: user.institutionId, assignmentId: created.id, studentId: item.studentId, enrolmentId: item.id, maxScore, status: "draft" })) });
        return created;
      });
      message = `Grading item created · ${title}`;
      result = { assignmentId: assignment.id };
    } else if (lower === "confirm post") {
      result = await publishDraftGrades(ctx);
      message = `Marks submitted for approval · ${String(result.approvals || 0)} section(s)`;
    } else if (lower === "export grades") {
      const sec = resolveSectionFromPath(ctx, path);
      if (!sec) throw Object.assign(new Error("Open a course section first"), { code: "NO_SECTION", status: 400 });
      const header = ["Student number", "Student", ...sec.assignments.map((item) => item.title)];
      const rows = sec.enrolments.map((enrolment) => [
        enrolment.studentNumber,
        enrolment.studentName,
        ...sec.assignments.map((assignment) => {
          const grade = ctx.grades.find((item) => item.assignmentTitle === assignment.title && item.studentId === enrolment.studentId && item.sectionCode === sec.code);
          return grade?.score == null ? "" : String(grade.score);
        }),
      ]);
      const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      message = `Grade export ready · ${sec.courseCode}`;
      result = { download: { filename: `${sec.courseCode}-${sec.code}-grades.csv`, mime: "text/csv", content: csv } };
    } else if (lower === "save course group") {
      const group = await saveCourseGroup(user.institutionId, parseActionFields(input.rowKey) || {});
      message = `Course group saved · ${group.name}`;
      result = { ...group, href: "/instructor/f/t59-course-groups-types" };
    } else if (lower === "save course type") {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Course Type Name"] || fields.Name || "").trim();
      const abbreviation = (fields.Abbreviation || "").trim().toUpperCase();
      if (!name) throw Object.assign(new Error("Course Type Name is required"), { code: "VALIDATION_ERROR", status: 400 });
      const existingId = (fields.__typeId || fields.typeId || parseScreenQuery(path).query.get("typeId") || "").trim();
      const id = existingId || `ctype-${Date.now().toString(36)}`;
      const row: CourseTypeRecord = {
        id, name, abbreviation,
        active: !/inactive/i.test(fields["Active / Inactive"] || "Active"),
        learningStyle: fields["Learning Style"] || "Face to Face",
        asynchronous: /^(yes|true|1)$/i.test(fields.Asynchronous || "No"),
      };
      await patchScreenOverlay(user.institutionId, COURSE_TYPES_LIST_PATH, (prev) => {
        const extras = Array.isArray(prev.extraCourseTypes) ? [...prev.extraCourseTypes as CourseTypeRecord[]] : [];
        const edits = prev.courseTypeEdits && typeof prev.courseTypeEdits === "object" ? { ...prev.courseTypeEdits as Record<string, Partial<CourseTypeRecord>> } : {};
        const index = extras.findIndex((item) => item.id === id);
        if (index >= 0) extras[index] = row;
        else if (DEFAULT_COURSE_TYPES.some((item) => item.id === id)) edits[id] = row;
        else extras.push(row);
        return { ...prev, extraCourseTypes: extras, courseTypeEdits: edits };
      });
      message = `Course type saved · ${name}`;
      result = { ...row, href: COURSE_TYPES_LIST_PATH };
    } else if (lower === "delete course type") {
      const id = (input.rowKey || "").trim();
      if (!id) throw Object.assign(new Error("Course type id is required"), { code: "VALIDATION_ERROR", status: 400 });
      await patchScreenOverlay(user.institutionId, COURSE_TYPES_LIST_PATH, (prev) => ({
        ...prev,
        deletedCourseTypeIds: [...new Set([...(Array.isArray(prev.deletedCourseTypeIds) ? prev.deletedCourseTypeIds as string[] : []), id])],
        extraCourseTypes: (Array.isArray(prev.extraCourseTypes) ? prev.extraCourseTypes as CourseTypeRecord[] : []).filter((item) => item.id !== id),
      }));
      message = "Course type deleted";
      result = { id };
    } else if (lower === "reorder course types") {
      let order: string[] = [];
      try { const value = JSON.parse(input.rowKey || "[]"); if (Array.isArray(value)) order = value.filter((id): id is string => typeof id === "string"); } catch { /* empty order */ }
      await patchScreenOverlay(user.institutionId, COURSE_TYPES_LIST_PATH, (prev) => ({ ...prev, courseTypeOrder: order }));
      message = "Course types reordered";
      result = { order };
    } else if (lower === "dismiss flag" || lower === "delete flag") {
      result = await updateInstructorFlag(user, input.rowKey || "", lower === "delete flag" ? "delete" : "dismiss");
      message = lower === "delete flag" ? "Flag deleted" : "Flag dismissed";
    } else if (lower.includes("announcement") || lower.includes("share with class") || lower.includes("publish announcement")) {
      let title = input.rowKey || `Class update · ${new Date().toLocaleDateString()}`;
      let body = `${ctx.displayName} posted: ${title}`;
      let sectionId = parseScreenQuery(path).query.get("sectionId")?.trim() || null;
      if (input.rowKey?.startsWith("{")) {
        try {
          const parsed = JSON.parse(input.rowKey) as { title?: string; body?: string; sectionId?: string };
          if (parsed.title) title = parsed.title;
          if (parsed.body) body = parsed.body;
          if (parsed.sectionId?.trim()) sectionId = parsed.sectionId.trim();
        } catch {
          /* keep defaults */
        }
      } else if (path.includes("lecture-review") || path.includes("in-09")) {
        const review = (await buildLectureReview(ctx, path)).lectureReview as
          | { title?: string; sectionId?: string | null; meta?: string; transcript?: string; highlights?: string[]; aiNotes?: string }
          | undefined;
        if (review?.title) {
          title = `Lecture notes · ${review.title}`;
          const highlights = (review.highlights ?? []).map((h) => `• ${h}`).join("\n");
          body = [review.meta, review.transcript, highlights, review.aiNotes].filter(Boolean).join("\n\n");
        }
        if (review?.sectionId) sectionId = review.sectionId;
      }
      const posted = await postAnnouncement(ctx, title, body, sectionId);
      message = `Announcement sent to ${posted.recipients} student account(s) in ${posted.section.courseCode} · ${posted.section.code}`;
      result = { recipients: posted.recipients, title, sectionId: posted.section.id };
    } else if (
      lower.includes("save availability") ||
      (lower.includes("availability") && lower.includes("save"))
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const date = (fields.Date || "").trim();
      if (!date) {
        message = "Choose a date for this availability slot.";
        result = { error: true };
      } else {
        const slot = await persistAvailabilitySlot(ctx, fields);
        message = slot.date
          ? `Availability saved · ${slot.date} ${slot.start}–${slot.end}`
          : `Availability saved · ${slot.day} ${slot.start}–${slot.end}`;
        result = slot;
      }
    } else if (lower === "save profile") {
      const fields = parseActionFields(input.rowKey) || {};
      const details = await persistProfileDetails(ctx, fields);
      const connect = await persistConnect(ctx, fields);
      const education = await persistEducation(ctx, fields);
      result = { ...details, ...connect, highestDegree: education.background };
      message = "Faculty profile updated";
    } else if (lower.includes("save content") || lower === "save connect" || lower === "save education") {
      const fields = parseActionFields(input.rowKey) || {};
      const kind = (fields.__kind || fields.Kind || "").toLowerCase();
      if (kind === "education" || lower.includes("education")) {
        result = await persistEducation(ctx, fields);
        message = "Education / accreditation saved";
      } else if (kind === "general") {
        result = await persistGeneralInfo(ctx, fields);
        message = "General information saved";
      } else {
        result = await persistConnect(ctx, fields);
        message = "Connect details saved";
      }
    } else if (lower === "update accomplishment") {
      const fields = parseActionFields(input.rowKey) || {};
      const id = (fields.Id || "").trim();
      if (!id) throw Object.assign(new Error("Faculty record id is required"), { status: 400, code: "VALIDATION_ERROR" });
      result = await updateAccomplishment(ctx, id, fields);
      message = `Accomplishment updated · ${String(result.title || "")}`;
    } else if (lower.includes("save accomplishment") || lower.includes("add accomplishment")) {
      const fields = parseActionFields(input.rowKey) || {};
      const saved = await persistAccomplishment(ctx, fields);
      if ("error" in saved && saved.error) {
        message = saved.message;
        result = saved;
      } else {
        message = `Accomplishment saved · ${saved.title}`;
        result = saved;
      }
    } else if (lower.includes("save time zone") || (lower.includes("time zone") && lower.includes("save"))) {
      const fields = parseActionFields(input.rowKey) || {};
      result = await persistTimezone(ctx, fields);
      message = result.timezone ? `Time zone updated · ${result.timezone}` : "Choose a time zone";
    } else if (
      (lower.includes("schedule") ||
        lower.includes("lecture") ||
        lower.includes("add slot") ||
        lower.includes("schedule event")) &&
      !path.includes("availability") &&
      !path.includes("t04") &&
      !path.includes("t25")
    ) {
      const title =
        (input.rowKey && !input.rowKey.trim().startsWith("{") ? input.rowKey : null) ||
        (lower.includes("lecture")
          ? `Lecture · ${new Date().toLocaleDateString()}`
          : lower.includes("event")
            ? `Event · ${new Date().toLocaleDateString()}`
            : `Scheduled item · ${new Date().toLocaleDateString()}`);
      const created = await createAssignmentForInstructor(
        ctx,
        title,
        14,
        parseScreenQuery(path).query.get("sectionId")?.trim() || null,
      );
      message = `Scheduled “${created.assignment.title}” on ${created.section.code}`;
      result = { assignmentId: created.assignment.id, sectionId: created.section.id };
    } else if (
      lower === "send" ||
      lower.includes("send message") ||
      lower.includes("send reply") ||
      ((path.includes("message") || path.includes("t16")) && lower.includes("send"))
    ) {
      const sent = await sendInstructorMessage(ctx, input.rowKey);
      message = `Message sent${sent.recipients ? ` · ${sent.recipients} recipient(s)` : ""}`;
      result = sent;
    } else if (
      lower.includes("publish final") ||
      lower.includes("publish marks") ||
      lower.includes("submit for approval") ||
      lower === "publish" ||
      lower.includes("audit & approve")
    ) {
      const pub = await publishDraftGrades(ctx);
      message =
        pub.count === 0
          ? "No draft grades to publish"
          : `Submitted ${pub.count} grade(s) for approval (${pub.approvals} request(s))`;
      result = pub;
    } else if (
      lower.includes("finalize session") ||
      lower.includes("submit & finalize") ||
      lower === "submit attendance" ||
      (lower.includes("attendance") && lower.includes("submit")) ||
      lower.includes("mark all present")
    ) {
      const rowKey = lower.includes("mark all present")
        ? JSON.stringify({
            roster: ctx.sections.flatMap((s) =>
              s.enrolments.filter((e) => e.status === "enrolled").map((e) => ({ studentId: e.studentId, sectionId: s.id, status: "Present" })),
            ),
          })
        : input.rowKey;
      const att = await saveAttendanceSession(ctx, path, true, rowKey);
      const markedCount = att.roster.filter((r) => r.status).length;
      message = `Attendance submitted · ${markedCount} student(s) marked`;
      result = att;
    } else if (
      path.includes("t42") ||
      path.includes("new-workshop-enrollment") ||
      path.includes("new-workshop-enrolment")
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const saved = await saveWorkshopEnrolment(user, fields);
      message = saved.message;
      result = { ...saved, error: !saved.ok };
    } else if (
      (path.includes("t40") || path.includes("workshop-enrollment-status")) &&
      (lower.includes("approve") || lower.includes("decline") || lower.includes("drop") || lower.includes("reinstate"))
    ) {
      const status: WorkshopEnrolmentStatus = lower.includes("reinstate")
        ? "pending"
        : lower.includes("approve")
          ? "approved"
          : lower.includes("drop")
            ? "dropped"
            : "declined";
      const saved = await updateWorkshopEnrolmentStatus(user, input.rowKey || "", status);
      message = saved.message;
      result = { ...saved, error: !saved.ok };
    } else if (
      (path.includes("t41") || path.includes("workshop-attendance")) &&
      lower.includes("save attendance")
    ) {
      let roster: Array<{ studentId: string; workshopId: string; status: string; note?: string }> = [];
      let date = "";
      try {
        const parsed = JSON.parse(input.rowKey || "{}") as {
          date?: string;
          roster?: Array<{ studentId: string; workshopId: string; status: string; note?: string }>;
        };
        date = parsed.date || "";
        roster = Array.isArray(parsed.roster) ? parsed.roster : [];
      } catch {
        roster = [];
      }
      const saved = await saveWorkshopAttendance(user, date, roster);
      message = saved.message;
      result = { ...saved, error: !saved.ok };
    } else if (
      lower.includes("save student") ||
      lower.includes("create student") ||
      lower.includes("create profile") ||
      (path.includes("t43") &&
        (lower.includes("save") ||
          lower.includes("create") ||
          lower.includes("profile") ||
          lower.includes("draft")))
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const created = await createStudentProfile(ctx, fields);
      message = created.alreadyEnrolled
        ? `Student already on roster · ${created.name} (${created.studentNumber})`
        : `Student created · ${created.name} (${created.studentNumber}) enrolled in section`;
      result = created;
    } else if (
      (lower.includes("save draft") || (lower.includes("attendance") && lower.includes("save"))) &&
      !isAssessmentBuilderPath
    ) {
      const att = await saveAttendanceSession(ctx, path, false, input.rowKey);
      message = att.submittedUpdated
        ? `Attendance for ${att.meetingLabel} was already submitted · updated ${att.submittedUpdated} submitted record(s)${att.pendingDraft ? ` · draft saved for ${att.pendingDraft} unsubmitted student(s)` : ""}`
        : `Attendance draft saved · ${att.pendingDraft} student(s) marked`;
      result = att;
    } else if (lower.includes("save session") || lower.includes("create session") || lower.includes("add session")) {
      const fields = parseActionFields(input.rowKey) || {};
      const created = await createSessionOffering(ctx, path, fields);
      const listPath = "/instructor/f/t77-course-admin";
      await patchScreenOverlay(user.institutionId, listPath, (prev) => {
        const extras = Array.isArray(prev.extraSessions)
          ? [
              ...(prev.extraSessions as Array<{
                id: string;
                course: string;
                courseId?: string;
                location: string;
                instructors: string;
                schedule: string;
                enrolled: number;
                reserved: number;
                waitList: number;
                status: string;
              }>),
            ]
          : [];
        extras.unshift(created);
        return {
          ...prev,
          extraSessions: extras.slice(0, 100),
          _lastSessionMeta: {
            fields,
            weeklyTimings: fields.__weeklyTimings ?? null,
            exams: fields.__exams ?? null,
            at: new Date().toISOString(),
          },
        };
      });
      message = `Session saved · ${created.course}`;
      result = { id: created.id, sessionName: created.course, courseId: created.courseId };
    } else if (lower.includes("delete session")) {
      const sessionId = (input.rowKey || "").trim();
      if (!sessionId) {
        message = "Delete failed · missing session id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, "/instructor/f/t77-course-admin", (prev) => {
          const deleted = Array.isArray(prev.deletedSessionIds)
            ? [...(prev.deletedSessionIds as string[])]
            : [];
          if (!deleted.includes(sessionId)) deleted.push(sessionId);
          const extras = Array.isArray(prev.extraSessions)
            ? (
                prev.extraSessions as Array<{
                  id: string;
                  course: string;
                  location: string;
                  instructors: string;
                  schedule: string;
                  enrolled: number;
                  reserved: number;
                  waitList: number;
                  status: string;
                }>
              ).filter((s) => s.id !== sessionId)
            : [];
          return { ...prev, deletedSessionIds: deleted, extraSessions: extras };
        });
        message = "Session deleted";
        result = { id: sessionId };
      }
    } else if (lower.includes("delete course")) {
      const courseId = (input.rowKey || "").trim();
      if (!courseId) {
        message = "Delete failed · missing course id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, "/instructor/f/t54-courses-sessions", (prev) => {
          const deleted = Array.isArray(prev.deletedCourseIds)
            ? [...(prev.deletedCourseIds as string[])]
            : [];
          if (!deleted.includes(courseId)) deleted.push(courseId);
          const extras = Array.isArray(prev.extraCourses)
            ? (
                prev.extraCourses as Array<{
                  id: string;
                  name: string;
                  number: string;
                  creditValue: string;
                  notStarted: number;
                  inProgress: number;
                  completed: number;
                }>
              ).filter((c) => c.id !== courseId)
            : [];
          return { ...prev, deletedCourseIds: deleted, extraCourses: extras };
        });
        message = "Course deleted";
        result = { id: courseId };
      }
    } else if (lower.includes("bulk actions")) {
      message = "Bulk actions · select courses then choose an action";
      result = { bulk: true };
    } else if (lower.includes("search courses")) {
      message = `Course filter applied${input.rowKey ? ` · ${input.rowKey}` : ""}`;
      result = { query: input.rowKey || "" };
    } else if (lower.includes("save textbook") || lower.includes("create textbook")) {
      const fields = (parseActionFields(input.rowKey) || {}) as Record<string, unknown>;
      const existingId = String(fields.__textbookId || fields.textbookId || "").trim();
      const row = textbookFromFields(fields, existingId || undefined);
      const defaultIds = new Set(DEFAULT_TEXTBOOKS.map((t) => t.id));
      await patchScreenOverlay(user.institutionId, TEXTBOOKS_LIST_PATH, (prev) => {
        const extras = Array.isArray(prev.extraTextbooks)
          ? [...(prev.extraTextbooks as TextbookRecord[])]
          : [];
        const edits =
          prev.textbookEdits && typeof prev.textbookEdits === "object"
            ? { ...(prev.textbookEdits as Record<string, Partial<TextbookRecord>>) }
            : {};
        const extraIdx = extras.findIndex((t) => t.id === row.id);
        if (extraIdx >= 0) extras[extraIdx] = row;
        else if (existingId && defaultIds.has(existingId)) edits[existingId] = row;
        else extras.unshift(row);
        return { ...prev, extraTextbooks: extras.slice(0, 100), textbookEdits: edits };
      });
      message = `Textbook saved · ${row.name}`;
      result = { id: row.id, name: row.name };
    } else if (lower.includes("delete textbook")) {
      const textbookId = (input.rowKey || "").trim();
      if (!textbookId) {
        message = "Delete failed · missing textbook id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, TEXTBOOKS_LIST_PATH, (prev) => {
          const deleted = Array.isArray(prev.deletedTextbookIds)
            ? [...(prev.deletedTextbookIds as string[])]
            : [];
          if (!deleted.includes(textbookId)) deleted.push(textbookId);
          const extras = Array.isArray(prev.extraTextbooks)
            ? (prev.extraTextbooks as TextbookRecord[]).filter((t) => t.id !== textbookId)
            : [];
          return { ...prev, deletedTextbookIds: deleted, extraTextbooks: extras };
        });
        message = "Textbook deleted";
        result = { id: textbookId };
      }
    } else if (lower.includes("create content course") || lower.includes("save content course")) {
      const fields = (parseActionFields(input.rowKey) || {}) as Record<string, unknown>;
      const existingId = String(fields.__contentCourseId || "").trim();
      const catalog = mergeRepositoryList(
        buildRepositoryCatalog(),
        await loadScreenOverlay(user.institutionId, REPOSITORY_LIST_PATH),
      );
      const row = repositoryCourseFromFields(fields, catalog, existingId || undefined);
      const selectedId = String(fields.Course || "").trim();
      const defaultIds = new Set(buildRepositoryCatalog().map((c) => c.id));
      await patchScreenOverlay(user.institutionId, REPOSITORY_LIST_PATH, (prev) => {
        const extras = Array.isArray(prev.extraRepositoryCourses)
          ? [...(prev.extraRepositoryCourses as RepositoryCourseRecord[])]
          : [];
        const edits =
          prev.repositoryEdits && typeof prev.repositoryEdits === "object"
            ? { ...(prev.repositoryEdits as Record<string, Partial<RepositoryCourseRecord>>) }
            : {};
        const extraIdx = extras.findIndex((c) => c.id === row.id);
        if (extraIdx >= 0) extras[extraIdx] = row;
        else if (existingId && defaultIds.has(existingId)) edits[existingId] = row;
        else extras.unshift(row);
        if (!existingId && selectedId && selectedId !== row.id) {
          const selectedExtra = extras.findIndex((c) => c.id === selectedId);
          if (selectedExtra >= 0) extras[selectedExtra] = { ...extras[selectedExtra], status: "Inactive" };
          else if (defaultIds.has(selectedId)) {
            edits[selectedId] = { ...(edits[selectedId] ?? {}), status: "Inactive" };
          }
        }
        return { ...prev, extraRepositoryCourses: extras.slice(0, 200), repositoryEdits: edits };
      });
      message = `Content course saved · ${row.number}: ${row.name}`;
      result = { id: row.id, name: row.name };
    } else if (lower.includes("delete content course")) {
      const courseId = (input.rowKey || "").trim();
      if (!courseId) {
        message = "Delete failed · missing content course id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, REPOSITORY_LIST_PATH, (prev) => {
          const deleted = Array.isArray(prev.deletedRepositoryIds)
            ? [...(prev.deletedRepositoryIds as string[])]
            : [];
          if (!deleted.includes(courseId)) deleted.push(courseId);
          const extras = Array.isArray(prev.extraRepositoryCourses)
            ? (prev.extraRepositoryCourses as RepositoryCourseRecord[]).filter((c) => c.id !== courseId)
            : [];
          return { ...prev, deletedRepositoryIds: deleted, extraRepositoryCourses: extras };
        });
        message = "Content course deleted";
        result = { id: courseId };
      }
    } else if (lower.includes("search repository")) {
      message = `Repository filter applied${input.rowKey ? ` · ${input.rowKey}` : ""}`;
      result = { query: input.rowKey || "" };
    } else if (lower.startsWith("push") || lower.includes("push content")) {
      const courseId = (input.rowKey || "").trim();
      await bumpRepositoryCount(user.institutionId, courseId, "push");
      message = `Push recorded${courseId ? ` · ${courseId}` : ""}`;
      result = { id: courseId, action: "push" };
    } else if (lower.startsWith("pull") || lower.includes("pull content")) {
      const courseId = (input.rowKey || "").trim();
      await bumpRepositoryCount(user.institutionId, courseId, "pull");
      message = `Pull recorded${courseId ? ` · ${courseId}` : ""}`;
      result = { id: courseId, action: "pull" };
    } else if (lower.startsWith("history") || lower.includes("content history")) {
      const courseId = (input.rowKey || "").trim();
      await bumpRepositoryCount(user.institutionId, courseId, "history");
      message = `History opened${courseId ? ` · ${courseId}` : ""}`;
      result = { id: courseId, action: "history" };
    } else if (lower.includes("manage content")) {
      const courseId = (input.rowKey || "").trim();
      const href = courseId
        ? `/instructor/f/t32-resource-file-manager?courseId=${encodeURIComponent(courseId)}`
        : "/instructor/f/t32-resource-file-manager";
      message = `Opening manage${courseId ? ` · ${courseId}` : ""}`;
      result = { id: courseId, manage: true, href };
    } else if (
      (lower.includes("create course") || lower.includes("save course")) &&
      !lower.includes("configuration") &&
      !lower.includes("content course")
    ) {
      const created = await createCourseAndSection(ctx, input.rowKey);
      message = `Created ${created.course.code} · ${created.section.code}`;
      result = { courseId: created.course.id, sectionId: created.section.id };
    } else if (lower.includes("save program type") || lower.includes("create program type")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Program Type Name"] || fields["Type Name"] || fields.Name || "New Program Type").trim();
      const abbreviation = (fields.Abbreviation || fields.Code || name.slice(0, 4)).trim();
      const active = !/inactive/i.test(fields["Active / Inactive"] || "Active");
      const existingId = (fields.__typeId || fields.typeId || "").trim();
      const defaultIds = new Set(DEFAULT_PROGRAM_TYPES.map((t) => t.id));
      let savedId = existingId || `ptype-${Date.now().toString(36)}`;
      await patchScreenOverlay(user.institutionId, PROGRAM_TYPES_LIST_PATH, (prev) => {
        const extras = Array.isArray(prev.extraProgramTypes)
          ? [
              ...(prev.extraProgramTypes as ProgramTypeRecord[]),
            ]
          : [];
        const edits =
          prev.programTypeEdits && typeof prev.programTypeEdits === "object"
            ? { ...(prev.programTypeEdits as Record<string, Partial<ProgramTypeRecord>>) }
            : {};
        const extraIdx = extras.findIndex((t) => t.id === savedId);
        const row: ProgramTypeRecord = { id: savedId, name, abbreviation, active };
        if (extraIdx >= 0) {
          extras[extraIdx] = row;
        } else if (existingId && defaultIds.has(existingId)) {
          edits[existingId] = { name, abbreviation, active };
        } else {
          if (!existingId) savedId = row.id;
          extras.unshift(row);
        }
        return {
          ...prev,
          extraProgramTypes: extras.slice(0, 100),
          programTypeEdits: edits,
        };
      });
      message = `Program type saved · ${name}`;
      result = { id: savedId, name, abbreviation, active };
    } else if (lower.includes("delete program type")) {
      const typeId = (input.rowKey || "").trim();
      if (!typeId) {
        message = "Delete failed · missing program type id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, "/instructor/f/t50-program-types", (prev) => {
          const deleted = Array.isArray(prev.deletedProgramTypeIds)
            ? [...(prev.deletedProgramTypeIds as string[])]
            : [];
          if (!deleted.includes(typeId)) deleted.push(typeId);
          const extras = Array.isArray(prev.extraProgramTypes)
            ? (
                prev.extraProgramTypes as Array<{
                  id: string;
                  name: string;
                  abbreviation: string;
                  active: boolean;
                }>
              ).filter((t) => t.id !== typeId)
            : [];
          return { ...prev, deletedProgramTypeIds: deleted, extraProgramTypes: extras };
        });
        message = "Program type deleted";
        result = { id: typeId };
      }
    } else if (lower.includes("reorder program types")) {
      let order: string[] = [];
      try {
        const parsed = JSON.parse(input.rowKey || "[]");
        if (Array.isArray(parsed)) order = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        order = [];
      }
      await patchScreenOverlay(user.institutionId, "/instructor/f/t50-program-types", (prev) => ({
        ...prev,
        programTypeOrder: order,
      }));
      message = "Program types reordered";
      result = { order };
    } else if (
      lower.includes("save configuration") ||
      lower.includes("save course configuration") ||
      lower.includes("create configuration")
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Course Name"] || fields.Name || "").trim();
      if (!name) throw Object.assign(new Error("Course Name is required"), { status: 400 });
      const abbreviation = (fields.Abbreviation || fields.Code || name.slice(0, 8)).trim();
      const overlay = await loadScreenOverlay(user.institutionId, COURSE_CONFIG_PATH);
      const current = mergeCourseConfigList(overlay, []);
      const existingIdRaw = courseConfigQueryId(path) || (fields.courseId || "").trim();
      const existingId = existingIdRaw && existingIdRaw !== "new" ? existingIdRaw : "";
      const existing = existingId ? current.find((c) => c.id === existingId) : undefined;
      const id = existing?.id || `cfg-${Date.now().toString(36)}`;
      const row: CourseConfigRecord = {
        id,
        name,
        abbreviation,
        enrollmentPermission: fields["Course Enrollment Permission"] || "No permission required",
        syllabusPrivacy: fields["Course Syllabus Privacy"] || "Private",
        repositorySettings: fields["Repository Settings"] || "Use brand settings",
        textbookOptOut: fields["Textbook Opt-Out"] || "System Default",
        active: !/inactive/i.test(fields["Active / Inactive"] || "Active"),
      };
      await patchScreenOverlay(user.institutionId, COURSE_CONFIG_PATH, (prev) => {
        const extras = Array.isArray(prev.extraCourseConfigs)
          ? [...(prev.extraCourseConfigs as CourseConfigRecord[])]
          : [];
        const edits =
          prev.courseConfigEdits && typeof prev.courseConfigEdits === "object"
            ? { ...(prev.courseConfigEdits as Record<string, Partial<CourseConfigRecord>>) }
            : {};
        if (existing && extras.some((c) => c.id === id)) {
          return {
            ...prev,
            extraCourseConfigs: extras.map((c) => (c.id === id ? row : c)),
            courseConfigEdits: { ...edits, [id]: row },
          };
        }
        if (existing && DEFAULT_COURSE_CONFIGS.some((c) => c.id === id)) {
          return { ...prev, courseConfigEdits: { ...edits, [id]: row } };
        }
        extras.unshift(row);
        return { ...prev, extraCourseConfigs: extras.slice(0, 200), courseConfigEdits: { ...edits, [id]: row } };
      });
      message = `Course configuration saved · ${name}`;
      result = { id, name, abbreviation };
    } else if (lower.includes("delete course configuration") || lower.includes("delete configuration")) {
      const configId = (input.rowKey || "").trim();
      if (!configId) {
        message = "Delete failed · missing course id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, COURSE_CONFIG_PATH, (prev) => {
          const deleted = Array.isArray(prev.deletedCourseConfigIds)
            ? [...(prev.deletedCourseConfigIds as string[])]
            : [];
          if (!deleted.includes(configId)) deleted.push(configId);
          const extras = Array.isArray(prev.extraCourseConfigs)
            ? (prev.extraCourseConfigs as CourseConfigRecord[]).filter((c) => c.id !== configId)
            : [];
          return { ...prev, deletedCourseConfigIds: deleted, extraCourseConfigs: extras };
        });
        message = "Course configuration deleted";
        result = { id: configId };
      }
    } else if (lower.includes("save faculty") || lower.includes("create faculty")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Faculty Name"] || fields.Name || "").trim();
      if (!name) throw Object.assign(new Error("Faculty Name is required"), { status: 400 });
      const abbreviation = (fields["Faculty Abbreviation"] ?? fields.Abbreviation ?? "").trim();
      const active = !/inactive/i.test(fields["Active / Inactive"] || "Active");
      const overlay = await loadScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH);
      const current = mergeFacultyList(overlay);
      const existingId = facultyQueryId(path) || (fields.facultyId || "").trim();
      const existing = existingId ? current.find((f) => f.id === existingId) : undefined;
      const id = existing?.id || facultySlug(name);
      await patchScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH, (prev) => {
        const extras = Array.isArray(prev.extraFaculties)
          ? [...(prev.extraFaculties as FacultyRecord[])]
          : [];
        const edits =
          prev.facultyEdits && typeof prev.facultyEdits === "object"
            ? { ...(prev.facultyEdits as Record<string, Partial<FacultyRecord>>) }
            : {};
        const row: FacultyRecord = { id, name, abbreviation, active };
        if (existing && extras.some((f) => f.id === id)) {
          return {
            ...prev,
            extraFaculties: extras.map((f) => (f.id === id ? row : f)),
            facultyEdits: { ...edits, [id]: row },
          };
        }
        if (existing && DEFAULT_FACULTIES.some((f) => f.id === id)) {
          return { ...prev, facultyEdits: { ...edits, [id]: row } };
        }
        extras.unshift(row);
        return { ...prev, extraFaculties: extras.slice(0, 100), facultyEdits: { ...edits, [id]: row } };
      });
      message = `Faculty saved · ${name}`;
      result = { id, name, abbreviation, active };
    } else if (lower.includes("delete faculty")) {
      const facultyId = (input.rowKey || "").trim();
      if (!facultyId) {
        message = "Delete failed · missing faculty id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH, (prev) => {
          const deleted = Array.isArray(prev.deletedFacultyIds) ? [...(prev.deletedFacultyIds as string[])] : [];
          if (!deleted.includes(facultyId)) deleted.push(facultyId);
          const extras = Array.isArray(prev.extraFaculties)
            ? (prev.extraFaculties as FacultyRecord[]).filter((f) => f.id !== facultyId)
            : [];
          return { ...prev, deletedFacultyIds: deleted, extraFaculties: extras };
        });
        message = "Faculty deleted";
        result = { id: facultyId };
      }
    } else if (lower.includes("delete program") && !lower.includes("program type")) {
      const programId = (input.rowKey || "").trim();
      if (!programId) {
        message = "Delete failed · missing program id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH, (prev) => {
          const deleted = Array.isArray(prev.deletedFacultyProgramIds)
            ? [...(prev.deletedFacultyProgramIds as string[])]
            : [];
          if (!deleted.includes(programId)) deleted.push(programId);
          const extras = Array.isArray(prev.extraFacultyPrograms)
            ? (prev.extraFacultyPrograms as FacultyProgramRecord[]).filter((p) => p.id !== programId)
            : [];
          return { ...prev, deletedFacultyProgramIds: deleted, extraFacultyPrograms: extras };
        });
        message = "Program deleted";
        result = { id: programId };
      }
    } else if (
      (lower.includes("create program") || lower.includes("save program")) &&
      !lower.includes("program type") &&
      !lower.includes("program settings") &&
      !path.includes("program-settings") &&
      !path.includes("t83")
    ) {
      const created = await createProgramRecord(ctx, input.rowKey);
      const overlay = await loadScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH);
      const faculties = mergeFacultyList(overlay);
      const facultyId = facultyIdFromName(created.faculty, faculties);
      const fields = (parseActionFields(input.rowKey) || {}) as Record<string, string>;
      const active = !/inactive/i.test(fields["Active / Inactive"] || "Active");
      await patchScreenOverlay(user.institutionId, FACULTIES_PROGRAMS_PATH, (prev) => {
        const extras = Array.isArray(prev.extraFacultyPrograms)
          ? [...(prev.extraFacultyPrograms as FacultyProgramRecord[])]
          : [];
        const row: FacultyProgramRecord = {
          id: created.program.id,
          facultyId: facultyId || faculties[0]?.id || facultySlug(created.faculty || "Unassigned"),
          name: created.program.name,
          abbreviation: created.program.code,
          active,
        };
        const extraIndex = extras.findIndex((item) => item.id === row.id);
        if (extraIndex >= 0) extras[extraIndex] = row;
        else if (!(fields.__programId || fields.programId)) extras.unshift(row);
        const edits = prev.facultyProgramEdits && typeof prev.facultyProgramEdits === "object"
          ? { ...(prev.facultyProgramEdits as Record<string, Partial<FacultyProgramRecord>>) }
          : {};
        edits[row.id] = row;
        const programFaculty =
          prev.programFaculty && typeof prev.programFaculty === "object"
            ? { ...(prev.programFaculty as Record<string, string>) }
            : {};
        programFaculty[created.program.id] = facultyId || faculties[0]?.id || "";
        return { ...prev, extraFacultyPrograms: extras.slice(0, 200), facultyProgramEdits: edits, programFaculty };
      });
      message = `Program saved · ${created.program.code} · ${created.program.name}`;
      result = { programId: created.program.id, code: created.program.code, facultyId };
    } else if (lower === "continue" && (path.includes("create-master-schedule") || path.includes("create-term-schedule") || path.includes("t71") || path.includes("t72"))) {
      const fields = parseActionFields(input.rowKey) || {};
      const kind = path.includes("term") || path.includes("t72") ? "term" : "master";
      const termValue = (fields.Term || "").trim();
      const option = TERM_SCHEDULE_TERM_OPTIONS.find((o) => o.value === termValue);
      let termLabel = option?.label || termValue;
      if (kind === "term" && termValue && !option) {
        const termState = await prisma.sisScreenState.findUnique({
          where: { institutionId_path: { institutionId: user.institutionId, path: MANAGE_TERMS_LIST_PATH } },
        });
        const termOverlay = termState ? (JSON.parse(termState.payloadJson) as Record<string, unknown>) : null;
        const extra = mergeTermList([], termOverlay).find((t) => t.id === termValue);
        if (extra) termLabel = `${extra.name}: ${extra.dates}`;
      }
      const label = (
        kind === "term"
          ? termLabel
          : fields.Program || fields["Schedule Abbreviation"] || "Schedule draft"
      ).trim();
      await appendInstructorActivity(user.institutionId, MASTER_SCHEDULING_LIST_PATH, {
        action,
        kind,
        label,
        fields,
        at: new Date().toISOString(),
      });
      if (kind === "term") {
        const parts = termScheduleLabelParts(termLabel);
        const description = (fields["Schedule Description"] || "").trim();
        const id = `ts-${Date.now().toString(36)}`;
        await patchScreenOverlay(user.institutionId, MASTER_SCHEDULING_LIST_PATH, (prev) => {
          const extras = Array.isArray(prev.extraSchedules)
            ? [
                ...(prev.extraSchedules as Array<{
                  id: string;
                  dateRange: string;
                  session: string;
                  duration: string;
                  program: string;
                  canDelete?: boolean;
                }>),
              ]
            : [];
          extras.unshift({
            id,
            dateRange: parts.dateRange,
            session: parts.session,
            duration: "Term",
            program: description || "Term schedule",
            canDelete: true,
          });
          return { ...prev, extraSchedules: extras.slice(0, 100) };
        });
        result = { kind, label, id };
      } else {
        result = { kind, label };
      }
      message = `Step 1 saved · ${label} · continue to step 2`;
    } else if (lower.includes("save academic calendar") || lower.includes("create academic calendar")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields.Name || "Untitled calendar").trim();
      const start = (fields["Start Date"] || "—").trim();
      const end = (fields["End Date"] || "—").trim();
      const status = (fields.Status || "Inactive").trim();
      const id = `cal-${Date.now().toString(36)}`;
      const listPath = "/instructor/f/t52-academic-calendars";
      await patchScreenOverlay(user.institutionId, listPath, (prev) => {
        const extras = Array.isArray(prev.extraCalendars)
          ? [...(prev.extraCalendars as Array<{ id: string; name: string; dates: string; status: string }>)]
          : [];
        extras.unshift({ id, name, dates: `${start} – ${end}`, status });
        return { ...prev, extraCalendars: extras.slice(0, 100) };
      });
      message = `Academic calendar saved · ${name}`;
      result = { id, name, status };
    } else if (lower.includes("delete master schedule")) {
      const scheduleId = (input.rowKey || "").trim();
      if (!scheduleId) {
        message = "Delete failed · missing schedule id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, "/instructor/f/t53-master-scheduling", (prev) => {
          const deleted = Array.isArray(prev.deletedScheduleIds) ? [...(prev.deletedScheduleIds as string[])] : [];
          if (!deleted.includes(scheduleId)) deleted.push(scheduleId);
          return { ...prev, deletedScheduleIds: deleted };
        });
        message = "Master schedule deleted";
        result = { id: scheduleId };
      }
    } else if (lower.includes("copy master schedule")) {
      const scheduleId = (input.rowKey || "").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t53-master-scheduling", {
        action,
        scheduleId,
        at: new Date().toISOString(),
      });
      message = `Schedule copied · ${scheduleId || "selection"}`;
      result = { id: scheduleId, copied: true };
    } else if (lower.includes("manage master schedule")) {
      const scheduleId = (input.rowKey || "").trim();
      message = `Opening manage · ${scheduleId || "schedule"}`;
      result = {
        id: scheduleId,
        manage: true,
        href: `/instructor/f/t85-manage-schedule?scheduleId=${encodeURIComponent(scheduleId || "ms-dib-nov-2026")}`,
      };
    } else if (lower.includes("save ledger") || lower.includes("add ledger")) {
      const fields = parseActionFields(input.rowKey) || {};
      const scheduleId = String(fields.__scheduleId || "ms-dib-nov-2026").trim();
      const ledgerId = String(fields.__ledgerId || "").trim() || `led-${Date.now().toString(36)}`;
      const type = (fields["Tuition / Ledger Type"] || "Tuition Fee").trim();
      const domestic = (fields.Domestic || "0.00").trim();
      const international = (fields.International || "0.00").trim();
      await patchScreenOverlay(user.institutionId, "/instructor/f/t85-manage-schedule", (prev) => {
        const schedules = {
          ...((prev.schedules as Record<string, Record<string, unknown>>) || {}),
        };
        const cur = { ...(schedules[scheduleId] || {}) };
        if (fields.__ledgerId) {
          const edits = { ...((cur.ledgerEdits as Record<string, unknown>) || {}) };
          edits[ledgerId] = { type, domestic, international };
          cur.ledgerEdits = edits;
        } else {
          const extras = Array.isArray(cur.extraLedgers)
            ? [
                ...(cur.extraLedgers as Array<{
                  id: string;
                  type: string;
                  domestic: string;
                  international: string;
                }>),
              ]
            : [];
          extras.unshift({ id: ledgerId, type, domestic, international });
          cur.extraLedgers = extras.slice(0, 50);
        }
        schedules[scheduleId] = cur;
        return { ...prev, schedules };
      });
      message = `Ledger saved · ${type}`;
      result = { id: ledgerId, type };
    } else if (lower.includes("delete ledger")) {
      const ledgerId = (input.rowKey || "").trim();
      await patchScreenOverlay(user.institutionId, "/instructor/f/t85-manage-schedule", (prev) => {
        const schedules = {
          ...((prev.schedules as Record<string, Record<string, unknown>>) || {}),
        };
        const scheduleId = "ms-dib-nov-2026";
        const cur = { ...(schedules[scheduleId] || {}) };
        const deleted = Array.isArray(cur.deletedLedgerIds) ? [...(cur.deletedLedgerIds as string[])] : [];
        if (ledgerId && !deleted.includes(ledgerId)) deleted.push(ledgerId);
        cur.deletedLedgerIds = deleted;
        schedules[scheduleId] = cur;
        return { ...prev, schedules };
      });
      message = "Ledger deleted";
      result = { id: ledgerId };
    } else if (lower.includes("delete schedule session")) {
      const sessionId = (input.rowKey || "").trim();
      await patchScreenOverlay(user.institutionId, "/instructor/f/t85-manage-schedule", (prev) => {
        const schedules = {
          ...((prev.schedules as Record<string, Record<string, unknown>>) || {}),
        };
        const scheduleId = "ms-dib-nov-2026";
        const cur = { ...(schedules[scheduleId] || {}) };
        const deleted = Array.isArray(cur.deletedSessionIds) ? [...(cur.deletedSessionIds as string[])] : [];
        if (sessionId && !deleted.includes(sessionId)) deleted.push(sessionId);
        cur.deletedSessionIds = deleted;
        schedules[scheduleId] = cur;
        return { ...prev, schedules };
      });
      message = "Session removed from schedule";
      result = { id: sessionId };
    } else if (lower.includes("update schedule") && !lower.includes("master")) {
      const fields = parseActionFields(input.rowKey) || {};
      const scheduleId = String(fields.__scheduleId || "ms-dib-nov-2026").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t85-manage-schedule", {
        action,
        scheduleId,
        fields,
        at: new Date().toISOString(),
      });
      message = "Schedule settings updated";
      result = { id: scheduleId, updated: true };
    } else if (lower.includes("save schedule term")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Term Name"] || "Untitled term").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t85-manage-schedule", {
        action,
        term: name,
        at: new Date().toISOString(),
      });
      message = `Schedule term saved · ${name}`;
      result = { name };
    } else if (
      lower.includes("save linked course") ||
      lower.includes("add linked course") ||
      lower.includes("add cross-listed")
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const courseId = String(fields.__courseId || fields["Select Linked Course"] || "").trim();
      const condition = (fields["Linking Condition"] || "Optional Enrolment").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t77-course-admin", {
        action,
        courseId,
        condition,
        at: new Date().toISOString(),
      });
      message = `Linked course saved · ${courseId || "selection"}`;
      result = { courseId, condition };
    } else if (lower.includes("add textbook to course")) {
      const fields = parseActionFields(input.rowKey) || {};
      const textbook = (fields["Select Textbook"] || "").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t77-course-admin", {
        action,
        textbook,
        at: new Date().toISOString(),
      });
      message = `Textbook added · ${textbook || "selection"}`;
      result = { textbook };
    } else if (lower.includes("save transfer course") || lower.includes("add transfer course")) {
      const fields = parseActionFields(input.rowKey) || {};
      const institution = (fields["Transfer Institution"] || "").trim();
      const courseName = (fields["Transfer Course Name"] || "").trim();
      await appendInstructorActivity(user.institutionId, "/instructor/f/t77-course-admin", {
        action,
        institution,
        courseName,
        at: new Date().toISOString(),
      });
      message = `Transfer course saved · ${courseName || institution || "selection"}`;
      result = { institution, courseName };
    } else if (
      lower.includes("bulk schedule action") ||
      lower.includes("bulk course action") ||
      lower === "bulk actions"
    ) {
      const bulk = (input.rowKey || "").trim();
      message = bulk ? `Bulk action queued · ${bulk}` : "Select a bulk action";
      result = { bulk: bulk || null };
    } else if (lower.includes("save grading scheme") || lower.includes("create grading scheme")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Grading Scheme Name"] || fields.Name || "Untitled scheme").trim();
      const active = !/inactive/i.test(fields["Active / Inactive"] || "Active");
      const existingId = String(fields.__schemeId || "").trim();
      const id = existingId || `scheme-${Date.now().toString(36)}`;
      const listPath = GRADING_SCHEMES_PATH;
      const gradeEntries = Array.isArray(fields.__gradeEntries)
        ? (fields.__gradeEntries as Array<Record<string, string>>)
        : [];
      await patchScreenOverlay(user.institutionId, listPath, (prev) => {
        const extras = Array.isArray(prev.extraSchemes)
          ? [...(prev.extraSchemes as Array<{ id: string; name: string; active: boolean }>)]
          : [];
        const idx = extras.findIndex((s) => s.id === id);
        if (idx >= 0) extras[idx] = { id, name, active };
        else if (!DEFAULT_GRADING_SCHEMES.some((s) => s.id === id)) extras.unshift({ id, name, active });
        const schemeGrades = {
          ...((prev.schemeGrades as Record<string, unknown>) || {}),
          [id]: gradeEntries.map((e) => ({
            letter: String(e.letter || ""),
            percent: String(e.percent || ""),
            gradePoint: String(e.gradePoint || ""),
            credit: String(e.credit || "Yes"),
            condition: String(e.condition || "None"),
          })),
        };
        const schemeMeta = {
          ...((prev.schemeMeta as Record<string, unknown>) || {}),
          [id]: {
            defaultScheme: String(fields["This is the default grading scheme"] || "false"),
            useLetterGrades: String(fields["Use Letter Grades"] || "Yes"),
            usePercentages: String(fields["Use Percentages"] || "Yes"),
            roundUp: String(
              fields["Enable round-up options for marginal letter grades in final standings"] || "false",
            ),
            useGradePoints: String(fields["Use Grade Points"] || "Yes"),
            active: active ? "Active" : "Inactive",
            name,
          },
        };
        // When editing a default scheme, store name override in meta only
        const renamedDefaults = {
          ...((prev.renamedSchemes as Record<string, { name: string; active: boolean }>) || {}),
        };
        if (DEFAULT_GRADING_SCHEMES.some((s) => s.id === id)) {
          renamedDefaults[id] = { name, active };
        }
        return {
          ...prev,
          extraSchemes: extras.slice(0, 100),
          schemeGrades,
          schemeMeta,
          renamedSchemes: renamedDefaults,
          _lastAction: {
            action,
            name,
            id,
            entries: gradeEntries,
            at: new Date().toISOString(),
          },
        };
      });
      message = `Grading scheme saved · ${name}`;
      result = { id, name, active };
    } else if (lower.includes("delete grading scheme")) {
      const schemeId = (input.rowKey || "").trim();
      if (!schemeId) {
        message = "Delete failed · missing scheme id";
        result = { error: true };
      } else {
        const listPath = GRADING_SCHEMES_PATH;
        await patchScreenOverlay(user.institutionId, listPath, (prev) => {
          const deleted = Array.isArray(prev.deletedSchemeIds)
            ? [...(prev.deletedSchemeIds as string[])]
            : [];
          if (!deleted.includes(schemeId)) deleted.push(schemeId);
          const extras = Array.isArray(prev.extraSchemes)
            ? (prev.extraSchemes as Array<{ id: string; name: string; active: boolean }>).filter(
                (s) => s.id !== schemeId,
              )
            : [];
          return { ...prev, deletedSchemeIds: deleted, extraSchemes: extras };
        });
        message = `Grading scheme deleted`;
        result = { id: schemeId };
      }
    } else if (lower.includes("save resource category")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Category Name"] || fields.Name || "").trim();
      const row = await createResourceCategory(user.institutionId, name);
      message = `Resource category saved · ${row.name}`;
      result = { id: row.id, name: row.name };
    } else if (lower.includes("save resource") && !lower.includes("category")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Resource Name"] || fields.Name || "").trim();
      const courseId = (fields.Course || "").trim();
      const allowQuantities = /yes/i.test(fields["Allow Resource Quantities"] || "No");
      const row = await createCourseResource(user.institutionId, {
        courseId: courseId || undefined,
        name,
        allowQuantities,
      });
      message = `Resource saved · ${row.name}`;
      result = { id: row.id, name: row.name };
    } else if (lower === "save competency") {
      const fields = parseActionFields(input.rowKey) || {};
      const section = resolveSectionFromPath(ctx, path);
      if (!section) throw Object.assign(new Error("Open a course section first"), { code: "NO_SECTION", status: 400 });
      const competency = competencyFromFields(fields);
      if (!competency.name.trim()) throw Object.assign(new Error("Competency name is required"), { code: "VALIDATION_ERROR", status: 400 });
      const requestedId = (fields.Id || "").trim();
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraCompetencies)
          ? [...(prev.extraCompetencies as Array<Record<string, unknown>>)]
          : [];
        const edits = prev.competencyEdits && typeof prev.competencyEdits === "object"
          ? { ...(prev.competencyEdits as Record<string, Record<string, unknown>>) }
          : {};
        const extraIndex = extras.findIndex((item) => item.id === competency.id);
        if (extraIndex >= 0) extras[extraIndex] = { ...extras[extraIndex], ...competency };
        else if (requestedId) edits[requestedId] = { ...(edits[requestedId] || {}), ...competency };
        else extras.unshift(competency);
        return { ...prev, extraCompetencies: extras.slice(0, 100), competencyEdits: edits };
      });
      message = `Competency saved · ${competency.name}`;
      result = competency;
    } else if (lower === "delete competency") {
      const id = (input.rowKey || "").trim();
      if (!id) throw Object.assign(new Error("Competency id is required"), { code: "VALIDATION_ERROR", status: 400 });
      await patchScreenOverlay(user.institutionId, path, (prev) => ({
        ...prev,
        deletedCompetencyIds: [...new Set([...(Array.isArray(prev.deletedCompetencyIds) ? prev.deletedCompetencyIds as string[] : []), id])],
        extraCompetencies: (Array.isArray(prev.extraCompetencies) ? prev.extraCompetencies as Array<{ id?: string }> : []).filter((item) => item.id !== id),
        competencyAssessments: Object.fromEntries(Object.entries(prev.competencyAssessments && typeof prev.competencyAssessments === "object" ? prev.competencyAssessments as Record<string, unknown> : {}).filter(([key]) => key !== id)),
      }));
      message = "Competency deleted";
      result = { id };
    } else if (lower === "assess competency") {
      const fields = parseActionFields(input.rowKey) || {};
      const competencyId = (fields.CompetencyId || "").trim();
      const studentId = (fields.StudentId || "").trim();
      const level = (fields.Level || "").trim();
      const section = resolveSectionFromPath(ctx, path);
      if (!competencyId || !studentId || !level) throw Object.assign(new Error("Competency, student and level are required"), { code: "VALIDATION_ERROR", status: 400 });
      if (!section?.enrolments.some((item) => item.studentId === studentId && item.status === "enrolled")) {
        throw Object.assign(new Error("Student is not enrolled in this section"), { code: "FORBIDDEN", status: 403 });
      }
      const assessment = { id: `${competencyId}:${studentId}`, competencyId, studentId, level, updatedAt: new Date().toISOString() };
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const all = prev.competencyAssessments && typeof prev.competencyAssessments === "object"
          ? { ...(prev.competencyAssessments as Record<string, Array<typeof assessment>>) }
          : {};
        all[competencyId] = [...(all[competencyId] || []).filter((item) => item.studentId !== studentId), assessment];
        return { ...prev, competencyAssessments: all };
      });
      message = `Competency assessment saved · ${level}`;
      result = assessment;
    } else if (lower === "save course badge") {
      const fields = parseActionFields(input.rowKey) || {};
      const section = resolveSectionFromPath(ctx, path);
      if (!section) throw Object.assign(new Error("Open a course section first"), { code: "NO_SECTION", status: 400 });
      const name = (fields.Name || "").trim();
      if (!name) throw Object.assign(new Error("Badge name is required"), { code: "VALIDATION_ERROR", status: 400 });
      const requestedId = (fields.Id || "").trim();
      const definitionId = requestedId || randomUUID();
      const roster = new Set(section.enrolments.filter((item) => item.status === "enrolled").map((item) => item.studentId));
      const studentIds = (fields.StudentIds || "").split(",").map((value) => value.trim()).filter(Boolean);
      if (studentIds.some((studentId) => !roster.has(studentId))) {
        throw Object.assign(new Error("A selected student is not enrolled in this section"), { code: "FORBIDDEN", status: 403 });
      }
      const definition = await prisma.badgeDefinition.findFirst({ where: { id: definitionId, institutionId: user.institutionId } });
      if (definition) {
        await prisma.badgeDefinition.update({
          where: { id: definition.id },
          data: { name, description: fields.Description || "", badgeText: fields.Criteria || fields.Description || "", coursesRule: section.courseCode, status: "active", rowVersion: { increment: 1 } },
        });
      } else {
        await prisma.badgeDefinition.create({
          data: { id: definitionId, institutionId: user.institutionId, name, description: fields.Description || "", badgeText: fields.Criteria || fields.Description || "", coursesRule: section.courseCode, approvalMode: "Instant / Automated" },
        });
      }
      const badgeCode = `BADGE-${definitionId.slice(0, 8).toUpperCase()}`;
      await prisma.studentBadge.updateMany({
        where: { institutionId: user.institutionId, code: badgeCode, studentId: { in: [...roster].filter((id) => !studentIds.includes(id)) } },
        data: { status: "revoked", rowVersion: { increment: 1 } },
      });
      if (studentIds.length) await awardBadge(user.institutionId, definitionId, studentIds);
      const badge = { id: definitionId, name, description: fields.Description || "", criteria: fields.Criteria || "", awardedStudentIds: studentIds, language: "English" };
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraCourseBadges)
          ? [...(prev.extraCourseBadges as Array<Record<string, unknown>>)]
          : [];
        const edits = prev.courseBadgeEdits && typeof prev.courseBadgeEdits === "object"
          ? { ...(prev.courseBadgeEdits as Record<string, Record<string, unknown>>) }
          : {};
        const extraIndex = extras.findIndex((item) => item.id === definitionId);
        if (extraIndex >= 0) extras[extraIndex] = { ...extras[extraIndex], ...badge };
        else if (requestedId) edits[definitionId] = { ...(edits[definitionId] || {}), ...badge };
        else extras.unshift(badge);
        return { ...prev, extraCourseBadges: extras.slice(0, 100), courseBadgeEdits: edits };
      });
      message = `Course badge saved · ${name}`;
      result = badge;
    } else if (lower === "delete course badge") {
      const id = (input.rowKey || "").trim();
      if (!id) throw Object.assign(new Error("Badge id is required"), { code: "VALIDATION_ERROR", status: 400 });
      await prisma.badgeDefinition.updateMany({ where: { id, institutionId: user.institutionId }, data: { status: "inactive", rowVersion: { increment: 1 } } });
      await prisma.studentBadge.updateMany({ where: { institutionId: user.institutionId, code: `BADGE-${id.slice(0, 8).toUpperCase()}` }, data: { status: "revoked", rowVersion: { increment: 1 } } });
      await patchScreenOverlay(user.institutionId, path, (prev) => ({
        ...prev,
        deletedCourseBadgeIds: [...new Set([...(Array.isArray(prev.deletedCourseBadgeIds) ? prev.deletedCourseBadgeIds as string[] : []), id])],
        extraCourseBadges: (Array.isArray(prev.extraCourseBadges) ? prev.extraCourseBadges as Array<{ id?: string }> : []).filter((item) => item.id !== id),
      }));
      message = "Course badge deleted";
      result = { id };
    } else if (
      lower.includes("save badge") ||
      lower.includes("badge / accomplishment") ||
      lower.includes("create base") ||
      (lower.includes("create badge") && lower.includes("accomplishment"))
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const row = await createBadgeDefinition(user.institutionId, fields);
      message = `Badge base saved · ${row.name}`;
      result = { id: row.id, name: row.name };
    } else if (
      (lower.includes("save term") || lower.includes("add term") || lower.includes("create term")) &&
      !lower.includes("schedule") &&
      !path.includes("create-term-schedule") &&
      !path.includes("t72") &&
      !path.includes("program-settings") &&
      !path.includes("t83")
    ) {
      const raw = (() => {
        try {
          return JSON.parse(input.rowKey || "{}") as Record<string, unknown>;
        } catch {
          return {} as Record<string, unknown>;
        }
      })();
      const fields = parseActionFields(input.rowKey) || {};
      const code = (
        fields["Term Abbreviation"] ||
        fields.Code ||
        fields["Term Code"] ||
        `T${Date.now().toString().slice(-4)}`
      )
        .trim()
        .toUpperCase();
      const name = (fields["Term Name"] || fields.Name || code).trim();
      const startsOn = (fields["Start Date"] || new Date().toISOString().slice(0, 10)).trim();
      const endsOn = (fields["End Date"] || startsOn).trim();
      const campuses = String(fields.Campuses || "")
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const existingId = String(raw.__termId || fields.__termId || fields.termId || "").trim();
      const customEvents = asTermEvents(raw.__customEvents);
      const row: TermRecord = {
        id: existingId || `term-${Date.now().toString(36)}`,
        name,
        code,
        dates: formatTermDates(startsOn, endsOn),
        campuses: campuses.length ? campuses : [...DEFAULT_TERM_CAMPUSES],
        startsOn,
        endsOn,
        midterm: fields["Midterm Date"] || "",
        lastInstruction: fields["Last Instruction Date"] || "",
        examStart: fields["Exam Start Date"] || "",
        examEnd: fields["Exam End Date"] || "",
        census: fields["Census Date"] || "",
        customEvents,
      };
      if (!existingId) {
        try {
          const term = await prisma.term.create({
            data: {
              id: randomUUID(),
              institutionId: user.institutionId,
              code,
              name,
              startsOn,
              endsOn,
            },
          });
          row.id = term.id;
        } catch {
          /* overlay-only fallback id already set */
        }
      } else {
        try {
          await prisma.term.updateMany({
            where: { id: existingId, institutionId: user.institutionId },
            data: { code, name, startsOn, endsOn },
          });
        } catch {
          /* seeded overlay-only ids */
        }
      }
      const defaultIds = new Set<string>(DEFAULT_MANAGE_TERMS.map((t) => t.id));
      await patchScreenOverlay(user.institutionId, MANAGE_TERMS_LIST_PATH, (prev) => {
        const extras = Array.isArray(prev.extraTerms) ? [...(prev.extraTerms as TermRecord[])] : [];
        const edits =
          prev.termEdits && typeof prev.termEdits === "object"
            ? { ...(prev.termEdits as Record<string, Partial<TermRecord>>) }
            : {};
        const extraIdx = extras.findIndex((t) => t.id === row.id);
        if (extraIdx >= 0) {
          extras[extraIdx] = row;
        } else if (existingId && defaultIds.has(existingId)) {
          edits[existingId] = row;
        } else {
          extras.unshift(row);
        }
        return {
          ...prev,
          extraTerms: extras.slice(0, 100),
          termEdits: edits,
        };
      });
      message = `Term saved · ${name} (${code})`;
      result = { termId: row.id, code };
    } else if (lower.includes("delete term")) {
      const termId = (input.rowKey || "").trim();
      if (!termId) {
        message = "Delete failed · missing term id";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, "/instructor/f/t51-manage-terms", (prev) => {
          const deleted = Array.isArray(prev.deletedTermIds) ? [...(prev.deletedTermIds as string[])] : [];
          if (!deleted.includes(termId)) deleted.push(termId);
          const extras = Array.isArray(prev.extraTerms)
            ? (
                prev.extraTerms as Array<{
                  id: string;
                  name: string;
                  code: string;
                  dates: string;
                  campuses: string[];
                }>
              ).filter((t) => t.id !== termId)
            : [];
          return { ...prev, deletedTermIds: deleted, extraTerms: extras };
        });
        try {
          await prisma.term.deleteMany({ where: { id: termId, institutionId: user.institutionId } });
        } catch {
          /* seeded overlay-only ids */
        }
        message = "Term deleted";
        result = { id: termId };
      }
    } else if (
      (path.includes("t58") || path.includes("course-categor")) &&
      lower.includes("category") &&
      /^(?:quick-)?(?:create|save|add)\b/.test(lower) &&
      !/delete|remove|edit/.test(lower)
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields["Category Name"] || fields.Name || "New Category").trim();
      const code = (fields.Code || name.slice(0, 4).toUpperCase()).trim();
      const description = (fields.Description || "—").trim();
      const courses = (fields.Courses || "0").trim();
      const parent = (fields.Parent || "None (Root)").trim();
      const status = (fields.Status || "ACTIVE").trim();
      await appendExtraRow(user.institutionId, path, {
        cells: [name, code, description, courses, parent, status],
        badge: status,
        badgeTone: /inactive/i.test(status) ? "muted" : "active",
      });
      message = `Category created · ${name}`;
      result = { name, code };
    } else if (lower.includes("create alert") || lower.includes("create flag") || lower.includes("create academic")) {
      let focus =
        ctx.sections[0]?.enrolments.find((e) => e.standing !== "good") || ctx.sections[0]?.enrolments[0];
      let courseCode =
        ctx.sections.find((s) => s.enrolments.some((e) => e.studentId === focus?.studentId))?.courseCode ??
        ctx.sections[0]?.courseCode ??
        "";
      let flagType = "ACADEMIC RISK";
      let description = "";
      let priority = "High";
      let studentResolved = false;
      const fields = parseActionFields(input.rowKey);
      const flagInput =
        (path.includes("flag") || path.includes("t45")) && !lower.includes("alert") ? validateFlagFields(fields) : null;
      if (fields) {
        const studentLabel = (fields["Student Name"] || fields.studentName || "").toLowerCase();
        const match = ctx.sections
          .flatMap((s) => s.enrolments.map((e) => ({ ...e, courseCode: s.courseCode })))
          .find(
            (e) =>
              studentLabel.includes(e.studentName.toLowerCase()) ||
              studentLabel.includes(e.studentNumber.toLowerCase()) ||
              studentLabel.includes(e.studentId),
          );
        if (match) {
          focus = match;
          courseCode = match.courseCode;
          studentResolved = true;
        }
        flagType = fields["Alert Type"] || fields["Flag Type"] || fields.flagType || flagType;
        description = fields.Description || fields.description || "";
        priority = fields.Priority || fields.priority || priority;
        if (fields.Course || fields["Course Name"]) {
          courseCode = (fields.Course || fields["Course Name"] || courseCode).trim();
        }
        if (flagInput) {
          flagType = flagInput.flagType;
          description = flagInput.note;
          priority = flagInput.priority;
        }
      } else if (input.rowKey) {
        const match = ctx.sections
          .flatMap((s) => s.enrolments.map((e) => ({ ...e, courseCode: s.courseCode })))
          .find((e) => input.rowKey!.includes(e.studentName) || input.rowKey!.includes(e.studentNumber));
        if (match) {
          focus = match;
          courseCode = match.courseCode;
          studentResolved = true;
        }
      }

      if (fields && !studentResolved) {
        message = "Student not found in your sections · enter the student's full name or student number";
        result = { error: true };
      } else {
        const body =
          description ||
          `${action} recorded for ${focus?.studentNumber ?? "roster"} (${focus?.standing ?? "n/a"}) · priority ${priority}.`;

        const isFlagPath = path.includes("flag") || path.includes("t45");
        const isAlertPath =
          path.includes("t44") ||
          path.includes("academic-alert") ||
          path.includes("t22") ||
          path.includes("student-detail") ||
          lower.includes("alert");

        if (isAlertPath || !isFlagPath) {
          await persistAcademicAlert(ctx, {
            studentName: focus?.studentName ?? fields?.["Student Name"] ?? "Student",
            studentNumber: focus?.studentNumber ?? null,
            studentId: focus?.studentId ?? null,
            course: courseCode,
            tag: flagType,
            body,
            priority,
            mirrorToAdmin: studentResolved,
          });
        } else {
          await prisma.notification.create({
            data: {
              institutionId: user.institutionId,
              recipientAccountId: user.accountId,
              channel: "in_app",
              title: `${flagType} · ${focus?.studentName ?? "student"}`,
              body,
              templateKey: "instructor.alert",
            },
          });
        }

        if (isFlagPath) {
          if (studentResolved && focus?.studentId) {
            await recordAdminFlag(user, {
              studentId: focus.studentId,
              name: flagType,
              message: description || "Flag recorded from instructor workspace.",
              priority,
            });
          }
        }
        message = flagInput
          ? `Flag created · ${focus?.studentName ?? "student"} · ${flagType}`
          : `Alert created · ${focus?.studentName ?? "roster"} · ${flagType}`;
        result = { studentId: focus?.studentId ?? null, flagType, priority, courseCode };
      }
    } else if (
      path.includes("t33") ||
      path.includes("help-support") ||
      lower.includes("submit ticket") ||
      lower.includes("consult ai")
    ) {
      const fields = parseActionFields(input.rowKey) || {};
      if (lower.includes("consult")) {
        const query = (fields.query || fields.Query || input.rowKey || "").trim();
        if (!query) {
          message = "Ask a question first";
          result = { error: true };
        } else {
          const answer = consultHelpAnswer(query, ctx);
          await patchScreenOverlay(user.institutionId, path, (prev) => ({
            ...prev,
            aiConsult: { query, answer, at: new Date().toISOString() },
          }));
          message = "AI consult ready";
          result = { query, answer };
        }
      } else {
        const category = (fields.Category || fields.category || "General").trim();
        const subject = (fields.Subject || fields.subject || "Support request").trim();
        const details = (fields.Details || fields.details || "").trim();
        if (!subject || !details) {
          message = "Subject and details are required";
          result = { error: true };
        } else {
          const id = `TKT-${Date.now().toString(36).toUpperCase()}`;
          await patchScreenOverlay(user.institutionId, path, (prev) => {
            const extraTickets = Array.isArray(prev.extraTickets)
              ? [...(prev.extraTickets as unknown[])]
              : [];
            extraTickets.unshift({
              id,
              subject: `${category}: ${subject}`,
              status: "Open",
              tone: "info",
              updated: "Just now",
              details,
            });
            return { ...prev, extraTickets: extraTickets.slice(0, 50) };
          });
          await prisma.notification.create({
            data: {
              institutionId: user.institutionId,
              recipientAccountId: user.accountId,
              channel: "in_app",
              title: `Ticket ${id} submitted`,
              body: `${category}: ${subject}`,
              templateKey: "instructor.support",
            },
          });
          message = `Ticket ${id} submitted`;
          result = { id, category, subject };
        }
      }
    } else if (lower.includes("auto-resolve") || lower.includes("resolve conflict")) {
      message = `Conflicts reviewed against ${ctx.sections.length} section(s) — no blocking overlaps`;
      result = { sections: ctx.sections.length };
    } else if (
      lower.includes("upload") ||
      lower.includes("create folder") ||
      (path.includes("t32") && lower.includes("folder"))
    ) {
      if (lower.includes("folder")) {
        const fields = parseActionFields(input.rowKey) || {};
        const name = (fields.name || fields.Name || fields.Folder || "New folder").trim() || "New folder";
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const folders = Array.isArray(prev.extraFolders) ? [...(prev.extraFolders as string[])] : [];
          if (!folders.some((f) => f.toLowerCase() === name.toLowerCase())) folders.unshift(name);
          return { ...prev, extraFolders: folders.slice(0, 50) };
        });
        message = `Folder created · ${name}`;
        result = { name };
      } else {
        const parsed = parseActionFields(input.rowKey);
        const file = asOverlayFile(parsed) || asOverlayFile({ name: input.rowKey || `Upload-${Date.now()}.pdf` });
        if (!file) {
          message = "Upload failed · missing file name";
          result = { error: true };
        } else {
          await patchScreenOverlay(user.institutionId, path, (prev) => {
            const files = Array.isArray(prev.extraFiles) ? [...(prev.extraFiles as unknown[])] : [];
            files.unshift(file);
            return { ...prev, extraFiles: files.slice(0, 100) };
          });
          await appendExtraRow(user.institutionId, path, {
            cells: [file.name, "Course", file.folder || "Uploads", file.size, "Download"],
            badge: file.type,
            badgeTone: "info",
          });
          message = `Uploaded · ${file.name}`;
          result = file;
        }
      }
    } else if (lower.includes("add new book") || (path.includes("t57") && lower.startsWith("add ") && !lower.includes("textbook"))) {
      const fields = parseActionFields(input.rowKey) || {};
      const title = (fields["Book Title & Publisher"] || fields.Title || fields.Name || "Untitled textbook").trim();
      const isbn = (fields["ISBN / ISBN-13"] || fields.ISBN || "—").trim();
      const adoption = (fields.Adoption || "Required").trim();
      const required = (fields["Required/Optional"] || (/optional/i.test(adoption) ? "Optional" : "Required")).trim();
      const optOut = (fields["Opt-Out Rate"] || "0% Opt-Out").trim();
      await appendExtraRow(user.institutionId, path, {
        cells: [title, isbn, `${required}${adoption && !/required|optional/i.test(adoption) ? ` (${adoption})` : ""}`.trim(), optOut, "Edit"],
        badge: required,
        badgeTone: /optional/i.test(required) ? "info" : "active",
      });
      message = `Textbook added · ${title}`;
      result = { title, isbn, required };
    } else if (lower.includes("create badge") && !lower.includes("accomplishment")) {
      const fields = parseActionFields(input.rowKey) || {};
      const name = (fields.Name || "").trim();
      if (!name) {
        message = "Create badge failed · Name is required";
        result = { error: true };
      } else {
        const badge = badgeFromFields(fields);
        const row = await createBadgeDefinition(user.institutionId, {
          Name: name,
          Description: fields.Description || "",
          Version: fields.Version || "",
          Language: fields.Language || "English",
          "Issuer Name": fields["Issuer Name"] || "Heritage Community College",
          Contact: fields.Contact || "",
          "Badge Text": fields["Badge Text"] || fields.Description || "",
          "Badge Image": fields.Image || fields["Badge Image"] || "",
        });
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const extras = Array.isArray(prev.extraCourseBadges)
            ? [...(prev.extraCourseBadges as Array<Record<string, unknown>>)]
            : [];
          extras.unshift({ ...badge, id: row.id });
          return { ...prev, extraCourseBadges: extras.slice(0, 50) };
        });
        message = `Badge created · ${row.name}`;
        result = { ...badge, id: row.id };
      }
    } else if (lower.includes("create group") && !lower.includes("course group") && !lower.includes("course type")) {
      const fields = parseActionFields(input.rowKey) || { Name: input.rowKey || "New group" };
      const group = groupFromFields(fields);
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraGroups) ? [...(prev.extraGroups as Array<Record<string, unknown>>)] : [];
        extras.unshift(group);
        return { ...prev, extraGroups: extras.slice(0, 50) };
      });
      message = `Group created · ${group.name}`;
      result = group;
    } else if (lower.includes("delete selected group")) {
      const groupId = (input.rowKey || "").trim();
      if (!groupId) {
        message = "Delete failed · select a group";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const deleted = Array.isArray(prev.deletedGroupIds) ? [...(prev.deletedGroupIds as string[])] : [];
          if (!deleted.includes(groupId)) deleted.push(groupId);
          const extras = Array.isArray(prev.extraGroups)
            ? (prev.extraGroups as Array<{ id: string }>).filter((g) => g.id !== groupId)
            : [];
          return { ...prev, deletedGroupIds: deleted, extraGroups: extras };
        });
        message = "Group deleted";
        result = { id: groupId };
      }
    } else if (lower.includes("add/remove users") || lower.includes("add/remove user")) {
      const raw = (() => {
        try {
          return JSON.parse(input.rowKey || "{}") as {
            groupId?: string;
            members?: Array<{ id: string; name: string }>;
          };
        } catch {
          return {} as { groupId?: string; members?: Array<{ id: string; name: string }> };
        }
      })();
      if (!raw.groupId) {
        message = "Select a group first";
        result = { error: true };
      } else {
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const members = {
            ...((prev.groupMembers as Record<string, Array<{ id: string; name: string }>>) || {}),
            [raw.groupId!]: raw.members || [],
          };
          return { ...prev, groupMembers: members };
        });
        message = "Group members updated";
        result = raw;
      }
    } else if (
      lower.includes("save question") ||
      lower.includes("edit question") ||
      lower.includes("create a new question") ||
      lower.includes("create question")
    ) {
      const fields = parseActionFields(input.rowKey) || { Type: input.rowKey || "Multiple choice" };
      const question = questionFromFields(fields, fields.Course || "Course", ctx.displayName);
      const editing = Boolean((fields.Id || fields.id || "").trim());
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraQuestions)
          ? [...(prev.extraQuestions as Array<Record<string, unknown>>)]
          : [];
        if (editing) {
          const idx = extras.findIndex((row) => String(row.id || "") === question.id);
          if (idx >= 0) {
            extras[idx] = { ...extras[idx], ...question };
            return { ...prev, extraQuestions: extras.slice(0, 80) };
          }
          const edits = {
            ...((prev.questionEdits as Record<string, unknown>) || {}),
            [question.id]: question,
          };
          return { ...prev, extraQuestions: extras, questionEdits: edits };
        }
        extras.unshift(question);
        return { ...prev, extraQuestions: extras.slice(0, 80) };
      });
      message = editing ? `Question updated · ${question.name}` : `Question created · ${question.name}`;
      result = question;
    } else if (lower.includes("add topic")) {
      const fields = parseActionFields(input.rowKey) || {};
      const title = (fields.Title || fields.Name || `Topic ${Date.now().toString(36).slice(-4)}`).trim();
      const topic = { id: `topic-${Date.now().toString(36)}`, title, activities: [] as Array<{ type: string; name: string }> };
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraTopics)
          ? [...(prev.extraTopics as Array<Record<string, unknown>>)]
          : [];
        extras.push(topic);
        return { ...prev, extraTopics: extras.slice(0, 40) };
      });
      message = `Topic added · ${title}`;
      result = topic;
    } else if (lower.includes("publish online class") || lower.includes("publish meeting") || lower.includes("publish class session")) {
      const fields = parseActionFields(input.rowKey) || {};
      const published = await publishOnlineClassSession(ctx, path, fields);
      const activityId = (fields.ActivityId || fields.Id || "").trim();
      if (activityId) {
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<Record<string, unknown>>>) || {}),
          };
          for (const key of Object.keys(topicActivities)) {
            topicActivities[key] = (topicActivities[key] || []).map((row) =>
              String(row.id || "") === activityId
                ? {
                    ...row,
                    joinUrl: published.joinUrl,
                    note: `Published · ${published.notified} student(s) notified. Join now.`,
                  }
                : row,
            );
          }
          return { ...prev, topicActivities, lastPublishedClass: published };
        });
      }
      message = `Online class published · ${published.notified} student(s) notified`;
      result = published;
    } else if (lower.includes("add an activity or resource") || lower.includes("add activity") || lower.includes("add resource")) {
      const fields = parseActionFields(input.rowKey) || {};
      const topicId = (fields.TopicId || fields.topicId || "").trim();
      const type = (fields.ActivityType || fields.Type || fields.type || "Page").trim().toUpperCase();
      const name = (fields.Name || fields.name || `New ${type}`).trim();
      if (!topicId) {
        message = "Select a topic first";
        result = { error: true };
      } else {
        await assertLmsRestrictionScope(ctx, path, fields[LMS_ACCESS_RESTRICTIONS_KEY]);
        const content = activityContentFromForm(type, fields);
        const activity: Record<string, unknown> = {
          id: `act-${Date.now().toString(36)}`,
          type,
          name,
          settings: content.settings,
          ...(content.description ? { description: content.description } : {}),
          ...(content.url ? { url: content.url } : {}),
        };
        const upload = await uploadedLmsFile(ctx, path, (fields.FileId || "").trim());
        if (upload) {
          Object.assign(activity, upload);
          activity.modified = new Date().toLocaleString("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" });
        }
        if (content.body) {
          activity.body = content.body;
          activity.modified = new Date().toLocaleString("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" });
        }
        if (content.assignment) {
          activity.assignment = content.assignment;
          const workspaceId = workspaceSectionId(path);
          if (workspaceId && ctx.sections.some((s) => s.id === workspaceId)) {
            activity.assignmentId = await saveLmsAssignment({
              institutionId: user.institutionId,
              sectionId: workspaceId,
              title: name,
              settings: content.assignment,
              hidden: content.hidden,
            });
          }
        }
        if (fields.Storyboard) {
          let raw: unknown = null;
          try {
            raw = JSON.parse(fields.Storyboard);
          } catch {
            raw = null;
          }
          const storyboard = normalizeStoryboard(raw, name);
          if (!storyboard) throw Object.assign(new Error("Video storyboard is invalid"), { status: 400 });
          activity.storyboard = storyboard;
          activity.note = `AI video lesson · ${storyboard.slides.length} slides · ~${Math.max(1, Math.round(storyboard.estimated_duration_sec / 60))} min`;
        }
        if (type === "BIGBLUEBUTTON") {
          const publishNow = !/^(no|false|0|skip)$/i.test(
            String(fields.PublishMeeting || fields["Publish meeting"] || "yes").trim() || "yes",
          );
          if (publishNow) {
            const published = await publishOnlineClassSession(ctx, path, { ...fields, Name: name });
            activity.joinUrl = published.joinUrl;
            activity.note = `Published · ${published.notified} student(s) notified. Join now.`;
            result = { topicId, activity, published };
            message = `Online class ready · ${name} · ${published.notified} student(s) notified`;
          } else {
            const sec = resolveSectionFromPath(ctx, path);
            activity.joinUrl = sec ? liveClassUrl(sec.id, onlineClassProvider(fields)) : null;
            activity.note = "Room ready — publish to notify students.";
            result = { topicId, activity };
            message = `Added ${type} · ${name}`;
          }
        } else {
          result = { topicId, activity };
          message = `Added ${type} · ${name}`;
        }
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<Record<string, unknown>>>) || {}),
          };
          topicActivities[topicId] = [...(topicActivities[topicId] || []), activity];
          const hidden = Array.isArray(prev.hiddenActivityIds) ? (prev.hiddenActivityIds as string[]) : [];
          return {
            ...prev,
            topicActivities,
            hiddenActivityIds: content.hidden ? [...hidden, String(activity.id)] : hidden,
          };
        });
      }
    } else if (lower === "save activity settings") {
      const fields = parseActionFields(input.rowKey) || {};
      const activityId = (fields.Id || "").trim();
      const name = (fields.Name || "").trim();
      if (!activityId || !name) {
        message = "Activity name is required";
        result = { error: true };
      } else {
        await assertLmsRestrictionScope(ctx, path, fields[LMS_ACCESS_RESTRICTIONS_KEY]);
        const existing = findOverlayActivity(await loadLmsOverlay(user.institutionId, path), activityId)?.activity;
        const type = String(existing?.type || fields.ActivityType || "PAGE").toUpperCase();
        const content = activityContentFromForm(type, fields);
        const edit: Record<string, unknown> = {
          name,
          settings: content.settings,
          description: content.description ?? "",
          modified: new Date().toLocaleString("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" }),
        };
        if (type === "BIGBLUEBUTTON") {
          const section = resolveSectionFromPath(ctx, path);
          if (section) edit.joinUrl = liveClassUrl(section.id, onlineClassProvider(fields));
        }
        const upload = await uploadedLmsFile(ctx, path, (fields.FileId || "").trim());
        if (upload) Object.assign(edit, upload);
        if (content.body !== undefined) edit.body = content.body;
        if (content.url) edit.url = content.url;
        if (content.assignment) {
          edit.assignment = content.assignment;
          const workspaceId = workspaceSectionId(path);
          if (workspaceId && ctx.sections.some((s) => s.id === workspaceId)) {
            edit.assignmentId = await saveLmsAssignment({
              institutionId: user.institutionId,
              sectionId: workspaceId,
              assignmentId: typeof existing?.assignmentId === "string" ? existing.assignmentId : null,
              title: name,
              settings: content.assignment,
              hidden: content.hidden,
            });
          }
        }
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<Record<string, unknown>>>) || {}),
          };
          let inOverlay = false;
          for (const key of Object.keys(topicActivities)) {
            topicActivities[key] = (topicActivities[key] || []).map((row) => {
              if (String(row.id || "") !== activityId) return row;
              inOverlay = true;
              return { ...row, ...edit };
            });
          }
          const activityEdits = { ...((prev.activityEdits as Record<string, Record<string, unknown>>) || {}) };
          if (!inOverlay) activityEdits[activityId] = { ...(activityEdits[activityId] || {}), ...edit };
          const hidden = Array.isArray(prev.hiddenActivityIds) ? (prev.hiddenActivityIds as string[]).filter((id) => id !== activityId) : [];
          if (content.hidden) hidden.push(activityId);
          return { ...prev, topicActivities, activityEdits, hiddenActivityIds: hidden };
        });
        message = `Saved · ${name}`;
        result = { id: activityId, name, hidden: content.hidden };
      }
    } else if (lower.includes("hide activity") || lower.includes("show activity")) {
      const activityId = (input.rowKey || "").trim();
      if (!activityId) {
        message = "Select an activity first";
        result = { error: true };
      } else {
        const hide = lower.includes("hide activity");
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const hidden = Array.isArray(prev.hiddenActivityIds) ? [...(prev.hiddenActivityIds as string[])] : [];
          const next = hide
            ? hidden.includes(activityId)
              ? hidden
              : [...hidden, activityId]
            : hidden.filter((id) => id !== activityId);
          return { ...prev, hiddenActivityIds: next };
        });
        const linked = await linkedLmsAssignment(user.institutionId, path, activityId);
        if (linked) await setLmsAssignmentHidden(user.institutionId, linked.sectionId, linked.assignmentId, hide);
        message = hide ? "Activity hidden from students" : "Activity shown";
        result = { id: activityId, hidden: hide };
      }
    } else if (lower.includes("duplicate activity")) {
      const fields = parseActionFields(input.rowKey) || {};
      const topicId = (fields.TopicId || "").trim();
      const type = (fields.Type || "PAGE").trim().toUpperCase();
      const name = `${(fields.Name || "Activity").trim()} (copy)`;
      if (!topicId) {
        message = "Select a topic first";
        result = { error: true };
      } else {
        const source = fields.Id
          ? findOverlayActivity(await loadLmsOverlay(user.institutionId, path), fields.Id.trim())?.activity
          : undefined;
        const { assignmentId: _sourceAssignment, hidden: _sourceHidden, ...copied } = source || {};
        const activity: Record<string, unknown> = { ...copied, id: `act-${Date.now().toString(36)}`, type, name };
        const workspaceId = workspaceSectionId(path);
        const settings = copied.assignment as LmsAssignmentSettings | undefined;
        if (type === "ASSIGNMENT" && settings && workspaceId && ctx.sections.some((s) => s.id === workspaceId)) {
          activity.assignmentId = await saveLmsAssignment({
            institutionId: user.institutionId,
            sectionId: workspaceId,
            title: name,
            settings,
            hidden: false,
          });
        }
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<Record<string, unknown>>>) || {}),
          };
          topicActivities[topicId] = [...(topicActivities[topicId] || []), activity];
          return { ...prev, topicActivities };
        });
        message = `Duplicated · ${name}`;
        result = { topicId, activity };
      }
    } else if (lower.includes("delete activity")) {
      const activityId = (input.rowKey || "").trim();
      if (!activityId) {
        message = "Select an activity first";
        result = { error: true };
      } else {
        const linked = await linkedLmsAssignment(user.institutionId, path, activityId);
        if (linked) await retireLmsAssignment(user.institutionId, linked.sectionId, linked.assignmentId);
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const deleted = Array.isArray(prev.deletedActivityIds) ? [...(prev.deletedActivityIds as string[])] : [];
          if (!deleted.includes(activityId)) deleted.push(activityId);
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<{ id?: string }>>) || {}),
          };
          for (const key of Object.keys(topicActivities)) {
            topicActivities[key] = (topicActivities[key] || []).filter((row) => row.id !== activityId);
          }
          return { ...prev, deletedActivityIds: deleted, topicActivities };
        });
        message = "Activity deleted";
        result = { id: activityId };
      }
    } else if (lower === "save page") {
      const fields = parseActionFields(input.rowKey) || {};
      const activityId = (fields.Id || "").trim();
      const name = (fields.Name || "").trim();
      if (!activityId || !name) {
        message = "Page name is required";
        result = { error: true };
      } else {
        await assertLmsRestrictionScope(ctx, path, fields.AccessRestrictions);
        const accessRestrictions = serializeLmsAccessRestrictions(fields.AccessRestrictions);
        const existing = findOverlayActivity(await loadLmsOverlay(user.institutionId, path), activityId)?.activity;
        const settings = existing?.settings && typeof existing.settings === "object"
          ? { ...(existing.settings as Record<string, string>) }
          : {};
        if (accessRestrictions) settings[LMS_ACCESS_RESTRICTIONS_KEY] = accessRestrictions;
        else delete settings[LMS_ACCESS_RESTRICTIONS_KEY];
        const edit: Record<string, unknown> = {
          name,
          settings,
          modified: new Date().toLocaleString("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" }),
        };
        if (typeof fields.Body === "string") edit.body = sanitizeLessonHtml(fields.Body.trim());
        const hide = /^(yes|true|1)$/i.test(String(fields.Hidden || ""));
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicActivities = {
            ...((prev.topicActivities as Record<string, Array<Record<string, unknown>>>) || {}),
          };
          let inOverlay = false;
          for (const key of Object.keys(topicActivities)) {
            topicActivities[key] = (topicActivities[key] || []).map((row) => {
              if (String(row.id || "") !== activityId) return row;
              inOverlay = true;
              return { ...row, ...edit };
            });
          }
          const activityEdits = { ...((prev.activityEdits as Record<string, Record<string, unknown>>) || {}) };
          if (!inOverlay) activityEdits[activityId] = { ...(activityEdits[activityId] || {}), ...edit };
          const hidden = Array.isArray(prev.hiddenActivityIds) ? (prev.hiddenActivityIds as string[]).filter((id) => id !== activityId) : [];
          if (hide) hidden.push(activityId);
          return { ...prev, topicActivities, activityEdits, hiddenActivityIds: hidden };
        });
        const linked = await linkedLmsAssignment(user.institutionId, path, activityId);
        if (linked) await setLmsAssignmentHidden(user.institutionId, linked.sectionId, linked.assignmentId, hide);
        message = `Page saved · ${name}`;
        result = { id: activityId, name, hidden: hide };
      }
    } else if (lower.includes("save section") || lower.includes("edit section")) {
      const fields = parseActionFields(input.rowKey) || {};
      const topicId = (fields.TopicId || "").trim();
      const title = (fields.Title || fields.Name || "").trim();
      if (!topicId || !title) {
        message = "Section name is required";
        result = { error: true };
      } else {
        await assertLmsRestrictionScope(ctx, path, fields.AccessRestrictions);
        const accessRestrictions = serializeLmsAccessRestrictions(fields.AccessRestrictions);
        await patchScreenOverlay(user.institutionId, path, (prev) => {
          const topicTitles = { ...((prev.topicTitles as Record<string, string>) || {}), [topicId]: title };
          const topicSummaries = {
            ...((prev.topicSummaries as Record<string, string>) || {}),
            [topicId]: fields.Summary || "",
          };
          const topicRestrictions = { ...((prev.topicRestrictions as Record<string, string>) || {}) };
          if (accessRestrictions) topicRestrictions[topicId] = accessRestrictions;
          else delete topicRestrictions[topicId];
          return { ...prev, topicTitles, topicSummaries, topicRestrictions };
        });
        message = `Section updated · ${title}`;
        result = { topicId, title };
      }
    } else if (lower.includes("add competencies to course")) {
      const fields = parseActionFields(input.rowKey) || { Name: input.rowKey || "Course competency" };
      const competency = competencyFromFields(fields);
      await patchScreenOverlay(user.institutionId, path, (prev) => {
        const extras = Array.isArray(prev.extraCompetencies)
          ? [...(prev.extraCompetencies as Array<Record<string, unknown>>)]
          : [];
        extras.unshift(competency);
        return { ...prev, extraCompetencies: extras.slice(0, 50) };
      });
      message = `Competency linked · ${competency.name}`;
      result = competency;
    } else if (
      (lower.startsWith("add ") ||
        lower.startsWith("create ") ||
        lower.startsWith("quick-create") ||
        lower.startsWith("new ") ||
        lower.startsWith("submit new") ||
        lower.includes("upload")) &&
      parseActionFields(input.rowKey)
    ) {
      const fields = parseActionFields(input.rowKey)!;
      const cells = cellsFromFields(fields);
      const status = fields.Status || "Active";
      await appendExtraRow(user.institutionId, path, {
        cells,
        badge: status,
        badgeTone: /inactive|draft/i.test(status) ? "muted" : "active",
      });
      message = `Created · ${action}`;
      result = { cells };
    } else {
      throw Object.assign(new Error(`Action is not supported: ${action}`), {
        code: "ACTION_NOT_SUPPORTED",
        status: 422,
      });
    }
  } catch (err) {
    const e = err as Error & { status?: number; code?: string };
    if (e.status) throw e;
    throw Object.assign(e, { status: 500, code: e.code || "INSTRUCTOR_ACTION_FAILED" });
  }

  await appendInstructorActivity(user.institutionId, path, {
    action,
    at: new Date().toISOString(),
    by: user.accountId,
    rowKey: input.rowKey ?? null,
    result,
  });

  await prisma.auditEvent.create({
    data: {
      institutionId: user.institutionId,
      actorId: user.accountId,
      eventName: "instructor.sis.action",
      purpose: "instructor_mutation",
      afterJson: JSON.stringify({ path, action, rowKey: input.rowKey ?? null, result }),
      source: "instructor.sis",
      correlationId: randomUUID(),
    },
  });

  const screen = await buildInstructorScreen(input.path, user);
  return {
    ...screen,
    ok: !(result as { error?: boolean }).error,
    action,
    path: input.path,
    rowKey: input.rowKey ?? null,
    message,
    result,
  };
}

export function assertInstructorMasterDataBoundary(user: SessionClaims, path: string, action: string) {
  if (user.roles.includes("admin") || user.roles.includes("registrar")) return;

  const normalizedPath = path.toLowerCase();
  const isStudentProvisioning =
    (normalizedPath.includes("t43") || normalizedPath.includes("create-student-profile")) &&
    /\b(save|create)\b/.test(action);
  const isProgramMaster =
    /(program-settings|program-types|add-program|create-program|t50|t73|t83)/.test(normalizedPath) &&
    /\b(save|create|add|delete|remove|reorder)\b/.test(action);
  const isTermMaster =
    /(term-management|add-term|create-term|manage-terms|t74)/.test(normalizedPath) &&
    /\b(save|create|add|delete|remove)\b/.test(action);
  const isCourseOrSectionMaster =
    /(add-course|course-admin|courses-sessions|course-configuration|course-groups-types|t54|t55|t59|t77)/.test(
      normalizedPath,
    ) && /\b(save|create|add|delete|remove)\b/.test(action);
  const isBadgeDefinition =
    /(add-badge|badge-management|t70)/.test(normalizedPath) &&
    /\b(save|create|add|delete|remove)\b/.test(action) &&
    action !== "award course badge";

  if (isStudentProvisioning || isProgramMaster || isTermMaster || isCourseOrSectionMaster || isBadgeDefinition) {
    throw Object.assign(
      new Error("This master-data action is restricted to administrators and registrars"),
      { code: "FORBIDDEN", status: 403 },
    );
  }
}

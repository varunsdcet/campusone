/* Program Management schedule sessions are taught as real course sections: each active session owns a Section row
   and the Course Management session settings (timetable, room, capacity, waitlist, grading) behind it. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { S as CM, defaults, settingsOf, saveSettings, dropSettings } from "./courses.js";
import { SESSION_FIELDS } from "./courses.spec.js";
import { nextSectionCode, termFor } from "./courses.catalog.js";
import { PM, WEEKDAYS, type Data } from "./programs.spec.js";
import { dropGeneratedClassSessions, generatedTitle, syncSectionClassSessions } from "../../courses/sectionOffering.js";

type SessionRec = { id: string; contextKey: string; data: Data };

type SectionRemovalUsage = {
  enrolments: number;
  assignments: number;
  assessments: number;
  attendanceRecords: number;
  dayBlocks: number;
  folders: number;
  syllabusTopics: number;
  classSessions: Array<{ title: string; attendanceRecords: number; labNotebookEntries: number }>;
};

const s = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));
const lc = (v: unknown) => s(v).trim().toLowerCase();
const parse = (json: string): Data => {
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Data) : {};
  } catch {
    return {};
  }
};

export function meetingsFromWeekly(weekly: unknown) {
  const src = weekly && typeof weekly === "object" ? (weekly as Data) : {};
  return WEEKDAYS.flatMap((day) => {
    const e = src[day] as Data | undefined;
    return e && s(e.start) && s(e.end) ? [{ day, start: s(e.start), end: s(e.end) }] : [];
  });
}

/**
 * A master-schedule deletion may hard-delete only an unused generated section.
 * Academic records and manually-created class sessions must never be orphaned
 * behind a schedule that disappeared from the administrator's directory.
 */
export function sectionRemovalBlockers(usage: SectionRemovalUsage, generatedClassTitle: string) {
  const reasons: string[] = [];
  const add = (count: number, one: string, many = `${one}s`) => {
    if (count > 0) reasons.push(`${count} ${count === 1 ? one : many}`);
  };
  add(usage.enrolments, "student enrolment");
  add(usage.assignments, "assignment");
  add(usage.assessments, "assessment");
  add(usage.attendanceRecords, "attendance record");
  add(usage.dayBlocks, "course day block");
  add(usage.folders, "course folder");
  add(usage.syllabusTopics, "syllabus topic");
  const protectedClasses = usage.classSessions.filter(
    (row) => row.title !== generatedClassTitle || row.attendanceRecords > 0 || row.labNotebookEntries > 0,
  );
  add(protectedClasses.length, "protected class session");
  return reasons;
}

/** Returns the human-readable dependencies that make a linked section unsafe to delete. */
export async function sessionSectionRemovalBlockers(inst: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: inst },
    include: {
      course: { select: { code: true } },
      _count: { select: { enrolments: true, assignments: true, assessments: true, attendanceRecords: true, dayBlocks: true, folders: true, syllabusTopics: true } },
      classSessions: { select: { title: true, _count: { select: { attendanceRecords: true, labNotebookEntries: true } } } },
    },
  });
  if (!section) return [];
  return sectionRemovalBlockers(
    {
      ...section._count,
      classSessions: section.classSessions.map((row) => ({
        title: row.title,
        attendanceRecords: row._count.attendanceRecords,
        labNotebookEntries: row._count.labNotebookEntries,
      })),
    },
    generatedTitle(section.course.code, section.code),
  );
}

type Refs = {
  campusIdByName: Map<string, string>;
  gradingIdByName: Map<string, string>;
  gradingNameById: Map<string, string>;
  defaultGrading: string;
  typeIdFor: (delivery: string) => string;
};

async function refs(inst: string): Promise<Refs> {
  const rows = await prisma.heritageRecord.findMany({
    where: { institutionId: inst, screenId: { in: ["LOC:CAMPUS", "CM:GRADING", "CM:TYPE"] }, deletedAt: null, singletonKey: null },
    select: { id: true, screenId: true, dataJson: true },
    orderBy: { createdAt: "asc" },
  });
  const of = (screen: string) => rows.filter((r) => r.screenId === screen).map((r) => ({ id: r.id, d: parse(r.dataJson) }));
  const grading = of("CM:GRADING").filter((g) => g.d.active !== "Inactive" && g.d.status !== "Inactive");
  const types = of("CM:TYPE").filter((t) => t.d.active !== "Inactive" && t.d.status !== "Inactive");
  const typeIdFor = (delivery: string) => {
    if (!delivery || delivery === "Not Set") return "";
    const want = /online/i.test(delivery) ? /online/i : /lecture|person|face|class/i;
    return types.find((t) => want.test(s(t.d.name)))?.id ?? "";
  };
  return {
    campusIdByName: new Map(of("LOC:CAMPUS").map((c) => [lc(c.d.name), c.id])),
    gradingIdByName: new Map(grading.map((g) => [lc(g.d.name), g.id])),
    gradingNameById: new Map(grading.map((g) => [g.id, s(g.d.name)])),
    defaultGrading: grading.find((g) => g.d.isDefault === true)?.id ?? "",
    typeIdFor,
  };
}

async function sectionTerm(inst: string, session: Data, schedule: Data | null, start: string) {
  const pmTermId = s(session.term) || (schedule?._kind === "term" ? s(schedule.term) : "");
  if (pmTermId) {
    const rec = await prisma.heritageRecord.findFirst({ where: { id: pmTermId, institutionId: inst, screenId: PM.term, deletedAt: null } });
    const prismaId = rec ? s(parse(rec.dataJson)._prismaId) : "";
    const term = prismaId ? await prisma.term.findFirst({ where: { id: prismaId, institutionId: inst } }) : null;
    if (term) return term;
  }
  return termFor(inst, start || new Date().toISOString().slice(0, 10));
}

/**
 * Creates or updates the Section behind a schedule session and copies the session's timetable, room, capacity,
 * waitlist, instructors and grading into its session settings. Returns the section id to store on the session and the
 * grading scheme name used (the course default when the session left it blank).
 */
export async function syncSessionSection(user: SessionClaims, rec: SessionRec, scheduleCode: string): Promise<{ sectionId: string; gradingScheme: string } | null> {
  const inst = user.institutionId;
  const d = rec.data;
  if (d._status !== "active") return null;
  const course = await prisma.course.findFirst({ where: { id: s(d.course), institutionId: inst } });
  if (!course) return null;
  const schedule = await prisma.heritageRecord.findFirst({ where: { id: rec.contextKey, institutionId: inst, screenId: PM.schedule, deletedAt: null } });
  const sch = schedule ? parse(schedule.dataJson) : null;
  const termHint = s(d.term) || (sch?._kind === "term" ? s(sch.term) : "");
  let start = s(d.startDate);
  let end = s(d.endDate);
  if ((!start || !end) && termHint) {
    const t = await prisma.heritageRecord.findFirst({ where: { id: termHint, institutionId: inst, screenId: PM.term, deletedAt: null } });
    const td = t ? parse(t.dataJson) : {};
    start ||= s(td.startDate);
    end ||= s(td.endDate);
  }
  const term = await sectionTerm(inst, d, sch, start);
  start ||= term.startsOn;
  end ||= term.endsOn;
  const r = await refs(inst);
  const instructors = Array.isArray(d.instructors) ? d.instructors.map(s).filter(Boolean) : [];
  const firstInstructor = instructors[0] ? await prisma.account.findFirst({ where: { id: instructors[0], institutionId: inst }, select: { personId: true } }) : null;
  const instructorPersonId = firstInstructor?.personId ?? "";
  const courseGrading = s((await settingsOf(inst, CM.courseSettings, [course.id])).get(course.id)?.data.gradingScheme);
  const gradingScheme = r.gradingIdByName.get(lc(d.gradingScheme)) || courseGrading || r.defaultGrading;
  const campusName = s(d.campus);
  const campus = campusName && campusName !== "Not Set" ? (r.campusIdByName.get(lc(campusName)) ?? campusName) : "";

  let sectionId = s(d._sectionId);
  const linked = sectionId ? await prisma.section.findFirst({ where: { id: sectionId, institutionId: inst } }) : null;
  const section = linked
    ? await prisma.section.update({ where: { id: linked.id }, data: { courseId: course.id, termId: term.id, ...(instructorPersonId ? { instructorPersonId } : {}), rowVersion: { increment: 1 } } })
    : await prisma.section.create({ data: { institutionId: inst, courseId: course.id, termId: term.id, code: await nextSectionCode(inst, term.id, course.code, start), instructorPersonId } });
  sectionId = section.id;

  const before = (await settingsOf(inst, CM.session, [sectionId])).get(sectionId)?.data ?? {};
  const number = String(d._number ?? 1).padStart(2, "0");
  await saveSettings(user, CM.session, sectionId, {
    ...defaults(SESSION_FIELDS),
    ...before,
    name: s(d.sessionName) || `${scheduleCode ? `${scheduleCode}-` : ""}${number}`,
    classPeriod: s(d.classPeriod) || s(before.classPeriod) || "Morning",
    sessionType: r.typeIdFor(s(d.deliveryMethod)) || s(before.sessionType),
    deliveryMethod: s(d.deliveryMethod) === "Not Set" ? "" : s(d.deliveryMethod),
    campus,
    classroom: s(d.classroom),
    sameAsClassroom: d.sameAsClassroom === true,
    maxEnrolments: d.maxEnrolments ?? null,
    waitlist: s(d.waitlist) || "Disabled",
    waitlistSize: d.waitlistSize ?? null,
    selfEnrolment: s(d.selfEnrolment) || "Disabled",
    instructors,
    assistants: Array.isArray(d.assistants) ? d.assistants : [],
    guests: Array.isArray(d.guests) ? d.guests : [],
    continuous: false,
    startDate: start,
    endDate: end,
    meetings: meetingsFromWeekly(d.weekly),
    gradingScheme,
    attendanceGrading: s(d.attendanceGrading) || s(before.attendanceGrading) || "Disabled",
    enableLms: s(d.enableLms) === "Disabled" || !s(d.enableLms) ? "Disabled" : "Enabled",
    _pmSessionId: rec.id,
    _pmScheduleId: rec.contextKey,
  });
  await syncSectionClassSessions(inst, sectionId);
  return { sectionId, gradingScheme: s(d.gradingScheme) || r.gradingNameById.get(gradingScheme) || "" };
}

/**
 * When a schedule session is deleted its section goes too, unless students, content or attendance already depend on
 * it; then the section stays as a Course Management offering and only the link is dropped.
 */
export async function releaseSessionSection(user: SessionClaims, sectionId: string) {
  const inst = user.institutionId;
  const x = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: inst },
    include: { course: true, _count: { select: { enrolments: true, assignments: true, assessments: true, attendanceRecords: true, dayBlocks: true, folders: true, syllabusTopics: true } } },
  });
  if (!x) return "missing" as const;
  const st = (await settingsOf(inst, CM.session, [sectionId])).get(sectionId)?.data ?? {};
  if (Object.values(x._count).some((n) => n > 0)) {
    const { _pmSessionId: _a, _pmScheduleId: _b, ...rest } = st;
    void _a;
    void _b;
    await saveSettings(user, CM.session, sectionId, rest);
    return "kept" as const;
  }
  await dropGeneratedClassSessions(inst, sectionId, x.course.code, x.code);
  if ((await prisma.classSession.count({ where: { institutionId: inst, sectionId } })) > 0) return "kept" as const;
  await prisma.section.delete({ where: { id: sectionId } });
  await dropSettings(user, CM.session, sectionId);
  return "deleted" as const;
}

/** Sections linked to a schedule's sessions (feed-in session first when asked). */
export async function scheduleSectionIds(inst: string, scheduleId: string, opts: { sessionId?: string | null } = {}) {
  const rows = await prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: PM.session, contextKey: scheduleId, deletedAt: null, singletonKey: null } });
  const sessions = rows.map((r) => ({ id: r.id, data: parse(r.dataJson) })).filter((r) => r.data._status === "active" && s(r.data._sectionId));
  const chosen = opts.sessionId ? sessions.filter((r) => r.id === opts.sessionId) : sessions;
  return chosen.map((r) => ({ sessionId: r.id, sectionId: s(r.data._sectionId), feedIn: r.data.feedIn === true, course: s(r.data.course) }));
}

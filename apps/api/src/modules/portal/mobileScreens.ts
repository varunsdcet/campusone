import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { currentStudent } from "../me/studentAlignment.js";
import type { PortalRow, PortalView } from "./portal.service.js";

type MobileKind = "todo" | "schedule" | "notifications" | "offline";

export const MOBILE_SCREENS: Record<string, { title: string; kind: MobileKind }> = {
  "mb-03-student-todo": { title: "To-do", kind: "todo" },
  "mb-04-student-schedule": { title: "Schedule", kind: "schedule" },
  "mb-03-mobile-schedule": { title: "Schedule", kind: "schedule" },
  "mb-06-mobile-notifications": { title: "Notifications", kind: "notifications" },
  "mb-09-notifications": { title: "Notifications", kind: "notifications" },
  "mb-10-offline-state": { title: "Offline", kind: "offline" },
};

export function mobileScreenFor(path: string) {
  const m = /^\/m\/f\/([a-z0-9-]+)\/?$/.exec(path);
  return m ? MOBILE_SCREENS[m[1]!] ?? null : null;
}

const DAY = 86_400_000;
const fmtDay = (d: Date) => d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (d: Date) => d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });

async function enrolledSectionIds(user: SessionClaims) {
  const student = await currentStudent(user.institutionId, user.personId);
  if (!student) return { studentId: null, sectionIds: [] as string[] };
  const enrolments = await prisma.enrolment.findMany({
    where: { institutionId: user.institutionId, studentId: student.id, status: "enrolled" },
    select: { sectionId: true },
  });
  return { studentId: student.id, sectionIds: [...new Set(enrolments.map((e) => e.sectionId))] };
}

/** Open work: visible assignments in current sections that the student has not submitted yet. */
export function todoRows(
  assignments: Array<{ id: string; title: string; dueAt: Date | null; section: { id: string; course: { code: string } } }>,
  submittedIds: ReadonlySet<string>,
  now: Date,
): PortalRow[] {
  return assignments
    .filter((a) => !submittedIds.has(a.id))
    .map((a) => {
      const overdue = a.dueAt ? a.dueAt.getTime() < now.getTime() : false;
      return {
        primary: `${a.section.course.code} · ${a.title}`,
        secondary: a.dueAt ? `Due ${fmtDay(a.dueAt)} at ${fmtTime(a.dueAt)}` : "No due date",
        meta: overdue ? "Overdue" : a.dueAt && a.dueAt.getTime() - now.getTime() < 2 * DAY ? "Due soon" : "Open",
        href: `/student/assignments/${a.id}`,
      };
    });
}

async function todo(user: SessionClaims, base: PortalView, now: Date) {
  const { studentId, sectionIds } = await enrolledSectionIds(user);
  const assignments = sectionIds.length
    ? await prisma.assignment.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: sectionIds }, hidden: false, OR: [{ dueAt: null }, { dueAt: { gte: new Date(now.getTime() - 14 * DAY) } }] },
        select: { id: true, title: true, dueAt: true, section: { select: { id: true, course: { select: { code: true } } } } },
        orderBy: [{ dueAt: "asc" }],
        take: 60,
      })
    : [];
  const submitted = studentId
    ? await prisma.submission.findMany({
        where: { studentId, assignmentId: { in: assignments.map((a) => a.id) }, status: { not: "draft" } },
        select: { assignmentId: true },
      })
    : [];
  const rows = todoRows(assignments, new Set(submitted.map((s) => s.assignmentId)), now);
  base.metrics = [
    { label: "Open", value: String(rows.length) },
    { label: "Overdue", value: String(rows.filter((r) => r.meta === "Overdue").length) },
    { label: "Due soon", value: String(rows.filter((r) => r.meta === "Due soon").length) },
  ];
  base.sections = [{ title: "Your to-do list", rows: rows.length ? rows : [{ primary: "You're all caught up", secondary: "No open assignments in your current courses." }] }];
}

async function schedule(user: SessionClaims, base: PortalView, now: Date) {
  const { sectionIds } = await enrolledSectionIds(user);
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const sessions = sectionIds.length
    ? await prisma.classSession.findMany({
        where: { institutionId: user.institutionId, sectionId: { in: sectionIds }, startsAt: { gte: from, lt: new Date(from.getTime() + 14 * DAY) } },
        include: { section: { include: { course: true } } },
        orderBy: { startsAt: "asc" },
        take: 40,
      })
    : [];
  const byDay = new Map<string, PortalRow[]>();
  for (const s of sessions) {
    const day = fmtDay(s.startsAt);
    const rows = byDay.get(day) ?? [];
    rows.push({
      primary: `${s.section.course.code} · ${s.title || s.section.course.title}`,
      secondary: [s.location, s.deliveryMode === "online" ? "Online" : null].filter(Boolean).join(" · ") || s.sessionKind.replace(/_/g, " "),
      meta: `${fmtTime(s.startsAt)}${s.endsAt ? `–${fmtTime(s.endsAt)}` : ""}`,
      href: `/student/courses/${s.sectionId}`,
    });
    byDay.set(day, rows);
  }
  const today = sessions.filter((s) => s.startsAt.getTime() < from.getTime() + DAY).length;
  base.metrics = [
    { label: "Today", value: String(today) },
    { label: "Next 14 days", value: String(sessions.length) },
    { label: "Courses", value: String(sectionIds.length) },
  ];
  base.sections = byDay.size
    ? [...byDay].map(([day, rows]) => ({ title: day, rows }))
    : [{ title: "Next 14 days", rows: [{ primary: "No classes scheduled", secondary: "Classes for your current courses will appear here." }] }];
}

async function notifications(user: SessionClaims, base: PortalView) {
  const items = await prisma.notification.findMany({
    where: { institutionId: user.institutionId, recipientAccountId: user.accountId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const unread = items.filter((n) => !n.readAt).length;
  base.metrics = [
    { label: "Unread", value: String(unread) },
    { label: "Total", value: String(items.length) },
  ];
  base.sections = [
    {
      title: "Inbox",
      rows: items.length
        ? items.map((n) => ({ primary: n.title, secondary: n.body, meta: `${n.readAt ? "Read" : "Unread"} · ${fmtDay(n.createdAt)}` }))
        : [{ primary: "No notifications yet", secondary: "Grade, message and course alerts will appear here." }],
    },
  ];
}

/** Live data for the student mobile "f" screens; null when the path is not one of them. */
export async function buildMobileScreen(user: SessionClaims, path: string, base: PortalView, now = new Date()): Promise<PortalView | null> {
  const screen = mobileScreenFor(path);
  if (!screen) return null;
  base.title = screen.title;
  base.active = screen.title;
  base.breadcrumb = ["Student", screen.title];
  base.actions = [
    { label: "Mobile home", href: "/m/student" },
    { label: "Desktop", href: screen.kind === "notifications" ? "/student/notifications" : screen.kind === "schedule" ? "/student/calendar" : "/student", variant: "secondary" },
  ];
  if (screen.kind === "todo") await todo(user, base, now);
  else if (screen.kind === "schedule") await schedule(user, base, now);
  else if (screen.kind === "notifications") await notifications(user, base);
  else {
    base.metrics = [];
    base.sections = [{ title: "Connection", rows: [{ primary: "You're online", secondary: "Your data is up to date." }] }];
  }
  return base;
}

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import {
  attendanceDay,
  availableWorkshops,
  completedWorkshops,
  createEnrolment,
  getWorkshop,
  instructorWorkshopScope,
  listEnrolments,
  myWorkshops,
  saveAttendance,
  setEnrolmentStatus,
  workshopCounts,
  type WorkshopScope,
  type WorkshopSummary,
} from "../admin/heritage/workshops.js";

type InstructorLivePayload = Record<string, unknown>;

export type WorkshopEnrolmentStatus = "pending" | "approved" | "declined" | "dropped";
export type WorkshopListKind = "mine" | "available" | "completed";

const ENROLMENT_STATUSES: WorkshopEnrolmentStatus[] = ["pending", "approved", "declined", "dropped"];
const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const WEEKDAYS = ["Sun.", "Mon.", "Tue.", "Wed.", "Thu.", "Fri.", "Sat."];

function pathQuery(path: string) {
  try {
    return new URL(path, "http://local").searchParams;
  } catch {
    return new URLSearchParams();
  }
}

export function normalizeEnrolmentStatus(status: string): WorkshopEnrolmentStatus {
  const s = status.trim().toLowerCase();
  if (s === "pending") return "pending";
  if (s === "declined" || s === "rejected") return "declined";
  if (s === "dropped" || s === "cancelled") return "dropped";
  return "approved";
}

export function parseEnrolmentStatusFilter(path: string): WorkshopEnrolmentStatus | "all" {
  const raw = (pathQuery(path).get("status") || "pending").trim().toLowerCase();
  if (raw === "all" || raw === "all statuses") return "all";
  if (ENROLMENT_STATUSES.includes(raw as WorkshopEnrolmentStatus)) return raw as WorkshopEnrolmentStatus;
  return "pending";
}

export function parseWorkshopListKind(path: string): WorkshopListKind {
  const raw = (pathQuery(path).get("list") || "mine").trim().toLowerCase();
  if (raw === "available" || raw === "completed") return raw;
  return "mine";
}

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

function shiftYmd(value: string, days: number) {
  const d = new Date(`${value}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  const d = new Date(`${value}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatAttendanceHeading(value: string) {
  const d = new Date(`${value}T12:00:00Z`);
  return `ATTENDANCE FOR: ${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()}, ${d.getUTCFullYear()} (${WEEKDAYS[d.getUTCDay()].toUpperCase()})`;
}

function dateRange(w: Pick<WorkshopSummary, "startDate" | "endDate" | "continuous">) {
  if (!w.startDate) return "—";
  if (w.continuous) return `From ${formatShortDate(w.startDate)} (continuous intake)`;
  if (!w.endDate || w.endDate === w.startDate) return formatShortDate(w.startDate);
  return `${formatShortDate(w.startDate)} – ${formatShortDate(w.endDate)}`;
}

function statusTone(status: string): "warning" | "success" | "danger" | "muted" {
  if (status === "Pending") return "warning";
  if (status === "Approved") return "success";
  if (status === "Declined") return "danger";
  return "muted";
}

async function scopedWorkshops(institutionId: string, scope: WorkshopScope) {
  const rows = await prisma.workshop.findMany({
    where: { institutionId, id: { in: [...scope.workshopIds] } },
    select: { id: true, title: true, code: true },
    orderBy: { title: "asc" },
  });
  return rows;
}

function workshopOptions(workshops: Array<{ id: string; title: string; code: string }>) {
  return [{ label: "All Workshops", value: "" }, ...workshops.map((w) => ({ label: `${w.code} — ${w.title}`, value: w.id }))];
}

export async function workshopNavCounts(user: SessionClaims) {
  return workshopCounts(user, await instructorWorkshopScope(user));
}

function workshopCard(w: WorkshopSummary) {
  return {
    tag: w.status.toUpperCase(),
    org: w.category || "Heritage Community College",
    seats: `${w.seatsLeft} of ${w.capacity} seats left`,
    title: w.title,
    description: [w.code, w.schedule !== "—" ? w.schedule : "", w.length].filter(Boolean).join(" · "),
    when: dateRange(w),
    where: [w.campus, w.classroom].filter(Boolean).join(" · ") || "TBA",
    href: `/instructor/f/t24-workshop-detail?workshopId=${encodeURIComponent(w.id)}`,
  };
}

export async function buildWorkshopList(user: SessionClaims, path: string): Promise<InstructorLivePayload> {
  const list = parseWorkshopListKind(path);
  const scope = await instructorWorkshopScope(user);
  const [mine, available, completed] = await Promise.all([
    myWorkshops(user, "Active & Upcoming Workshops", scope),
    availableWorkshops(user, scope),
    completedWorkshops(user, scope),
  ]);
  const rows = list === "available" ? available.items : list === "completed" ? completed.items : mine.items;
  const title = list === "available" ? "Available Workshops" : list === "completed" ? "Completed Workshops" : "All My Workshops";
  const tabs = [`My Workshops (${mine.items.length})`, `Available Workshops (${available.items.length})`, `Completed Workshops (${completed.items.length})`];
  return {
    title,
    subtitle: `${rows.length} workshop(s)`,
    breadcrumbs: list === "mine" ? ["Home", "All My Workshops"] : ["Home", "All My Workshops", title],
    primaryAction: "New Workshop Enrolment",
    primaryActionHref: "/instructor/f/t42-new-workshop-enrollment",
    secondaryAction: "Workshop Attendance",
    secondaryActionHref: "/instructor/f/t41-workshop-attendance",
    workshops: {
      tabs,
      activeTab: list === "available" ? tabs[1] : list === "completed" ? tabs[2] : tabs[0],
      credits: "",
      cards: rows.map(workshopCard),
      registrations: mine.items.slice(0, 8).map((w) => ({ title: w.title, when: dateRange(w) })),
    },
  };
}

function unavailableWorkshop(subtitle: string, description: string): InstructorLivePayload {
  return {
    title: "Workshop Detail",
    subtitle,
    breadcrumbs: ["Home", "All My Workshops", "Workshop"],
    workshopDetail: {
      title: "Workshop",
      status: "Unavailable",
      when: "—",
      where: "—",
      seats: "—",
      description,
      agenda: [],
      materials: [],
    },
  };
}

export async function buildWorkshopDetail(user: SessionClaims, path: string): Promise<InstructorLivePayload> {
  const scope = await instructorWorkshopScope(user);
  const requested = (pathQuery(path).get("workshopId") || "").trim();
  const fallback = requested ? null : (await scopedWorkshops(user.institutionId, scope))[0]?.id;
  const id = requested || fallback;
  if (!id) return unavailableWorkshop("No workshop selected", "No workshops are assigned to you yet.");
  if (!scope.workshopIds.has(id)) return unavailableWorkshop("This workshop is not assigned to you", "This workshop is not assigned to you.");
  let w: Awaited<ReturnType<typeof getWorkshop>>;
  try {
    w = await getWorkshop(user, id, scope);
  } catch (err) {
    return unavailableWorkshop("Workshop unavailable", errorMessage(err, "This workshop could not be loaded."));
  }
  const st = w.settings;
  const agenda =
    st.scheduleType === "Daily Schedule"
      ? [`Daily ${st.dailyStart}–${st.dailyEnd}`]
      : st.sessions.map((x) => `${x.day} ${x.start}–${x.end}`);
  const fee =
    st.feeCollection === "Do Not Collect" || !(st.defaultFee || st.domesticFee || st.internationalFee)
      ? "No fee"
      : `$${st.defaultFee.toFixed(2)} default · $${st.domesticFee.toFixed(2)} domestic · $${st.internationalFee.toFixed(2)} international`;
  const description = [st.introduction, w.settings.descriptionHtml ? w.settings.descriptionHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: w.title,
    subtitle: w.code,
    breadcrumbs: ["Home", "All My Workshops", w.title],
    workshopDetail: {
      title: w.title,
      status: w.status,
      when: dateRange(w),
      where: [w.campus, w.classroom].filter(Boolean).join(" · ") || "TBA",
      seats: `${w.seatsLeft} of ${w.capacity} seats remaining`,
      description: description || "No description provided.",
      agenda: agenda.length ? agenda : ["No schedule set"],
      materials: [
        { label: "Enrolments", meta: `${w.counts.approved} approved · ${w.counts.pending} pending · ${w.counts.declined} declined · ${w.counts.dropped} dropped` },
        { label: "Instructor(s)", meta: w.instructors.join(", ") || "Not assigned" },
        { label: "Enrolment Approval", meta: st.approval },
        { label: "Workshop Privacy", meta: st.privacy },
        { label: "Enrolment Cut-off", meta: st.enrolmentCutoff ? st.enrolmentCutoff.replace("T", " ") : "None" },
        { label: "Fees", meta: fee },
        { label: "Length", meta: w.length },
      ],
    },
  };
}

export async function buildWorkshopEnrolments(user: SessionClaims, path: string): Promise<InstructorLivePayload> {
  const q = pathQuery(path);
  const statusFilter = parseEnrolmentStatusFilter(path);
  const workshopId = q.get("workshop") || "";
  const letter = (q.get("letter") || "ALL").trim().toUpperCase();
  const scope = await instructorWorkshopScope(user);
  const [workshops, result] = await Promise.all([
    scopedWorkshops(user.institutionId, scope),
    listEnrolments(
      user,
      {
        student: (q.get("student") || "").trim(),
        workshop: workshopId,
        status: statusFilter,
        letter: letter === "ALL" ? "" : letter,
        page: 1,
        perPage: 500,
      },
      scope,
    ),
  ]);
  return {
    title: "WORKSHOP ENROLMENTS",
    subtitle: statusFilter === "all" ? "All statuses" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1),
    breadcrumbs: ["Home", "Workshop Enrolments"],
    workshopEnrolments: {
      studentPlaceholder: "Student #, login or last name",
      studentValue: q.get("student") || "",
      workshopValue: workshopId,
      workshopOptions: workshopOptions(workshops),
      statusValue: statusFilter,
      statusOptions: [
        { label: "All Statuses", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Declined", value: "declined" },
        { label: "Dropped", value: "dropped" },
      ],
      letter,
      searchLabel: "Search Workshops",
      emptyMessage: "No workshop enrolments were found.",
      rows: result.items.map((row) => ({
        id: row.id,
        studentName: row.student.name,
        studentNumber: row.student.studentNumber,
        workshop: `${row.workshop.code} — ${row.workshop.title}${row.role ? ` (${row.role})` : ""}`,
        workshopId: row.workshop.id,
        status: row.status,
        statusTone: statusTone(row.status),
        enrolledOn: row.enrolledAt.slice(0, 10),
        note: row.note || "",
      })),
    },
  };
}

export async function buildWorkshopAttendance(user: SessionClaims, path: string): Promise<InstructorLivePayload> {
  const q = pathQuery(path);
  const workshopId = q.get("workshop") || "";
  const scope = await instructorWorkshopScope(user);
  const [workshops, day] = await Promise.all([
    scopedWorkshops(user.institutionId, scope),
    attendanceDay(user, { date: q.get("date") || "", student: q.get("student") || "", workshop: workshopId }, scope),
  ]);
  const date = day.date;
  const students = day.groups.flatMap((g) =>
    g.students.map((s) => ({
      id: `${g.workshop.id}:${s.student.id}`,
      studentId: s.student.id,
      workshopId: g.workshop.id,
      workshopTitle: `${g.workshop.code} — ${g.workshop.title}${g.workshop.time ? ` · ${g.workshop.time}` : ""}`,
      name: s.student.name,
      studentNumber: s.student.studentNumber,
      familyName: s.student.familyName,
      status: (s.status === "absent" ? "Absent" : "Present") as "Present" | "Absent",
      note: s.note,
      avatar: "",
    })),
  );
  const sunday = shiftYmd(date, -new Date(`${date}T12:00:00Z`).getUTCDay());
  return {
    title: "WORKSHOP ATTENDANCE",
    subtitle: formatAttendanceHeading(date),
    breadcrumbs: ["Home", "Workshop Attendance"],
    workshopAttendance: {
      date,
      studentPlaceholder: "Student # or last name",
      studentValue: q.get("student") || "",
      workshopValue: workshopId,
      workshopOptions: workshopOptions(workshops),
      loadLabel: "Load Attendance",
      heading: formatAttendanceHeading(date),
      previousLabel: `« ${formatShortDate(day.previous)}`,
      previousDate: day.previous,
      nextLabel: `${formatShortDate(day.next)} »`,
      nextDate: day.next,
      emptyMessage: "No students were found. Please change the filters above to see other possibilities.",
      totalLabel: `Total Students: ${students.length}`,
      saveLabel: "Save Attendance",
      weekDates: Array.from({ length: 7 }, (_, i) => {
        const value = shiftYmd(sunday, i);
        const d = new Date(`${value}T12:00:00Z`);
        return { value, label: `${WEEKDAYS[i]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`, active: value === date };
      }),
      students,
    },
  };
}

export async function buildNewWorkshopEnrolmentForm(user: SessionClaims): Promise<InstructorLivePayload> {
  const scope = await instructorWorkshopScope(user);
  const open = (await availableWorkshops(user, scope)).items;
  const roleIds = new Set<string>();
  if (open.length) {
    const rows = await prisma.workshop.findMany({ where: { id: { in: open.map((w) => w.id) } }, select: { settingsJson: true } });
    for (const r of rows) {
      try {
        const st = JSON.parse(r.settingsJson) as { rolesMode?: string; roleIds?: string[] };
        if (st.rolesMode === "Enabled") for (const id of st.roleIds ?? []) roleIds.add(id);
      } catch {
        /* legacy row without settings */
      }
    }
  }
  const roles = roleIds.size
    ? await prisma.workshopRole.findMany({ where: { institutionId: user.institutionId, id: { in: [...roleIds] } }, orderBy: { name: "asc" } })
    : [];
  return {
    title: "NEW WORKSHOP ENROLMENT",
    subtitle: "Enrol a student into one of your workshops",
    breadcrumbs: ["Home", "Workshop Enrolments", "New Workshop Enrolment"],
    form: {
      submitLabel: "Save Enrolment",
      groups: [
        {
          title: "Workshop Enrolment Details",
          fields: [
            { label: "Student", value: "", type: "text", hint: "Student #, login or last name" },
            {
              label: "Workshop",
              value: "",
              type: "select",
              options: [
                { label: open.length ? "--- Please Select Workshop ---" : "No available workshops", value: "" },
                ...open.map((w) => ({
                  label: `${w.code} — ${w.title} (${w.seatsLeft} seat${w.seatsLeft === 1 ? "" : "s"} left · ${w.approval === "Automatic Approval" ? "auto-approved" : "needs approval"})`,
                  value: w.id,
                })),
              ],
            },
            ...(roles.length
              ? [
                  {
                    label: "Workshop Role",
                    value: "",
                    type: "select",
                    optional: true,
                    hint: "Required when the workshop uses roles",
                    options: [{ label: "--- Not applicable ---", value: "" }, ...roles.map((r) => ({ label: r.name, value: r.id }))],
                  },
                ]
              : []),
            { label: "Note", value: "", type: "textarea", optional: true },
          ],
        },
      ],
    },
  };
}

async function findStudentForEnrolment(institutionId: string, raw: string) {
  const q = raw.trim();
  if (!q) return null;
  const include = { person: { include: { accounts: { select: { email: true } } } } } as const;
  const byNumber = await prisma.student.findFirst({
    where: { institutionId, studentNumber: { equals: q, mode: "insensitive" } },
    include,
  });
  if (byNumber) return byNumber;
  const lowered = q.toLowerCase();
  const candidates = await prisma.student.findMany({
    where: {
      institutionId,
      OR: [
        { person: { email: { contains: q, mode: "insensitive" } } },
        { person: { accounts: { some: { email: { contains: q, mode: "insensitive" } } } } },
        { person: { familyName: { contains: q, mode: "insensitive" } } },
        { person: { givenName: { contains: q.split(" ")[0] ?? q, mode: "insensitive" } } },
      ],
    },
    include,
    take: 50,
  });
  const emails = (s: (typeof candidates)[number]) => [s.person.email, ...s.person.accounts.map((a) => a.email)].map((e) => e.toLowerCase());
  return (
    candidates.find((s) => emails(s).includes(lowered)) ||
    candidates.find((s) => emails(s).some((e) => e.split("@")[0] === lowered)) ||
    candidates.find((s) => s.person.familyName.toLowerCase() === lowered) ||
    candidates.find((s) => `${s.person.givenName} ${s.person.familyName}`.toLowerCase() === lowered) ||
    candidates.find((s) => s.person.familyName.toLowerCase().startsWith(lowered)) ||
    null
  );
}

export async function saveWorkshopEnrolment(user: SessionClaims, fields: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const studentRaw = (fields.Student || fields["Student #, login or last name"] || "").trim();
  const workshopId = (fields.Workshop || "").trim();
  if (!studentRaw) return { ok: false, message: "Enter a student #, login or last name." };
  if (!workshopId) return { ok: false, message: "Please select a workshop." };
  const student = await findStudentForEnrolment(user.institutionId, studentRaw);
  if (!student) return { ok: false, message: `No student matched “${studentRaw}”.` };
  try {
    const saved = await createEnrolment(
      user,
      { studentId: student.id, workshopId, roleId: (fields["Workshop Role"] || "").trim(), note: (fields.Note || "").trim() || "Enrolled by instructor" },
      await instructorWorkshopScope(user),
    );
    return { ok: true, message: saved.message };
  } catch (err) {
    return { ok: false, message: errorMessage(err, "Could not save the enrolment.") };
  }
}

export async function updateWorkshopEnrolmentStatus(user: SessionClaims, registrationId: string, status: WorkshopEnrolmentStatus, note?: string) {
  if (!registrationId) return { ok: false, message: "Enrolment not found." };
  try {
    const saved = await setEnrolmentStatus(user, registrationId, status, note, await instructorWorkshopScope(user));
    return { ok: true, message: saved.message };
  } catch (err) {
    return { ok: false, message: errorMessage(err, "Could not update the enrolment.") };
  }
}

export async function saveWorkshopAttendance(
  user: SessionClaims,
  date: string,
  roster: Array<{ studentId: string; workshopId: string; status: string; note?: string }>,
) {
  try {
    const saved = await saveAttendance(
      user,
      { date, marks: roster.map((r) => ({ workshopId: r.workshopId, studentId: r.studentId, status: /absent/i.test(r.status) ? "absent" : "present", note: r.note || "" })) },
      await instructorWorkshopScope(user),
    );
    return { ok: true, message: saved.message };
  } catch (err) {
    return { ok: false, message: errorMessage(err, "Could not save attendance.") };
  }
}

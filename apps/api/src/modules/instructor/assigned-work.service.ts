import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { listInterviewerInterviews, safeInterviewMeetingUrl } from "../admissions/interviewAccess.js";
import { listAssignedCrmLeads } from "./assigned-crm.service.js";
import { listAssignedAppointments, listAssignedSuccessCases } from "../student-success/assigned-success.service.js";

type WorkItem = {
  id: string;
  kind: string;
  category: string;
  title: string;
  subtitle: string;
  status: string;
  when: string | null;
  location: string | null;
  actionUrl: string | null;
  details: Array<{ label: string; value: string }>;
  updatedAt: string;
  availableActions: Array<{ key: string; label: string; tone?: "primary" | "danger" }>;
};

type Json = Record<string, unknown>;

function dataOf(value: string): Json {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Json : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

const recordAssignments = [
  { screenId: "OPS:LB_SESSION", field: "instructorId", kind: "lab_session", category: "Labs", title: "title", subtitle: "sectionId", when: "date", location: "roomId" },
  { screenId: "OPS:WS_TICKET", field: "assigneeId", kind: "helpdesk_ticket", category: "Help Desk", title: "subject", subtitle: "category", when: "", location: "" },
  { screenId: "OPS:CP_HOLD", field: "custodianId", kind: "legal_hold", category: "Compliance", title: "matter", subtitle: "scope", when: "placedOn", location: "" },
  { screenId: "OPS:CP_PRIVACY", field: "handlerId", kind: "privacy_request", category: "Compliance", title: "type", subtitle: "response", when: "dueOn", location: "" },
  { screenId: "OPS:CP_EVIDENCE", field: "ownerId", kind: "evidence", category: "Compliance", title: "title", subtitle: "standard", when: "dueOn", location: "" },
  { screenId: "OPS:FM_SUBMISSION", field: "reviewerId", kind: "form_review", category: "Forms", title: "formId", subtitle: "reviewNote", when: "submittedOn", location: "" },
] as const;

function genericItem(
  row: { id: string; screenId: string; dataJson: string; updatedAt: Date },
  def: typeof recordAssignments[number],
  labels: { students: Map<string, string>; programs: Map<string, string> },
): WorkItem {
  const data = dataOf(row.dataJson);
  const date = text(data[def.when]);
  const start = text(data.startTime);
  const end = text(data.endTime);
  const when = date ? `${date}${start ? ` ${start}${end ? `–${end}` : ""}` : ""}` : null;
  const studentName = labels.students.get(text(data.studentId));
  const programName = labels.programs.get(text(data.programId));
  const complianceSubtitle = def.kind === "legal_hold"
    ? [studentName, text(data.scope)].filter(Boolean).join(" · ")
    : def.kind === "privacy_request"
      ? studentName
      : def.kind === "evidence"
        ? [programName, text(data.standard)].filter(Boolean).join(" · ")
        : "";
  const hiddenDetails = new Set([def.field, def.title, def.subtitle, "status", "studentId", "programId", "custodianId", "handlerId", "ownerId", "sectionId", "roomId"]);
  return {
    id: row.id,
    kind: def.kind,
    category: def.category,
    title: text(data[def.title]) || def.category,
    subtitle: complianceSubtitle || text(data[def.subtitle]) || "Assigned to you",
    status: text(data.status) || "Assigned",
    when,
    location: text(data[def.location]) || null,
    actionUrl: null,
    details: Object.entries(data)
      .filter(([key, value]) => !hiddenDetails.has(key) && text(value))
      .slice(0, 4)
      .map(([label, value]) => ({ label, value: text(value) })),
    updatedAt: row.updatedAt.toISOString(),
    availableActions: def.kind === "lab_session"
      ? text(data.status) === "Scheduled"
        ? [{ key: "In Progress", label: "Start Lab", tone: "primary" }, { key: "Completed", label: "Complete" }, { key: "Cancelled", label: "Cancel", tone: "danger" }]
        : text(data.status) === "In Progress"
          ? [{ key: "Completed", label: "Complete Lab", tone: "primary" }]
          : []
      : [],
  };
}

export async function listAssignedWork(user: SessionClaims): Promise<WorkItem[]> {
  const { syncExistingLabSessions } = await import("../labs/lab-flow.service.js");
  await syncExistingLabSessions(user.institutionId);
  const screens = [...recordAssignments.map((def) => def.screenId), "PM:PROGRAM"];
  const [cases, appointments, leads, interviews, records, placements] = await Promise.all([
    listAssignedSuccessCases(user),
    listAssignedAppointments(user),
    listAssignedCrmLeads(user),
    listInterviewerInterviews(user.institutionId, user.personId),
    prisma.heritageRecord.findMany({
      where: { institutionId: user.institutionId, screenId: { in: screens }, deletedAt: null },
      select: { id: true, screenId: true, dataJson: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.placement.findMany({
      where: { institutionId: user.institutionId, supervisorPersonId: user.personId, status: { in: ["pending", "active"] } },
      include: { employerOrg: true, hours: { where: { status: "pending" }, orderBy: { createdAt: "asc" } }, evaluations: { where: { status: "due" }, orderBy: { createdAt: "asc" } } },
      orderBy: { startsOn: "asc" },
    }),
  ]);

  const parsedRecords = records.map((row) => ({ row, data: dataOf(row.dataJson) }));
  const studentIds = [...new Set(parsedRecords.map(({ data }) => text(data.studentId)).filter(Boolean))];
  const students = studentIds.length ? await prisma.student.findMany({
    where: { institutionId: user.institutionId, id: { in: studentIds } },
    include: { person: { select: { givenName: true, familyName: true } } },
  }) : [];
  const studentLabels = new Map(students.map((student) => [student.id, `${student.person.givenName} ${student.person.familyName}`.trim()]));
  const programLabels = new Map(parsedRecords.flatMap(({ row, data }) => row.screenId === "PM:PROGRAM"
    ? [[row.id, text(data.name) || text(data.title) || text(data.code) || "Programme"] as const]
    : []));

  const applicationIds = [...new Set(interviews.map((item) => item.applicationId))];
  const applications = applicationIds.length ? await prisma.admissionsApplication.findMany({
    where: { institutionId: user.institutionId, id: { in: applicationIds } },
    select: { id: true, personId: true, programName: true },
  }) : [];
  const people = applications.length ? await prisma.person.findMany({
    where: { institutionId: user.institutionId, id: { in: applications.map((item) => item.personId) } },
    select: { id: true, givenName: true, familyName: true },
  }) : [];
  const names = new Map(people.map((person) => [person.id, `${person.givenName} ${person.familyName}`.trim()]));
  const applicationMeta = new Map(applications.map((application) => [application.id, { name: names.get(application.personId) || "Applicant", program: application.programName }]));

  const items: WorkItem[] = [
    ...placements.map((placement) => ({
      id: placement.id,
      kind: "practicum_placement",
      category: "Practicum",
      title: placement.studentName,
      subtitle: `${placement.programName} · ${placement.employerOrg.name}`,
      status: placement.status,
      when: placement.startsOn,
      location: placement.employerOrg.siteName,
      actionUrl: null,
      details: [
        { label: "Pending hours", value: String(placement.hours.length) },
        { label: "Evaluations due", value: String(placement.evaluations.length) },
        ...(placement.endsOn ? [{ label: "Ends", value: placement.endsOn }] : []),
      ],
      updatedAt: placement.updatedAt.toISOString(),
      availableActions: [
        ...placement.hours.flatMap((hours) => [
          { key: `approve_hours:${hours.id}`, label: `Approve ${hours.hours}h`, tone: "primary" as const },
          { key: `reject_hours:${hours.id}`, label: `Reject ${hours.hours}h`, tone: "danger" as const },
        ]),
        ...placement.evaluations.map((evaluation) => ({ key: `submit_evaluation:${evaluation.id}`, label: "Submit Evaluation", tone: "primary" as const })),
      ],
    })),
    ...cases.map((item) => ({
      id: item.id, kind: "success_case", category: "Student Success", title: item.studentName,
      subtitle: item.summary, status: item.status, when: null, location: null, actionUrl: null,
      details: [{ label: "Student", value: item.studentNumber }, { label: "Level", value: item.level }, { label: "Tasks", value: String(item.tasks.length) }],
      updatedAt: item.updatedAt,
      availableActions: [],
    })),
    ...appointments.map((item) => ({
      id: item.id, kind: "advising_appointment", category: "Advising", title: item.studentName,
      subtitle: item.topic, status: item.status, when: item.startsAt, location: null, actionUrl: null,
      details: [{ label: "Student", value: item.studentNumber }, ...(item.notes ? [{ label: "Notes", value: item.notes }] : [])],
      updatedAt: item.updatedAt,
      availableActions: [],
    })),
    ...leads.map((item) => ({
      id: item.id, kind: "crm_lead", category: "CRM Counselling", title: item.name,
      subtitle: item.programName, status: item.stage, when: item.nextFollowUp, location: null, actionUrl: null,
      details: [{ label: "Email", value: item.email || "—" }, { label: "Source", value: item.source }], updatedAt: item.updatedAt,
      availableActions: [],
    })),
    ...interviews.map((item) => {
      const meta = applicationMeta.get(item.applicationId);
      return {
        id: item.id, kind: "admissions_interview", category: "Admissions", title: meta?.name || "Applicant",
        subtitle: meta?.program || "Admissions interview", status: item.status, when: item.scheduledAt,
        location: item.location || null, actionUrl: item.status === "Scheduled" ? safeInterviewMeetingUrl(item.location) : null,
        details: [{ label: "Mode", value: item.mode || "—" }], updatedAt: item.scheduledAt,
        availableActions: [],
      };
    }),
    ...records.flatMap((row) => {
      const def = recordAssignments.find((item) => item.screenId === row.screenId);
      if (!def) return [];
      const data = dataOf(row.dataJson);
      return text(data[def.field]) === user.personId ? [genericItem(row, def, { students: studentLabels, programs: programLabels })] : [];
    }),
  ];

  return items.sort((a, b) => {
    const aDate = a.when || a.updatedAt;
    const bDate = b.when || b.updatedAt;
    return aDate.localeCompare(bDate);
  });
}

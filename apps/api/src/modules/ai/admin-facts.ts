import { prisma } from "@myheritage/db";
import { S as COURSE_SCREENS, settingsOf } from "../admin/heritage/courses.js";

export type AdminFact = { id: string; title: string; uri: string; text: string; topics: RegExp };

const LIST = 25;
const money = (n: number) => `CAD ${Math.round(n).toLocaleString("en-CA")}`;
const nameOf = (p?: { givenName: string; familyName: string } | null) => (p ? `${p.givenName} ${p.familyName}`.trim() : "Unknown");
const roles = (json: string) => {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
};
const tally = (values: string[]) => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v || "unspecified", (m.get(v || "unspecified") ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace(/_/g, " ")}: ${n}`).join(", ") || "none";
};

/** Live, institution-scoped evidence for admin Ask Heritage — every figure is read from the database at question time. */
export async function adminCampusFacts(inst: string): Promise<AdminFact[]> {
  const [students, accounts, programs, courses, sections, enrolments, ledger, approvals, loa, services, grades, apps, cases, evals, holds, privacy] = await Promise.all([
    prisma.student.findMany({ where: { institutionId: inst }, select: { id: true, studentNumber: true, programName: true, standing: true, person: { select: { givenName: true, familyName: true } } } }),
    prisma.account.findMany({ where: { institutionId: inst }, select: { status: true, email: true, rolesJson: true, personId: true, person: { select: { givenName: true, familyName: true } } } }),
    prisma.program.findMany({ where: { institutionId: inst }, select: { code: true, name: true, awardLevel: true } }),
    prisma.course.findMany({ where: { institutionId: inst }, select: { code: true, title: true, credits: true }, orderBy: { code: "asc" } }),
    prisma.section.findMany({ where: { institutionId: inst }, select: { id: true, code: true, instructorPersonId: true, course: { select: { code: true, title: true } }, term: { select: { name: true } }, enrolments: { where: { status: "enrolled" }, select: { id: true } } } }),
    prisma.enrolment.findMany({ where: { institutionId: inst }, select: { status: true, studentId: true } }),
    prisma.financeLedgerEntry.findMany({ where: { institutionId: inst }, select: { studentId: true, amountCad: true, kind: true, status: true, dueAt: true } }),
    prisma.approvalRequest.findMany({ where: { institutionId: inst, status: "pending" }, select: { type: true } }),
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst, status: "pending" }, select: { startsOn: true, endsOn: true, reason: true, student: { select: { studentNumber: true, person: { select: { givenName: true, familyName: true } } } } } }),
    prisma.serviceRequest.findMany({ where: { institutionId: inst, status: "open" }, select: { type: true } }),
    prisma.gradeItem.findMany({ where: { institutionId: inst }, select: { status: true } }),
    prisma.admissionsApplication.findMany({ where: { institutionId: inst }, select: { status: true, programName: true } }),
    prisma.complianceCase.findMany({ where: { institutionId: inst, status: "open" }, select: { caseKind: true, severity: true } }),
    prisma.courseEvaluation.count({ where: { institutionId: inst, status: "pending" } }),
    prisma.heritageRecord.count({ where: { institutionId: inst, screenId: "OPS:CP_HOLD", deletedAt: null, dataJson: { contains: '"status":"Active"' } } }),
    prisma.heritageRecord.count({ where: { institutionId: inst, screenId: "OPS:CP_PRIVACY", deletedAt: null, OR: [{ dataJson: { contains: '"status":"Received"' } }, { dataJson: { contains: '"status":"In Progress"' } }] } }),
  ]);

  const people = new Map(accounts.map((a) => [a.personId, a.person]));
  const instructors = accounts.filter((a) => roles(a.rolesJson).includes("instructor"));
  const studentName = new Map(students.map((s) => [s.id, `${nameOf(s.person)} (${s.studentNumber})`]));
  const session = await settingsOf(inst, COURSE_SCREENS.session, sections.map((x) => x.id));

  const offerings = sections.map((x) => {
    const max = session.get(x.id)?.data.maxEnrolments;
    const capacity = max === null || max === undefined || max === "" ? null : Number(max);
    const enrolled = x.enrolments.length;
    return { label: `${x.course.code} ${x.code} — ${x.course.title} (${x.term.name})`, instructor: nameOf(people.get(x.instructorPersonId)), instructorId: x.instructorPersonId, enrolled, capacity: capacity && capacity > 0 ? capacity : null };
  });
  const util = (o: (typeof offerings)[number]) => (o.capacity ? Math.round((o.enrolled / o.capacity) * 100) : null);
  const withLimit = offerings.filter((o) => o.capacity);
  const low = withLimit.filter((o) => (util(o) ?? 100) < 40).sort((a, b) => (util(a) ?? 0) - (util(b) ?? 0));
  const full = withLimit.filter((o) => o.enrolled >= (o.capacity ?? Infinity));

  const now = Date.now();
  const bal = new Map<string, { open: number; pastDue: number }>();
  let open = 0;
  let pastDue = 0;
  for (const r of ledger) {
    if (r.status !== "open" && r.status !== "posted") continue;
    const amount = Number(r.amountCad);
    const signed = r.kind === "payment" || r.kind === "credit" ? -Math.abs(amount) : Math.abs(amount);
    const b = bal.get(r.studentId) ?? { open: 0, pastDue: 0 };
    b.open += signed;
    open += signed;
    if (r.dueAt && r.dueAt.getTime() < now && signed > 0) {
      b.pastDue += signed;
      pastDue += signed;
    }
    bal.set(r.studentId, b);
  }
  const owing = [...bal].filter(([, b]) => b.open > 0.5).sort((a, b) => b[1].open - a[1].open);
  const late = [...bal].filter(([, b]) => b.pastDue > 0.5).sort((a, b) => b[1].pastDue - a[1].pastDue);

  const enrolledStudents = new Set(enrolments.filter((e) => e.status === "enrolled").map((e) => e.studentId)).size;
  const atRisk = students.filter((s) => s.standing !== "good");
  const loads = new Map<string, typeof offerings>();
  for (const o of offerings) loads.set(o.instructorId, [...(loads.get(o.instructorId) ?? []), o]);

  return [
    {
      id: "admin:students",
      title: "Students",
      uri: "/admin/student-management/browse",
      topics: /student|enrol|roster|program|cohort|standing/,
      text: `${students.length} student records; ${enrolledStudents} of them are currently enrolled in at least one course offering. By program: ${tally(students.map((s) => s.programName))}. By academic standing: ${tally(students.map((s) => s.standing))}. Course enrolments (one per student per offering) by status: ${tally(enrolments.map((e) => e.status))}.`,
    },
    {
      id: "admin:programs",
      title: "Programs",
      uri: "/admin/program-management",
      topics: /program|diploma|certificate|award/,
      text: programs.length ? `${programs.length} programs: ${programs.map((p) => `${p.name} (${p.code}, ${p.awardLevel})`).join("; ")}.` : "No programs are set up in Program Management.",
    },
    {
      id: "admin:courses",
      title: "Courses",
      uri: "/admin/course-management/courses",
      topics: /course|catalog|credit|subject/,
      text: `${courses.length} courses in the catalogue${courses.length ? `: ${courses.slice(0, 40).map((c) => `${c.code} ${c.title} (${c.credits} cr)`).join("; ")}${courses.length > 40 ? `; and ${courses.length - 40} more` : ""}` : ""}.`,
    },
    {
      id: "admin:sections",
      title: "Course offerings",
      uri: "/admin/course-management/active",
      topics: /section|offering|seat|capacity|utili[sz]ation|fill|full|class size|enrol/,
      text: [
        `${offerings.length} course offerings (sections) holding ${offerings.reduce((n, o) => n + o.enrolled, 0)} active course enrolments (seats taken; a student in several offerings counts once per offering).`,
        `${withLimit.length} offerings have a Maximum Enrolments limit set in Course Management${offerings.length - withLimit.length ? `; ${offerings.length - withLimit.length} have no limit set, so utilization cannot be calculated for them` : ""}.`,
        low.length ? `Below 40% seat utilization (${low.length}): ${low.slice(0, LIST).map((o) => `${o.label}: ${o.enrolled}/${o.capacity} (${util(o)}%)`).join("; ")}.` : "No offering with a seat limit is below 40% utilization.",
        full.length ? `Full (${full.length}): ${full.slice(0, LIST).map((o) => `${o.label}: ${o.enrolled}/${o.capacity}`).join("; ")}.` : "No offering is full.",
        `All offerings: ${offerings.slice(0, 40).map((o) => `${o.label}, instructor ${o.instructor}, ${o.enrolled}${o.capacity ? `/${o.capacity}` : ""} enrolled`).join("; ")}${offerings.length > 40 ? `; and ${offerings.length - 40} more` : ""}.`,
      ].join(" "),
    },
    {
      id: "admin:instructors",
      title: "Instructors",
      uri: "/admin/user-management",
      topics: /instructor|teacher|faculty|staff|teach|professor|who (is|are)/,
      text: instructors.length
        ? `${instructors.length} instructor accounts: ${instructors.map((a) => {
            const taught = loads.get(a.personId) ?? [];
            return `${nameOf(a.person)} <${a.email}> (${a.status}) — ${taught.length ? `teaches ${taught.map((o) => o.label.split(" — ")[0]).join(", ")}` : "no sections assigned"}`;
          }).join("; ")}.`
        : "No accounts have the instructor role.",
    },
    {
      id: "admin:finance",
      title: "Student accounts receivable",
      uri: "/admin/financial",
      topics: /fee|tuition|balance|owe|owing|past due|overdue|payment|finance|ar\b|receivable|invoice|debt|money|paid/,
      text: [
        `Open accounts receivable ${money(Math.max(0, open))}; past due ${money(pastDue)} across ${late.length} students; ${owing.length} students have an open balance.`,
        late.length ? `Past due by student: ${late.slice(0, LIST).map(([id, b]) => `${studentName.get(id) ?? id}: ${money(b.pastDue)}`).join("; ")}.` : "",
        owing.length ? `Largest open balances: ${owing.slice(0, LIST).map(([id, b]) => `${studentName.get(id) ?? id}: ${money(b.open)}`).join("; ")}.` : "",
      ].filter(Boolean).join(" "),
    },
    {
      id: "admin:queues",
      title: "Requests & approvals",
      uri: "/admin/approvals",
      topics: /approv|request|leave|loa|withdraw|pending|queue|task|to.?do/,
      text: [
        `${approvals.length} approval requests pending (${tally(approvals.map((a) => a.type))}).`,
        `${loa.length} leave of absence requests pending${loa.length ? `: ${loa.slice(0, LIST).map((l) => `${nameOf(l.student.person)} (${l.student.studentNumber}) ${l.startsOn} to ${l.endsOn}`).join("; ")}` : ""}.`,
        `${services.length} open student service requests (${tally(services.map((s) => s.type))}).`,
        `${evals} course evaluations pending.`,
      ].join(" "),
    },
    {
      id: "admin:grades",
      title: "Grades",
      uri: "/admin/student-management/grades",
      topics: /grade|mark|publish|draft|transcript|gpa/,
      text: `Grade items by status: ${tally(grades.map((g) => g.status))}.`,
    },
    {
      id: "admin:at-risk",
      title: "At-risk students",
      uri: "/admin/student-management/alerts",
      topics: /risk|alert|probation|warning|standing|struggl|success|retention/,
      text: atRisk.length ? `${atRisk.length} students are not in good standing: ${atRisk.slice(0, LIST).map((s) => `${nameOf(s.person)} (${s.studentNumber}) — ${s.standing}`).join("; ")}${atRisk.length > LIST ? `; and ${atRisk.length - LIST} more` : ""}.` : "Every student is in good standing.",
    },
    {
      id: "admin:admissions",
      title: "Admissions",
      uri: "/admin/ops/admissions",
      topics: /admission|applica|applicant|intake|offer|conversion/,
      text: `${apps.length} admissions applications. By status: ${tally(apps.map((a) => a.status))}. By program: ${tally(apps.map((a) => a.programName))}.`,
    },
    {
      id: "admin:compliance",
      title: "Compliance",
      uri: "/admin/ops/compliance",
      topics: /complian|legal hold|privacy|retention|disposal|case|attendance sla|audit/,
      text: `${cases.length} open compliance cases (${tally(cases.map((c) => `${c.caseKind} ${c.severity}`))}); ${holds} active legal holds; ${privacy} open privacy requests.`,
    },
  ];
}

/** Facts relevant to the question; an overview set when nothing specific matches. */
export function relevantFacts(question: string, facts: AdminFact[]) {
  const q = question.toLowerCase();
  const hit = facts.filter((f) => f.topics.test(q));
  return hit.length ? hit : facts.filter((f) => ["admin:students", "admin:sections", "admin:queues"].includes(f.id));
}

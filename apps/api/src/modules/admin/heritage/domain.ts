import { randomUUID } from "node:crypto";
import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { CAMPUSES, STUDENT_STATUSES, assertPermission, patchStudentMeta, studentMetaMap, type PermissionModuleKey } from "../superAdmin.service.js";
import { withStudentMoneyLock } from "./studentLock.js";
import { normalizeDelivery } from "./students.spec.js";
import { applicationLifecycleStatus } from "./applicationStatus.js";

export type DomainRow = {
  id: string;
  status?: string;
  data: Record<string, unknown>;
  link?: { screen: string; ctx: string };
};
export type DomainResult = { source: string; rows: DomainRow[]; columns?: Array<{ key: string; label: string }>; summary?: Record<string, unknown> };
export type DomainCtx = { user: SessionClaims; contextKey: string; contextId: string | null };

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");
const money = (n: number) => Math.round(n * 100) / 100;
const fullName = (p: { givenName: string; familyName: string }) => `${p.familyName}, ${p.givenName}`;

async function students(ctx: DomainCtx): Promise<DomainResult> {
  const { institutionId } = ctx.user;
  const [rows, meta, apps] = await Promise.all([
    prisma.student.findMany({
      where: { institutionId },
      include: { person: true, cohort: true, enrolments: { where: { status: "enrolled" }, select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    studentMetaMap(institutionId),
    prisma.admissionsApplication.findMany({ where: { institutionId }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const people = new Map(
    (await prisma.person.findMany({ where: { id: { in: apps.map((a) => a.personId) } } })).map((p) => [p.id, p]),
  );
  const studentPeople = new Set(rows.map((s) => s.personId));
  const out: DomainRow[] = rows.map((s) => {
    const m = meta[s.id] ?? {};
    const status = m.status ?? (s.enrolments.length ? "Active Student" : "Registered Student");
    return {
      id: `student:${s.id}`,
      status,
      link: { screen: "S03", ctx: `student:${s.id}` },
      data: {
        name: fullName(s.person),
        student_number: s.studentNumber,
        status,
        advisors: "",
        program: s.programName,
        program_term: s.cohort?.label ?? "",
        admission_term: m.admissionTerm ?? s.cohort?.label ?? "",
        date: day(s.createdAt),
        campus: m.campus ?? s.cohort?.campus ?? "",
        nationality: m.residency ?? "",
        e_mail_address: s.person.email,
        phone_number: s.person.phone ?? "",
        delivery_method: normalizeDelivery(m.delivery) ?? "",
      },
    };
  });
  for (const a of apps) {
    if (studentPeople.has(a.personId)) continue;
    const p = people.get(a.personId);
    const status = applicationLifecycleStatus(a.status);
    out.push({
      id: `application:${a.id}`,
      status,
      data: {
        name: p ? fullName(p) : "Applicant",
        status,
        program: a.programName,
        admission_term: a.intakeTerm,
        date: day(a.submittedAt ?? a.createdAt),
        e_mail_address: p?.email ?? "",
      },
    });
  }
  return { source: "Student records + admissions applications", rows: out };
}

async function studentProfile(ctx: DomainCtx): Promise<DomainResult> {
  if (!ctx.contextId) return { source: "Student record", rows: [] };
  const s = await prisma.student.findFirst({ where: { id: ctx.contextId, institutionId: ctx.user.institutionId }, include: { person: true, cohort: true } });
  if (!s) return { source: "Student record", rows: [] };
  const m = (await studentMetaMap(ctx.user.institutionId))[s.id] ?? {};
  return {
    source: "Student record",
    rows: [],
    summary: {
      last_name: s.person.familyName,
      first_name: s.person.givenName,
      middle_name: s.person.middleName ?? "",
      preferred_name: s.person.preferredName ?? "",
      date_of_birth: s.person.dateOfBirth ?? "",
      phone_number: s.person.phone ?? "",
      e_mail_address: s.person.personalEmail ?? s.person.email,
      sis_e_mail: s.person.email,
      emergency_contact_name: s.person.emergencyContactName ?? "",
      emergency_contact_phone_number: s.person.emergencyContactPhone ?? "",
      student_number: s.studentNumber,
      program: s.programName,
      student_status: m.status ?? "",
      campus: m.campus ?? s.cohort?.campus ?? "",
      street_address: m.street ?? "",
      city: m.city ?? "",
      postal_zip_code: m.postal ?? "",
      domestic_international: m.residency ?? "",
      discount_code: m.discountCode ?? "",
    },
  };
}

async function ledger(ctx: DomainCtx, kinds: string[], perStudent: boolean): Promise<DomainResult> {
  const where = {
    institutionId: ctx.user.institutionId,
    kind: { in: kinds },
    ...(perStudent && ctx.contextId ? { studentId: ctx.contextId } : {}),
  };
  const storedEntries = await prisma.financeLedgerEntry.findMany({
    where,
    include: { student: { include: { person: true } } },
    orderBy: { postedAt: "desc" },
    take: 1000,
  });
  const entries = storedEntries.map((entry) => ({ ...entry, amountCad: Number(entry.amountCad) }));
  const terms = new Map((await prisma.financialTerm.findMany({ where: { institutionId: ctx.user.institutionId } })).map((t) => [t.id, t.name]));
  let running = 0;
  const rows = entries.map((e, i) => {
    running += e.kind === "charge" ? e.amountCad : -e.amountCad;
    const paid = e.status === "paid" ? e.amountCad : 0;
    return {
      id: `ledger:${e.id}`,
      status: e.status,
      link: { screen: "SF01", ctx: `student:${e.studentId}` },
      data: {
        value: `#${String(entries.length - i).padStart(5, "0")}`,
        transaction: e.id.slice(0, 8).toUpperCase(),
        student: `${fullName(e.student.person)} (${e.student.studentNumber})`,
        tuition_ledger_type: e.label,
        type: e.kind,
        status: e.status,
        entry_date: day(e.postedAt),
        posting_date: day(e.postedAt),
        posted_date: day(e.postedAt),
        recorded_date: day(e.createdAt),
        record_date: day(e.postedAt),
        due_date: day(e.dueAt),
        fund_source: e.source ?? "",
        amount: money(e.amountCad),
        payment_amount: e.kind === "payment" ? money(e.amountCad) : "",
        tuition_paid: money(paid),
        paid: money(paid),
        balance: money(e.kind === "charge" ? e.amountCad - paid : 0),
        disbursement_type: e.label,
        allocated: money(paid),
        total: money(e.amountCad),
        term: e.financialTermId ? terms.get(e.financialTermId) ?? "" : "",
        note: e.note ?? "",
      },
    };
  });
  let summary: Record<string, unknown> | undefined;
  if (perStudent && ctx.contextId) {
    const stored = await prisma.financeLedgerEntry.findMany({
      where: { institutionId: ctx.user.institutionId, studentId: ctx.contextId, status: { notIn: ["waived", "void"] } },
    });
    const all = stored.map((entry) => ({ ...entry, amountCad: Number(entry.amountCad) }));
    const sum = (f: (e: (typeof all)[number]) => boolean) => money(all.filter(f).reduce((a, e) => a + e.amountCad, 0));
    const isTuition = (e: (typeof all)[number]) => /tuition/i.test(e.label);
    const tuitionTotal = sum((e) => e.kind === "charge" && isTuition(e));
    const feesTotal = sum((e) => e.kind === "charge" && !isTuition(e));
    const payments = sum((e) => e.kind === "payment");
    const credits = sum((e) => e.kind === "credit");
    const refunds = sum((e) => e.kind === "refund");
    const tuitionPaid = sum((e) => e.kind === "charge" && isTuition(e) && e.status === "paid");
    const feesPaid = sum((e) => e.kind === "charge" && !isTuition(e) && e.status === "paid");
    summary = {
      tuition_total: tuitionTotal,
      tuition_paid: tuitionPaid,
      tuition_owing: money(tuitionTotal - tuitionPaid),
      fees_total: feesTotal,
      fees_paid: feesPaid,
      fees_owing: money(feesTotal - feesPaid),
      total_payments: payments,
      total_credit: credits,
      total_refunds: refunds,
      student_balance: money(tuitionTotal + feesTotal + refunds - payments - credits),
    };
  }
  void running;
  return { source: "Finance ledger", rows, summary };
}

async function invoices(ctx: DomainCtx): Promise<DomainResult> {
  const storedEntries = await prisma.financeLedgerEntry.findMany({
    where: { institutionId: ctx.user.institutionId, kind: "charge" },
    include: { student: { include: { person: true } } },
    orderBy: { postedAt: "desc" },
    take: 2000,
  });
  const entries = storedEntries.map((entry) => ({ ...entry, amountCad: Number(entry.amountCad) }));
  const groups = new Map<string, typeof entries>();
  for (const e of entries) {
    const k = `${e.studentId}:${e.financialTermId ?? "none"}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  let n = groups.size;
  const rows: DomainRow[] = [...groups.entries()].map(([k, list]) => {
    const total = list.reduce((a, e) => a + e.amountCad, 0);
    const paid = list.filter((e) => e.status === "paid").reduce((a, e) => a + e.amountCad, 0);
    const first = list[0];
    return {
      id: `invoice:${k}`,
      status: total - paid > 0 ? "Owing" : "Paid",
      link: { screen: "SF01", ctx: `student:${first.studentId}` },
      data: {
        value: `INV-${String(n--).padStart(5, "0")}`,
        create_invoice_student: `${fullName(first.student.person)} (${first.student.studentNumber})`,
        status: total - paid > 0 ? "Owing" : "Paid",
        type: list.length > 1 ? "Multiple items" : first.label,
        due_date: day(list.map((e) => e.dueAt).find(Boolean) ?? null),
        adjustments: list.filter((e) => e.status === "waived").length,
        balance: money(total - paid),
      },
    };
  });
  return { source: "Finance ledger (charges grouped by student and term)", rows };
}

async function workshopRegistrations(ctx: DomainCtx): Promise<DomainResult> {
  const regs = await prisma.workshopRegistration.findMany({
    where: { institutionId: ctx.user.institutionId },
    include: { student: { include: { person: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const ws = new Map((await prisma.workshop.findMany({ where: { institutionId: ctx.user.institutionId } })).map((w) => [w.id, w]));
  const label: Record<string, string> = { pending: "Pending", registered: "Approved", approved: "Approved", declined: "Declined", cancelled: "Declined", waitlisted: "Pending" };
  return {
    source: "Workshop registrations",
    rows: regs.map((r) => {
      const status = label[r.status] ?? r.status;
      const w = ws.get(r.workshopId);
      return {
        id: `workshopreg:${r.id}`,
        status,
        data: {
          workshop_enrolment_records: `${w?.code ?? ""} · ${day(r.createdAt)}`,
          student_identity: `${fullName(r.student.person)} (${r.student.studentNumber})`,
          workshop_identity: w ? `${w.code} — ${w.title}` : r.workshopId,
          approval_status: status,
          note: r.note,
        },
      };
    }),
  };
}

async function workshops(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.workshop.findMany({ where: { institutionId: ctx.user.institutionId }, orderBy: { startsAt: "desc" } });
  const now = Date.now();
  return {
    source: "Workshops",
    columns: [
      { key: "code", label: "Code" },
      { key: "title", label: "Workshop" },
      { key: "starts", label: "Starts" },
      { key: "location", label: "Location" },
      { key: "capacity", label: "Capacity" },
      { key: "workshop_state", label: "State" },
    ],
    rows: list.map((w) => {
      const state = (w.endsAt ?? w.startsAt).getTime() < now ? "Completed Workshops" : "Available Workshops";
      return {
        id: `workshop:${w.id}`,
        status: w.status,
        data: { code: w.code, title: w.title, starts: day(w.startsAt), location: w.location ?? "", capacity: w.capacity, workshop_state: state, status: w.status },
      };
    }),
  };
}

async function workshopAttendance(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.workshopAttendance.findMany({
    where: { institutionId: ctx.user.institutionId },
    include: { student: { include: { person: true } } },
    orderBy: { attendedOn: "desc" },
    take: 1000,
  });
  const ws = new Map((await prisma.workshop.findMany({ where: { institutionId: ctx.user.institutionId } })).map((w) => [w.id, w]));
  return {
    source: "Workshop attendance",
    columns: [
      { key: "date", label: "Date" },
      { key: "workshop", label: "Workshop" },
      { key: "student", label: "Student" },
      { key: "status", label: "Attendance" },
    ],
    rows: list.map((a) => ({
      id: `workshopatt:${a.id}`,
      status: a.status,
      data: { date: a.attendedOn, workshop: ws.get(a.workshopId)?.title ?? "", student: fullName(a.student.person), status: a.status },
    })),
  };
}

const REQUEST_BUCKET = (type: string) => {
  const t = type.toLowerCase();
  if (/incident|dispute|complaint|appeal/.test(t)) return "Incidents / Disputes";
  if (/e-?mail/.test(t)) return "E-mail Changes";
  if (/profile|personal|name|address/.test(t)) return "Profile Changes";
  if (/general|other|info/.test(t)) return "General Requests";
  return "Student Requests";
};

async function requests(ctx: DomainCtx): Promise<DomainResult> {
  const [srs, loas] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { institutionId: ctx.user.institutionId }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: ctx.user.institutionId }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
  const rows: DomainRow[] = [
    ...srs.map((r) => ({
      id: `request:${r.id}`,
      status: cap(r.status),
      link: { screen: "S03", ctx: `student:${r.studentId}` },
      data: {
        value: r.id.slice(0, 8).toUpperCase(),
        name: fullName(r.student.person),
        request_form: `${cap(r.type)} — ${r.subject}`,
        status: cap(r.status),
        request_date: day(r.createdAt),
        type: REQUEST_BUCKET(r.type),
        details: r.details,
      },
    })),
    ...loas
      .filter((l) => !l.approvalRequestId || !srs.some((r) => r.approvalRequestId === l.approvalRequestId))
      .map((l) => ({
        id: `loa:${l.id}`,
        status: cap(l.status),
        link: { screen: "S03", ctx: `student:${l.studentId}` },
        data: {
          value: l.id.slice(0, 8).toUpperCase(),
          name: fullName(l.student.person),
          request_form: "Leave of Absence",
          status: cap(l.status),
          request_date: day(l.createdAt),
          type: "Student Requests",
          details: l.reason,
        },
      })),
  ];
  return { source: "Service requests + leave of absence", rows };
}

async function leaveRequests(ctx: DomainCtx): Promise<DomainResult> {
  const loas = await prisma.leaveOfAbsenceRequest.findMany({
    where: { institutionId: ctx.user.institutionId, ...(ctx.contextId ? { studentId: ctx.contextId } : {}) },
    include: { student: { include: { person: true } } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return {
    source: "Leave of absence requests",
    columns: [
      { key: "request", label: "Request #" },
      { key: "applicant_student_reference", label: "Student" },
      { key: "request_date", label: "Request Date" },
      { key: "requested_start_date", label: "Requested Start" },
      { key: "requested_end_date", label: "Requested End" },
      { key: "current_status", label: "Status" },
    ],
    rows: loas.map((l) => ({
      id: `loa:${l.id}`,
      status: l.status,
      link: { screen: "S03", ctx: `student:${l.studentId}` },
      data: {
        request: l.id.slice(0, 8).toUpperCase(),
        applicant_student_reference: `${fullName(l.student.person)} (${l.student.studentNumber})`,
        request_date: day(l.createdAt),
        current_status: l.status,
        reason_for_absence: l.reason,
        requested_start_date: l.startsOn,
        requested_end_date: l.endsOn,
        comments_note: l.decisionNote ?? "",
      },
    })),
  };
}

async function withdrawRequests(ctx: DomainCtx): Promise<DomainResult> {
  const srs = await prisma.serviceRequest.findMany({
    where: { institutionId: ctx.user.institutionId, type: { contains: "withdraw", mode: "insensitive" } },
    include: { student: { include: { person: true } } },
    orderBy: { createdAt: "desc" },
  });
  return {
    source: "Service requests (withdraw)",
    columns: [
      { key: "student", label: "Student" },
      { key: "subject", label: "Course / subject" },
      { key: "request_status", label: "Status" },
      { key: "date", label: "Requested" },
    ],
    rows: srs.map((r) => ({
      id: `request:${r.id}`,
      status: r.status,
      link: { screen: "S03", ctx: `student:${r.studentId}` },
      data: { student: fullName(r.student.person), subject: r.subject, request_status: r.status, date: day(r.createdAt), details: r.details },
    })),
  };
}

async function requiredTasks(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.requiredTask.findMany({
    where: { institutionId: ctx.user.institutionId },
    include: { student: { include: { person: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  return {
    source: "Student required tasks",
    columns: [
      { key: "student", label: "Student" },
      { key: "requirement", label: "Requirement" },
      { key: "requirement_status", label: "Status" },
      { key: "due", label: "Due" },
    ],
    rows: list.map((t) => ({
      id: `task:${t.id}`,
      status: t.status,
      link: { screen: "S16", ctx: `student:${t.studentId}` },
      data: { student: fullName(t.student.person), requirement: t.title, requirement_status: t.status, due: day(t.dueAt), detail: t.detail ?? "" },
    })),
  };
}

async function studentBadges(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.studentBadge.findMany({ where: { institutionId: ctx.user.institutionId }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "desc" } });
  return {
    source: "Student badges",
    columns: [
      { key: "student", label: "Student" },
      { key: "badge", label: "Badge / accomplishment" },
      { key: "status", label: "Status" },
      { key: "earned", label: "Earned" },
    ],
    rows: list.map((b) => ({
      id: `badge:${b.id}`,
      status: b.status,
      link: { screen: "S03", ctx: `student:${b.studentId}` },
      data: { student: fullName(b.student.person), badge: b.title, status: b.status, earned: day(b.earnedAt) },
    })),
  };
}

async function studentDocuments(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.studentDocument.findMany({ where: { institutionId: ctx.user.institutionId }, include: { student: { include: { person: true } } }, orderBy: { createdAt: "desc" } });
  return {
    source: "Student documents",
    columns: [
      { key: "student", label: "Student" },
      { key: "document_export", label: "Document" },
      { key: "date", label: "Record date" },
      { key: "status", label: "Status" },
    ],
    rows: list.map((d) => ({
      id: `doc:${d.id}`,
      status: d.status,
      link: { screen: "S03", ctx: `student:${d.studentId}` },
      data: { student: fullName(d.student.person), document_export: d.docLabel ?? d.recordName, date: d.recordDate ?? day(d.createdAt), status: d.status, download: d.downloadUrl ?? "" },
    })),
  };
}

async function attendance(ctx: DomainCtx, perStudent: boolean): Promise<DomainResult> {
  const list = await prisma.attendanceRecord.findMany({
    where: { institutionId: ctx.user.institutionId, ...(perStudent && ctx.contextId ? { studentId: ctx.contextId } : {}) },
    include: { student: { include: { person: true } }, section: { include: { course: true } } },
    orderBy: { recordedAt: "desc" },
    take: 1000,
  });
  return {
    source: "Attendance records",
    columns: [
      { key: "date", label: "Date" },
      { key: "course", label: "Course" },
      { key: "student", label: "Student" },
      { key: "meeting", label: "Meeting" },
      { key: "status", label: "Attendance" },
    ],
    rows: list.map((a) => ({
      id: `attendance:${a.id}`,
      status: a.status,
      data: {
        date: day(a.recordedAt),
        course: `${a.section.course.code} — ${a.section.course.title}`,
        student: fullName(a.student.person),
        student_last_name: a.student.person.familyName,
        meeting: a.meetingLabel,
        status: a.status,
      },
    })),
  };
}

async function programs(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.program.findMany({ where: { institutionId: ctx.user.institutionId }, include: { versions: true, cohorts: true }, orderBy: { name: "asc" } });
  return {
    source: "Programs",
    columns: [
      { key: "abbreviation", label: "Abbreviation" },
      { key: "program_name", label: "Program" },
      { key: "program_type", label: "Award level" },
      { key: "versions", label: "Versions" },
      { key: "cohorts", label: "Cohorts" },
    ],
    rows: list.map((p) => ({
      id: `program:${p.id}`,
      status: "Active",
      link: { screen: "PR04", ctx: `program:${p.id}` },
      data: {
        abbreviation: p.code,
        program_name: p.name,
        associated_program_records: p.name,
        program_type: p.awardLevel,
        versions: p.versions.length,
        cohorts: p.cohorts.length,
        total_program_credits: p.versions[0]?.totalCredits ?? "",
      },
    })),
  };
}

async function terms(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.term.findMany({ where: { institutionId: ctx.user.institutionId }, include: { sections: { select: { id: true } } }, orderBy: { startsOn: "desc" } });
  return {
    source: "Terms",
    columns: [
      { key: "term_abbreviation", label: "Code" },
      { key: "term_name", label: "Term" },
      { key: "start_date", label: "Start" },
      { key: "end_date", label: "End" },
      { key: "sections", label: "Sections" },
    ],
    rows: list.map((t) => ({
      id: `term:${t.id}`,
      status: "Active",
      link: { screen: "PR15", ctx: `term:${t.id}` },
      data: { term_abbreviation: t.code, term_name: t.name, start_date: t.startsOn, end_date: t.endsOn, sections: t.sections.length, enrolment_dates: `${t.startsOn} → ${t.endsOn}` },
    })),
  };
}

async function courses(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.course.findMany({ where: { institutionId: ctx.user.institutionId }, include: { sections: { select: { id: true } } }, orderBy: { code: "asc" } });
  return {
    source: "Courses",
    rows: list.map((c) => ({
      id: `course:${c.id}`,
      status: "Active",
      link: { screen: "C03", ctx: `course:${c.id}` },
      data: { course_name_number: `${c.code} — ${c.title}`, name: c.title, number: c.code, credit_value: c.credits, sessions: c.sections.length },
    })),
  };
}

async function sections(ctx: DomainCtx, opts: { perCourse?: boolean; mine?: boolean; past?: boolean }): Promise<DomainResult> {
  const today = new Date().toISOString().slice(0, 10);
  const list = await prisma.section.findMany({
    where: {
      institutionId: ctx.user.institutionId,
      ...(opts.perCourse && ctx.contextId ? { courseId: ctx.contextId } : {}),
      ...(opts.mine ? { instructorPersonId: ctx.user.personId } : {}),
      ...(opts.past ? { term: { endsOn: { lt: today } } } : {}),
    },
    include: { course: true, term: true, enrolments: { where: { status: "enrolled" }, select: { id: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const instructors = new Map(
    (await prisma.person.findMany({ where: { id: { in: [...new Set(list.map((s) => s.instructorPersonId))] } } })).map((p) => [p.id, `${p.givenName} ${p.familyName}`]),
  );
  return {
    source: "Course sections",
    columns: opts.past ? [{ key: "course", label: "Course" }, { key: "term", label: "Term" }, { key: "dates", label: "Dates" }, { key: "enrolment", label: "Students" }] : undefined,
    rows: list.map((s) => {
      const active = s.term.startsOn <= today && s.term.endsOn >= today;
      return {
        id: `section:${s.id}`,
        status: active ? "Active" : s.term.startsOn > today ? "Upcoming" : "Completed",
        link: { screen: "LM01", ctx: `course:${s.courseId}` },
        data: {
          course: `${s.course.code} — ${s.course.title} (${s.code})`,
          session_offering: `${s.code} · ${s.term.name}`,
          location: "",
          instructors: instructors.get(s.instructorPersonId) ?? "",
          associated_course_instructor_information: instructors.get(s.instructorPersonId) ?? "",
          dates_schedule: `${s.term.startsOn} → ${s.term.endsOn}`,
          course_schedule_dates: `${s.term.startsOn} → ${s.term.endsOn}`,
          dates: `${s.term.startsOn} → ${s.term.endsOn}`,
          delivery_type: "",
          enrolment: s.enrolments.length,
          term: s.term.name,
          course_state: active ? "Active Courses" : s.term.startsOn > today ? "Upcoming Courses" : "Completed Courses",
        },
      };
    }),
  };
}

async function users(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.account.findMany({ where: { institutionId: ctx.user.institutionId }, include: { person: true }, orderBy: { email: "asc" }, take: 2000 });
  return {
    source: "User accounts",
    rows: list.map((a) => {
      let roles: string[] = [];
      try {
        roles = JSON.parse(a.rolesJson) as string[];
      } catch {
        /* ignore malformed roles */
      }
      return {
        id: `account:${a.id}`,
        status: a.status,
        data: { name_login: `${fullName(a.person)} — ${a.email}`, access_level: roles.join(", "), status: a.status },
      };
    }),
  };
}

async function campuses(ctx: DomainCtx): Promise<DomainResult> {
  const cohorts = await prisma.cohort.findMany({ where: { institutionId: ctx.user.institutionId }, select: { campus: true } });
  const names = [...new Set([...CAMPUSES, ...cohorts.map((c) => c.campus).filter((c): c is string => Boolean(c))])];
  return {
    source: "Campuses",
    rows: names.map((n) => ({ id: `campus:${slugId(n)}`, status: "Active", data: { campus_group: n, classroom_name_number: "", type: "Campus", seats: "", active: "Active" } })),
  };
}

async function studentStatuses(): Promise<DomainResult> {
  return {
    source: "Student status catalogue",
    columns: [
      { key: "status_name", label: "Status Name" },
      { key: "parent_status", label: "Parent Status" },
    ],
    rows: STUDENT_STATUSES.map((s) => ({ id: `status:${slugId(s)}`, status: "Active", data: { status_name: s, parent_status: "" } })),
  };
}

async function resourceCategories(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.courseResourceCategory.findMany({ where: { institutionId: ctx.user.institutionId }, orderBy: { name: "asc" } });
  return {
    source: "Course resource categories",
    columns: [{ key: "resource_category_name_english", label: "Category" }],
    rows: list.map((c) => ({ id: `rescat:${c.id}`, status: "Active", data: { resource_category_name_english: c.name } })),
  };
}

async function badgeDefinitions(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.badgeDefinition.findMany({ where: { institutionId: ctx.user.institutionId }, orderBy: { name: "asc" } });
  return {
    source: "Badge definitions",
    rows: list.map((b) => ({
      id: `badgedef:${b.id}`,
      status: b.status,
      data: { name_english: b.name, description_english: b.description, badge_text_rich_text: b.badgeText, badge_approval: b.approvalMode, badge_type: b.badgeType },
    })),
  };
}

async function auditTrail(ctx: DomainCtx): Promise<DomainResult> {
  const list = await prisma.heritageAuditEntry.findMany({
    where: { institutionId: ctx.user.institutionId, ...(ctx.contextKey ? { contextKey: ctx.contextKey } : {}) },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return {
    source: "Heritage audit trail",
    rows: list.map((a) => ({
      id: `audit:${a.id}`,
      status: a.action,
      data: {
        changes_made: `${a.screenId} · ${a.action}${a.note ? ` — ${a.note}` : ""}`,
        changed_by: a.actorName,
        change_author: a.actorName,
        change_timestamp: a.createdAt.toISOString(),
        updated_value: summarise(a.afterJson),
        original_value: summarise(a.beforeJson),
      },
    })),
  };
}

function summarise(json: string | null) {
  if (!json) return "";
  try {
    const obj = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && v !== undefined && typeof v !== "object")
      .slice(0, 4)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v).slice(0, 40)}`)
      .join("; ");
  } catch {
    return "";
  }
}

function slugId(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const DOMAIN_SOURCES: Record<string, (ctx: DomainCtx) => Promise<DomainResult>> = {
  G04: students,
  S01: students,
  S03: studentProfile,
  S06: (c) => attendance(c, true),
  S09: auditTrail,
  S26: requiredTasks,
  S27: leaveRequests,
  S28: withdrawRequests,
  S32: studentBadges,
  S33: studentDocuments,
  SF01: (c) => ledger(c, ["charge", "payment", "credit", "refund"], true),
  SF03: (c) => ledger(c, ["payment", "refund", "credit"], true),
  SF10: auditTrail,
  W01: workshopRegistrations,
  W02: workshops,
  W03: workshopAttendance,
  R01: requests,
  R02: leaveRequests,
  F01: (c) => ledger(c, ["payment", "refund"], false),
  F02: (c) => ledger(c, ["charge"], false),
  F03: invoices,
  F04: (c) => ledger(c, ["credit"], false),
  PR01: programs,
  PR10: auditTrail,
  PR14: terms,
  C01: courses,
  C03: (c) => sections(c, { perCourse: true }),
  C07: auditTrail,
  C10: (c) => sections(c, {}),
  C22: resourceCategories,
  C24: badgeDefinitions,
  U02: users,
  MC01: (c) => sections(c, { mine: true }),
  MC02: (c) => attendance(c, false),
  MC06: (c) => sections(c, { mine: true, past: true }),
  L10: campuses,
  SC09: studentStatuses,
  SC12: auditTrail,
};

/* ------------------------------------------------------------------ */
/* Write-through: saving these screens also writes the core tables.     */
/* ------------------------------------------------------------------ */

type Data = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v)).trim();
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

async function studentByRef(institutionId: string, ref: unknown) {
  const v = str(ref);
  if (!v) return null;
  const id = v.replace(/^student:/, "");
  return prisma.student.findFirst({
    where: { institutionId, OR: [{ id }, { studentNumber: v }, { studentNumber: v.match(/\(([^)]+)\)$/)?.[1] ?? "__none__" }] },
  });
}

async function financialTermId(institutionId: string, name: unknown) {
  const v = str(name);
  if (!v) return null;
  const t = await prisma.financialTerm.findFirst({ where: { institutionId, OR: [{ name: v }, { code: v }, { id: v }] } });
  return t?.id ?? null;
}

export type WriteResult = { domainId?: string; message?: string; data?: Data };

export const WRITE_THROUGH: Record<string, (user: SessionClaims, data: Data, contextId: string | null) => Promise<WriteResult | null>> = {
  async S02(user, d) {
    const given = str(d.first_name);
    const family = str(d.last_name);
    if (!given || !family) throw Object.assign(new Error("First Name and Last Name are required"), { status: 400 });
    const email = str(d.e_mail_address).toLowerCase() || `${given}.${family}.${Date.now()}@students.heritage.local`.toLowerCase().replace(/\s+/g, "");
    const existing = await prisma.person.findFirst({ where: { institutionId: user.institutionId, email } });
    if (existing) throw Object.assign(new Error(`A person with e-mail ${email} already exists`), { status: 409 });
    const year = new Date().getFullYear();
    const count = await prisma.student.count({ where: { institutionId: user.institutionId, studentNumber: { startsWith: `ST-${year}-` } } });
    let n = count + 1;
    while (await prisma.student.findFirst({ where: { institutionId: user.institutionId, studentNumber: `ST-${year}-${String(n).padStart(3, "0")}` } })) n++;
    const person = await prisma.person.create({
      data: {
        institutionId: user.institutionId,
        givenName: given,
        familyName: family,
        middleName: str(d.middle_name) || null,
        preferredName: str(d.preferred_name) || null,
        email,
        personalEmail: str(d.e_mail_address) || null,
        phone: str(d.phone_number) || null,
        emergencyContactName: str(d.emergency_contact_name) || null,
        emergencyContactPhone: str(d.emergency_contact_phone_number) || null,
        dateOfBirth: str(d.date_of_birth) || null,
      },
    });
    const student = await prisma.student.create({
      data: {
        institutionId: user.institutionId,
        personId: person.id,
        studentNumber: `ST-${year}-${String(n).padStart(3, "0")}`,
        programName: str(d.program_of_study) || "Not assigned",
      },
    });
    await patchStudentMeta(user.institutionId, student.id, {
      status: str(d.student_status) || "New Inquiry",
      residency: str(d.domestic_international),
      street: str(d.street_address),
      city: str(d.city),
      postal: str(d.postal_zip_code),
      discountCode: str(d.discount_code),
      campus: str(d.campus),
      delivery: str(d.delivery_method),
      admissionTerm: str(d.admission_term),
      country: str(d.country),
      rateCategory: str(d.rate_category_fee_status),
    });
    return { domainId: `student:${student.id}`, message: `Student ${student.studentNumber} created`, data: { student_number: student.studentNumber } };
  },

  async S03(user, d, studentId) {
    if (!studentId) return null;
    const s = await prisma.student.findFirst({ where: { id: studentId, institutionId: user.institutionId } });
    if (!s) return null;
    await prisma.person.update({
      where: { id: s.personId },
      data: {
        ...(str(d.first_name) ? { givenName: str(d.first_name) } : {}),
        ...(str(d.last_name) ? { familyName: str(d.last_name) } : {}),
        middleName: str(d.middle_name) || null,
        preferredName: str(d.preferred_name) || null,
        ...(str(d.phone_number) ? { phone: str(d.phone_number) } : {}),
        ...(str(d.date_of_birth) ? { dateOfBirth: str(d.date_of_birth) } : {}),
        ...(str(d.emergency_contact_name) ? { emergencyContactName: str(d.emergency_contact_name) } : {}),
        ...(str(d.emergency_contact_phone_number) ? { emergencyContactPhone: str(d.emergency_contact_phone_number) } : {}),
      },
    });
    const cleared = (key: string) => (key in d && !str(d[key]) ? null : str(d[key]));
    await patchStudentMeta(user.institutionId, s.id, {
      street: cleared("street_address"),
      city: cleared("city"),
      postal: cleared("postal_zip_code"),
      residency: cleared("domestic_international"),
      campus: cleared("campus"),
    });
    return { message: "Student profile updated" };
  },

  async S08(user, d, studentId) {
    const status = str(d.new_status) || str(d.available_student_status_options);
    if (!studentId || !status) throw Object.assign(new Error("Select a student and a new status"), { status: 400 });
    await patchStudentMeta(user.institutionId, studentId, { status });
    return { message: `Status changed to ${status}` };
  },

  async SF01(user, d, studentId) {
    const amount = num(d.payment_amount);
    if (!studentId || amount <= 0) throw Object.assign(new Error("Payment Amount must be greater than zero"), { status: 400 });
    const e = await prisma.financeLedgerEntry.create({
      data: {
        institutionId: user.institutionId,
        studentId,
        label: `Payment${str(d.payment_method) ? ` — ${str(d.payment_method)}` : ""}`,
        amountCad: amount,
        kind: "payment",
        status: "paid",
        source: str(d.payment_type) || "heritage_admin",
        note: [str(d.payee) && `Payee: ${str(d.payee)}`, str(d.note)].filter(Boolean).join(" · ") || null,
        postedAt: str(d.payment_date) ? new Date(str(d.payment_date)) : new Date(),
      },
    });
    if (d.automatically_apply_payment_to_outstanding_balances === true) {
      let left = amount;
      const open = await prisma.financeLedgerEntry.findMany({ where: { institutionId: user.institutionId, studentId, kind: "charge", status: "open" }, orderBy: { postedAt: "asc" } });
      for (const c of open) {
        const chargeAmount = Number(c.amountCad);
        if (left < chargeAmount) break;
        left -= chargeAmount;
        await prisma.financeLedgerEntry.update({ where: { id: c.id }, data: { status: "paid", rowVersion: { increment: 1 } } });
      }
    }
    return { domainId: `ledger:${e.id}`, message: `Payment of $${amount.toFixed(2)} applied` };
  },

  async SF02(user, d, studentId) {
    const amount = num(d.fee_amount) * Math.max(1, num(d.quantity) || 1);
    if (!studentId || amount <= 0) throw Object.assign(new Error("Fee Amount must be greater than zero"), { status: 400 });
    const e = await prisma.financeLedgerEntry.create({
      data: {
        institutionId: user.institutionId,
        studentId,
        label: str(d.tuition_ledger_type) || "Fee",
        amountCad: amount,
        kind: "charge",
        status: /paid/i.test(str(d.payment_status)) ? "paid" : "open",
        source: "heritage_admin",
        note: str(d.fee_note_comment) || null,
        financialTermId: await financialTermId(user.institutionId, d.apply_to_term),
      },
    });
    return { domainId: `ledger:${e.id}`, message: `Fee of $${amount.toFixed(2)} posted` };
  },

  async SF04(user, d, studentId) {
    const amount = money(num(d.refund_amount));
    if (!studentId || !(amount > 0)) throw Object.assign(new Error("Refund Amount must be greater than zero"), { status: 400 });
    return withStudentMoneyLock(user.institutionId, studentId, async () => {
      const sums = await prisma.financeLedgerEntry.groupBy({
        by: ["kind"],
        where: { institutionId: user.institutionId, studentId, kind: { in: ["payment", "refund"] }, status: { not: "waived" } },
        _sum: { amountCad: true },
      });
      const total = (k: string) => Number(sums.find((x) => x.kind === k)?._sum.amountCad ?? 0);
      const refundable = money(total("payment") - total("refund"));
      if (amount > refundable + 0.005) {
        throw Object.assign(new Error(`Refund Amount cannot exceed $${Math.max(0, refundable).toFixed(2)} (paid minus already refunded)`), { status: 400, code: "VALIDATION_ERROR" });
      }
      const e = await prisma.financeLedgerEntry.create({
        data: {
          institutionId: user.institutionId,
          studentId,
          label: `Refund${str(d.refund_type) ? ` — ${str(d.refund_type)}` : ""}`,
          amountCad: amount,
          kind: "refund",
          status: "paid",
          source: str(d.refund_method) || "heritage_admin",
          note: str(d.note_comment) || null,
          postedAt: str(d.refund_date) ? new Date(str(d.refund_date)) : new Date(),
        },
      });
      return { domainId: `ledger:${e.id}`, message: `Refund of $${amount.toFixed(2)} issued` };
    });
  },

  async W04(user, d) {
    const student = await studentByRef(user.institutionId, d.student_user_selection);
    const wsRef = str(d.workshop_selection);
    const workshop = await prisma.workshop.findFirst({
      where: { institutionId: user.institutionId, OR: [{ id: wsRef.replace(/^workshop:/, "") }, { code: wsRef.split(" — ")[0] }, { title: wsRef }] },
    });
    if (!student || !workshop) throw Object.assign(new Error("Select a valid student and workshop"), { status: 400 });
    const existing = await prisma.workshopRegistration.findFirst({ where: { institutionId: user.institutionId, studentId: student.id, workshopId: workshop.id } });
    if (existing) throw Object.assign(new Error("Student is already enrolled in this workshop"), { status: 409 });
    const r = await prisma.workshopRegistration.create({
      data: { institutionId: user.institutionId, workshopId: workshop.id, studentId: student.id, status: "pending", note: "Enrolled from Heritage admin" },
    });
    return { domainId: `workshopreg:${r.id}`, message: `Enrolled in ${workshop.title} (pending approval)` };
  },

  async PR02(user, d) {
    const name = str(d.program_name);
    const code = (str(d.abbreviation) || name.split(/\s+/).map((w) => w[0]).join("")).toUpperCase();
    if (!name) throw Object.assign(new Error("Program Name is required"), { status: 400 });
    const existing = await prisma.program.findFirst({ where: { institutionId: user.institutionId, code } });
    const p = existing
      ? await prisma.program.update({ where: { id: existing.id }, data: { name, awardLevel: str(d.program_type) || existing.awardLevel, rowVersion: { increment: 1 } } })
      : await prisma.program.create({ data: { institutionId: user.institutionId, code, name, awardLevel: str(d.program_type) || "diploma" } });
    return { domainId: `program:${p.id}`, message: existing ? `Program ${code} updated` : `Program ${code} created` };
  },

  async PR14(user, d) {
    const name = str(d.term_name);
    const code = str(d.term_abbreviation) || name.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
    if (!name || !str(d.start_date) || !str(d.end_date)) throw Object.assign(new Error("Term Name, Start Date and End Date are required"), { status: 400 });
    const existing = await prisma.term.findFirst({ where: { institutionId: user.institutionId, code } });
    const t = existing
      ? await prisma.term.update({ where: { id: existing.id }, data: { name, startsOn: str(d.start_date), endsOn: str(d.end_date), rowVersion: { increment: 1 } } })
      : await prisma.term.create({ data: { institutionId: user.institutionId, code, name, startsOn: str(d.start_date), endsOn: str(d.end_date) } });
    return { domainId: `term:${t.id}`, message: existing ? `Term ${code} updated` : `Term ${code} created` };
  },

  async C02(user, d) {
    const title = str(d.name);
    const code = str(d.number).toUpperCase();
    if (!title || !code) throw Object.assign(new Error("Course Name and Number are required"), { status: 400 });
    const existing = await prisma.course.findFirst({ where: { institutionId: user.institutionId, code } });
    const credits = num(d.credit_value) || 3;
    const c = existing
      ? await prisma.course.update({ where: { id: existing.id }, data: { title, credits, rowVersion: { increment: 1 } } })
      : await prisma.course.create({ data: { institutionId: user.institutionId, code, title, credits } });
    return { domainId: `course:${c.id}`, message: existing ? `Course ${code} updated` : `Course ${code} created` };
  },

  async C22(user, d) {
    const name = str(d.resource_category_name_english);
    if (!name) throw Object.assign(new Error("Category name is required"), { status: 400 });
    const c = await prisma.courseResourceCategory.create({ data: { id: randomUUID(), institutionId: user.institutionId, name, language: "en" } });
    return { domainId: `rescat:${c.id}`, message: `Resource category ${name} created` };
  },
};

/** The screen's own module gate is not enough: a domain row belongs to the module that owns the underlying table. */
const DOMAIN_MODULE: Record<string, PermissionModuleKey> = {
  workshopreg: "courseManagement",
  loa: "userRequests",
  request: "userRequests",
  ledger: "financialManagement",
};

function domainError(status: number, message: string, code: string) {
  return Object.assign(new Error(message), { status, code });
}

/* Status changes on domain rows (approve / decline / etc.). */
export async function domainStatus(user: SessionClaims, domainId: string, status: string, note?: string): Promise<string | null> {
  const [kind, id] = [domainId.slice(0, domainId.indexOf(":")), domainId.slice(domainId.indexOf(":") + 1)];
  const lower = status.toLowerCase();
  const module = DOMAIN_MODULE[kind];
  if (module) await assertPermission(user, module, "edit");
  if (kind === "workshopreg") {
    await prisma.workshopRegistration.updateMany({
      where: { id, institutionId: user.institutionId },
      data: { status: lower === "approved" ? "registered" : lower === "declined" ? "declined" : lower, rowVersion: { increment: 1 } },
    });
    return `Workshop enrolment ${lower}`;
  }
  if (kind === "loa") {
    await prisma.leaveOfAbsenceRequest.updateMany({
      where: { id, institutionId: user.institutionId },
      data: { status: lower, decidedAt: new Date(), decisionNote: note ?? null, rowVersion: { increment: 1 } },
    });
    if (lower === "approved") {
      const loa = await prisma.leaveOfAbsenceRequest.findFirst({ where: { id, institutionId: user.institutionId } });
      if (loa) await patchStudentMeta(user.institutionId, loa.studentId, { status: "Leave of Absence" });
    }
    return `Leave of absence ${lower}`;
  }
  if (kind === "request") {
    await prisma.serviceRequest.updateMany({ where: { id, institutionId: user.institutionId }, data: { status: lower, rowVersion: { increment: 1 } } });
    return `Request ${lower}`;
  }
  if (kind === "ledger" && /refund|waive|void|removed|inactive/.test(lower)) {
    const entry = await prisma.financeLedgerEntry.findFirst({ where: { id, institutionId: user.institutionId }, select: { kind: true, status: true } });
    if (!entry) throw domainError(404, "Ledger entry not found", "NOT_FOUND");
    if (entry.status === "waived") return "Ledger entry already waived";
    // Money that moved (payments, refunds, paid or part-paid fees) must go through Financial Management so refunds stay capped and audited.
    const allocated = await prisma.heritageRecord.count({ where: { institutionId: user.institutionId, screenId: "FIN:ALLOC", deletedAt: null, dataJson: { contains: id } } });
    if (entry.kind !== "charge" || entry.status !== "open" || allocated > 0) {
      throw domainError(409, "Only an unpaid fee can be waived here. Use Financial Management to refund payments or paid fees.", "CONFLICT");
    }
    await prisma.financeLedgerEntry.updateMany({ where: { id, institutionId: user.institutionId, status: "open" }, data: { status: "waived", rowVersion: { increment: 1 } } });
    return "Ledger entry waived";
  }
  return null;
}

/**
 * Persist edits made from a generic Heritage grid into the table that supplied
 * the row. Returning null means the row is read-only; callers must never hide
 * such an edit in a HeritageRecord overlay because every dedicated page reads
 * the core table directly.
 */
export async function updateDomainRecord(user: SessionClaims, domainId: string, patch: Data): Promise<string | null> {
  const colon = domainId.indexOf(":");
  const kind = domainId.slice(0, colon);
  const id = domainId.slice(colon + 1);
  const inst = user.institutionId;
  if (!id) return null;

  if (kind === "student") {
    const student = await prisma.student.findFirst({ where: { id, institutionId: inst }, select: { personId: true } });
    if (!student) throw domainError(404, "Student not found", "NOT_FOUND");
    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...(str(patch.student_number) ? { studentNumber: str(patch.student_number) } : {}),
          ...(str(patch.program) ? { programName: str(patch.program) } : {}),
          rowVersion: { increment: 1 },
        },
      });
      await tx.person.update({
        where: { id: student.personId },
        data: {
          ...(str(patch.first_name) ? { givenName: str(patch.first_name) } : {}),
          ...(str(patch.last_name) ? { familyName: str(patch.last_name) } : {}),
          ...(str(patch.phone_number) ? { phone: str(patch.phone_number) } : {}),
          rowVersion: { increment: 1 },
        },
      });
    });
    const meta: Record<string, unknown> = {};
    if (str(patch.status) || str(patch.student_status)) meta.status = str(patch.status) || str(patch.student_status);
    if (str(patch.campus)) meta.campus = str(patch.campus);
    if (str(patch.admission_term)) meta.admissionTerm = str(patch.admission_term);
    if (str(patch.domestic_international) || str(patch.nationality)) meta.residency = str(patch.domestic_international) || str(patch.nationality);
    if (Object.keys(meta).length) await patchStudentMeta(inst, id, meta);
    return "Student record updated";
  }
  if (kind === "program") {
    const result = await prisma.program.updateMany({
      where: { id, institutionId: inst },
      data: {
        ...(str(patch.abbreviation) ? { code: str(patch.abbreviation).toUpperCase() } : {}),
        ...(str(patch.program_name) ? { name: str(patch.program_name) } : {}),
        ...(str(patch.program_type) ? { awardLevel: str(patch.program_type) } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (!result.count) throw domainError(404, "Program not found", "NOT_FOUND");
    return "Program updated";
  }
  if (kind === "course") {
    const result = await prisma.course.updateMany({
      where: { id, institutionId: inst },
      data: {
        ...(str(patch.number) ? { code: str(patch.number).toUpperCase() } : {}),
        ...(str(patch.name) ? { title: str(patch.name) } : {}),
        ...(patch.credit_value !== undefined ? { credits: num(patch.credit_value) } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (!result.count) throw domainError(404, "Course not found", "NOT_FOUND");
    return "Course updated";
  }
  if (kind === "term") {
    const result = await prisma.term.updateMany({
      where: { id, institutionId: inst },
      data: {
        ...(str(patch.term_abbreviation) ? { code: str(patch.term_abbreviation).toUpperCase() } : {}),
        ...(str(patch.term_name) ? { name: str(patch.term_name) } : {}),
        ...(str(patch.start_date) ? { startsOn: str(patch.start_date) } : {}),
        ...(str(patch.end_date) ? { endsOn: str(patch.end_date) } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (!result.count) throw domainError(404, "Term not found", "NOT_FOUND");
    return "Term updated";
  }
  if (kind === "attendance") {
    const result = await prisma.attendanceRecord.updateMany({
      where: { id, institutionId: inst },
      data: {
        ...(str(patch.status) ? { status: str(patch.status).toLowerCase() } : {}),
        ...(str(patch.meeting) ? { meetingLabel: str(patch.meeting) } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (!result.count) throw domainError(404, "Attendance record not found", "NOT_FOUND");
    return "Attendance updated";
  }
  if (kind === "task") {
    const result = await prisma.requiredTask.updateMany({
      where: { id, institutionId: inst },
      data: {
        ...(str(patch.requirement) ? { title: str(patch.requirement) } : {}),
        ...(str(patch.requirement_status) ? { status: str(patch.requirement_status).toLowerCase() } : {}),
        ...(str(patch.detail) ? { detail: str(patch.detail) } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (!result.count) throw domainError(404, "Required task not found", "NOT_FOUND");
    return "Required task updated";
  }
  if (["workshopreg", "loa", "request", "ledger"].includes(kind)) {
    const status = str(patch.approval_status) || str(patch.current_status) || str(patch.request_status) || str(patch.status);
    if (!status) return null;
    return domainStatus(user, domainId, status, str(patch.comments_note) || str(patch.note));
  }
  return null;
}

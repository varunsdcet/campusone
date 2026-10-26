/* Student Management: directories, Create Student Profile, profile header / overview, status, program profiles, flags & holds, attendance, audit. */

import { randomBytes } from "node:crypto";
import { prisma } from "@myheritage/db";
import { hashPassword } from "@myheritage/auth";
import type { SessionClaims } from "@myheritage/contracts";
import { termLabel } from "../../../lib/sectionTerm.js";
import { ymdIn } from "../../../lib/workshopPolicy.js";
import { loadSectionTerms } from "../../instructor/myCoursesFacts.js";
import { DEFAULT_TZ } from "../../courses/sectionSchedule.js";
import { getTranscriptSummary } from "../../academic/program-plan.service.js";
import { ensureSeed, sanitizeHtml, entityRecords } from "./sysconfig.js";
import { page } from "./finance.core.js";
import {
  add,
  admissionTerms,
  agentCatalogue,
  arr,
  bool,
  campusNames,
  canStudents,
  countryCatalogue,
  drop,
  fileRefs,
  flatStatuses,
  fullName,
  httpError,
  loadProfile,
  metaOf,
  oneOf,
  optDate,
  patchMetaLoose,
  profilesFor,
  programCatalogue,
  putSingle,
  readFile,
  required,
  requireStudentRow,
  row,
  rows,
  s,
  save,
  saveProfile,
  seq,
  staffAccounts,
  statusOf,
  statusTree,
  studentStatusPolicy,
  storeFile,
  storeValidFile,
  stuAudit,
  text,
  validateFile,
  type Data,
} from "./students.core.js";
import { CAMPUSES, studentMetaMap } from "../superAdmin.service.js";
import { applicantLeads } from "./applicationStatus.js";
import {
  ACTION_STATUSES,
  ASSESSMENT_STATUSES,
  AUDIT_SECTIONS,
  AWARD_ELIGIBILITY,
  AWARD_STATUSES,
  BADGE_STATUSES,
  BULK_ACTIONS,
  CAPTURED_DOCUMENT_GROUPS,
  CAPTURED_NOTIFICATION_TEMPLATES,
  CORR_VISIBILITY,
  DECLARATION_ACKS,
  DECLARATION_BY,
  DELIVERY_METHODS,
  ENROLMENT_STATUSES,
  EXPORT_OPTIONS,
  FINANCE_AUDIT_SCREEN,
  FLAG_STATUSES,
  GENDERS,
  INVOICE_ITEM_TYPES,
  LOA_STATUSES,
  NOTIFICATION_METHODS,
  PAYEES,
  PAYMENT_TYPES,
  PLAN_FREQUENCIES,
  PLAN_SCHEDULE_TYPES,
  PLAN_SYNC,
  RATE_CATEGORIES,
  RATE_REQUIRED_MESSAGE,
  RATE_REQUIRED_STATUSES,
  REFUND_TYPES,
  REQ_DATA_COLLECTION,
  REQ_DATA_TYPES,
  REQ_DOC_APPROVAL,
  REQ_EXPIRY,
  REQ_EXPIRY_ACTIONS,
  REQ_EXPIRY_UNITS,
  REQ_RECURRENCE,
  REQ_STATUSES,
  REQ_SUBMISSIONS,
  RESIDENCY,
  STU,
  TAX_DOCUMENTS,
  TRANSCRIPT_OPTIONS,
  VISA_STATUSES,
  WITHDRAW_STATUSES,
  auditScreen,
  normalizeDelivery,
  type AuditSection,
} from "./students.spec.js";

/* ------------------------------------------------------------------ */
/* Meta                                                                 */
/* ------------------------------------------------------------------ */

export async function studentsMeta(user: SessionClaims) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  // Catalogues below read sysconfig entities that are seeded lazily on first use.
  await ensureSeed(user);
  const [tree, pm, campuses, countries, advisors, agents, admission, flagTemplates, corrCategories, corrTypes, docTemplates, notifTemplates, documentTypes, workflows, badges, tests, promotionAllocations] = await Promise.all([
    statusTree(user),
    programCatalogue(inst),
    campusNames(inst),
    countryCatalogue(inst),
    staffAccounts(inst),
    agentCatalogue(inst),
    admissionTerms(inst),
    entityRecords(inst, "flagTemplates"),
    entityRecords(inst, "correspondenceCategories"),
    entityRecords(inst, "correspondenceTypes"),
    entityRecords(inst, "documentTemplates"),
    entityRecords(inst, "notificationTemplates"),
    entityRecords(inst, "documentTypes"),
    entityRecords(inst, "workflows"),
    rows(inst, "CM:BADGE"),
    rows(inst, "CM:TEST"),
    entityRecords(inst, "promotionAllocations"),
  ]);
  const name = (r: { data: Data }) => s(r.data.name);
  return {
    statusTree: tree,
    statuses: flatStatuses(tree),
    programs: pm.programs,
    schedules: pm.schedules,
    pathways: pm.pathways,
    terms: pm.terms,
    admissionTerms: admission,
    campuses,
    countries,
    advisors,
    agents,
    flagTemplates: flagTemplates.map((r) => ({ id: r.id, name: name(r), message: s(r.data.message) })),
    correspondence: {
      categories: corrCategories.map((r) => ({ id: r.id, name: name(r) })).filter((c) => c.name),
      types: corrTypes.map((r) => ({ id: r.id, name: name(r), categories: arr<string>(r.data.categories) })).filter((t) => t.name),
    },
    documentTemplates: docTemplates
      .map((r) => ({
        id: r.id,
        name: name(r),
        documentType: s(r.data.documentType),
        inputs: [...s(r.data.content).matchAll(/\{input:([A-Za-z0-9_-]+)\}/g)].map((match) => match[1]!).filter((value, index, all) => all.indexOf(value) === index),
      }))
      .filter((t) => t.name),
    capturedDocumentGroups: CAPTURED_DOCUMENT_GROUPS,
    notificationTemplates: [
      ...CAPTURED_NOTIFICATION_TEMPLATES.map((n) => ({ id: `captured:${n}`, name: n, subject: "", body: "" })),
      ...notifTemplates.map((r) => ({ id: r.id, name: name(r), subject: s(r.data.subject), body: s(r.data.body) })).filter((t) => t.name && !(CAPTURED_NOTIFICATION_TEMPLATES as readonly string[]).includes(t.name)),
    ],
    documentTypes: documentTypes.map((r) => ({ id: r.id, name: name(r) })).filter((t) => t.name),
    workflows: workflows.map((r) => ({ id: r.id, name: name(r) })).filter((t) => t.name),
    badges: badges.map((r) => ({ id: r.id, name: name(r) })).filter((b) => b.name),
    entryTests: tests.map((r) => ({ id: r.id, name: name(r) })).filter((t) => t.name),
    options: {
      genders: GENDERS,
      residency: RESIDENCY,
      visaStatuses: VISA_STATUSES,
      deliveryMethods: DELIVERY_METHODS,
      declarationBy: DECLARATION_BY,
      declarationAcks: DECLARATION_ACKS,
      rateCategories: RATE_CATEGORIES,
      enrolmentStatuses: ENROLMENT_STATUSES,
      flagStatuses: FLAG_STATUSES,
      actionStatuses: ACTION_STATUSES,
      assessmentStatuses: ASSESSMENT_STATUSES,
      auditSections: AUDIT_SECTIONS,
      reqDataTypes: REQ_DATA_TYPES,
      reqDataCollection: REQ_DATA_COLLECTION,
      reqExpiry: REQ_EXPIRY,
      reqRecurrence: REQ_RECURRENCE,
      reqDocApproval: REQ_DOC_APPROVAL,
      reqExpiryUnits: REQ_EXPIRY_UNITS,
      reqExpiryActions: REQ_EXPIRY_ACTIONS,
      reqStatuses: REQ_STATUSES,
      reqSubmissions: REQ_SUBMISSIONS,
      corrVisibility: CORR_VISIBILITY,
      notificationMethods: NOTIFICATION_METHODS,
      transcriptOptions: TRANSCRIPT_OPTIONS,
      loaStatuses: LOA_STATUSES,
      withdrawStatuses: WITHDRAW_STATUSES,
      badgeStatuses: BADGE_STATUSES,
      exportOptions: EXPORT_OPTIONS,
      bulkActions: BULK_ACTIONS,
      payees: PAYEES,
      paymentTypes: PAYMENT_TYPES,
      refundTypes: REFUND_TYPES,
      invoiceItemTypes: INVOICE_ITEM_TYPES,
      awardStatuses: AWARD_STATUSES,
      awardAllocation: promotionAllocations.filter((r) => r.data.status !== "Inactive").map(name).filter(Boolean),
      awardEligibility: AWARD_ELIGIBILITY,
      planSync: PLAN_SYNC,
      planScheduleTypes: PLAN_SCHEDULE_TYPES,
      planFrequencies: PLAN_FREQUENCIES,
      taxDocuments: TAX_DOCUMENTS,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Directory                                                            */
/* ------------------------------------------------------------------ */

type DirectoryQuery = Record<string, unknown>;

export async function directory(user: SessionClaims, q: DirectoryQuery) {
  const access = await canStudents(user, "view");
  const inst = user.institutionId;
  const [students, metaMap, advisors, leads] = await Promise.all([
    prisma.student.findMany({
      where: { institutionId: inst },
      include: {
        person: true,
        enrolments: { where: { status: "enrolled" }, include: { section: { include: { term: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    studentMetaMap(inst),
    staffAccounts(inst),
    applicantLeads(inst),
  ]);
  const profiles = await profilesFor(
    inst,
    students.map((x) => x.id),
  );
  const advisorName = new Map(advisors.map((a) => [a.id, a.name]));
  const programTerms = await loadSectionTerms(inst, students.flatMap((st) => (st.enrolments[0] ? [st.enrolments[0].section] : [])));
  const want = (k: string) => text(q[k], 200);
  const f = {
    q: want("q").toLowerCase(),
    status: want("status"),
    campus: want("campus"),
    program: want("program"),
    pathway: want("pathway"),
    schedule: want("schedule"),
    programTerm: want("programTerm"),
    admissionTerm: want("admissionTerm"),
    nationality: want("nationality"),
    agent: want("agent"),
    advisor: want("advisor"),
    startDate: want("startDate"),
    endDate: want("endDate"),
    letter: want("letter").toUpperCase(),
  };
  /* Advanced Search criteria: case-insensitive "contains" except where an exact choice is selected. */
  const adv = {
    sisEmail: want("sisEmail").toLowerCase(),
    lastName: want("lastName").toLowerCase(),
    firstName: want("firstName").toLowerCase(),
    middleName: want("middleName").toLowerCase(),
    preferredName: want("preferredName").toLowerCase(),
    dobYear: want("dobYear"),
    dobMonth: want("dobMonth").padStart(2, "0").replace(/^00$/, ""),
    dobDay: want("dobDay").padStart(2, "0").replace(/^00$/, ""),
    residency: want("residency"),
    street: want("street").toLowerCase(),
    city: want("city").toLowerCase(),
    postal: want("postal").toLowerCase().replace(/\s/g, ""),
    phone: want("phone").replace(/\D/g, ""),
    email: want("email").toLowerCase(),
    discountCode: want("discountCode").toLowerCase(),
    delivery: want("delivery"),
  };
  const has = (v: string | null | undefined, needle: string) => !needle || (v ?? "").toLowerCase().includes(needle);
  const advancedMatch = (st: (typeof students)[number], m: Record<string, string | undefined>) => {
    const p = st.person;
    const [y = "", mo = "", d = ""] = (p.dateOfBirth ?? "").slice(0, 10).split("-");
    return (
      has(p.email, adv.sisEmail) &&
      has(p.familyName, adv.lastName) &&
      has(p.givenName, adv.firstName) &&
      has(p.middleName, adv.middleName) &&
      has(p.preferredName, adv.preferredName) &&
      (!adv.dobYear || y === adv.dobYear) &&
      (!adv.dobMonth || mo === adv.dobMonth) &&
      (!adv.dobDay || d === adv.dobDay) &&
      (!adv.residency || m.residency === adv.residency) &&
      has(m.street, adv.street) &&
      has(m.city, adv.city) &&
      (!adv.postal || (m.postal ?? "").toLowerCase().replace(/\s/g, "").includes(adv.postal)) &&
      (!adv.phone || (p.phone ?? "").replace(/\D/g, "").includes(adv.phone)) &&
      has(p.personalEmail ?? p.email, adv.email) &&
      has(m.discountCode, adv.discountCode) &&
      (!adv.delivery || normalizeDelivery(m.delivery) === normalizeDelivery(adv.delivery))
    );
  };
  const campusScoped = access.superAdmin || access.campuses.length === CAMPUSES.length
    ? students
    : students.filter((st) => access.campuses.includes(s(metaMap[st.id]?.campus)));
  const all = campusScoped.filter((st) => advancedMatch(st, (metaMap[st.id] ?? {}) as Record<string, string | undefined>)).map((st) => {
    const m = (metaMap[st.id] ?? {}) as Record<string, string | undefined>;
    const p = profiles.get(st.id);
    const status = statusOf(m, st.enrolments.length);
    const programTerm = st.enrolments[0] ? termLabel(programTerms.get(st.enrolments[0].sectionId)) : "";
    const start = p?.scheduleStart || st.createdAt.toISOString().slice(0, 10);
    const end = p?.scheduleEnd || "";
    return {
      id: st.id,
      personId: st.personId,
      name: fullName(st.person),
      initials: `${st.person.givenName[0] ?? ""}${st.person.familyName[0] ?? ""}`.toUpperCase(),
      last: st.person.familyName,
      studentNumber: st.studentNumber,
      applicationNumber: p?.applicationNumber ?? "",
      status,
      advisors: (p?.advisors ?? []).map((id) => advisorName.get(id) ?? "").filter(Boolean),
      advisorIds: p?.advisors ?? [],
      agentId: p?.agentId ?? "",
      program: st.programName,
      programTerm,
      admissionTerm: m.admissionTerm ?? "",
      campus: m.campus ?? "",
      pathway: m.pathway ?? "",
      schedule: m.schedule ?? "",
      nationality: m.country ?? "",
      start,
      end,
      createdAt: st.createdAt.toISOString(),
      href: "",
    };
  });
  /* Applicant leads carry only name and email, so any other advanced criterion excludes them. */
  const { sisEmail, lastName, firstName, email, ...profileOnly } = adv;
  const leadCriteriaOk = !Object.values(profileOnly).some(Boolean);
  for (const a of leads) {
    const p = a.person;
    if (!leadCriteriaOk || !(has(p.email, sisEmail) && has(p.familyName, lastName) && has(p.givenName, firstName) && has(p.personalEmail ?? p.email, email))) continue;
    const createdAt = (a.submittedAt ?? a.createdAt).toISOString();
    all.push({
      id: `application:${a.id}`,
      personId: a.personId,
      name: fullName(p),
      initials: `${p.givenName[0] ?? ""}${p.familyName[0] ?? ""}`.toUpperCase(),
      last: p.familyName,
      studentNumber: "",
      applicationNumber: "",
      status: a.lifecycleStatus,
      advisors: [],
      advisorIds: [],
      agentId: "",
      program: a.programName,
      programTerm: "",
      admissionTerm: a.intakeTerm,
      campus: "",
      pathway: "",
      schedule: "",
      nationality: "",
      start: createdAt.slice(0, 10),
      end: "",
      createdAt,
      href: `/admin/ops/admissions/applications?id=${encodeURIComponent(a.id)}`,
    });
  }
  const items = all
    .filter((r) => {
      if (f.q && !r.studentNumber.toLowerCase().includes(f.q) && !r.last.toLowerCase().startsWith(f.q) && !r.name.toLowerCase().includes(f.q)) return false;
      if (f.status && r.status !== f.status) return false;
      if (f.campus && r.campus !== f.campus) return false;
      if (f.program && r.program !== f.program) return false;
      if (f.pathway && r.pathway !== f.pathway) return false;
      if (f.schedule && r.schedule !== f.schedule) return false;
      if (f.programTerm && r.programTerm !== f.programTerm) return false;
      if (f.admissionTerm && r.admissionTerm !== f.admissionTerm) return false;
      if (f.nationality && r.nationality !== f.nationality) return false;
      if (f.agent && r.agentId !== f.agent) return false;
      if (f.advisor && !r.advisorIds.includes(f.advisor)) return false;
      if (f.startDate && r.start < f.startDate) return false;
      if (f.endDate && (r.end || r.start) > f.endDate) return false;
      if (f.letter && !r.last.toUpperCase().startsWith(f.letter)) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name) * (s(q.dir) === "desc" ? -1 : 1));
  return page(items, q);
}

/* ------------------------------------------------------------------ */
/* Create Student Profile                                               */
/* ------------------------------------------------------------------ */

async function nextStudentNumber(inst: string) {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { institutionId: inst, studentNumber: { startsWith: `ST-${year}-` } } });
  let n = count + 1;
  while (await prisma.student.findFirst({ where: { institutionId: inst, studentNumber: `ST-${year}-${String(n).padStart(3, "0")}` } })) n++;
  return `ST-${year}-${String(n).padStart(3, "0")}`;
}

function dob(body: Data) {
  const y = s(body.dobYear).trim();
  const m = s(body.dobMonth).trim();
  const d = s(body.dobDay).trim();
  if (!y || !m || !d) throw httpError(400, "Date of Birth (Month, Day and Year) is required");
  const iso = `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) throw httpError(400, "Date of Birth is not a valid date");
  if (t > new Date()) throw httpError(400, "Date of Birth cannot be in the future");
  return iso;
}

/** Shown once to the registrar; the student can replace it from Forgot Password or Change Password. */
const temporaryPasswordFor = () => `Hc-${randomBytes(9).toString("base64url")}`;

export async function createStudent(user: SessionClaims, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  const [tree, pm, campuses, countries, advisors, agents] = await Promise.all([statusTree(user), programCatalogue(inst), campusNames(inst), countryCatalogue(inst), staffAccounts(inst), agentCatalogue(inst)]);

  const last = required(body.lastName, "Last Name", 100);
  const first = required(body.firstName, "First Name", 100);
  const birth = dob(body);
  const residency = oneOf(body.residency, RESIDENCY, "Domestic / International");
  const street = required(body.street, "Street Address", 200);
  const city = required(body.city, "City", 100);
  const postal = required(body.postal, "Postal / ZIP Code", 20);
  const country = required(body.country, "Country", 100);
  const province = required(body.province, "Province / State", 100);
  const known = countries.find((c) => c.name === country);
  if (countries.length && !known) throw httpError(400, "Country is not in the configured country list");
  if (known?.regions.length && !known.regions.includes(province)) throw httpError(400, "Province / State does not belong to the selected country");
  const phone = required(body.phone, "Phone Number", 40);
  if (phone.replace(/\D/g, "").length < 7) throw httpError(400, "Phone Number must contain at least 7 digits");
  const email = required(body.email, "E-mail Address", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "E-mail Address is not valid");
  const emergencyName = required(body.emergencyName, "Emergency Contact Name", 120);
  const emergencyPhone = required(body.emergencyPhone, "Emergency Contact Phone Number", 40);
  const visaStatus = oneOf(body.visaStatus, VISA_STATUSES, "Visa Status");
  const visaExpiry = optDate(body.visaExpiry, "Visa Expiry Date");
  const campus = required(body.campus, "Campus", 120);
  if (!campuses.includes(campus)) throw httpError(400, "Campus is not a configured campus");
  const delivery = oneOf(normalizeDelivery(body.delivery), DELIVERY_METHODS, "Delivery Method");
  const programName = required(body.program, "Program of Study", 200);
  const program = pm.programs.find((p) => p.name === programName || p.id === programName);
  if (!program) throw httpError(400, "Program of Study is not a configured program");
  const admissionTerm = text(body.admissionTerm, 120);
  const declarationBy = body.declarationBy ? oneOf(body.declarationBy, DECLARATION_BY, "Completed by") : "";
  const acks = [bool(arr(body.acknowledgements)[0]), bool(arr(body.acknowledgements)[1])];
  const rateCategory = oneOf(body.rateCategory, RATE_CATEGORIES, "Rate Category / Fee Status");
  const status = required(body.status, "Student Status", 120);
  if (!flatStatuses(tree).includes(status)) throw httpError(400, "Student Status is not in the status catalogue");
  const advisorIds = bool(body.assignAdvisors) ? arr<string>(body.advisors).map(String) : [];
  if (advisorIds.some((id) => !advisors.some((a) => a.id === id))) throw httpError(400, "Unknown advisor selected");
  const agentId = bool(body.assignAgent) ? s(body.agentId) : "";
  if (agentId && !agents.some((a) => a.id === agentId)) throw httpError(400, "Unknown agent selected");

  const gender = body.gender ? oneOf(body.gender, GENDERS, "Gender") : "";
  const files = arr<Data>(body.transcripts).slice(0, 10).map(validateFile);

  const dup = await prisma.person.findFirst({ where: { institutionId: inst, email } });
  if (dup) throw httpError(409, `A person with e-mail ${email} already exists. Open the existing profile and use New Program Profile instead.`, "CONFLICT");
  const createLogin = body.createLogin !== false;
  const chosenPassword = s(body.password);
  if (createLogin && chosenPassword && (chosenPassword.length < 8 || chosenPassword.length > 200)) throw httpError(400, "Password must be 8 to 200 characters");
  if (createLogin && (await prisma.account.findFirst({ where: { institutionId: inst, email } }))) throw httpError(409, `A user login with e-mail ${email} already exists`, "CONFLICT");
  const temporaryPassword = createLogin && !chosenPassword ? temporaryPasswordFor() : "";
  const passwordHash = createLogin ? await hashPassword(chosenPassword || temporaryPassword) : "";

  const studentNumber = await nextStudentNumber(inst);
  const applicationNumber = String(await seq(inst, "application"));
  const student = await prisma.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: {
        institutionId: inst,
        givenName: first,
        familyName: last,
        middleName: text(body.middleName, 100) || null,
        preferredName: text(body.preferredName, 100) || null,
        email,
        personalEmail: email,
        phone,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
        dateOfBirth: birth,
      },
    });
    const created = await tx.student.create({ data: { institutionId: inst, personId: person.id, studentNumber, programName: program.name } });
    if (createLogin) await tx.account.create({ data: { institutionId: inst, personId: person.id, email, passwordHash, status: "active", rolesJson: JSON.stringify(["student"]) } });
    const transcripts = [];
    for (const file of files) transcripts.push(await storeValidFile(user, created.id, file, tx));
    await saveProfile(
      user,
      created.id,
      {
        gender,
        province,
        visaStatus,
        visaExpiry,
        academicHistory: text(body.academicHistory, 4000),
        transcripts: transcripts.map((t) => ({ id: t.id, name: t.name, size: t.size })),
        declarationBy,
        acknowledgements: acks,
        advisors: advisorIds,
        agentId,
        applicationNumber,
        programId: program.id,
      },
      tx,
    );
    if (agentId) await putSingle(user, "FIN:STUDENT_AGENT", created.id, "agent", { agentId }, tx);
    return created;
  });
  try {
    await patchMetaLoose(inst, student.id, {
      status,
      residency,
      street,
      city,
      postal,
      discountCode: text(body.discountCode, 60),
      campus,
      delivery,
      admissionTerm,
      country,
      rateCategory,
    });
  } catch (err) {
    await prisma.$transaction([
      prisma.heritageRecord.deleteMany({ where: { institutionId: inst, contextKey: student.id, screenId: { in: [STU.FILE, STU.PROFILE, "FIN:STUDENT_AGENT"] } } }),
      prisma.student.delete({ where: { id: student.id } }),
      prisma.account.deleteMany({ where: { institutionId: inst, personId: student.personId } }),
      prisma.person.delete({ where: { id: student.personId } }),
    ]);
    throw err;
  }
  await stuAudit(user, "Profile Changes", student.id, "Student profile created", { name: `${last}, ${first}`, studentNumber: student.studentNumber, status, program: program.name, campus, login: createLogin ? email : "No login created" });
  return {
    id: student.id,
    studentNumber: student.studentNumber,
    applicationNumber,
    login: createLogin ? { email, ...(temporaryPassword ? { temporaryPassword } : {}) } : null,
  };
}

/* ------------------------------------------------------------------ */
/* Header + Overview                                                    */
/* ------------------------------------------------------------------ */

export async function header(user: SessionClaims, id: string) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const [meta, profile, transcript, reqCount, siblings] = await Promise.all([
    metaOf(inst, id),
    loadProfile(inst, id),
    getTranscriptSummary(inst, id).catch(() => null),
    prisma.heritageRecord.count({ where: { institutionId: inst, screenId: STU.REQ, contextKey: id, deletedAt: null } }),
    prisma.student.findMany({ where: { institutionId: inst, personId: st.personId }, select: { id: true, studentNumber: true, programName: true, createdAt: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    id: st.id,
    name: fullName(st.person),
    preferredName: st.person.preferredName ?? "",
    initials: `${st.person.givenName[0] ?? ""}${st.person.familyName[0] ?? ""}`.toUpperCase(),
    applicationNumber: profile.applicationNumber,
    studentNumber: st.studentNumber,
    status: statusOf(meta, st._count.enrolments),
    campus: meta.campus ?? st.cohort?.campus ?? "",
    program: st.programName,
    schedule: meta.schedule ?? st.cohort?.label ?? "",
    startDate: profile.scheduleStart,
    endDate: profile.scheduleEnd,
    cgpa: transcript?.cgpa ?? null,
    requirements: reqCount,
    programProfiles: siblings.map((x) => ({ id: x.id, studentNumber: x.studentNumber, program: x.programName, current: x.id === id })),
  };
}

/** Preserve statutory/academic history while removing portal access and active-directory visibility. */
export async function archiveStudentProfile(user: SessionClaims, id: string) {
  await canStudents(user, "edit");
  const student = await requireStudentRow(user.institutionId, id);
  const before = await metaOf(user.institutionId, id);
  if (s(before.status) === "Archived") return { id, status: "Archived" };
  await prisma.$transaction([
    prisma.account.updateMany({
      where: { institutionId: user.institutionId, personId: student.personId },
      data: { status: "disabled", rowVersion: { increment: 1 } },
    }),
    prisma.student.update({ where: { id }, data: { standing: "withdrawn", rowVersion: { increment: 1 } } }),
  ]);
  await patchMetaLoose(user.institutionId, id, { status: "Archived" });
  await stuAudit(user, "Profile Changes", id, "Student profile archived", { status: "Archived", login: "disabled" }, null, { status: s(before.status) });
  return { id, status: "Archived" };
}

export async function overview(user: SessionClaims, id: string) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const [meta, profile, advisors, agents] = await Promise.all([metaOf(inst, id), loadProfile(inst, id), staffAccounts(inst), agentCatalogue(inst)]);
  const p = st.person;
  return {
    contact: {
      lastName: p.familyName,
      firstName: p.givenName,
      middleName: p.middleName ?? "",
      preferredName: p.preferredName ?? "",
      dateOfBirth: p.dateOfBirth ?? "",
      gender: profile.gender,
      street: meta.street ?? "",
      city: meta.city ?? "",
      postal: meta.postal ?? "",
      country: meta.country ?? "",
      province: profile.province,
      phone: p.phone ?? "",
      email: p.personalEmail ?? p.email,
    },
    emergency: { name: p.emergencyContactName ?? "", phone: p.emergencyContactPhone ?? "" },
    enrolment: {
      campus: meta.campus ?? st.cohort?.campus ?? "",
      program: st.programName,
      schedule: meta.schedule ?? st.cohort?.label ?? "",
      feedIn: profile.feedIn,
      startDate: profile.scheduleStart,
      endDate: profile.scheduleEnd,
    },
    declarations: { completedBy: profile.declarationBy, acknowledgements: DECLARATION_ACKS.map((label, i) => ({ label, accepted: Boolean(profile.acknowledgements[i]) })) },
    language: profile.language,
    rateCategory: meta.rateCategory ?? "",
    residency: meta.residency ?? "",
    visa: { status: profile.visaStatus, expiry: profile.visaExpiry },
    advisors: profile.advisors.map((a) => advisors.find((x) => x.id === a)?.name ?? "").filter(Boolean),
    agent: agents.find((a) => a.id === profile.agentId)?.name ?? "",
    transcripts: profile.transcripts,
  };
}

export async function uploadStudentFile(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  await requireStudentRow(user.institutionId, id);
  return storeFile(user, id, body);
}

export async function downloadStudentFile(user: SessionClaims, id: string, fileId: string) {
  await canStudents(user, "view");
  return readFile(user.institutionId, id, fileId);
}

/* ------------------------------------------------------------------ */
/* Status change / New Program Profile                                  */
/* ------------------------------------------------------------------ */

/** Registered / Active / Graduated cannot be reached while Rate Category / Fee Status is missing. */
export function assertRateCategory(meta: Record<string, string | undefined>, status: string) {
  if (RATE_REQUIRED_STATUSES.has(status) && !s(meta.rateCategory).trim()) throw httpError(400, RATE_REQUIRED_MESSAGE, "RATE_CATEGORY_REQUIRED");
}

/** The fee status a student without one would be billed at: the recorded Domestic / International residency. */
export function defaultRateCategory(meta: Record<string, string | undefined>) {
  const residency = s(meta.residency).trim();
  return (RATE_CATEGORIES as readonly string[]).find((r) => r.toLowerCase() === residency.toLowerCase()) ?? "";
}

/**
 * Sets Rate Category / Fee Status on an existing student (onboarding and User Management never ask for it).
 * Returns the stored value; an unchanged value is a no-op.
 */
export async function setRateCategory(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const rateCategory = oneOf(body.rateCategory, RATE_CATEGORIES, "Rate Category / Fee Status");
  const meta = await metaOf(inst, id);
  if (meta.rateCategory === rateCategory) return { rateCategory };
  await patchMetaLoose(inst, id, { rateCategory, ...(meta.residency ? {} : { residency: rateCategory }) });
  await stuAudit(user, "Profile Changes", id, "Rate Category / Fee Status changed", { rateCategory }, null, { rateCategory: meta.rateCategory ?? "" });
  return { rateCategory };
}

export async function changeStatus(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const status = required(body.status, "New Status", 120);
  if (!flatStatuses(await statusTree(user)).includes(status)) throw httpError(400, "New Status is not in the status catalogue");
  const meta = await metaOf(inst, id);
  const before = statusOf(meta, st._count.enrolments);
  if (before === status) throw httpError(400, `The student is already "${status}"`);
  assertRateCategory(meta, status);
  const policy = await studentStatusPolicy(inst, status);
  await patchMetaLoose(inst, id, { status });
  let generatedStudentNumber: string | null = null;
  if (policy?.generateNumber && (!st.studentNumber.trim() || /^PENDING[-_]/i.test(st.studentNumber))) {
    generatedStudentNumber = await nextStudentNumber(inst);
    await prisma.student.update({ where: { id }, data: { studentNumber: generatedStudentNumber, rowVersion: { increment: 1 } } });
  }
  if (policy?.grantsAdmission) {
    await prisma.admissionsApplication.updateMany({ where: { institutionId: inst, personId: st.personId, status: { notIn: ["accepted", "enrolled"] } }, data: { status: "accepted", progressPct: 100, rowVersion: { increment: 1 } } });
  }
  if (policy?.withdrawn) {
    await prisma.enrolment.updateMany({ where: { institutionId: inst, studentId: id, status: { in: ["enrolled", "waitlisted"] } }, data: { status: "withdrawn", rowVersion: { increment: 1 } } });
  } else if (policy?.completes) {
    await prisma.enrolment.updateMany({ where: { institutionId: inst, studentId: id, status: "enrolled" }, data: { status: "completed", creditAwarded: true, rowVersion: { increment: 1 } } });
  }
  if (policy?.createLogin) {
    const person = await prisma.person.findFirst({ where: { id: st.personId, institutionId: inst } });
    const account = person ? await prisma.account.findFirst({ where: { institutionId: inst, personId: person.id } }) : null;
    if (person && !account) {
      const temporaryPassword = temporaryPasswordFor();
      await prisma.account.create({ data: { institutionId: inst, personId: person.id, email: person.email, passwordHash: await hashPassword(temporaryPassword), status: "active", rolesJson: JSON.stringify(["student"]) } });
    }
  }
  await stuAudit(user, "Profile Changes", id, "Student status changed", { status }, null, { status: before });
  return { status, studentNumber: generatedStudentNumber ?? st.studentNumber };
}

export async function newProgramProfile(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const status = required(body.status, "New Profile Status", 120);
  if (!flatStatuses(await statusTree(user)).includes(status)) throw httpError(400, "New Profile Status is not in the status catalogue");
  const meta = await metaOf(inst, id);
  assertRateCategory(meta, status);
  const profile = await loadProfile(inst, id);
  const created = await prisma.student.create({ data: { institutionId: inst, personId: st.personId, studentNumber: await nextStudentNumber(inst), programName: "Not assigned" } });
  await patchMetaLoose(inst, created.id, {
    status,
    residency: meta.residency,
    street: meta.street,
    city: meta.city,
    postal: meta.postal,
    country: meta.country,
    campus: meta.campus,
    rateCategory: meta.rateCategory,
  });
  await saveProfile(user, created.id, {
    gender: profile.gender,
    province: profile.province,
    visaStatus: profile.visaStatus,
    visaExpiry: profile.visaExpiry,
    declarationBy: profile.declarationBy,
    acknowledgements: profile.acknowledgements,
    language: profile.language,
    applicationNumber: String(await seq(inst, "application")),
  });
  await stuAudit(user, "Profile Changes", id, "New program profile created", { newStudentNumber: created.studentNumber, status });
  await stuAudit(user, "Profile Changes", created.id, "Program profile created from existing person", { fromStudentNumber: st.studentNumber, status });
  return { id: created.id, studentNumber: created.studentNumber };
}

/* ------------------------------------------------------------------ */
/* Flags & Holds (personal)                                             */
/* ------------------------------------------------------------------ */

export function flagView(r: { id: string; contextKey: string; data: Data; createdAt: Date }) {
  return {
    id: r.id,
    studentId: r.contextKey,
    name: s(r.data.name),
    message: s(r.data.message),
    applyHold: s(r.data.applyHold) || "No",
    resolved: s(r.data.resolved) || "No",
    status: s(r.data.status) || "Active",
    templateId: s(r.data.templateId),
    date: s(r.data.date) || r.createdAt.toISOString(),
  };
}

export function filterFlags<T extends { status: string; resolved: string }>(list: T[], q: Data) {
  const status = s(q.status) || "Active";
  const resolved = s(q.resolved) || "All";
  return list.filter((f) => (status === "All" || f.status === status) && (resolved === "All" || f.resolved === resolved));
}

export async function listFlags(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  await requireStudentRow(user.institutionId, id);
  const list = (await rows(user.institutionId, STU.FLAG, id)).map(flagView).sort((a, b) => b.date.localeCompare(a.date));
  return { items: filterFlags(list, q) };
}

function flagInput(body: Data) {
  return {
    name: required(body.name, "Flag / Hold Name", 200),
    message: sanitizeHtml(s(body.message).slice(0, 20000)),
    applyHold: oneOf(body.applyHold, ["No", "Yes"] as const, "Apply Hold", "No"),
  };
}

export async function addFlag(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  await requireStudentRow(user.institutionId, id);
  const input = flagInput(body);
  const rec = await add(user, STU.FLAG, { ...input, resolved: "No", status: "Active", templateId: s(body.templateId), date: new Date().toISOString() }, id);
  await stuAudit(user, "Profile Changes", id, "Flag / hold added", { "Flag Name": input.name, Message: input.message, "Applies Hold": input.applyHold }, rec.id);
  return flagView(rec);
}

async function studentFlag(user: SessionClaims, id: string, flagId: string) {
  const rec = await row(user.institutionId, STU.FLAG, flagId, "Flag / hold");
  if (rec.contextKey !== id) throw httpError(404, "Flag / hold not found", "NOT_FOUND");
  return rec;
}

export async function updateFlag(user: SessionClaims, id: string, flagId: string, body: Data) {
  await canStudents(user, "edit");
  const rec = await studentFlag(user, id, flagId);
  const input = flagInput(body);
  const next = { ...rec.data, ...input, ...(body.resolved !== undefined ? { resolved: oneOf(body.resolved, ["No", "Yes"] as const, "Resolved") } : {}) };
  await save(user, rec.id, next);
  await stuAudit(user, "Profile Changes", id, "Flag / hold updated", { "Flag Name": input.name, Message: input.message, "Applies Hold": input.applyHold }, rec.id, { "Flag Name": rec.data.name, "Applies Hold": rec.data.applyHold });
  return flagView({ ...rec, data: next });
}

export async function deleteFlag(user: SessionClaims, id: string, flagId: string) {
  await canStudents(user, "edit");
  const rec = await studentFlag(user, id, flagId);
  await drop(user, [rec.id]);
  await stuAudit(user, "Profile Changes", id, "Flag / hold deleted", { "Flag Name": rec.data.name, "Applies Hold": rec.data.applyHold }, rec.id);
  return { ok: true };
}

export async function dismissFlag(user: SessionClaims, flagId: string) {
  await canStudents(user, "edit");
  const rec = await row(user.institutionId, STU.FLAG, flagId, "Flag / hold");
  if (s(rec.data.status) === "Dismissed") throw httpError(400, "This flag is already dismissed");
  await save(user, rec.id, { ...rec.data, status: "Dismissed" });
  await stuAudit(user, "Profile Changes", rec.contextKey, "Flag / hold dismissed", { "Flag Name": rec.data.name }, rec.id);
  return { ok: true };
}

export async function deleteFlagGlobal(user: SessionClaims, flagId: string) {
  const rec = await row(user.institutionId, STU.FLAG, flagId, "Flag / hold");
  return deleteFlag(user, rec.contextKey, flagId);
}

/* ------------------------------------------------------------------ */
/* Attendance                                                           */
/* ------------------------------------------------------------------ */

export async function attendance(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const from = optDate(q.startDate, "Start Date");
  const to = optDate(q.endDate, "End Date");
  if (from && to && from > to) throw httpError(400, "Start Date must be on or before End Date");
  const [records, institution] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { institutionId: inst, studentId: id },
      include: { section: { include: { course: true } }, classSession: { select: { startsAt: true } } },
      orderBy: { recordedAt: "desc" },
      take: 2000,
    }),
    prisma.institution.findFirst({ where: { id: inst }, select: { timezone: true } }),
  ]);
  const tz = institution?.timezone || DEFAULT_TZ;
  const meetingDate = (r: (typeof records)[number]) =>
    /^\d{4}-\d{2}-\d{2}$/.test(r.meetingLabel) ? r.meetingLabel : ymdIn(r.classSession?.startsAt ?? r.recordedAt, tz);
  const courses = [...new Map(records.map((r) => [r.sectionId, `${r.section.course.code} — ${r.section.course.title}`])).entries()].map(([value, label]) => ({ value, label }));
  const course = s(q.course);
  const items = records
    .map((r) => ({ r, date: meetingDate(r) }))
    .filter(({ r, date }) => (!course || r.sectionId === course) && (!from || date >= from) && (!to || date <= to))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ r, date }) => {
      const st = r.status.toLowerCase();
      return {
        id: r.id,
        date,
        course: `${r.section.course.code} — ${r.section.course.title}`,
        meeting: r.meetingLabel,
        status: st,
        present: st === "present",
        late: st === "late",
        absent: st === "absent",
        excused: st === "excused",
        note: r.note,
      };
    });
  return { courses, items };
}

/* ------------------------------------------------------------------ */
/* Audit Trail                                                          */
/* ------------------------------------------------------------------ */

const SECTION_BY_SCREEN = new Map<string, AuditSection>([...AUDIT_SECTIONS.map((sec) => [auditScreen(sec), sec] as [string, AuditSection]), [FINANCE_AUDIT_SCREEN, "Tuition/Finance"]]);

const parseJson = (v: string | null) => {
  if (!v) return null;
  try {
    return JSON.parse(v) as unknown;
  } catch {
    return null;
  }
};

export async function auditTrail(user: SessionClaims, id: string, q: Data, onlyFinance = false) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const from = optDate(q.startDate, "Start Datestamp");
  const to = optDate(q.endDate, "End Datestamp");
  const wanted = arr<string>(q.sections).length ? arr<string>(q.sections) : s(q.sections) ? s(q.sections).split(",") : [];
  const screens = onlyFinance ? [FINANCE_AUDIT_SCREEN] : [...SECTION_BY_SCREEN.entries()].filter(([, sec]) => !wanted.length || wanted.includes(sec)).map(([scr]) => scr);
  const entries = await prisma.heritageAuditEntry.findMany({
    where: {
      institutionId: inst,
      contextKey: id,
      screenId: { in: screens },
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const term = text(q.q, 120).toLowerCase();
  return {
    items: entries
      .map((e) => ({
        id: e.id,
        date: e.createdAt.toISOString(),
        by: e.actorName || "System",
        section: SECTION_BY_SCREEN.get(e.screenId) ?? "",
        action: e.action,
        before: parseJson(e.beforeJson),
        after: parseJson(e.afterJson),
        note: e.note ?? "",
      }))
      .filter((e) => !term || e.action.toLowerCase().includes(term) || e.by.toLowerCase().includes(term) || e.date.includes(term)),
  };
}

/* ------------------------------------------------------------------ */
/* Sidebar counts                                                       */
/* ------------------------------------------------------------------ */

export async function counts(user: SessionClaims) {
  const access = await canStudents(user, "view");
  const inst = user.institutionId;
  const [students, metaMap, flags, reqs, loas, withdraws, grades, alerts, assess, marks, badges, changes, leads] = await Promise.all([
    prisma.student.findMany({ where: { institutionId: inst }, select: { id: true, _count: { select: { enrolments: { where: { status: "enrolled" } } } } } }),
    studentMetaMap(inst),
    rows(inst, STU.FLAG),
    rows(inst, STU.REQ),
    prisma.leaveOfAbsenceRequest.findMany({ where: { institutionId: inst, status: "pending" }, select: { studentId: true } }),
    prisma.serviceRequest.findMany({ where: { institutionId: inst, type: { contains: "withdraw", mode: "insensitive" }, status: { in: ["open", "pending", "pending_approval", "submitted"] } }, select: { studentId: true } }),
    prisma.approvalRequest.findMany({ where: { institutionId: inst, type: { in: ["grade.publish", "grade_publish"] }, status: "pending" }, select: { subjectRef: true } }),
    rows(inst, STU.ALERT),
    rows(inst, STU.ASSESS),
    rows(inst, STU.TEST),
    prisma.studentBadge.findMany({ where: { institutionId: inst, status: "pending" }, select: { studentId: true } }),
    rows(inst, STU.TRANSCRIPT_CHANGE),
    applicantLeads(inst),
  ]);
  const scopedStudents = access.superAdmin || access.campuses.length === CAMPUSES.length
    ? students
    : students.filter((st) => access.campuses.includes(s(metaMap[st.id]?.campus)));
  const scopedStudentIds = new Set(scopedStudents.map((student) => student.id));
  const gradeSectionIds = grades.map((approval) => approval.subjectRef.replace(/^section:/, ""));
  const gradeSections = gradeSectionIds.length
    ? await prisma.section.findMany({ where: { institutionId: inst, id: { in: gradeSectionIds } }, select: { id: true, enrolments: { select: { studentId: true } } } })
    : [];
  const scopedGradeSectionIds = new Set(
    gradeSections
      .filter((section) => section.enrolments.length > 0 && section.enrolments.every((enrolment) => scopedStudentIds.has(enrolment.studentId)))
      .map((section) => section.id),
  );
  const inScope = (studentId: string) => scopedStudentIds.has(studentId);
  const out: Record<string, number> = { "students:all": scopedStudents.length + (access.superAdmin ? leads.length : 0) };
  for (const st of scopedStudents) {
    const status = statusOf((metaMap[st.id] ?? {}) as Record<string, string | undefined>, st._count.enrolments);
    out[`students:${status}`] = (out[`students:${status}`] ?? 0) + 1;
  }
  if (access.superAdmin) for (const a of leads) out[`students:${a.lifecycleStatus}`] = (out[`students:${a.lifecycleStatus}`] ?? 0) + 1;
  out["queue:alerts"] = alerts.filter((a) => inScope(a.contextKey) && s(a.data.status) !== "Dismissed" && s(a.data.resolved) !== "Yes").length;
  out["queue:flags"] = flags.filter((f) => inScope(f.contextKey) && (s(f.data.status) || "Active") === "Active" && s(f.data.resolved) !== "Yes").length;
  out["queue:assessments"] = assess.filter((a) => inScope(a.contextKey) && ["Pending Assignment", "Pending Review"].includes(s(a.data.status))).length;
  out["queue:requirements"] = reqs.filter((r) => inScope(r.contextKey) && (s(r.data.status) || "Pending") === "Pending").length;
  out["queue:loa"] = loas.filter((request) => inScope(request.studentId)).length;
  out["queue:withdraw"] = withdraws.filter((request) => inScope(request.studentId)).length;
  out["queue:grades"] = grades.filter((approval) => scopedGradeSectionIds.has(approval.subjectRef.replace(/^section:/, ""))).length;
  out["queue:transcript"] = changes.filter((c) => inScope(c.contextKey) && s(c.data.status) === "Pending").length;
  out["queue:marks"] = marks.filter((m) => inScope(m.contextKey) && !s(m.data.mark)).length;
  out["queue:badges"] = badges.filter((badge) => inScope(badge.studentId)).length;
  return out;
}

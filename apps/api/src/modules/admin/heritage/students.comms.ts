/* Student profile › Communication & Workflows: correspondence, notifications, actions, assessment cases and requirements. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { mailConfigured, sendMailViaHumanitix } from "../../../lib/mailer.js";
import { buildDocumentPdf, type DocLine } from "../../../lib/taxPdf.js";
import { entityRecords, sanitizeHtml } from "./sysconfig.js";
import { page } from "./finance.core.js";
import {
  add,
  arr,
  bool,
  canStudents,
  drop,
  fileRefs,
  httpError,
  oneOf,
  optDate,
  required,
  requireStudentRow,
  row,
  rows,
  s,
  save,
  seq,
  stuAudit,
  text,
  type Data,
} from "./students.core.js";
import {
  ACTION_STATUSES,
  ASSESSMENT_STATUSES,
  CAPTURED_NOTIFICATION_TEMPLATES,
  CORR_MISC_CATEGORY,
  CORR_VISIBILITY,
  NOTIFICATION_METHODS,
  REQ_DATA_COLLECTION,
  REQ_DATA_TYPES,
  REQ_DOC_APPROVAL,
  REQ_EXPIRY,
  REQ_EXPIRY_ACTIONS,
  REQ_EXPIRY_UNITS,
  REQ_RECURRENCE,
  REQ_STATUSES,
  STU,
} from "./students.spec.js";

const MISC_ID = "misc";
const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export async function generateStudentDocument(user: SessionClaims, studentId: string, body: Data) {
  await canStudents(user, "view");
  const templateId = required(body.templateId, "Document Template");
  const student = await requireStudentRow(user.institutionId, studentId);
  const template = (await entityRecords(user.institutionId, "documentTemplates")).find((row) => row.id === templateId);
  if (!template) throw httpError(404, "Document template not found");

  const today = new Date().toISOString().slice(0, 10);
  const templateName = s(template.data.name) || "Document";
  const suppliedInputs = body.inputs && typeof body.inputs === "object" && !Array.isArray(body.inputs) ? body.inputs as Data : {};
  const requiredInputs = [...s(template.data.content).matchAll(/\{input:([A-Za-z0-9_-]+)\}/g)].map((match) => match[1]!).filter((value, index, all) => all.indexOf(value) === index);
  const missingInputs = requiredInputs.filter((key) => !s(suppliedInputs[key]).trim());
  if (missingInputs.length) throw httpError(400, `Complete the required document inputs: ${missingInputs.join(", ")}`);
  const tokens: Record<string, string> = {
    "{template}": templateName,
    "{student_number}": student.studentNumber,
    "{last_name}": student.person.familyName,
    "{first_name}": student.person.givenName,
    "{student.student_number}": student.studentNumber,
    "{student.last_name}": student.person.familyName,
    "{student.first_name}": student.person.givenName,
    "{student.program}": student.programName,
    "{student.address}": "",
    "{date}": today,
    ...Object.fromEntries(requiredInputs.map((key) => [`{input:${key}}`, s(suppliedInputs[key]).trim().slice(0, 500)])),
  };
  const merge = (value: string) => Object.entries(tokens).reduce((out, [token, replacement]) => out.replaceAll(token, replacement), value);
  const content = merge(s(template.data.content))
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines: DocLine[] = [
    { kind: "title", text: templateName },
    { kind: "text", text: `${student.person.givenName} ${student.person.familyName} · ${student.studentNumber}`, bold: true },
    { kind: "rule" },
    ...(content.length ? content.map((text): DocLine => ({ kind: "text", text })) : [{ kind: "text" as const, text: "No template content configured." }]),
  ];
  const requestedName = s(template.data.naming) === "Custom Naming" ? merge(s(template.data.namingPattern)) : `${templateName}-${student.studentNumber}-${today}`;
  const filename = `${requestedName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "student-document"}.pdf`;
  await stuAudit(user, "Workflows/Requirements", studentId, "Student document generated", { templateId, templateName, filename });
  return { pdf: buildDocumentPdf(lines, `Generated ${today}`), filename };
}

async function accountNames(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return new Map<string, string>();
  const accounts = await prisma.account.findMany({ where: { id: { in: uniq } }, include: { person: true } });
  return new Map(accounts.map((a) => [a.id, `${a.person.givenName} ${a.person.familyName}`.trim() || a.email]));
}

/* ------------------------------------------------------------------ */
/* Correspondence                                                       */
/* ------------------------------------------------------------------ */

async function corrCatalogue(inst: string) {
  const [cats, types] = await Promise.all([entityRecords(inst, "correspondenceCategories"), entityRecords(inst, "correspondenceTypes")]);
  return {
    categories: [...cats.map((c) => ({ id: c.id, name: s(c.data.name) })), { id: MISC_ID, name: CORR_MISC_CATEGORY }],
    types: types.map((t) => ({ id: t.id, name: s(t.data.name), categories: arr<string>(t.data.categories) })),
  };
}

/** Record Type follows the chosen Category; types linked to no category belong to Miscellaneous. */
function typeFits(type: { categories: string[] }, categoryId: string) {
  return categoryId === MISC_ID ? type.categories.length === 0 : type.categories.includes(categoryId);
}

async function classify(inst: string, body: Data) {
  const cat = await corrCatalogue(inst);
  const categoryId = required(body.categoryId, "Category", 80);
  const category = cat.categories.find((c) => c.id === categoryId);
  if (!category) throw httpError(400, "Category was not found");
  const typeId = required(body.typeId, "Record Type", 80);
  const type = cat.types.find((t) => t.id === typeId);
  if (!type || !typeFits(type, categoryId)) throw httpError(400, "Record Type does not belong to the selected Category");
  return { categoryId, category: category.name, typeId, type: type.name };
}

type CorrRow = { id: string; data: Data; updatedAt: Date; updatedById: string | null; createdAt: Date };

function corrView(r: CorrRow, names: Map<string, string>) {
  return {
    id: r.id,
    title: s(r.data.title),
    categoryId: s(r.data.categoryId),
    category: s(r.data.category),
    typeId: s(r.data.typeId),
    type: s(r.data.type),
    notes: s(r.data.notes),
    content: s(r.data.content),
    files: arr(r.data.files),
    visibility: s(r.data.visibility) || CORR_VISIBILITY[0],
    kind: s(r.data.kind) || "record",
    method: s(r.data.method),
    delivery: s(r.data.delivery),
    lastUpdated: r.updatedAt.toISOString(),
    updatedBy: names.get(r.updatedById ?? "") ?? "",
  };
}

async function corrRows(inst: string, studentId: string) {
  return prisma.heritageRecord.findMany({ where: { institutionId: inst, screenId: STU.CORR, contextKey: studentId, deletedAt: null }, orderBy: { updatedAt: "desc" } });
}

export async function listCorrespondence(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const raw = await corrRows(inst, id);
  const names = await accountNames(raw.map((r) => r.updatedById ?? ""));
  const term = text(q.q, 200).toLowerCase();
  const items = raw
    .map((r) => corrView({ ...r, data: JSON.parse(r.dataJson) as Data }, names))
    .filter((r) => (!s(q.categoryId) || r.categoryId === s(q.categoryId)) && (!s(q.typeId) || r.typeId === s(q.typeId)) && (!term || r.title.toLowerCase().includes(term)));
  return page(items, q);
}

export async function getCorrespondence(user: SessionClaims, id: string, corrId: string) {
  await canStudents(user, "view");
  const r = await prisma.heritageRecord.findFirst({ where: { id: corrId, institutionId: user.institutionId, screenId: STU.CORR, contextKey: id, deletedAt: null } });
  if (!r) throw httpError(404, "Correspondence record not found", "NOT_FOUND");
  return corrView({ ...r, data: JSON.parse(r.dataJson) as Data }, await accountNames([r.updatedById ?? ""]));
}

async function corrInput(user: SessionClaims, id: string, body: Data) {
  const cls = await classify(user.institutionId, body);
  return {
    ...cls,
    title: required(body.title, "Record Title", 200),
    notes: text(body.notes, 4000),
    content: sanitizeHtml(s(body.content).slice(0, 50000)),
    files: await fileRefs(user.institutionId, id, body.files),
    visibility: oneOf(body.visibility, CORR_VISIBILITY, "Document(s) Visibility", CORR_VISIBILITY[0]),
  };
}

export async function addCorrespondence(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  await requireStudentRow(user.institutionId, id);
  const input = await corrInput(user, id, body);
  const rec = await add(user, STU.CORR, { ...input, kind: "record" }, id);
  await stuAudit(user, "Workflows/Requirements", id, "Correspondence record added", { title: input.title, category: input.category, type: input.type, visibility: input.visibility, files: input.files.length }, rec.id);
  return getCorrespondence(user, id, rec.id);
}

async function studentCorr(user: SessionClaims, id: string, corrId: string) {
  const rec = await row(user.institutionId, STU.CORR, corrId, "Correspondence record");
  if (rec.contextKey !== id) throw httpError(404, "Correspondence record not found", "NOT_FOUND");
  return rec;
}

export async function updateCorrespondence(user: SessionClaims, id: string, corrId: string, body: Data) {
  await canStudents(user, "edit");
  const rec = await studentCorr(user, id, corrId);
  const input = await corrInput(user, id, body);
  await save(user, rec.id, { ...rec.data, ...input });
  await stuAudit(user, "Workflows/Requirements", id, "Correspondence record updated", { title: input.title, category: input.category, type: input.type, visibility: input.visibility }, rec.id, { title: rec.data.title });
  return getCorrespondence(user, id, rec.id);
}

export async function deleteCorrespondence(user: SessionClaims, id: string, corrId: string) {
  await canStudents(user, "edit");
  const rec = await studentCorr(user, id, corrId);
  await drop(user, [rec.id]);
  await stuAudit(user, "Workflows/Requirements", id, "Correspondence record deleted", { title: rec.data.title }, rec.id);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Send Notification                                                    */
/* ------------------------------------------------------------------ */

export async function sendNotification(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  const st = await requireStudentRow(inst, id);
  const templates = await entityRecords(inst, "notificationTemplates");
  const template = s(body.template) || "No Template";
  const templateName =
    template === "No Template"
      ? template
      : template.startsWith("captured:") && (CAPTURED_NOTIFICATION_TEMPLATES as readonly string[]).includes(template.slice(9))
        ? template.slice(9)
        : s(templates.find((t) => t.id === template)?.data.name);
  if (!templateName) throw httpError(400, "Notification Template was not found");
  const cls = await classify(inst, body);
  const method = oneOf(body.method, NOTIFICATION_METHODS, "Notification Method", NOTIFICATION_METHODS[0]);
  const subject = required(body.subject, "Subject", 200);
  const html = sanitizeHtml(s(body.body).slice(0, 50000));
  if (!plain(html)) throw httpError(400, "Message Body is required");
  const files = await fileRefs(inst, id, body.attachments);

  const to = st.person.personalEmail || st.person.email;
  let delivery = "Not sent";
  let emailError = "";
  if (!mailConfigured()) emailError = "Outgoing e-mail is not configured";
  else {
    try {
      await sendMailViaHumanitix({ email: to, title: subject, message: html });
      delivery = `Sent to ${to}`;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "E-mail delivery failed";
    }
  }
  if (emailError) delivery = `Not delivered: ${emailError}`;
  const account = await prisma.account.findFirst({ where: { institutionId: inst, personId: st.personId } });
  if (account) await prisma.notification.create({ data: { institutionId: inst, recipientAccountId: account.id, channel: "in_app", title: subject, body: plain(html).slice(0, 4000), templateKey: templateName } });
  const rec = await add(user, STU.CORR, { ...cls, title: subject, notes: `Notification (${templateName})`, content: html, files, visibility: CORR_VISIBILITY[1], kind: "notification", method, template: templateName, delivery }, id);
  await stuAudit(user, "Workflows/Requirements", id, "Notification sent", { template: templateName, subject, method, delivery, attachments: files.length }, rec.id);
  return { message: "Notification sent successfully", emailDelivered: !emailError, delivery };
}

/* ------------------------------------------------------------------ */
/* Review Actions                                                       */
/* ------------------------------------------------------------------ */

export async function listActions(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  await requireStudentRow(user.institutionId, id);
  const status = oneOf(q.status, ACTION_STATUSES, "Status", "All");
  const items = (await rows(user.institutionId, STU.ACTION, id))
    .map((r) => ({ id: r.id, name: s(r.data.name), type: s(r.data.type), status: s(r.data.status) || "Pending", date: r.createdAt.toISOString() }))
    .filter((r) => status === "All" || r.status === status);
  return { items };
}

/* ------------------------------------------------------------------ */
/* Review Assessments (cases)                                           */
/* ------------------------------------------------------------------ */

export function caseView(r: { id: string; contextKey: string; data: Data; createdAt: Date }) {
  return {
    id: r.id,
    studentId: r.contextKey,
    number: s(r.data.number),
    assessmentId: s(r.data.assessmentId),
    assessment: s(r.data.assessment),
    status: s(r.data.status) || "Pending Assignment",
    advisor: s(r.data.advisor),
    date: r.createdAt.toISOString(),
  };
}

export async function listCases(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  await requireStudentRow(user.institutionId, id);
  const number = text(q.number, 40);
  const status = s(q.status);
  const items = (await rows(user.institutionId, STU.ASSESS, id)).map(caseView).filter((c) => (!number || c.number.includes(number)) && (!status || c.status === status));
  return { items };
}

async function availableAssessments(inst: string, id: string) {
  const [all, existing] = await Promise.all([entityRecords(inst, "assessments"), rows(inst, STU.ASSESS, id)]);
  const taken = new Set(existing.filter((c) => !["Completed", "Declined"].includes(s(c.data.status))).map((c) => s(c.data.assessmentId)));
  return all.filter((a) => s(a.data.status) === "Enabled" && !taken.has(a.id)).map((a) => ({ id: a.id, name: s(a.data.name) }));
}

export async function assessmentOptions(user: SessionClaims, id: string) {
  await canStudents(user, "view");
  await requireStudentRow(user.institutionId, id);
  return { items: await availableAssessments(user.institutionId, id) };
}

export async function addCase(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  await requireStudentRow(user.institutionId, id);
  const avail = await availableAssessments(user.institutionId, id);
  if (!avail.length) throw httpError(400, "No assessments are available to add to this profile.");
  const pick = avail.find((a) => a.id === s(body.assessmentId));
  if (!pick) throw httpError(400, "Select an available assessment");
  const number = String(await seq(user.institutionId, "assessment"));
  const rec = await add(user, STU.ASSESS, { number, assessmentId: pick.id, assessment: pick.name, status: ASSESSMENT_STATUSES[0], advisor: "" }, id);
  await stuAudit(user, "Assessments", id, "Assessment case added", { number, assessment: pick.name, status: ASSESSMENT_STATUSES[0] }, rec.id);
  return caseView(rec);
}

/* ------------------------------------------------------------------ */
/* Review Requirements                                                  */
/* ------------------------------------------------------------------ */

type HistoryItem = { at: string; by: string; status: string; action: string; files: Array<{ id: string; name: string; size: number }>; note: string; noteVisible: boolean; expiryDate: string };

export function reqView(r: { id: string; contextKey: string; data: Data; createdAt: Date }, taskDone = false) {
  const d = r.data;
  const submission = s(d.submission) || (taskDone ? "Submitted" : "No Response");
  return {
    id: r.id,
    studentId: r.contextKey,
    name: s(d.name),
    dataType: s(d.dataType),
    dataCollection: s(d.dataCollection),
    summary: s(d.summary),
    expiry: s(d.expiry),
    recurrence: s(d.recurrence),
    documentType: s(d.documentType),
    documentTypeName: s(d.documentTypeName),
    documentApproval: s(d.documentApproval),
    allowUpload: s(d.allowUpload),
    maxFiles: Number(d.maxFiles) || 0,
    docExpiryValue: s(d.docExpiryValue),
    docExpiryUnit: s(d.docExpiryUnit),
    expiryAction: s(d.expiryAction),
    workflowId: s(d.workflowId),
    requestedAt: s(d.requestedAt) || r.createdAt.toISOString(),
    submittedAt: s(d.submittedAt),
    status: s(d.status) || "Pending",
    submission,
    expiryDate: s(d.expiryDate),
    furtherReview: d.furtherReview === true,
    history: arr<HistoryItem>(d.history),
    taskId: s(d.taskId),
  };
}

async function reqInput(inst: string, body: Data) {
  const dataType = oneOf(body.dataType, REQ_DATA_TYPES, "Data Type");
  const base = {
    name: required(body.name, "Requirement Name", 200),
    dataType,
    dataCollection: oneOf(body.dataCollection, REQ_DATA_COLLECTION, "Data Collection"),
    summary: sanitizeHtml(s(body.summary).slice(0, 20000)),
    expiry: oneOf(body.expiry, REQ_EXPIRY, "Requirement Expiry", "None"),
    recurrence: oneOf(body.recurrence, REQ_RECURRENCE, "Recurrence", "Disabled"),
  };
  if (dataType !== "Document Required") return { ...base, documentType: "", documentTypeName: "", documentApproval: "", allowUpload: "", maxFiles: 0, docExpiryValue: "", docExpiryUnit: "", expiryAction: "" };
  const types = await entityRecords(inst, "documentTypes");
  const docType = types.find((t) => t.id === s(body.documentType));
  if (!docType) throw httpError(400, "Document Type is required");
  const maxFiles = Number(body.maxFiles);
  if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 20) throw httpError(400, "Maximum Files must be a whole number between 1 and 20");
  const expValue = s(body.docExpiryValue).trim();
  if (expValue && (!/^\d+$/.test(expValue) || Number(expValue) < 1 || Number(expValue) > 100)) throw httpError(400, "Document Expiry must be a whole number between 1 and 100");
  return {
    ...base,
    documentType: docType.id,
    documentTypeName: s(docType.data.name),
    documentApproval: oneOf(body.documentApproval, REQ_DOC_APPROVAL, "Document Approval", REQ_DOC_APPROVAL[0]),
    allowUpload: oneOf(body.allowUpload, ["Yes", "No"] as const, "Allow Upload", "Yes"),
    maxFiles,
    docExpiryValue: expValue,
    docExpiryUnit: expValue ? oneOf(body.docExpiryUnit, REQ_EXPIRY_UNITS, "Document Expiry unit", REQ_EXPIRY_UNITS[0]) : "",
    expiryAction: expValue ? oneOf(body.expiryAction, REQ_EXPIRY_ACTIONS, "Expiry Action", REQ_EXPIRY_ACTIONS[0]) : "",
  };
}

async function studentReq(user: SessionClaims, id: string, reqId: string) {
  const rec = await row(user.institutionId, STU.REQ, reqId, "Requirement");
  if (rec.contextKey !== id) throw httpError(404, "Requirement not found", "NOT_FOUND");
  return rec;
}

async function tasksDone(inst: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const tasks = await prisma.requiredTask.findMany({ where: { institutionId: inst, id: { in: ids }, completedAt: { not: null } }, select: { id: true } });
  return new Set(tasks.map((t) => t.id));
}

export async function listRequirements(user: SessionClaims, id: string, q: Data) {
  await canStudents(user, "view");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const list = await rows(inst, STU.REQ, id);
  const done = await tasksDone(
    inst,
    list.map((r) => s(r.data.taskId)).filter(Boolean),
  );
  const status = s(q.status);
  const items = list
    .map((r) => reqView(r, done.has(s(r.data.taskId))))
    .filter((r) => !status || status === "All" || r.status === status)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .map(({ history: _h, ...r }) => r);
  return page(items, q);
}

export async function getRequirement(user: SessionClaims, id: string, reqId: string) {
  await canStudents(user, "view");
  const rec = await studentReq(user, id, reqId);
  const done = await tasksDone(user.institutionId, [s(rec.data.taskId)].filter(Boolean));
  const view = reqView(rec, done.has(s(rec.data.taskId)));
  return view;
}

export async function addRequirement(user: SessionClaims, id: string, body: Data) {
  await canStudents(user, "edit");
  const inst = user.institutionId;
  await requireStudentRow(inst, id);
  const input = await reqInput(inst, body);
  const task = await prisma.requiredTask.create({ data: { institutionId: inst, studentId: id, title: input.name, detail: plain(input.summary).slice(0, 1000) || null, status: "pending" } });
  const rec = await add(user, STU.REQ, { ...input, status: "Pending", submission: "No Response", requestedAt: new Date().toISOString(), submittedAt: "", expiryDate: "", furtherReview: false, history: [], taskId: task.id }, id);
  await stuAudit(user, "Workflows/Requirements", id, "Requirement added", { name: input.name, dataType: input.dataType, dataCollection: input.dataCollection, status: "Pending" }, rec.id);
  return reqView(rec);
}

export async function updateRequirement(user: SessionClaims, id: string, reqId: string, body: Data) {
  await canStudents(user, "edit");
  const rec = await studentReq(user, id, reqId);
  const input = await reqInput(user.institutionId, body);
  const next = { ...rec.data, ...input };
  await save(user, rec.id, next);
  if (s(rec.data.taskId)) await prisma.requiredTask.updateMany({ where: { id: s(rec.data.taskId), institutionId: user.institutionId }, data: { title: input.name, detail: plain(input.summary).slice(0, 1000) || null } });
  await stuAudit(user, "Workflows/Requirements", id, "Requirement updated", { name: input.name, dataType: input.dataType }, rec.id, { name: rec.data.name, dataType: rec.data.dataType });
  return reqView({ ...rec, data: next });
}

export async function deleteRequirement(user: SessionClaims, id: string, reqId: string) {
  await canStudents(user, "edit");
  const rec = await studentReq(user, id, reqId);
  await drop(user, [rec.id]);
  if (s(rec.data.taskId)) await prisma.requiredTask.deleteMany({ where: { id: s(rec.data.taskId), institutionId: user.institutionId } });
  await stuAudit(user, "Workflows/Requirements", id, "Requirement deleted", { name: rec.data.name }, rec.id);
  return { ok: true };
}

/** Uploading files records a submission; the requirement keeps its status until it is reviewed. */
export async function uploadRequirement(user: SessionClaims, id: string, reqId: string, body: Data) {
  await canStudents(user, "edit");
  const rec = await studentReq(user, id, reqId);
  const view = reqView(rec);
  if (view.dataType !== "Document Required") throw httpError(400, "File uploads apply to Document Required requirements only");
  if (view.allowUpload !== "Yes") throw httpError(400, "Uploads are not allowed for this requirement");
  const files = await fileRefs(user.institutionId, id, body.files);
  if (!files.length) throw httpError(400, "Add at least one file");
  if (files.length > view.maxFiles) throw httpError(400, `This requirement accepts at most ${view.maxFiles} file(s)`);
  const expiryDate = optDate(body.expiryDate, "Expiry Date");
  const now = new Date().toISOString();
  const item: HistoryItem = { at: now, by: user.accountId, status: view.status, action: "Uploaded", files: files.map((f) => ({ id: f.id, name: f.name, size: f.size })), note: "", noteVisible: false, expiryDate };
  const next = { ...rec.data, submission: "Submitted", submittedAt: now, ...(expiryDate ? { expiryDate } : {}), history: [...view.history, item] };
  await save(user, rec.id, next);
  await stuAudit(user, "Workflows/Requirements", id, "Requirement document(s) uploaded", { name: view.name, files: files.map((f) => f.name).join(", "), status: view.status, expiryDate }, rec.id);
  return reqView({ ...rec, data: next });
}

export async function reviewRequirement(user: SessionClaims, id: string, reqId: string, body: Data) {
  await canStudents(user, "edit");
  const rec = await studentReq(user, id, reqId);
  const view = reqView(rec);
  const status = oneOf(body.status, REQ_STATUSES, "Requirement Status");
  const expiryDate = optDate(body.expiryDate, "Expiry Date");
  const note = text(body.note, 4000);
  const item: HistoryItem = { at: new Date().toISOString(), by: user.accountId, status, action: "Reviewed", files: [], note, noteVisible: bool(body.noteVisible), expiryDate };
  const next = { ...rec.data, status, expiryDate, furtherReview: bool(body.furtherReview), history: [...view.history, item] };
  await save(user, rec.id, next);
  if (view.taskId) {
    await prisma.requiredTask.updateMany({
      where: { id: view.taskId, institutionId: user.institutionId },
      data: status === "Approved" ? { status: "completed", completedAt: new Date() } : { status: "pending", completedAt: null },
    });
  }
  await stuAudit(user, "Workflows/Requirements", id, "Requirement reviewed", { name: view.name, status, furtherReview: bool(body.furtherReview), note, noteVisible: bool(body.noteVisible), expiryDate }, rec.id, { status: view.status });
  return reqView({ ...rec, data: next });
}

export async function historyNames(history: HistoryItem[]) {
  const names = await accountNames(history.map((h) => h.by));
  return history.map((h) => ({ ...h, by: names.get(h.by) ?? h.by }));
}

export async function requirementDetail(user: SessionClaims, id: string, reqId: string) {
  const view = await getRequirement(user, id, reqId);
  return { ...view, history: await historyNames(view.history) };
}

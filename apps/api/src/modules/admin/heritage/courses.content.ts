/* Course Management: content repository (manage / push / pull / history), course backups and evaluation assignments & results. */

import { prisma } from "@myheritage/db";
import type { SessionClaims } from "@myheritage/contracts";
import { audit } from "./service.js";
import { ALL_CAMPUSES, ALL_COURSE_TYPES, ENTITIES, type Data } from "./courses.spec.js";
import { S, arr, edit, fileRef, find, httpError, insert, isIsoDate, list, lookups, num, readOverlay, s, settingsOf, softDelete, today, update, view, writeOverlay, type Lookups, type Rec } from "./courses.js";
import { loadSections, sessionRow, sessionWindow } from "./courses.catalog.js";

const page = <T>(rows: T[], p?: number, per?: number) => {
  const perPage = per && per > 0 ? Math.min(per, 200) : 25;
  const pages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(Math.max(1, p ?? 1), pages);
  return { items: rows.slice((current - 1) * perPage, current * perPage), total: rows.length, page: current, pages, perPage };
};

async function personName(user: SessionClaims) {
  const p = await prisma.person.findFirst({ where: { id: user.personId }, select: { givenName: true, familyName: true } });
  return p ? `${p.givenName} ${p.familyName}`.trim() : "System";
}

/* ------------------------------------------------------------------ */
/* Content repository                                                    */
/* ------------------------------------------------------------------ */

type Activity = { id: string; type: string; name: string; body?: string; url?: string; description?: string; fileId?: string; fileName?: string; fileMime?: string; fileSize?: number };
type Topic = { id: string; title: string; summary: string; activities: Activity[] };

const ACTIVITY_TYPES = ["PAGE", "FILE", "FOLDER", "URL", "ASSIGNMENT", "QUIZ", "FORUM", "BOOK", "BIGBLUEBUTTON", "CHAT", "CHECKLIST", "CHOICE", "DATABASE", "EXTERNAL TOOL", "FEEDBACK", "LABEL"];

async function cleanTopics(institutionId: string, raw: unknown): Promise<Topic[]> {
  const out: Topic[] = [];
  for (const [i, t] of arr(raw).slice(0, 60).entries()) {
    const d = (t ?? {}) as Data;
    const title = s(d.title).slice(0, 200);
    if (!title) throw httpError(400, `Section ${i + 1} needs a title`);
    const activities: Activity[] = [];
    for (const [j, a] of arr(d.activities).slice(0, 80).entries()) {
      const x = (a ?? {}) as Data;
      const type = s(x.type).toUpperCase();
      const name = s(x.name).slice(0, 200);
      if (!ACTIVITY_TYPES.includes(type)) throw httpError(400, `${title}: item ${j + 1} has an unknown activity type`);
      if (!name) throw httpError(400, `${title}: item ${j + 1} needs a name`);
      const url = s(x.url).slice(0, 1000);
      if (url && !/^https?:\/\//i.test(url)) throw httpError(400, `${title}: ${name} — the link must start with http:// or https://`);
      const file = type === "FILE" ? await fileRef(institutionId, s(x.fileId)) : null;
      if (type === "FILE" && !file) throw httpError(400, `${title}: ${name} — upload the file again`);
      activities.push({
        id: s(x.id) || `ra-${Date.now().toString(36)}${i}${j}`,
        type,
        name,
        ...(s(x.body) ? { body: s(x.body).slice(0, 20_000) } : {}),
        ...(url ? { url } : {}),
        ...(s(x.description) ? { description: s(x.description).slice(0, 5000) } : {}),
        ...(file ? { fileId: file.id, fileName: file.name, fileMime: file.mime, fileSize: file.size } : {}),
      });
    }
    out.push({ id: s(d.id) || `t-${Date.now().toString(36)}${i}`, title, summary: s(d.summary).slice(0, 4000), activities });
  }
  return out;
}

const topicsOf = (r: Rec) => (arr(r.data.topics) as Topic[]).map((t) => ({ ...t, activities: arr(t.activities) as Activity[] }));

function inScope(rec: Data, campusId: string, typeId: string) {
  const campusOk = rec.campusesMode === ALL_CAMPUSES || arr(rec.campuses).map(s).includes(campusId);
  const typeOk = rec.typesMode === ALL_COURSE_TYPES || arr(rec.types).map(s).includes(typeId);
  return campusOk && typeOk;
}

async function repoLogs(inst: string, repoId?: string) {
  return list(inst, S.repoLog, repoId);
}

export async function repositoryList(user: SessionClaims, f: { course?: string; filter?: string; campus?: string; page?: number; perPage?: number }) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const [repos, logs] = await Promise.all([list(inst, ENTITIES.repository.screen), repoLogs(inst)]);
  const needle = s(f.course).toLowerCase();
  const rows = repos
    .filter((r) => f.filter !== "Default Repositories" || r.data.isDefault === "Yes")
    .filter((r) => !f.campus || r.data.campusesMode === ALL_CAMPUSES || arr(r.data.campuses).map(s).includes(f.campus))
    .map((r) => {
      const course = lk.label("courses", r.data.course);
      const mine = logs.filter((l) => l.contextKey === r.id);
      const topics = topicsOf(r);
      return {
        id: r.id,
        courseId: s(r.data.course),
        course: course || "Course no longer in catalogue",
        name: s(r.data.name),
        lms: `Moodle · ${s(r.data.format) || "Topics"} format`,
        sections: topics.length,
        activities: topics.reduce((n, t) => n + t.activities.length, 0),
        status: r.data.isDefault === "Yes" ? "Default" : "Not Default",
        types: r.data.typesMode === ALL_COURSE_TYPES ? [ALL_COURSE_TYPES] : arr(r.data.types).map((id) => lk.label("courseTypes", id) || "(removed type)"),
        campuses: r.data.campusesMode === ALL_CAMPUSES ? [ALL_CAMPUSES] : arr(r.data.campuses).map((id) => lk.label("campuses", id) || "(removed campus)"),
        push: mine.filter((l) => l.data.action === "push").length,
        pull: mine.filter((l) => l.data.action === "pull").length,
        history: mine.length,
      };
    })
    .filter((r) => !needle || r.course.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle))
    .sort((a, b) => a.course.localeCompare(b.course) || a.name.localeCompare(b.name));
  return page(rows, f.page, f.perPage);
}

export async function repositoryContent(user: SessionClaims, id: string) {
  await view(user);
  const lk = await lookups(user);
  const r = await find(user.institutionId, ENTITIES.repository.screen, id, "Content course");
  return { id: r.id, name: s(r.data.name), course: lk.label("courses", r.data.course), format: s(r.data.format) || "Topics", topics: topicsOf(r), activityTypes: ACTIVITY_TYPES };
}

export async function saveRepositoryContent(user: SessionClaims, id: string, body: Data) {
  await edit(user);
  const r = await find(user.institutionId, ENTITIES.repository.screen, id, "Content course");
  const topics = await cleanTopics(user.institutionId, body.topics);
  await update(user, id, { ...r.data, topics });
  await audit(user, "C11", id, "Updated repository content", { recordId: id, before: { topics: topicsOf(r).length }, after: { topics: topics.length } });
  return { message: `Content saved · ${topics.length} section(s), ${topics.reduce((n, t) => n + t.activities.length, 0)} item(s)` };
}

async function courseSessions(user: SessionClaims, repo: Rec, lk: Lookups) {
  const sections = await loadSections(user.institutionId, { courseId: s(repo.data.course) });
  const ss = await settingsOf(user.institutionId, S.session, sections.map((x) => x.id));
  const typeStyle = new Map((await list(user.institutionId, ENTITIES.types.screen)).map((t) => [t.id, s(t.data.learningStyle)]));
  return sections.map((x) => {
    const st = ss.get(x.id)?.data;
    const row = sessionRow(x, st, lk);
    return { ...row, typeId: s(st?.sessionType), delivery: typeStyle.get(s(st?.sessionType)) || "Not Set", inScope: inScope(repo.data, row.campusId, s(st?.sessionType)) };
  });
}

export async function pushTargets(user: SessionClaims, id: string, method: string) {
  await view(user);
  const lk = await lookups(user);
  const repo = await find(user.institutionId, ENTITIES.repository.screen, id, "Content course");
  const rows = (await courseSessions(user, repo, lk)).filter((r) => r.inScope && r.status !== "Completed").filter((r) => !method || r.delivery === method);
  const methods = [...new Set((await courseSessions(user, repo, lk)).map((r) => r.delivery))].sort();
  return { course: lk.label("courses", repo.data.course), name: s(repo.data.name), methods, items: rows };
}

const repoTag = (repoId: string) => `repo-${repoId.slice(0, 8)}-`;

export async function pushContent(user: SessionClaims, id: string, body: { sectionIds?: string[] }) {
  await edit(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const repo = await find(inst, ENTITIES.repository.screen, id, "Content course");
  const topics = topicsOf(repo);
  if (!topics.length) throw httpError(400, "This content course has no sections yet. Use MANAGE to add content first.");
  const ids = [...new Set((body.sectionIds ?? []).map(s).filter(Boolean))];
  if (!ids.length) throw httpError(400, "Select at least one course session / offering");
  const allowed = new Map((await courseSessions(user, repo, lk)).filter((r) => r.inScope).map((r) => [r.id, r]));
  const bad = ids.filter((x) => !allowed.has(x));
  if (bad.length) throw httpError(400, "One of the selected sessions is not covered by this repository's campuses / course types");
  const tag = repoTag(id);
  const by = await personName(user);
  for (const sectionId of ids) {
    const overlay = await readOverlay(inst, sectionId);
    await insert(user, S.backup, { sectionId, reason: `Before push from ${s(repo.data.name) || "content repository"}`, overlay, by }, sectionId);
    const kept = (arr(overlay.extraTopics) as Data[]).filter((t) => !s(t.id).startsWith(tag));
    const pushed = topics.map((t) => ({
      id: `${tag}${t.id}`,
      title: t.title,
      summary: t.summary,
      activities: t.activities.map((a) => ({ ...a, id: `${tag}${a.id}`, modified: new Date().toUTCString() })),
    }));
    await writeOverlay(inst, sectionId, { ...overlay, extraTopics: [...kept, ...pushed].slice(0, 60) });
  }
  await insert(user, S.repoLog, { action: "push", by, sections: ids.map((x) => `${allowed.get(x)!.courseCode} ${allowed.get(x)!.code}`), topics: topics.length }, id);
  await audit(user, "C13", id, "Pushed repository content", { recordId: id, after: { sectionIds: ids } });
  return { message: `Content pushed to ${ids.length} session(s) / offering(s). A backup of each session was saved first.` };
}

function addedContent(overlay: Data, tag: string) {
  const extra = (arr(overlay.extraTopics) as Data[]).filter((t) => !s(t.id).startsWith("repo-"));
  const perTopic = (overlay.topicActivities && typeof overlay.topicActivities === "object" ? overlay.topicActivities : {}) as Record<string, Data[]>;
  const deleted = new Set(arr(overlay.deletedActivityIds).map(s));
  // Hidden items include staff-only instructor guides with answer keys; they must not be copied to other sessions.
  const hidden = new Set(arr(overlay.hiddenActivityIds).map(s));
  const loose = Object.entries(perTopic)
    .flatMap(([topicId, acts]) => (topicId.startsWith(tag) ? [] : (arr(acts) as Data[])))
    .filter((a) => !deleted.has(s(a.id)) && !hidden.has(s(a.id)) && a.hidden !== true);
  return { extra, loose };
}

export async function pullSources(user: SessionClaims, id: string) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const repo = await find(inst, ENTITIES.repository.screen, id, "Content course");
  const rows = await courseSessions(user, repo, lk);
  const out = [];
  for (const r of rows) {
    const { extra, loose } = addedContent(await readOverlay(inst, r.id), repoTag(id));
    out.push({ ...r, addedTopics: extra.length, addedItems: loose.length + extra.reduce((n, t) => n + arr(t.activities).length, 0) });
  }
  return { course: lk.label("courses", repo.data.course), name: s(repo.data.name), items: out };
}

export async function pullContent(user: SessionClaims, id: string, body: { sectionId?: string }) {
  await edit(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const repo = await find(inst, ENTITIES.repository.screen, id, "Content course");
  const row = (await courseSessions(user, repo, lk)).find((r) => r.id === s(body.sectionId));
  if (!row) throw httpError(400, "Choose a session / offering of this course to pull from");
  const { extra, loose } = addedContent(await readOverlay(inst, row.id), repoTag(id));
  const stamp = Date.now().toString(36);
  const clone = (a: Data, i: number): Activity => ({
    id: `pa-${stamp}-${i}`,
    type: s(a.type).toUpperCase() || "PAGE",
    name: s(a.name) || "Untitled",
    ...(s(a.body) ? { body: s(a.body) } : {}),
    ...(s(a.url) ? { url: s(a.url) } : {}),
    ...(s(a.description) ? { description: s(a.description) } : {}),
    ...(s(a.fileId) ? { fileId: s(a.fileId), fileName: s(a.fileName), fileMime: s(a.fileMime), fileSize: num(a.fileSize) } : {}),
  });
  const fresh: Topic[] = extra.map((t, i) => ({ id: `pt-${stamp}-${i}`, title: s(t.title) || `Section ${i + 1}`, summary: s(t.summary), activities: (arr(t.activities) as Data[]).map((a, j) => clone(a, i * 100 + j)) }));
  if (loose.length) fresh.push({ id: `pt-${stamp}-loose`, title: `Pulled from ${row.courseCode} ${row.code}`, summary: "", activities: loose.map((a, j) => clone(a, 9000 + j)) });
  if (!fresh.length) throw httpError(400, `${row.courseCode} ${row.code} has no instructor-added content to pull`);
  const topics = await cleanTopics(user.institutionId, [...topicsOf(repo), ...fresh]);
  await update(user, id, { ...repo.data, topics });
  const by = await personName(user);
  await insert(user, S.repoLog, { action: "pull", by, sections: [`${row.courseCode} ${row.code}`], topics: fresh.length }, id);
  await audit(user, "C11", id, "Pulled session content into repository", { recordId: id, after: { sectionId: row.id, topics: fresh.length } });
  return { message: `Pulled ${fresh.length} section(s) from ${row.courseCode} ${row.code} into the repository` };
}

export async function repositoryHistory(user: SessionClaims, id: string) {
  await view(user);
  await find(user.institutionId, ENTITIES.repository.screen, id, "Content course");
  const logs = (await repoLogs(user.institutionId, id)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { items: logs.map((l) => ({ id: l.id, at: l.createdAt.toISOString(), action: s(l.data.action) === "pull" ? "Pull" : "Push", by: s(l.data.by) || "System", sections: arr(l.data.sections).map(s), topics: num(l.data.topics) })) };
}

/* ------------------------------------------------------------------ */
/* Course backups                                                        */
/* ------------------------------------------------------------------ */

export async function backupsList(user: SessionClaims, f: { campus?: string; course?: string; term?: string; status?: string; page?: number; perPage?: number }) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const backups = await list(inst, S.backup);
  const sectionIds = [...new Set(backups.map((b) => b.contextKey))];
  const sections = new Map((await loadSections(inst, { id: { in: sectionIds } })).map((x) => [x.id, x]));
  const ss = await settingsOf(inst, S.session, sectionIds);
  const rows = backups
    .map((b) => {
      const x = sections.get(b.contextKey);
      const row = x ? sessionRow(x, ss.get(x.id)?.data, lk) : null;
      return {
        id: b.id,
        available: Boolean(row),
        course: row ? `${row.courseCode} ${row.code}` : "Session no longer exists",
        courseTitle: row?.courseTitle ?? "",
        courseId: row?.courseId ?? "",
        campusId: row?.campusId ?? "",
        termId: row?.termId ?? "",
        term: row?.term ?? "",
        instructors: row?.instructors ?? [],
        backup: s(b.data.reason) || "Course backup",
        by: s(b.data.by) || "System",
        at: b.createdAt.toISOString(),
      };
    })
    .filter((r) => (f.status === "All Backups" ? true : r.available))
    .filter((r) => (!f.campus || r.campusId === f.campus) && (!f.course || r.courseId === f.course) && (!f.term || r.termId === f.term))
    .sort((a, b) => b.at.localeCompare(a.at));
  return page(rows, f.page, f.perPage);
}

/**
 * Restores the exact instructor-course overlay captured before a repository push.
 * The current overlay is backed up first, so an accidental restore is reversible.
 */
export async function restoreBackup(user: SessionClaims, backupId: string) {
  await edit(user);
  const inst = user.institutionId;
  const backup = await find(inst, S.backup, backupId, "Course backup");
  const sectionId = backup.contextKey;
  const section = await prisma.section.findFirst({
    where: { id: sectionId, institutionId: inst },
    include: { course: { select: { code: true } } },
  });
  if (!section) throw httpError(409, "This backup cannot be restored because its session / offering no longer exists", "BACKUP_UNAVAILABLE");

  const saved = backup.data.overlay;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw httpError(409, "This backup does not contain a restorable course snapshot", "BACKUP_INVALID");
  }

  const current = await readOverlay(inst, sectionId);
  const by = await personName(user);
  await insert(
    user,
    S.backup,
    {
      sectionId,
      reason: `Before restoring backup from ${backup.createdAt.toISOString()}`,
      overlay: current,
      by,
      sourceBackupId: backup.id,
    },
    sectionId,
  );
  await writeOverlay(inst, sectionId, saved as Data);
  await audit(user, "C13", backup.id, "Restored course backup", {
    recordId: backup.id,
    after: { sectionId, safetyBackupCreated: true },
  });
  return { message: `${section.course.code} ${section.code} restored. A safety backup of the replaced content was created first.` };
}

/* ------------------------------------------------------------------ */
/* Evaluation assignments & results                                      */
/* ------------------------------------------------------------------ */

const DT_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d/;
const isDateTime = (v: string) => DT_RE.test(v) && isIsoDate(v.slice(0, 10));

function windowOf(body: Data) {
  const from = s(body.availableFrom);
  const to = s(body.availableTo);
  const errors: string[] = [];
  if (!isDateTime(from)) errors.push(from ? "Available From must be a valid date and time" : "Available From Date / Time is required");
  if (!isDateTime(to)) errors.push(to ? "Available To must be a valid date and time" : "Available To Date / Time is required");
  if (!errors.length && to <= from) errors.push("Available To must be after Available From");
  if (errors.length) throw httpError(400, errors.join("; "));
  return { availableFrom: from.slice(0, 16), availableTo: to.slice(0, 16) };
}

async function createAssignment(user: SessionClaims, evaluationId: string, sectionId: string, win: { availableFrom: string; availableTo: string }, auto: boolean) {
  const inst = user.institutionId;
  const x = await prisma.section.findFirst({ where: { id: sectionId, institutionId: inst }, include: { course: true, enrolments: { where: { status: "enrolled" }, select: { studentId: true } } } });
  if (!x) throw httpError(404, "Session / offering not found", "NOT_FOUND");
  const dueAt = new Date(`${win.availableTo}:00`);
  const rows = await prisma.$transaction(
    x.enrolments.map((e) =>
      prisma.courseEvaluation.create({ data: { institutionId: inst, studentId: e.studentId, sectionId: x.id, courseCode: x.course.code, courseTitle: x.course.title, status: "pending", dueAt } }),
    ),
  );
  return insert(user, S.assignment, { evaluationId, sectionId: x.id, ...win, rowIds: rows.map((r) => r.id), auto, releasedAt: null }, evaluationId);
}

export async function assignEvaluation(user: SessionClaims, evaluationId: string, body: Data) {
  await edit(user);
  const inst = user.institutionId;
  const ev = await find(inst, ENTITIES.evaluations.screen, evaluationId, "Evaluation");
  if (ev.data.active === "Inactive") throw httpError(400, "This evaluation is inactive. Set it to Active before assigning it.");
  const sectionId = s(body.sectionId);
  if (!sectionId) throw httpError(400, "Choose a Session / Offering");
  const win = windowOf(body);
  const dup = (await list(inst, S.assignment, evaluationId)).find((a) => s(a.data.sectionId) === sectionId);
  if (dup) throw httpError(409, "This evaluation is already assigned to the selected session / offering", "DUPLICATE");
  const rec = await createAssignment(user, evaluationId, sectionId, win, false);
  await audit(user, "C29", evaluationId, "Assigned evaluation", { recordId: rec.id, after: rec.data });
  return { id: rec.id, message: `"${s(ev.data.title)}" assigned to ${arr(rec.data.rowIds).length} enrolled student(s)` };
}

/** Applies the evaluation's configured auto-assignment / auto-release rules (run whenever results are listed). */
async function sweepEvaluations(user: SessionClaims) {
  const inst = user.institutionId;
  const evals = (await list(inst, ENTITIES.evaluations.screen)).filter((e) => e.data.active !== "Inactive" && (e.data.autoAssign === "Enabled" || e.data.autoRelease === "Enabled"));
  if (!evals.length) return;
  const sections = await loadSections(inst, {});
  const ss = await settingsOf(inst, S.session, sections.map((x) => x.id));
  const assignments = await list(inst, S.assignment);
  const on = today();
  const addDays = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
  for (const ev of evals) {
    if (ev.data.autoAssign === "Enabled") {
      const campuses = arr(ev.data.campuses).map(s);
      const courses = arr(ev.data.courses).map(s);
      for (const x of sections) {
        const st = ss.get(x.id)?.data;
        const w = sessionWindow(x.term, st);
        if (!w.end || w.continuous) continue;
        if (campuses.length && !campuses.includes(s(st?.campus))) continue;
        if (courses.length && !courses.includes(x.courseId)) continue;
        const from = addDays(w.end, -num(ev.data.availabilityDays));
        if (from > on || assignments.some((a) => a.contextKey === ev.id && s(a.data.sectionId) === x.id)) continue;
        const to = addDays(from, Math.max(1, num(ev.data.expiresDays) || 14));
        if (to < on) continue;
        await createAssignment(user, ev.id, x.id, { availableFrom: `${from}T00:00`, availableTo: `${to}T23:59` }, true);
      }
    }
    if (ev.data.autoRelease === "Enabled") {
      for (const a of assignments.filter((y) => y.contextKey === ev.id && !y.data.releasedAt)) {
        const x = sections.find((y) => y.id === s(a.data.sectionId));
        if (!x) continue;
        const w = sessionWindow(x.term, ss.get(x.id)?.data);
        if (w.end && addDays(w.end, num(ev.data.releaseDays)) <= on) await update(user, a.id, { ...a.data, releasedAt: new Date().toISOString(), releasedBy: "Auto-release" });
      }
    }
  }
}

export async function assignedList(user: SessionClaims, f: { evaluation?: string; campus?: string; term?: string; course?: string; page?: number; perPage?: number }) {
  await view(user);
  const inst = user.institutionId;
  await sweepEvaluations(user);
  const lk = await lookups(user);
  const assignments = await list(inst, S.assignment);
  const sectionIds = [...new Set(assignments.map((a) => s(a.data.sectionId)))];
  const sections = new Map((await loadSections(inst, { id: { in: sectionIds } })).map((x) => [x.id, x]));
  const ss = await settingsOf(inst, S.session, sectionIds);
  const allRowIds = assignments.flatMap((a) => arr(a.data.rowIds).map(s));
  const submitted = new Set((await prisma.courseEvaluation.findMany({ where: { id: { in: allRowIds }, status: "submitted" }, select: { id: true } })).map((r) => r.id));
  const rows = assignments
    .map((a) => {
      const x = sections.get(s(a.data.sectionId));
      const row = x ? sessionRow(x, ss.get(x.id)?.data, lk) : null;
      const ids = arr(a.data.rowIds).map(s);
      return {
        id: a.id,
        evaluationId: a.contextKey,
        evaluation: lk.label("evaluations", a.contextKey) || "Evaluation removed",
        session: row ? `${row.courseCode} ${row.code}` : "Session no longer exists",
        courseTitle: row?.courseTitle ?? "",
        courseId: row?.courseId ?? "",
        campusId: row?.campusId ?? "",
        campus: row?.campus ?? "",
        termId: row?.termId ?? "",
        availableFrom: s(a.data.availableFrom),
        availableTo: s(a.data.availableTo),
        assignedAt: a.createdAt.toISOString(),
        auto: a.data.auto === true,
        released: Boolean(a.data.releasedAt),
        totalEnrolled: ids.length,
        totalParticipated: ids.filter((id) => submitted.has(id)).length,
      };
    })
    .filter((r) => (!f.evaluation || r.evaluationId === f.evaluation) && (!f.campus || r.campusId === f.campus) && (!f.term || r.termId === f.term) && (!f.course || r.courseId === f.course))
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
  return page(rows, f.page, f.perPage);
}

export async function editAssignment(user: SessionClaims, id: string, body: Data) {
  await edit(user);
  const a = await find(user.institutionId, S.assignment, id, "Evaluation assignment");
  const win = windowOf(body);
  const ids = arr(a.data.rowIds).map(s);
  await prisma.courseEvaluation.updateMany({ where: { id: { in: ids }, institutionId: user.institutionId, status: "pending" }, data: { dueAt: new Date(`${win.availableTo}:00`) } });
  await update(user, id, { ...a.data, ...win });
  await audit(user, "C30", a.contextKey, "Updated evaluation assignment", { recordId: id, before: { availableFrom: a.data.availableFrom, availableTo: a.data.availableTo }, after: win });
  return { message: "Evaluation assignment saved" };
}

export async function unassignEvaluation(user: SessionClaims, id: string) {
  await edit(user);
  const a = await find(user.institutionId, S.assignment, id, "Evaluation assignment");
  const ids = arr(a.data.rowIds).map(s);
  const removed = await prisma.courseEvaluation.deleteMany({ where: { id: { in: ids }, institutionId: user.institutionId, status: "pending" } });
  await softDelete(user, [id]);
  await audit(user, "C30", a.contextKey, "Unassigned evaluation", { recordId: id, before: a.data });
  return { message: `Evaluation unassigned · ${removed.count} pending response request(s) withdrawn${ids.length - removed.count ? `; ${ids.length - removed.count} submitted response(s) kept on record` : ""}` };
}

export async function evaluationResults(user: SessionClaims, id: string) {
  await view(user);
  const inst = user.institutionId;
  const lk = await lookups(user);
  const a = await find(inst, S.assignment, id, "Evaluation assignment");
  const ev = await find(inst, ENTITIES.evaluations.screen, a.contextKey, "Evaluation").catch(() => null);
  const x = (await loadSections(inst, { id: s(a.data.sectionId) }))[0];
  const row = x ? sessionRow(x, (await settingsOf(inst, S.session, [x.id])).get(x.id)?.data, lk) : null;
  const ids = arr(a.data.rowIds).map(s);
  const rows = await prisma.courseEvaluation.findMany({ where: { id: { in: ids }, status: "submitted" }, orderBy: { submittedAt: "asc" } });
  const parsed = rows.map((r) => {
    try {
      return JSON.parse(r.responsesJson ?? "{}") as Data;
    } catch {
      return {};
    }
  });
  const avg = (vals: number[]) => (vals.length ? Math.round((vals.reduce((n, v) => n + v, 0) / vals.length) * 100) / 100 : null);
  const metric = (k: string) => avg(parsed.map((p) => num(p[k])).filter((v) => v > 0));
  return {
    id: a.id,
    evaluation: s(ev?.data.title) || "Evaluation removed",
    session: row ? `${row.courseCode} ${row.code}` : "Session no longer exists",
    courseTitle: row?.courseTitle ?? "",
    instructors: row?.instructors ?? [],
    availableFrom: s(a.data.availableFrom),
    availableTo: s(a.data.availableTo),
    totalEnrolled: ids.length,
    totalParticipated: rows.length,
    released: Boolean(a.data.releasedAt),
    releasedAt: s(a.data.releasedAt),
    releasedBy: s(a.data.releasedBy),
    summary: rows.length
      ? [
          { label: "Overall rating", value: avg(rows.map((r) => r.overallRating ?? 0).filter((v) => v > 0)) },
          { label: "Teaching quality", value: metric("teachingQuality") },
          { label: "Course materials", value: metric("courseMaterials") },
          { label: "Workload", value: metric("workload") },
        ]
      : [],
    comments: parsed.map((p) => s(p.comments)).filter(Boolean),
  };
}

export async function releaseResults(user: SessionClaims, id: string) {
  await edit(user);
  const a = await find(user.institutionId, S.assignment, id, "Evaluation assignment");
  if (a.data.releasedAt) throw httpError(400, "Results have already been released to the instructor(s)");
  const by = await personName(user);
  await update(user, id, { ...a.data, releasedAt: new Date().toISOString(), releasedBy: by });
  await audit(user, "C30", a.contextKey, "Released evaluation results", { recordId: id });
  return { message: "Results released to the instructor(s)" };
}

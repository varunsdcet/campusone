"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { useNotice } from "@/components/location/shared";
import {
  Actions,
  BASE,
  Btn,
  Confirm,
  Counters,
  Empty,
  FieldGrid,
  Layout,
  Tabs,
  errMsg,
  fmtDate,
  fmtRange,
  fmtTime,
  initialValues,
  missingRequired,
  pm,
  send,
  str,
  useEntityForm,
  useLeaveGuard,
  useMeta,
  weeklyText,
  type Data,
  type Meta,
  type Row,
  type Saved,
} from "./kit";
import { FeesPanel } from "./ProgramTabs";

const SCHED = `${BASE}/scheduling`;
const CRUMB = ["Home", "Program Management", "Master Scheduling"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Summary = { id: string; kind: string; status: string; code: string; name: string; description: string; programId: string; programCode: string; programName: string; termName: string; startDate: string; endDate: string; sessions: number };
type Session = Row & { number: number; offering: string; courseCode: string; courseTitle: string; classroomLabel: string; location: string; instructorNames: string[]; effectiveStart: string; effectiveEnd: string; conflicts: string[] };
type Detail = { schedule: Row & Summary & { removed: number }; sessions: Session[]; counters: Record<string, number>; holidays: Array<{ name: string; date: string }> };

function useDetail(id: string, fail: (m: string) => void) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const load = useCallback(() => {
    if (!id) return;
    pm<Detail>(`/schedules/${id}`)
      .then(setDetail)
      .catch((e) => fail(errMsg(e, "Could not load the schedule")));
  }, [id, fail]);
  useEffect(load, [load]);
  return { detail, load };
}

const courseLink = (s: Session) => `/admin/heritage/lm01?ctx=${encodeURIComponent(`course:${str(s.course)}`)}`;
const category = (code: string) => code.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() ?? "Other";

/* ------------------------------------------------------------------ */
/* Directory                                                            */
/* ------------------------------------------------------------------ */

export function ScheduleDirectory() {
  const router = useRouter();
  const sp = useSearchParams();
  const notice = useNotice();
  const { ok, fail } = notice;
  const { meta } = useMeta();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [program, setProgram] = useState(sp?.get("program") ?? "");
  const [copy, setCopy] = useState<Summary | null>(null);
  const [del, setDel] = useState<Summary | null>(null);
  const load = useCallback(() => {
    pm<{ items: Summary[] }>("/schedules")
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load schedules")));
  }, [fail]);
  useEffect(load, [load]);
  const shown = (rows ?? []).filter((r) => !program || r.programId === program);
  const manage = (r: Summary) => (r.kind === "term" && r.status === "draft" ? `${SCHED}/review?id=${r.id}` : `${SCHED}/manage?id=${r.id}`);
  return (
    <SuperFrame
      title="Master Scheduling"
      breadcrumbs={CRUMB}
      activeHref={SCHED}
      actions={
        <>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${SCHED}/master-new${program ? `?program=${program}` : ""}`}>
            Create Master Schedule
          </Link>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${SCHED}/term-new`}>
            Create Term Schedule
          </Link>
        </>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          <label className="mh-sa__field pm-inline-field">
            <span className="mh-sa__label">Filter Programs</span>
            <select className="mh-sa__input" value={program} onChange={(e) => setProgram(e.target.value)}>
              <option value="">All Programs</option>
              {(meta?.programs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.abbreviation ? `${p.abbreviation} — ` : ""}
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Program Schedule Dates</th>
                    <th>Program</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div>{fmtRange(r.startDate, r.endDate)}</div>
                        <div className="mh-sa__muted lx-sub">
                          {r.code}
                          {r.description ? ` — ${r.description}` : ""} · {r.sessions} session{r.sessions === 1 ? "" : "s"}
                          {r.status === "draft" ? <span className="pm-status pm-status--off"> Draft</span> : null}
                        </div>
                      </td>
                      <td>{r.kind === "term" ? `Term Schedule: ${r.termName}` : `${r.programCode} — ${r.programName}`}</td>
                      <td className="lx-actions">
                        <Btn onClick={() => router.push(manage(r))}>Manage</Btn>
                        <Btn onClick={() => setCopy(r)}>Copy</Btn>
                        <Btn tone="danger" onClick={() => setDel(r)}>
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={3} className="mh-sa__empty-cell">
                        {program ? "No master schedules exist for this program." : "No master or term schedules have been created yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {copy && meta ? (
          <CopySchedule
            source={copy}
            meta={meta}
            onClose={() => setCopy(null)}
            onDone={(out) => {
              setCopy(null);
              router.push(`${out.kind === "term" ? `${SCHED}/review` : `${SCHED}/manage`}?id=${out.id}&notice=${encodeURIComponent(out.message)}`);
            }}
          />
        ) : null}
        {del ? (
          <Confirm
            title={`Delete Schedule: ${del.code}`}
            body={`Delete the ${del.kind === "term" ? "term" : "master"} schedule "${del.code}" with its ${del.sessions} session(s) and schedule fees? Unused linked course offerings will also be removed. If students, course content or academic history depend on an offering, deletion will stop and explain what must be resolved first.`}
            okLabel="Delete Schedule"
            onCancel={() => setDel(null)}
            onOk={() => {
              const r = del;
              setDel(null);
              send(`/e/${r.kind === "term" ? "termSchedules" : "programSchedules"}/${r.id}`, "DELETE")
                .then((out) => {
                  ok(out.message);
                  load();
                })
                .catch((e) => fail(errMsg(e, "Delete failed")));
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

function CopySchedule({ source, meta, onClose, onDone }: { source: Summary; meta: Meta; onClose: () => void; onDone: (out: Saved & { kind?: string }) => void }) {
  const term = source.kind === "term";
  const [abbreviation, setAbbreviation] = useState(term ? "" : `${source.code}-COPY`);
  const [description, setDescription] = useState(source.description);
  const [termId, setTermId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (term ? !termId : !abbreviation.trim()) return setError(term ? "Please select the Term for the copy" : "Please enter a Schedule Abbreviation");
    setBusy(true);
    send<Saved & { kind?: string }>(`/schedules/${source.id}/copy`, "POST", term ? { term: termId, description } : { abbreviation, description })
      .then(onDone)
      .catch((e) => setError(errMsg(e, "Copy failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title={`Copy Schedule: ${source.code}`}
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={submit}>
          Copy Schedule
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <p className="mh-sa__muted">Sessions and schedule fees are copied.{term ? " Session dates move with the new term; the copy starts as a draft for review and confirmation." : ""}</p>
      {term ? (
        <label className="mh-sa__field">
          <span className="mh-sa__label">
            Term<span className="lx-req">*</span>
          </span>
          <select className="mh-sa__input" value={termId} onChange={(e) => setTermId(e.target.value)}>
            <option value="">— Select —</option>
            {meta.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} ({fmtRange(t.startDate, t.endDate)})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="mh-sa__field">
          <span className="mh-sa__label">
            Schedule Abbreviation<span className="lx-req">*</span>
          </span>
          <input className="mh-sa__input" value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
        </label>
      )}
      <label className="mh-sa__field">
        <span className="mh-sa__label">Schedule Description</span>
        <input className="mh-sa__input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: Create Master Schedule / Create Term Schedule                */
/* ------------------------------------------------------------------ */

function Step1({ entity, title, groups, next }: { entity: "programSchedules" | "termSchedules"; title: string; groups: Array<[string, string[]]>; next: (id: string, message: string) => string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = entity === "termSchedules" ? sp?.get("id") || null : null;
  const program = sp?.get("program") ?? "";
  const notice = useNotice();
  const form = useEntityForm(entity, id, { defaults: program ? { program } : undefined });
  const inFlight = useRef(false);
  const [leaving, setLeaving] = useState(false);
  useLeaveGuard(form.dirty && !form.busy && !leaving);
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, "Step 1 of 3"]} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          if (inFlight.current) return;
          inFlight.current = true;
          form
            .save()
            .then((out) => {
              setLeaving(true);
              notice.ok(`${out.message || "Saved."} Opening the next step…`);
              router.push(next(out.id ?? id ?? "", out.message));
            })
            .catch((err) => {
              inFlight.current = false;
              notice.fail(errMsg(err, "Save failed"));
            });
        }}
      >
        {form.metaError || form.loadError ? <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice> : null}
        {notice.node}
        {form.values && form.meta ? <Layout groups={groups} fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} /> : <p className="mh-sa__muted">Loading…</p>}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={SCHED}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || leaving || !form.values}>
            {form.busy ? "Saving…" : leaving ? "Opening…" : "Continue"}
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

export function MasterStep1() {
  return (
    <Step1
      entity="programSchedules"
      title="Create Master Schedule — Step 1 of 3"
      groups={[
        ["Master Schedule Details", ["program", "abbreviation", "description", "length", "lengthUnit", "fullTimeCalc", "fullTimeMin", "alwaysFullTime"]],
        ["Enrolment Conditions", ["enrolmentLimit", "enrolmentLimitValue"]],
        ["Course Delivery Settings", ["enableLms", "studentAvailability", "facultyAvailability", "holidays", "attendanceGrading"]],
      ]}
      next={(id, message) => `${SCHED}/manage?id=${id}&notice=${encodeURIComponent(message)}`}
    />
  );
}

export function TermStep1() {
  return (
    <Step1
      entity="termSchedules"
      title="Create Term Schedule — Step 1 of 3"
      groups={[
        ["Master Schedule Details", ["term", "description"]],
        ["Course Delivery Settings", ["enableLms", "studentAvailability", "facultyAvailability", "attendanceGrading"]],
      ]}
      next={(id) => `${SCHED}/review?id=${id}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Course blocks (Step 2, Step 3, Manage Term Schedule)                 */
/* ------------------------------------------------------------------ */

type Filter = { course: string; category: string; method: string; faculty: string };
const NO_FILTER: Filter = { course: "", category: "", method: "", faculty: "" };

function applyFilter(sessions: Session[], f: Filter) {
  return sessions.filter(
    (s) =>
      (!f.course || s.course === f.course) &&
      (!f.category || category(s.courseCode) === f.category) &&
      (!f.method || s.deliveryMethod === f.method) &&
      (!f.faculty || (Array.isArray(s.instructors) && (s.instructors as string[]).includes(f.faculty))),
  );
}

function Filters({ sessions, meta, onApply }: { sessions: Session[]; meta: Meta; onApply: (f: Filter) => void }) {
  const [f, setF] = useState<Filter>(NO_FILTER);
  const courses = [...new Map(sessions.map((s) => [str(s.course), `${s.courseCode} ${s.courseTitle}`])).entries()];
  const cats = [...new Set(sessions.map((s) => category(s.courseCode)))].sort();
  const sel = (key: keyof Filter, label: string, all: string, opts: Array<[string, string]>) => (
    <label className="mh-sa__field">
      <span className="mh-sa__label">{label}</span>
      <select className="mh-sa__input" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
        <option value="">{all}</option>
        {opts.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="pm-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(f);
      }}
    >
      {sel("course", "Search Courses", "All Courses", courses)}
      {sel(
        "category",
        "Course Category",
        "All Categories",
        cats.map((c) => [c, c]),
      )}
      {sel(
        "method",
        "Delivery Method",
        "All Methods",
        ["Not Set", "Lecture", "Online"].map((m) => [m, m]),
      )}
      {sel(
        "faculty",
        "Faculty",
        "All Faculty / Instructors",
        meta.staff.map((p) => [p.id, p.label]),
      )}
      <button type="submit" className="mh-sa__btn">
        Apply Filter
      </button>
    </form>
  );
}

function CourseBlocks({ sessions, collapsed, onEdit, onDelete, showStatus }: { sessions: Session[]; collapsed?: boolean; onEdit?: (s: Session) => void; onDelete?: (s: Session) => void; showStatus?: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, Session[]>();
    for (const s of sessions) m.set(str(s.course), [...(m.get(str(s.course)) ?? []), s]);
    return [...m.values()];
  }, [sessions]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!sessions.length) return <Empty>No scheduled courses were found.</Empty>;
  return (
    <div className="pm-blocks">
      {groups.map((list) => {
        const first = list[0]!;
        const key = str(first.course);
        const isOpen = open[key] ?? !collapsed;
        const conflicts = list.filter((s) => s.conflicts.length).length;
        return (
          <div key={key} className="pm-block">
            <button type="button" className="pm-block__head" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [key]: !isOpen })}>
              <span className="pm-block__caret">{isOpen ? "▾" : "▸"}</span>
              <strong>{first.courseCode}</strong> {first.courseTitle}
              <span className="mh-sa__muted">
                {" "}
                · {list.length} session{list.length === 1 ? "" : "s"}
              </span>
              {conflicts ? <span className="pm-conflict">⚠ {conflicts} conflict{conflicts === 1 ? "" : "s"}</span> : null}
            </button>
            {isOpen ? (
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table lx-table pm-grid">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Batch</th>
                      <th>Location</th>
                      <th>Method</th>
                      <th>Instructor(s)</th>
                      {DAYS.map((d) => (
                        <th key={d}>{d.slice(0, 3).toUpperCase()}</th>
                      ))}
                      {onEdit || onDelete ? <th className="lx-actions" aria-label="Actions" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((s) => {
                      const w = (s.weekly ?? {}) as Record<string, { start: string; end: string }>;
                      const any = DAYS.some((d) => w[d]?.start);
                      return (
                        <tr key={s.id} className={s.conflicts.length ? "pm-row--conflict" : undefined}>
                          <td>
                            {s.offering}
                            {showStatus && s._status === "pending" ? <span className="pm-status pm-status--off"> {s._origin === "copied" ? "Copied" : "New"}</span> : null}
                            {showStatus && s._changed ? <span className="pm-status pm-status--off"> Changed</span> : null}
                            {s.conflicts.map((c) => (
                              <div key={c} className="pm-conflict-msg">
                                ⚠ {c}
                              </div>
                            ))}
                          </td>
                          <td>{str(s.classPeriod) || "Morning"}</td>
                          <td>{s.location || "Not Set"}</td>
                          <td>{str(s.deliveryMethod) || "Not Set"}</td>
                          <td>{s.instructorNames.join(", ") || "—"}</td>
                          {any ? (
                            DAYS.map((d) => <td key={d}>{w[d]?.start ? `${fmtTime(w[d]!.start)}–${fmtTime(w[d]!.end)}` : ""}</td>)
                          ) : (
                            <td colSpan={7} className="pm-tbd">
                              TBD
                            </td>
                          )}
                          {onEdit || onDelete ? (
                            <td className="lx-actions">
                              {onEdit ? <Btn onClick={() => onEdit(s)}>Edit</Btn> : null}
                              {onDelete ? (
                                <Btn tone="danger" onClick={() => onDelete(s)}>
                                  <span aria-hidden>🗑</span> <span className="pm-sr">Delete session {s.offering}</span>
                                </Btn>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Popups: Add Course & Session(s), Bulk Actions                         */
/* ------------------------------------------------------------------ */

function useProgramCourses(scheduleId: string) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    pm<{ programCourseIds: string[] }>(`/schedules/${scheduleId}/courses`).then((r) => setIds(r.programCourseIds), () => setIds([]));
  }, [scheduleId]);
  return ids;
}

function CourseSelect({ value, onChange, meta, programIds, id = "pm-course" }: { value: string; onChange: (v: string) => void; meta: Meta; programIds: string[]; id?: string }) {
  const program = meta.courses.filter((c) => programIds.includes(c.id));
  const rest = meta.courses.filter((c) => !programIds.includes(c.id));
  return (
    <select id={id} className="mh-sa__input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select Course —</option>
      {program.length ? (
        <>
          <optgroup label="PROGRAM SPECIFIC COURSES">
            {program.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="ALL OTHER COURSES">
            {rest.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        </>
      ) : (
        rest.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))
      )}
    </select>
  );
}

function AddCourseSessions({ scheduleId, meta, onClose, onDone }: { scheduleId: string; meta: Meta; onClose: () => void; onDone: (out: Saved) => void }) {
  const programIds = useProgramCourses(scheduleId);
  const fields = useMemo(() => (meta.entities.sessions?.fields ?? []).filter((f) => ["campus", "classroom", "deliveryMethod", "instructors"].includes(f.key)), [meta]);
  const [values, setValues] = useState<Data>(() => ({ ...initialValues(fields), course: "", count: "1" }));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!values.course) return setError("Please select a course");
    setBusy(true);
    send(`/schedules/${scheduleId}/sessions`, "POST", { ...values, count: Number(values.count) })
      .then(onDone)
      .catch((e) => setError(errMsg(e, "Could not add sessions")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title="Add Course & Session(s)"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={submit}>
          Add Course & Session(s)
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <div className="pm-modal-section">
        <h3>Add Course</h3>
        <div className="mh-sa__grid lx-grid">
          <div className="mh-sa__field">
            <label className="mh-sa__label" htmlFor="pm-add-course">
              Select Course<span className="lx-req">*</span>
            </label>
            <CourseSelect id="pm-add-course" value={str(values.course)} onChange={(v) => setValues({ ...values, course: v })} meta={meta} programIds={programIds} />
          </div>
          <div className="mh-sa__field">
            <label className="mh-sa__label" htmlFor="pm-add-count">
              Number of Sessions
            </label>
            <select id="pm-add-count" className="mh-sa__input" value={str(values.count)} onChange={(e) => setValues({ ...values, count: e.target.value })}>
              {Array.from({ length: 20 }, (_, i) => String(i + 1)).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="pm-modal-section">
        <h3>Session Settings</h3>
        <FieldGrid fields={fields} values={values} setValue={(k, v) => setValues((s) => ({ ...s, [k]: v, ...(k === "campus" ? { classroom: "" } : {}) }))} meta={meta} />
      </div>
    </SaModal>
  );
}

const BULK_FIELDS: Record<string, string[]> = {
  "Change Dates": ["startDate", "endDate"],
  "Course Size / Limit": ["maxEnrolments"],
  "Delivery Method": ["deliveryMethod"],
  "LMS / Import Options": ["enableLms"],
  "Grading Scheme": ["gradingScheme"],
  "Instructor(s)": ["instructors"],
  "Location / Room": ["campus", "classroom"],
  "Wait List Settings": ["waitlist", "waitlistSize"],
};

function BulkActions({ scheduleId, sessions, meta, onClose, onDone }: { scheduleId: string; sessions: Session[]; meta: Meta; onClose: () => void; onDone: (out: Saved) => void }) {
  const [cat, setCat] = useState("");
  const [ids, setIds] = useState<string[]>(sessions.map((s) => s.id));
  const fields = useMemo(() => (meta.entities.sessions?.fields ?? []).filter((f) => (BULK_FIELDS[cat] ?? []).includes(f.key)).map((f) => ({ ...f, section: undefined })), [meta, cat]);
  const [values, setValues] = useState<Data>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValues(initialValues(fields)), [fields]);
  const submit = () => {
    if (!cat) return setError("Choose a Bulk Updates category");
    if (!ids.length) return setError("Select at least one session");
    const missing = missingRequired(fields, values);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    setBusy(true);
    send(`/schedules/${scheduleId}/bulk`, "POST", { category: cat, sessionIds: ids, values })
      .then(onDone)
      .catch((e) => setError(errMsg(e, "Bulk update failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title="Bulk Actions"
      onClose={onClose}
      wide
      footer={
        cat ? (
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={submit}>
            Apply Update
          </button>
        ) : undefined
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <label className="mh-sa__field">
        <span className="mh-sa__label">Bulk Updates</span>
        <select className="mh-sa__input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">— Select —</option>
          {meta.bulkCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {cat ? (
        <>
          <div className="pm-modal-section">
            <h3>{cat}</h3>
            <FieldGrid fields={fields} values={values} setValue={(k, v) => setValues((s) => ({ ...s, [k]: v, ...(k === "campus" ? { classroom: "" } : {}) }))} meta={meta} />
          </div>
          <div className="pm-modal-section">
            <h3>
              Sessions ({ids.length} of {sessions.length} selected)
            </h3>
            <label className="mh-sa__check">
              <input type="checkbox" checked={ids.length === sessions.length} onChange={(e) => setIds(e.target.checked ? sessions.map((s) => s.id) : [])} /> Select all
            </label>
            <div className="pm-session-checks">
              {sessions.map((s) => (
                <label key={s.id} className="mh-sa__check">
                  <input type="checkbox" checked={ids.includes(s.id)} onChange={(e) => setIds(e.target.checked ? [...ids, s.id] : ids.filter((x) => x !== s.id))} /> {s.courseCode} {s.offering}
                </label>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 / Step 3 (term schedule wizard)                               */
/* ------------------------------------------------------------------ */

export function TermStep2() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const notice = useNotice();
  const { ok, fail } = notice;
  const { meta } = useMeta();
  const { detail, load } = useDetail(id, fail);
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [modal, setModal] = useState<null | "add" | { del: Session }>(null);
  const done = (out: Saved) => {
    setModal(null);
    ok(out.message);
    load();
  };
  return (
    <SuperFrame title="Review / Manage Course Sections" breadcrumbs={[...CRUMB, "Step 2 of 3"]} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
      <div className="lx">
        {notice.node}
        {detail ? (
          <p className="mh-sa__muted">
            Step 2 of 3 · Term: <strong>{detail.schedule.termName}</strong> ({fmtRange(detail.schedule.startDate, detail.schedule.endDate)})
          </p>
        ) : null}
        <section className="mh-sa__card">
          <div className="pm-toolbar">
            {detail && meta ? <Filters sessions={detail.sessions} meta={meta} onApply={setFilter} /> : null}
            <Btn tone="primary" small={false} onClick={() => setModal("add")}>
              Add Course / Sessions
            </Btn>
          </div>
          {!detail ? <p className="mh-sa__muted">Loading…</p> : <CourseBlocks sessions={applyFilter(detail.sessions, filter)} showStatus onEdit={(s) => router.push(`${SCHED}/session?id=${s.id}`)} onDelete={(s) => setModal({ del: s })} />}
        </section>
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={`${SCHED}/term-new?id=${id}`}>
            Back
          </Link>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${SCHED}/confirm?id=${id}`}>
            Continue
          </Link>
        </div>
      </div>
      {modal === "add" && meta ? <AddCourseSessions scheduleId={id} meta={meta} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal && typeof modal === "object" ? <DeleteSession session={modal.del} onCancel={() => setModal(null)} onDone={done} onFail={(m) => (setModal(null), fail(m))} /> : null}
    </SuperFrame>
  );
}

function DeleteSession({ session, onCancel, onDone, onFail }: { session: Session; onCancel: () => void; onDone: (out: Saved) => void; onFail: (m: string) => void }) {
  return (
    <Confirm
      title={`Delete Session: ${session.courseCode} ${session.offering}`}
      body={`Delete session ${session.offering} of ${session.courseCode} ${session.courseTitle}?`}
      okLabel="Delete Session"
      onCancel={onCancel}
      onOk={() =>
        send(`/e/sessions/${session.id}`, "DELETE")
          .then(onDone)
          .catch((e) => onFail(errMsg(e, "Delete failed")))
      }
    />
  );
}

export function TermStep3() {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const notice = useNotice();
  const { detail } = useDetail(id, notice.fail);
  const [busy, setBusy] = useState(false);
  const c = detail?.counters;
  return (
    <SuperFrame title="Confirm Term Schedule" breadcrumbs={[...CRUMB, "Step 3 of 3"]} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
      <div className="lx">
        {notice.node}
        {!detail || !c ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Schedule Details</h2>
              </div>
              <dl className="pm-dl">
                <dt>Scheduled Term</dt>
                <dd>
                  {detail.schedule.termName} ({fmtRange(detail.schedule.startDate, detail.schedule.endDate)})
                </dd>
                <dt>Schedule Description</dt>
                <dd>{detail.schedule.description || "—"}</dd>
                <dt>Enable LMS</dt>
                <dd>{str(detail.schedule.enableLms) || "Disabled"}</dd>
              </dl>
            </section>
            <Counters
              items={[
                ["Total Courses", c.totalCourses ?? 0],
                ["Total Sessions", c.totalSessions ?? 0],
                ["New Sessions", c.newSessions ?? 0],
                ["Copied Sessions", c.copiedSessions ?? 0],
                ["Removed Sessions", c.removedSessions ?? 0],
              ]}
            />
            <section className="mh-sa__card">
              <CourseBlocks sessions={detail.sessions} collapsed showStatus />
            </section>
          </>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={`${SCHED}/review?id=${id}`}>
            Back
          </Link>
          <button
            type="button"
            className="mh-sa__btn mh-sa__btn--primary"
            disabled={busy || !detail}
            onClick={() => {
              setBusy(true);
              send(`/schedules/${id}/confirm`, "POST")
                .then((out) => router.push(`${SCHED}/manage?id=${id}&notice=${encodeURIComponent(out.message)}`))
                .catch((e) => notice.fail(errMsg(e, "Could not confirm the schedule")))
                .finally(() => setBusy(false));
            }}
          >
            Confirm Schedule
          </button>
        </div>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Manage (term schedule or program master schedule)                    */
/* ------------------------------------------------------------------ */

export function ManageSchedule() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const notice = useNotice();
  const { detail, load } = useDetail(id, notice.fail);
  if (!detail)
    return (
      <SuperFrame title="Schedule" breadcrumbs={CRUMB} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
        <div className="lx">
          {notice.node}
          <p className="mh-sa__muted">Loading…</p>
        </div>
      </SuperFrame>
    );
  return detail.schedule.kind === "term" ? <TermManage detail={detail} reload={load} notice={notice} /> : <ProgramManage detail={detail} reload={load} notice={notice} />;
}

type ManageProps = { detail: Detail; reload: () => void; notice: ReturnType<typeof useNotice> };

function TermManage({ detail, reload, notice }: ManageProps) {
  const router = useRouter();
  const { meta } = useMeta();
  const [filter, setFilter] = useState<Filter>(NO_FILTER);
  const [modal, setModal] = useState<null | "add" | "bulk" | { del: Session }>(null);
  const s = detail.schedule;
  const c = detail.counters;
  const done = (out: Saved) => {
    setModal(null);
    notice.ok(out.message);
    reload();
  };
  const pending = (c.pendingSessions ?? 0) + (c.pendingChanges ?? 0) + (c.removedSessions ?? 0);
  return (
    <SuperFrame title={`Term Schedule: ${s.termName} (${fmtRange(s.startDate, s.endDate)})`} breadcrumbs={[...CRUMB, s.termName]} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
      <div className="lx">
        {notice.node}
        <Counters
          items={[
            ["Total Courses", c.totalCourses ?? 0],
            ["Total Sessions", c.totalSessions ?? 0],
            ["Conflicts", c.conflicts ?? 0, c.conflicts ? "bad" : undefined],
            ["Pending Sessions", c.pendingSessions ?? 0, c.pendingSessions ? "warn" : undefined],
            ["Pending Changes", c.pendingChanges ?? 0, c.pendingChanges ? "warn" : undefined],
            ["Active Sessions", c.activeSessions ?? 0],
          ]}
        />
        {pending || s.status === "draft" ? (
          <p className="pm-warn">
            {s.status === "draft" ? "This term schedule has not been confirmed yet." : "Some sessions or changes are pending confirmation."}{" "}
            <Link className="mh-sa__link" href={`${SCHED}/confirm?id=${s.id}`}>
              Review & Confirm
            </Link>
          </p>
        ) : null}
        <section className="mh-sa__card">
          <div className="pm-toolbar">
            {meta ? <Filters sessions={detail.sessions} meta={meta} onApply={setFilter} /> : null}
            <Actions>
              <Btn tone="primary" small={false} onClick={() => setModal("add")}>
                Add Course Session
              </Btn>
              <Btn small={false} onClick={() => setModal("bulk")} disabled={!detail.sessions.length}>
                Bulk Actions
              </Btn>
            </Actions>
          </div>
          <CourseBlocks sessions={applyFilter(detail.sessions, filter)} showStatus onEdit={(x) => router.push(`${SCHED}/session?id=${x.id}`)} onDelete={(x) => setModal({ del: x })} />
        </section>
      </div>
      {modal === "add" && meta ? <AddCourseSessions scheduleId={s.id} meta={meta} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal === "bulk" && meta ? <BulkActions scheduleId={s.id} sessions={detail.sessions} meta={meta} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal && typeof modal === "object" ? <DeleteSession session={modal.del} onCancel={() => setModal(null)} onDone={done} onFail={(m) => (setModal(null), notice.fail(m))} /> : null}
    </SuperFrame>
  );
}

const MANAGE_TABS: Array<[string, string]> = [
  ["outline", "Schedule Outline"],
  ["fees", "Fees & Tuition Price List"],
  ["settings", "Settings & Conditions"],
];

function ProgramManage({ detail, reload, notice }: ManageProps) {
  const sp = useSearchParams();
  const tab = sp?.get("tab") || "outline";
  const s = detail.schedule;
  const c = detail.counters;
  return (
    <SuperFrame title={`Schedule: ${s.programName}`} breadcrumbs={[...CRUMB, s.code]} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
      <div className="lx">
        {notice.node}
        <p className="mh-sa__muted">
          <strong>{s.code}</strong>
          {s.description ? ` — ${s.description}` : ""} · {fmtRange(s.startDate, s.endDate)}
        </p>
        <Counters
          items={[
            ["Total Courses", c.totalCourses ?? 0],
            ["Total Sessions", c.totalSessions ?? 0],
            ["Conflicts", c.conflicts ?? 0, c.conflicts ? "bad" : undefined],
            ["Enrolled Students", c.enrolledStudents ?? 0],
          ]}
        />
        <Tabs tabs={MANAGE_TABS} active={tab} hrefOf={(k) => `${SCHED}/manage?id=${s.id}&tab=${k}`} />
        {tab === "outline" ? <Outline detail={detail} reload={reload} notice={notice} /> : null}
        {tab === "fees" ? <FeesPanel parentId={s.id} termEntity="scheduleFeeTerms" feeEntity="scheduleFees" amountLabel="Fees" empty="No ledger or tuition types currently exist for this schedule." /> : null}
        {tab === "settings" ? <ScheduleSettings id={s.id} onSaved={reload} /> : null}
      </div>
    </SuperFrame>
  );
}

function Outline({ detail, reload, notice }: ManageProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const { meta } = useMeta();
  const view = sp?.get("view") === "calendar" ? "calendar" : "standard";
  const [modal, setModal] = useState<null | "bulk" | { del: Session }>(null);
  const s = detail.schedule;
  const done = (out: Saved) => {
    setModal(null);
    notice.ok(out.message);
    reload();
  };
  const viewHref = (v: string) => `${SCHED}/manage?id=${s.id}&tab=outline${v === "calendar" ? "&view=calendar" : ""}`;
  return (
    <section className="mh-sa__card">
      <div className="pm-toolbar pm-toolbar--end">
        <Actions>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${SCHED}/session?schedule=${s.id}`}>
            Add Session
          </Link>
          {view === "standard" ? (
            <Btn small={false} onClick={() => setModal("bulk")} disabled={!detail.sessions.length}>
              Bulk Actions
            </Btn>
          ) : null}
          <Link className="mh-sa__btn" href={viewHref(view === "standard" ? "calendar" : "standard")}>
            {view === "standard" ? "Calendar View" : "Standard View"}
          </Link>
        </Actions>
      </div>
      {view === "calendar" ? (
        <CalendarView detail={detail} />
      ) : !detail.sessions.length ? (
        <Empty>No sessions have been scheduled yet. Click Add Session to create one.</Empty>
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Batch</th>
                <th>Faculty</th>
                <th>Room</th>
                <th>Dates</th>
                <th>Schedule</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {detail.sessions.map((x) => (
                <tr key={x.id} className={x.conflicts.length ? "pm-row--conflict" : undefined}>
                  <td>
                    <strong>{x.courseCode}</strong> {x.courseTitle}
                    <div className="mh-sa__muted lx-sub">
                      {x.offering}
                      {str(x.sessionName) ? ` · ${str(x.sessionName)}` : ""}
                    </div>
                    {x.conflicts.map((m) => (
                      <div key={m} className="pm-conflict-msg">
                        ⚠ {m}
                      </div>
                    ))}
                  </td>
                  <td>{str(x.classPeriod) || "Morning"}</td>
                  <td>{x.instructorNames.join(", ") || "—"}</td>
                  <td>{x.location || "Not Set"}</td>
                  <td>{fmtRange(x.effectiveStart, x.effectiveEnd)}</td>
                  <td className="pm-weekly-text">{weeklyText(x.weekly)}</td>
                  <td className="lx-actions">
                    <Link className="mh-sa__btn mh-sa__btn--sm" href={courseLink(x)}>
                      View
                    </Link>
                    <Btn onClick={() => router.push(`${SCHED}/session?id=${x.id}`)}>Edit</Btn>
                    <Btn tone="danger" onClick={() => setModal({ del: x })}>
                      Delete
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal === "bulk" && meta ? <BulkActions scheduleId={s.id} sessions={detail.sessions} meta={meta} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal && typeof modal === "object" ? <DeleteSession session={modal.del} onCancel={() => setModal(null)} onDone={done} onFail={(m) => (setModal(null), notice.fail(m))} /> : null}
    </section>
  );
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendarView({ detail }: { detail: Detail }) {
  const start = detail.schedule.startDate || iso(new Date());
  const [month, setMonth] = useState(start.slice(0, 7));
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = new Date(y, m - 1, 1);
  const cells: Array<Date | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => new Date(y, m - 1, i + 1))];
  while (cells.length % 7) cells.push(null);
  const months = useMemo(() => {
    const out: string[] = [];
    const base = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1 - 6, 1);
    for (let i = 0; i < 30; i++) out.push(iso(new Date(base.getFullYear(), base.getMonth() + i, 1)).slice(0, 7));
    return out.includes(month) ? out : [month, ...out];
  }, [start, month]);
  const shift = (n: number) => setMonth(iso(new Date(y, m - 1 + n, 1)).slice(0, 7));
  const courses = [...new Set(detail.sessions.map((s) => str(s.course)))];
  const undated = detail.sessions.filter((s) => !s.effectiveStart || !s.effectiveEnd).length;
  const eventsOn = (d: Date) => {
    const day = iso(d);
    const name = DAYS[d.getDay()]!;
    const out: ReactNode[] = [];
    for (const h of detail.holidays.filter((x) => x.date.slice(0, 10) === day))
      out.push(
        <div key={`h-${h.name}`} className="pm-cal__event pm-cal__event--holiday">
          {h.name}
        </div>,
      );
    for (const s of detail.sessions) {
      const w = (s.weekly ?? {}) as Record<string, { start: string; end: string }>;
      if (!w[name]?.start || !s.effectiveStart || !s.effectiveEnd || day < s.effectiveStart || day > s.effectiveEnd) continue;
      out.push(
        <div key={s.id} className={`pm-cal__event pm-cal__c${courses.indexOf(str(s.course)) % 8}`} title={`${s.courseCode} ${s.courseTitle}`}>
          <strong>
            {s.courseCode} {s.offering}
          </strong>
          <span>{s.courseTitle}</span>
          <span>
            {fmtTime(w[name]!.start)}–{fmtTime(w[name]!.end)}
          </span>
        </div>,
      );
    }
    return out;
  };
  return (
    <div className="pm-cal">
      <div className="pm-cal__bar">
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => shift(-1)} aria-label="Previous month">
          ‹
        </button>
        <select className="mh-sa__input" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((mm) => (
            <option key={mm} value={mm}>
              {new Date(Number(mm.slice(0, 4)), Number(mm.slice(5, 7)) - 1, 1).toLocaleDateString("en-CA", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => shift(1)} aria-label="Next month">
          ›
        </button>
        {undated ? <span className="mh-sa__muted">{undated} session(s) without dates are not shown.</span> : null}
      </div>
      <div className="pm-cal__grid" role="grid">
        {DAYS.map((d) => (
          <div key={d} className="pm-cal__dow" role="columnheader">
            {d}
          </div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className={`pm-cal__cell${d ? "" : " is-blank"}`} role="gridcell">
            {d ? (
              <>
                <span className="pm-cal__num">{d.getDate()}</span>
                {eventsOn(d)}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleSettings({ id, onSaved }: { id: string; onSaved: () => void }) {
  const notice = useNotice();
  const form = useEntityForm("programSchedules", id);
  useLeaveGuard(form.dirty && !form.busy);
  if (form.metaError || form.loadError) return <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice>;
  if (!form.values || !form.meta) return <p className="mh-sa__muted">Loading…</p>;
  return (
    <form
      className="lx"
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => {
            notice.ok(out.message);
            onSaved();
          })
          .catch((err) => notice.fail(errMsg(err, "Save failed")));
      }}
    >
      {notice.node}
      <Layout
        groups={[
          ["Master Schedule Details", ["description", "abbreviation"]],
          ["Schedule Calculations", ["length", "lengthUnit", "fullTimeCalc", "fullTimeMin", "alwaysFullTime"]],
          ["Availability & Enrolment Settings", ["enrolmentLimit", "enrolmentLimitValue", "studentAvailability", "facultyAvailability", "automatedEnrolment", "requiredCoreCourses"]],
          ["Practicum / Co-op Settings", ["practicumDelivery", "practicumEnrolment", "practicumStatus"]],
          ["Teach-out Settings", ["teachOut"]],
        ]}
        fields={form.fields}
        values={form.values}
        setValue={form.setValue}
        meta={form.meta}
      />
      <div className="mh-sa__actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Update Schedule
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Add Session / Edit Session                                           */
/* ------------------------------------------------------------------ */

const SESSION_GROUPS: Array<[string, string[]]> = [
  ["Session Settings", ["linkSchedule", "sessionName", "classPeriod", "sessionType", "campus", "classroom", "deliveryMethod", "maxEnrolments", "sameAsClassroom", "selfEnrolment", "feedIn"]],
  ["Session Faculty & Accesses", ["instructors", "assistants", "guests"]],
  ["Session Schedule", ["startDate", "endDate", "recalculate", "term", "scheduleType", "weekly"]],
  ["Grading Scheme", ["gradingScheme"]],
  ["Attendance / Participation", ["attendanceGrading", "scannerEnrolment"]],
  ["Course Content", ["enableLms"]],
  ["Wait List Settings", ["waitlist", "waitlistSize"]],
];

export function SessionPage() {
  const sp = useSearchParams();
  const id = sp?.get("id") || null;
  const [scheduleId, setScheduleId] = useState(sp?.get("schedule") ?? "");
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    if (id && !scheduleId)
      pm<Row>(`/e/sessions/${id}`)
        .then((r) => setScheduleId(r.parentId))
        .catch((e) => setLoadError(errMsg(e, "Could not load the session")));
  }, [id, scheduleId]);
  if (loadError)
    return (
      <SuperFrame title="Edit Session" breadcrumbs={CRUMB} breadcrumbHrefs={[null, null, SCHED]} activeHref={SCHED}>
        <SaNotice tone="error">{loadError}</SaNotice>
      </SuperFrame>
    );
  if (!scheduleId) return null;
  return <SessionForm id={id} scheduleId={scheduleId} />;
}

function SessionForm({ id, scheduleId }: { id: string | null; scheduleId: string }) {
  const router = useRouter();
  const notice = useNotice();
  const { detail } = useDetail(scheduleId, notice.fail);
  const form = useEntityForm("sessions", id, { parentId: scheduleId });
  useLeaveGuard(form.dirty && !form.busy);
  const programIds = useProgramCourses(scheduleId);
  const back = `${SCHED}/${detail?.schedule.kind === "term" && detail.schedule.status === "draft" ? "review" : "manage"}?id=${scheduleId}`;
  const session = detail?.sessions.find((s) => s.id === id);
  const term = detail?.schedule.kind === "term";
  const title = id ? `Edit Session: ${session?.courseCode ?? ""}: ${session?.offering ?? ""}` : "Add Session";
  const groups = SESSION_GROUPS.map(([t, keys]) => [t, term ? keys.filter((k) => k !== "term") : keys] as [string, string[]]);
  const otherSchedules = form.meta ? form.meta.schedules.filter((x) => x.id !== scheduleId) : [];
  const passFail = form.values?.gradingScheme === "Pass / Fail" && form.meta;
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, detail?.schedule.code ?? "Schedule", id ? "Edit Session" : "Add Session"]} breadcrumbHrefs={[null, null, SCHED, back]} activeHref={SCHED}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${back}&notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError || form.loadError ? <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            {!id ? (
              <section className="mh-sa__card">
                <div className="mh-sa__card-head">
                  <h2>Session Course</h2>
                </div>
                <div className="mh-sa__grid lx-grid">
                  <div className="mh-sa__field">
                    <label className="mh-sa__label" htmlFor="pm-session-course">
                      Select Course<span className="lx-req">*</span>
                    </label>
                    <CourseSelect id="pm-session-course" value={str(form.values.course)} onChange={(v) => form.setValue("course", v)} meta={form.meta} programIds={programIds} />
                  </div>
                </div>
              </section>
            ) : null}
            {term && detail ? (
              <p className="mh-sa__muted">
                Term: <strong>{detail.schedule.termName}</strong> — set by the term schedule.
              </p>
            ) : null}
            <Layout
              groups={groups}
              fields={form.fields}
              values={form.values}
              setValue={(k, v) => {
                form.setValue(k, v);
                if (k === "campus") form.setValue("classroom", "");
              }}
              meta={form.meta}
              refs={{ schedules: otherSchedules }}
              after={{
                "Grading Scheme": passFail ? (
                  <div className="mh-sa__table-wrap">
                    <table className="mh-sa__table lx-table">
                      <thead>
                        <tr>
                          <th>Letter</th>
                          <th>Credit</th>
                          <th>Condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.meta.passFailRows.map((r) => (
                          <tr key={r.letter}>
                            <td>{r.letter}</td>
                            <td>{r.credit}</td>
                            <td>{r.condition}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null,
                "Session Schedule": session ? (
                  <p className="mh-sa__muted pm-note">
                    Effective dates: {fmtDate(session.effectiveStart) || "—"} – {fmtDate(session.effectiveEnd) || "—"}
                  </p>
                ) : null,
              }}
            />
          </>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={back}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Session
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

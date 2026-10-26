"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice } from "@/components/superadmin/shared";
import {
  Confirm,
  EntityModal,
  FieldGrid,
  Frame,
  HREF,
  LinkBtn,
  Loading,
  RowActions,
  Sections,
  TimePick,
  arr,
  cm,
  errMsg,
  fmtDate,
  fmtStamp,
  fmtTime,
  initialValues,
  missingRequired,
  money,
  qs,
  send,
  str,
  useLeaveGuard,
  useLoad,
  useMeta,
  useNotice,
  type Data,
  type Field,
  type Meta,
  type Row,
} from "./kit";

const CRUMB = ["Courses & Sessions"];
const courseHref = (id: string, tab = "settings") => `${HREF.courses}/view${qs({ id, tab })}`;
const sessionFormHref = (course: string, id?: string) => `${HREF.courses}/session${qs({ course, id })}`;
export const viewCourseHref = (sectionId: string, tab?: string) => `${HREF.active}/view${qs({ id: sectionId, tab })}`;

type DirRow = { id: string; code: string; title: string; credits: number; group: string; sessions: { notStarted: number; inProgress: number; completed: number } };
type Directory = { groups: Array<{ category: string; rows: DirRow[] }>; total: number };

/* ------------------------------------------------------------------ */
/* Manage Courses & Sessions                                            */
/* ------------------------------------------------------------------ */

export function CourseDirectory() {
  const notice = useNotice();
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const { data, error, reload } = useLoad<Directory>(`/directory${qs({ q })}`, "Could not load courses");
  const [bulk, setBulk] = useState(false);
  const [confirm, setConfirm] = useState<DirRow | null>(null);
  return (
    <Frame
      title="Manage Courses & Sessions"
      crumbs={CRUMB}
      active={HREF.courses}
      actions={
        <>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${HREF.courses}/new`}>
            Create Course
          </Link>
          <button type="button" className="mh-sa__btn" onClick={() => setBulk(true)}>
            Bulk Actions
          </button>
        </>
      }
    >
      {notice.node}
      <section className="mh-sa__card">
        <form
          className="cm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(filter);
          }}
        >
          <label className="mh-sa__field" style={{ maxWidth: 420 }}>
            <span className="mh-sa__label">Filter Course</span>
            <input className="mh-sa__input" placeholder="Enter a course name or number" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </label>
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Courses
            </button>
          </span>
        </form>
        {!data ? (
          <Loading error={error} />
        ) : (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Course Name / Number</th>
                  <th>Credit Value</th>
                  <th>Sessions</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {data.groups.map((g) => (
                  <Fragment key={g.category}>
                    <tr className="cm-group-row">
                      <td colSpan={4}>{g.category}</td>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <div className="cm-stack">
                            <strong>{r.title}</strong>
                            <span className="cm-muted">
                              {r.code}
                              {r.group ? ` · ${r.group}` : ""}
                            </span>
                          </div>
                        </td>
                        <td>{r.credits}</td>
                        <td>
                          <span className="cm-pills">
                            <span className="cm-pill">Not Started: {r.sessions.notStarted}</span>
                            <span className="cm-pill cm-pill--on">In Progress: {r.sessions.inProgress}</span>
                            <span className="cm-pill cm-pill--info">Completed: {r.sessions.completed}</span>
                          </span>
                        </td>
                        <td className="lx-actions">
                          <RowActions>
                            {[
                              <LinkBtn key="s" href={courseHref(r.id, "sessions")}>
                                SESSIONS
                              </LinkBtn>,
                              <LinkBtn key="e" href={courseHref(r.id, "settings")}>
                                EDIT
                              </LinkBtn>,
                              <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                                DELETE
                              </LinkBtn>,
                            ]}
                          </RowActions>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {!data.total ? (
                  <tr>
                    <td colSpan={4} className="mh-sa__empty-cell">
                      {q ? `No courses match "${q}".` : "No courses have been created yet."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {bulk ? (
        <BulkActions
          onClose={() => setBulk(false)}
          onSaved={(m) => {
            setBulk(false);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title={`Delete Course: ${confirm.code}`}
          body={`Delete ${confirm.code} — ${confirm.title}? Courses that still have sessions / offerings, program requirements, plans, prerequisites, transfer credits or resources cannot be deleted.`}
          okLabel="Delete Course"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            send(`/courses/${r.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </Frame>
  );
}

function BulkActions({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const { meta } = useMeta();
  const [type, setType] = useState("");
  const [value, setValue] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [pickLeft, setPickLeft] = useState<string[]>([]);
  const [pickRight, setPickRight] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const courses = meta?.refs.courses ?? [];
  const available = courses.filter((c) => !selected.includes(c.id) && c.label.toLowerCase().includes(filter.trim().toLowerCase()));
  const submit = () => {
    setError(null);
    setBusy(true);
    send("/bulk", "POST", { type, value, courseIds: selected })
      .then((out) => onSaved(out.message))
      .catch((e) => setError(errMsg(e, "Bulk update failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title="Bulk Actions"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !type} onClick={submit}>
          Bulk Save Updates
        </button>
      }
    >
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      <div className="cm-modal-form">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Bulk Updates</span>
          <select className="mh-sa__input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">-- Select Action --</option>
            {(meta?.options.bulkUpdates ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        {type === "Credit Value" ? (
          <>
            <label className="mh-sa__field">
              <span className="mh-sa__label">
                Course Credit Value<span className="lx-req">*</span>
              </span>
              <input className="mh-sa__input" type="number" min={0} max={100} step="any" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            <label className="mh-sa__field">
              <span className="mh-sa__label">Filter Course</span>
              <input className="mh-sa__input" placeholder="Course number or name" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </label>
            <div className="cm-transfer">
              <label className="mh-sa__field">
                <span className="mh-sa__label">Available Courses ({available.length})</span>
                <select className="mh-sa__input" multiple value={pickLeft} onChange={(e) => setPickLeft(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cm-transfer__btns">
                <button
                  type="button"
                  className="mh-sa__btn mh-sa__btn--sm"
                  disabled={!pickLeft.length}
                  onClick={() => {
                    setSelected((s) => [...s, ...pickLeft]);
                    setPickLeft([]);
                  }}
                >
                  Add →
                </button>
                <button
                  type="button"
                  className="mh-sa__btn mh-sa__btn--sm"
                  disabled={!pickRight.length}
                  onClick={() => {
                    setSelected((s) => s.filter((x) => !pickRight.includes(x)));
                    setPickRight([]);
                  }}
                >
                  ← Remove
                </button>
              </div>
              <label className="mh-sa__field">
                <span className="mh-sa__label">Selected Courses ({selected.length})</span>
                <select className="mh-sa__input" multiple value={pickRight} onChange={(e) => setPickRight(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                  {selected.map((id) => (
                    <option key={id} value={id}>
                      {courses.find((c) => c.id === id)?.label ?? id}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <p className="mh-sa__muted">Choose a bulk update to continue.</p>
        )}
      </div>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit Course (also the Course Settings tab)                     */
/* ------------------------------------------------------------------ */

type CurriculumRequirement = { id: string; program: string; programCode: string; version: string; versionStatus: string; title: string; kind: string; credits: number; sortOrder: number };
type CurriculumCourseLink = { id: string; courseId: string; code: string; title: string };
type CurriculumOffering = { id: string; termCode: string; termName: string; seatsOpen: number; seatsTotal: number; status: string };
type CourseCurriculum = {
  requirements: CurriculumRequirement[];
  prerequisites: CurriculumCourseLink[];
  corequisites: CurriculumCourseLink[];
  offerings: CurriculumOffering[];
};
type CourseRec = { id: string; code: string; title: string; credits: number; values: Data; sessionDefaults?: { gradingScheme?: string }; curriculum?: CourseCurriculum };

function CourseFormBody({ id, onSaved }: { id: string | null; onSaved: (out: { id?: string; message: string }) => void }) {
  const { meta, error: metaError } = useMeta();
  const { data, error } = useLoad<CourseRec>(id ? `/courses/${id}` : null, "Could not load this course");
  const fields = meta?.forms.course ?? [];
  const [values, setValues] = useState<Data | null>(null);
  const [snap, setSnap] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!meta) return;
    if (id && !data) return;
    const v = initialValues(fields, id ? data!.values : undefined);
    setValues(v);
    setSnap(JSON.stringify(v));
  }, [meta, data, id, fields]);
  useLeaveGuard(Boolean(values) && JSON.stringify(values) !== snap && !busy);
  if (!meta || !values) return <Loading error={metaError ?? error} />;
  const setValue = (k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s));
  const hours = Number(values.totalHours) || 0;
  const perDay = Number(values.hoursPerDay) || 0;
  const totalDays = hours > 0 && perDay > 0 ? Math.ceil(hours / perDay) : null;
  const submit = () => {
    setErr(null);
    const missing = missingRequired(fields, values);
    if (missing.length) {
      setErr(`Please complete: ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    (id ? send(`/courses/${id}`, "PATCH", values) : send("/courses", "POST", values))
      .then((out) => {
        setSnap(JSON.stringify(values));
        onSaved(out);
      })
      .catch((e) => setErr(errMsg(e, "Save failed")))
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="cm-modal-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {err ? <p className="cm-error" role="alert">{err}</p> : null}
      <Sections
        fields={fields}
        values={values}
        setValue={setValue}
        meta={meta}
        after={{
          "Default Course Schedule": (
            <p className="cm-muted" style={{ marginTop: 8 }}>
              Total Days: <strong>{totalDays ?? "—"}</strong>
              {totalDays ? ` (${hours} hours ÷ ${perDay} hours per day)` : " — enter Total Course Hours and Hours per Day"}
            </p>
          ),
          "Course Chair & Lead Accesses": values.overridePermissions ? null : <p className="cm-muted">The course category&apos;s Academic Chair and Course Lead apply. Tick the box to set course-specific users.</p>,
        }}
      />
      <div className="lx-sticky-actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
          Save Course
        </button>
      </div>
    </form>
  );
}

export function CourseFormPage() {
  const router = useRouter();
  return (
    <Frame title="Add Course" crumbs={[...CRUMB, "Add Course"]} active={HREF.courses}>
      <CourseFormBody id={null} onSaved={(out) => router.push(`${courseHref(out.id ?? "", "settings")}&notice=${encodeURIComponent(out.message)}`)} />
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Selected course: 7 tabs                                              */
/* ------------------------------------------------------------------ */

const TABS: Array<[string, string]> = [
  ["settings", "Course Settings"],
  ["curriculum", "Curriculum Records"],
  ["sessions", "Course Sessions & Offerings"],
  ["prereqs", "Prerequisites & Corequisites"],
  ["linked", "Cross-Listing / Linked Courses"],
  ["textbooks", "Course Textbooks & e-Texts"],
  ["transfer", "Transfer Courses & Equivalence"],
  ["audit", "Audit Changes"],
];

export function CoursePage() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const tab = TABS.some(([k]) => k === sp?.get("tab")) ? sp!.get("tab")! : "settings";
  const notice = useNotice();
  const { data, error, reload } = useLoad<CourseRec>(id ? `/courses/${id}` : null, "Could not load this course");
  const label = data ? `${data.code} — ${data.title}` : "Course";
  return (
    <Frame title={label} crumbs={[...CRUMB, data?.code ?? "Course"]} active={HREF.courses}>
      {notice.node}
      <nav className="lx-tabs cm-tabs" aria-label="Course sections">
        {TABS.map(([k, l]) => (
          <Link key={k} href={courseHref(id, k)} className={`lx-tab${tab === k ? " is-active" : ""}`} aria-current={tab === k ? "page" : undefined}>
            {l}
          </Link>
        ))}
      </nav>
      {!data ? (
        <Loading error={error} />
      ) : tab === "settings" ? (
        <CourseFormBody
          key={id}
          id={id}
          onSaved={(out) => {
            notice.ok(out.message);
            reload();
          }}
        />
      ) : tab === "sessions" ? (
        <SessionsTab course={data} notice={notice} />
      ) : tab === "curriculum" ? (
        <CurriculumTab course={data} />
      ) : tab === "prereqs" ? (
        <PrereqTab course={data} notice={notice} />
      ) : tab === "linked" ? (
        <LinkedTab course={data} notice={notice} />
      ) : tab === "textbooks" ? (
        <TextbooksTab course={data} notice={notice} />
      ) : tab === "transfer" ? (
        <TransferTab course={data} notice={notice} />
      ) : (
        <AuditTab course={data} notice={notice} onRestored={reload} />
      )}
    </Frame>
  );
}

type Notice = ReturnType<typeof useNotice>;

function CurriculumTable({ title, empty, headings, rows }: { title: string; empty: string; headings: string[]; rows: Array<{ id: string; cells: ReactNode[] }> }) {
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 10 }}>{title}</h3>
      <div className="mh-sa__table-wrap">
        <table className="mh-sa__table lx-table">
          <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => <tr key={row.id}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}
            {!rows.length ? <tr><td colSpan={headings.length} className="mh-sa__empty-cell">{empty}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CurriculumTab({ course }: { course: CourseRec }) {
  const curriculum = course.curriculum ?? { requirements: [], prerequisites: [], corequisites: [], offerings: [] };
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <div>
          <h2>Curriculum records linked to {course.code}</h2>
          <p className="cm-muted">These are the normalized records created in Academic → Curriculum Catalogue. They drive degree rules and enrolment validation.</p>
        </div>
        <Link className="mh-sa__btn mh-sa__btn--secondary" href="/admin/curriculum">Manage Catalogue</Link>
      </div>
      <CurriculumTable
        title="Programme versions & degree requirements"
        empty="This course is not linked to a degree requirement yet."
        headings={["Programme", "Version", "Requirement", "Type", "Credits"]}
        rows={curriculum.requirements.map((row) => ({ id: row.id, cells: [`${row.programCode} · ${row.program}`, `${row.version} · ${row.versionStatus}`, row.title, row.kind, row.credits] }))}
      />
      <CurriculumTable
        title="Prerequisites"
        empty="No normalized prerequisite is linked to this course."
        headings={["Required course", "Rule"]}
        rows={curriculum.prerequisites.map((row) => ({ id: row.id, cells: [`${row.code} · ${row.title}`, `Must be completed before ${course.code}`] }))}
      />
      <CurriculumTable
        title="Corequisites"
        empty="No normalized corequisite is linked to this course."
        headings={["Required course", "Rule"]}
        rows={curriculum.corequisites.map((row) => ({ id: row.id, cells: [`${row.code} · ${row.title}`, `Must be completed or taken with ${course.code}`] }))}
      />
      <CurriculumTable
        title="Catalogue offerings"
        empty="No catalogue offering is linked to this course."
        headings={["Term", "Seats", "Status"]}
        rows={curriculum.offerings.map((row) => ({ id: row.id, cells: [`${row.termCode} · ${row.termName}`, `${row.seatsOpen} open / ${row.seatsTotal} total`, row.status] }))}
      />
    </section>
  );
}
type SessionRow = {
  id: string;
  courseCode: string;
  courseTitle: string;
  code: string;
  name: string;
  term: string;
  campus: string;
  classroom: string;
  instructors: string[];
  start: string;
  end: string;
  continuous: boolean;
  meetings: Array<{ day: string; start: string; end: string }>;
  status: string;
  enrolled: number;
  capacity: number | null;
  reserved: number;
  waitlist: number;
};

export function scheduleText(r: { start: string; end: string; continuous: boolean; meetings: Array<{ day: string; start: string; end: string }> }) {
  const dates = r.continuous ? `${fmtDate(r.start)} – Continuous` : `${fmtDate(r.start)} – ${fmtDate(r.end)}`;
  return { dates, days: r.meetings.map((m) => `${m.day.slice(0, 3)} ${fmtTime(m.start)}–${fmtTime(m.end)}`) };
}

function SessionsTab({ course, notice }: { course: CourseRec; notice: Notice }) {
  const { meta } = useMeta();
  const [status, setStatus] = useState("");
  const { data, error, reload } = useLoad<{ items: SessionRow[] }>(`/courses/${course.id}/sessions${qs({ status })}`, "Could not load sessions");
  const [confirm, setConfirm] = useState<SessionRow | null>(null);
  const [seats, setSeats] = useState<SessionRow | null>(null);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>
          {course.code} — {course.title}
        </h2>
        <Link className="mh-sa__btn mh-sa__btn--primary" href={sessionFormHref(course.id)}>
          Create Session / Offering
        </Link>
      </div>
      {(course.curriculum?.offerings.length ?? 0) > 0 ? (
        <div className="cm-note" style={{ marginBottom: 16 }}>
          <strong>Catalogue offerings:</strong>{" "}
          {course.curriculum!.offerings.map((offering) => `${offering.termCode} (${offering.seatsOpen}/${offering.seatsTotal} open)`).join(" · ")}
          <div className="cm-muted">Catalogue offerings describe availability. A real teaching session is created separately below.</div>
        </div>
      ) : null}
      <div className="cm-filters">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Status</span>
          <select className="mh-sa__input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {(meta?.options.sessionStatuses ?? ["Not Started", "In Progress", "Completed"]).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Location</th>
                <th>Instructors</th>
                <th>Schedule</th>
                <th>Enrolments</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const sch = scheduleText(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="cm-stack">
                        <strong>
                          {r.courseCode} {r.code}
                        </strong>
                        <span className="cm-muted">
                          {r.name || r.courseTitle} · {r.term}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="cm-stack">
                        <span>{r.campus || "Campus not set"}</span>
                        <span className="cm-muted">{r.classroom || "Classroom not set"}</span>
                      </div>
                    </td>
                    <td>{r.instructors.length ? r.instructors.join(", ") : <span className="cm-muted">Not Set</span>}</td>
                    <td>
                      <div className="cm-stack">
                        <span>{sch.dates}</span>
                        {sch.days.map((d) => (
                          <span key={d} className="cm-muted">
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="cm-stack">
                        <span>
                          Enrolled: {r.enrolled}
                          {r.capacity !== null ? ` / ${r.capacity}` : ""}
                        </span>
                        <span className="cm-muted">
                          Reserved: {r.reserved} · Wait List: {r.waitlist}
                        </span>
                        <button type="button" className="mh-sa__link" style={{ textAlign: "left", fontSize: 12 }} onClick={() => setSeats(r)}>
                          Manage Wait List / Reserved Seats
                        </button>
                      </div>
                    </td>
                    <td className="lx-actions">
                      <RowActions>
                        {[
                          <LinkBtn key="v" href={viewCourseHref(r.id)}>
                            VIEW
                          </LinkBtn>,
                          <LinkBtn key="e" href={sessionFormHref(course.id, r.id)}>
                            EDIT
                          </LinkBtn>,
                          <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                            DELETE
                          </LinkBtn>,
                        ]}
                      </RowActions>
                    </td>
                  </tr>
                );
              })}
              {!data.items.length ? (
                <tr>
                  <td colSpan={6} className="mh-sa__empty-cell">
                    {status ? `No ${status.toLowerCase()} sessions / offerings for this course.` : "No sessions / offerings have been created for this course."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {seats ? (
        <SaModal
          title={`Wait List / Reserved Seats · ${seats.courseCode} ${seats.code}`}
          onClose={() => setSeats(null)}
          footer={
            <Link className="mh-sa__btn mh-sa__btn--primary" href={sessionFormHref(course.id, seats.id)}>
              Edit Session Settings
            </Link>
          }
        >
          <div className="cm-counters">
            <div className="cm-counter">
              <strong>
                {seats.enrolled}
                {seats.capacity !== null ? ` / ${seats.capacity}` : ""}
              </strong>
              <span>Enrolled</span>
            </div>
            <div className="cm-counter">
              <strong>{seats.reserved}</strong>
              <span>Reserved</span>
            </div>
            <div className="cm-counter">
              <strong>{seats.waitlist}</strong>
              <span>Wait List</span>
            </div>
          </div>
          <p className="cm-muted" style={{ marginTop: 12 }}>
            Enrolment Waitlist and Reserved Enrolments are switched on or off in the session&apos;s Session Settings.
          </p>
        </SaModal>
      ) : null}
      {confirm ? (
        <Confirm
          title={`Delete Session: ${confirm.courseCode} ${confirm.code}`}
          body="Sessions with enrolled students, course content, class sessions or attendance cannot be deleted."
          okLabel="Delete Session"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            send(`/sessions/${r.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </section>
  );
}

function PrereqTab({ course, notice }: { course: CourseRec; notice: Notice }) {
  const { data, error, reload } = useLoad<{ items: Row[] }>(`/e/prereqTemplates${qs({ parentId: course.id })}`, "Could not load templates");
  const [selected, setSelected] = useState("");
  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const items = data?.items ?? [];
  const current = items.find((t) => t.id === selected) ?? items[0];
  return (
    <section className="mh-sa__card">
      <div className="cm-note" style={{ marginBottom: 16 }}>
        <strong>Enforced curriculum rules</strong>
        <div className="cm-muted" style={{ marginTop: 6 }}>
          Prerequisites: {course.curriculum?.prerequisites.length ? course.curriculum.prerequisites.map((row) => `${row.code} · ${row.title}`).join(", ") : "None"}
        </div>
        <div className="cm-muted">
          Corequisites: {course.curriculum?.corequisites.length ? course.curriculum.corequisites.map((row) => `${row.code} · ${row.title}`).join(", ") : "None"}
        </div>
        <div className="cm-muted">These Curriculum Catalogue rules are checked during enrolment. The templates below are reusable legacy course templates.</div>
      </div>
      <div className="cm-filters">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Templates</span>
          <select className="mh-sa__input" value={current?.id ?? ""} onChange={(e) => setSelected(e.target.value)} disabled={!items.length}>
            {!items.length ? <option value="">No templates</option> : null}
            {items.map((t) => (
              <option key={t.id} value={t.id}>
                {str(t.name)} ({str(t.status)})
              </option>
            ))}
          </select>
        </label>
        <span className="cm-filters__go">
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setModal({ id: null })}>
            New Template
          </button>
        </span>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : !current ? (
        <p className="cm-empty">No prerequisite / corequisite templates have been created for this course.</p>
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Template Name</th>
                <th>Template Status</th>
                <th>Effective Dating</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{str(current.name)}</td>
                <td>
                  <span className={`cm-pill${current.status === "Active" ? " cm-pill--on" : ""}`}>{str(current.status)}</span>
                </td>
                <td>{current.effectiveDating ? "Enabled" : "Disabled"}</td>
                <td className="lx-actions">
                  <RowActions>
                    {[
                      <LinkBtn key="e" onClick={() => setModal({ id: current.id })}>
                        EDIT
                      </LinkBtn>,
                      <LinkBtn key="d" danger onClick={() => setConfirm(current)}>
                        DELETE
                      </LinkBtn>,
                    ]}
                  </RowActions>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {modal ? (
        <EntityModal
          entity="prereqTemplates"
          id={modal.id}
          parentId={course.id}
          title={modal.id ? "Edit Template" : "New Template"}
          onClose={() => setModal(null)}
          onSaved={(out) => {
            setModal(null);
            if (out.id) setSelected(out.id);
            notice.ok(out.message);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title="Delete Template"
          body={`Delete the template "${str(confirm.name)}"?`}
          okLabel="Delete Template"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            send(`/e/prereqTemplates/${r.id}`, "DELETE")
              .then((out) => {
                setSelected("");
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </section>
  );
}

function LinkedTab({ course, notice }: { course: CourseRec; notice: Notice }) {
  const { data, error, reload } = useLoad<{ items: Row[] }>(`/e/linkedCourses${qs({ parentId: course.id })}`, "Could not load linked courses");
  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Cross-Listed / Linked Courses</h2>
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setModal({ id: null })}>
          Add Cross-Listed / Linked Course
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Linked Course</th>
                <th>Linking Condition</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>{str(r._course)}</td>
                  <td>{str(r.condition)}</td>
                  <td className="lx-actions">
                    <RowActions>
                      {[
                        <LinkBtn key="e" onClick={() => setModal({ id: r.id })}>
                          EDIT
                        </LinkBtn>,
                        <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                          DELETE
                        </LinkBtn>,
                      ]}
                    </RowActions>
                  </td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={3} className="mh-sa__empty-cell">
                    No cross-listed or linked courses have been added.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {modal ? (
        <EntityModal
          entity="linkedCourses"
          id={modal.id}
          parentId={course.id}
          title={modal.id ? "Edit Cross-Listed / Linked Course" : "Add Cross-Listed / Linked Course"}
          onClose={() => setModal(null)}
          onSaved={(out) => {
            setModal(null);
            notice.ok(out.message);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title="Remove Linked Course"
          body={`Remove ${str(confirm._course)} from this course's linked courses?`}
          okLabel="Remove"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            send(`/e/linkedCourses/${r.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Remove failed")));
          }}
        />
      ) : null}
    </section>
  );
}

type CourseBook = { id: string; name: string; isbn: string; format: string; domestic: number | null; international: number | null; optOut: string; recurringFee: string };

function TextbooksTab({ course, notice }: { course: CourseRec; notice: Notice }) {
  const { meta } = useMeta();
  const { data, error, reload } = useLoad<{ items: CourseBook[] }>(`/courses/${course.id}/textbooks`, "Could not load textbooks");
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<CourseBook | null>(null);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Course Textbooks & e-Texts</h2>
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setAdding(true)}>
          Add Textbook
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Textbook</th>
                <th>ISBN</th>
                <th>Price</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="cm-stack">
                      <strong>{b.name}</strong>
                      <span className="cm-muted">
                        {b.format} · Opt-Out: {b.optOut} · Recurring fee: {b.recurringFee}
                      </span>
                    </div>
                  </td>
                  <td>{b.isbn || "—"}</td>
                  <td>
                    <div className="cm-stack">
                      <span>Domestic: {money(b.domestic)}</span>
                      <span>International: {money(b.international)}</span>
                    </div>
                  </td>
                  <td className="lx-actions">
                    <RowActions>
                      {[
                        <LinkBtn key="e" href={`${HREF.textbooks}/edit${qs({ id: b.id })}`}>
                          EDIT
                        </LinkBtn>,
                        <LinkBtn key="d" danger onClick={() => setConfirm(b)}>
                          REMOVE
                        </LinkBtn>,
                      ]}
                    </RowActions>
                  </td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    No textbooks or e-texts have been added to this course.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {adding && meta ? (
        <FieldsModal
          title="Add Textbook to Course"
          fields={meta.forms.courseTextbook}
          meta={meta}
          saveLabel="Add Textbook"
          onClose={() => setAdding(false)}
          onSubmit={(v) => send(`/courses/${course.id}/textbooks`, "POST", v)}
          onSaved={(m) => {
            setAdding(false);
            notice.ok(m);
            reload();
          }}
          note={
            <p className="cm-muted">
              Textbooks are selected from the master catalogue. To create a new textbook use <Link href={`${HREF.textbooks}/new`}>Course Textbooks</Link>.
            </p>
          }
        />
      ) : null}
      {confirm ? (
        <Confirm
          title="Remove Textbook"
          body={`Remove ${confirm.name} from ${course.code}? The textbook stays in the master catalogue.`}
          okLabel="Remove"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const b = confirm;
            setConfirm(null);
            send(`/courses/${course.id}/textbooks/${b.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Remove failed")));
          }}
        />
      ) : null}
    </section>
  );
}

/** Popup over an ad-hoc field list (not a stored entity). */
export function FieldsModal({
  title,
  fields,
  meta,
  saveLabel,
  initial,
  onClose,
  onSubmit,
  onSaved,
  note,
}: {
  title: string;
  fields: Field[];
  meta: Meta;
  saveLabel: string;
  initial?: Data;
  onClose: () => void;
  onSubmit: (v: Data) => Promise<{ message: string }>;
  onSaved: (message: string) => void;
  note?: React.ReactNode;
}) {
  const [values, setValues] = useState<Data>(() => initialValues(fields, initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    const missing = missingRequired(fields, values);
    if (missing.length) {
      setError(`Please complete: ${missing.join(", ")}`);
      return;
    }
    setBusy(true);
    setError(null);
    onSubmit(values)
      .then((out) => onSaved(out.message))
      .catch((e) => setError(errMsg(e, "Save failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title={title}
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={submit}>
          {saveLabel}
        </button>
      }
    >
      {error ? <p className="cm-error" role="alert">{error}</p> : null}
      <form
        className="cm-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FieldGrid fields={fields} values={values} setValue={(k, v) => setValues((s) => ({ ...s, [k]: v }))} meta={meta} />
        {note}
      </form>
    </SaModal>
  );
}

function TransferTab({ course, notice }: { course: CourseRec; notice: Notice }) {
  const { data, error, reload } = useLoad<{ items: Row[] }>(`/e/transferCourses${qs({ parentId: course.id })}`, "Could not load transfer courses");
  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Transfer Courses & Equivalence</h2>
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setModal({ id: null })}>
          Add Transfer Course
        </button>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Transfer Institution</th>
                <th>Transfer Course</th>
                <th>Credits</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>{str(r._institution)}</td>
                  <td>
                    <div className="cm-stack">
                      <strong>{str(r.name)}</strong>
                      <span className="cm-muted">{str(r.number)}</span>
                    </div>
                  </td>
                  <td>{str(r.credits) || "—"}</td>
                  <td className="lx-actions">
                    <RowActions>
                      {[
                        <LinkBtn key="e" onClick={() => setModal({ id: r.id })}>
                          EDIT
                        </LinkBtn>,
                        <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                          DELETE
                        </LinkBtn>,
                      ]}
                    </RowActions>
                  </td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    No transfer courses are recorded as equivalent to {course.code}.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {modal ? (
        <EntityModal
          entity="transferCourses"
          id={modal.id}
          parentId={course.id}
          title={modal.id ? "Edit Transfer Course" : "Add Transfer Course"}
          onClose={() => setModal(null)}
          onSaved={(out) => {
            setModal(null);
            notice.ok(out.message);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title="Delete Transfer Course"
          body={`Delete ${str(confirm.number)} ${str(confirm.name)} (${str(confirm._institution)})?`}
          okLabel="Delete"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            send(`/e/transferCourses/${r.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </section>
  );
}

type Version = { id: string; date: string; by: string; changes: string[]; current: boolean };
type VersionDetail = { id: string; date: string; by: string; changes: string[]; rows: Array<{ label: string; former: string; updated: string }> };
type Records = { enrolledStudents: number; currentSessions: number; completedSessions: number; programPlans: number; schedules: number };

function AuditTab({ course, notice, onRestored }: { course: CourseRec; notice: Notice; onRestored: () => void }) {
  const router = useRouter();
  const { data, error, reload } = useLoad<{ items: Version[] }>(`/courses/${course.id}/history`, "Could not load course history");
  const [review, setReview] = useState<VersionDetail | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [restore, setRestore] = useState<Version | null>(null);
  const [busy, setBusy] = useState(false);
  const openReview = (v: Version) =>
    cm<VersionDetail>(`/courses/${course.id}/history/${v.id}`)
      .then(setReview)
      .catch((e) => notice.fail(errMsg(e, "Could not load this change")));
  const openRecords = () =>
    cm<Records>(`/courses/${course.id}/records`)
      .then(setRecords)
      .catch((e) => notice.fail(errMsg(e, "Could not load assigned records")));
  const go = (href: string) => {
    setRecords(null);
    router.push(href);
  };
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Audit Changes</h2>
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Changed By</th>
                <th>Changes Made</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((v) => (
                <tr key={v.id}>
                  <td>
                    {fmtStamp(v.date)} {v.current ? <span className="cm-pill cm-pill--on">Current</span> : null}
                  </td>
                  <td>{v.by}</td>
                  <td>{v.changes.join("; ")}</td>
                  <td className="lx-actions">
                    <RowActions>
                      {[
                        <LinkBtn key="r" onClick={() => void openReview(v)}>
                          REVIEW
                        </LinkBtn>,
                        <LinkBtn key="c" onClick={() => void openRecords()}>
                          RECORDS
                        </LinkBtn>,
                        v.current ? null : (
                          <LinkBtn key="s" onClick={() => setRestore(v)}>
                            RESTORE
                          </LinkBtn>
                        ),
                      ].filter(Boolean) as React.ReactNode[]}
                    </RowActions>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {review ? (
        <SaModal title="Review Changes" onClose={() => setReview(null)} wide>
          <p className="cm-muted">
            {fmtStamp(review.date)} · Changed by <strong>{review.by}</strong>
          </p>
          {review.rows.length ? (
            <table className="cm-compare">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Former Values</th>
                  <th>Updated Values</th>
                </tr>
              </thead>
              <tbody>
                {review.rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td>{r.former}</td>
                    <td>{r.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="cm-empty">{review.changes.join("; ") || "No field changes were recorded for this version."}</p>
          )}
        </SaModal>
      ) : null}
      {records ? (
        <SaModal title="Assigned Records" onClose={() => setRecords(null)}>
          <p className="cm-muted">Click a statistic to manage the records assigned to {course.code}.</p>
          <div className="cm-counters" style={{ marginTop: 10 }}>
            <button type="button" className="cm-counter" onClick={() => go(`${HREF.active}${qs({ course: course.id })}`)}>
              <strong>{records.enrolledStudents}</strong>
              <span>Enrolled Students</span>
            </button>
            <button type="button" className="cm-counter" onClick={() => go(courseHref(course.id, "sessions"))}>
              <strong>{records.currentSessions}</strong>
              <span>Current Sessions</span>
            </button>
            <button type="button" className="cm-counter" onClick={() => go(courseHref(course.id, "sessions"))}>
              <strong>{records.completedSessions}</strong>
              <span>Completed Sessions</span>
            </button>
            <button type="button" className="cm-counter" onClick={() => go("/admin/program-management/faculties")}>
              <strong>{records.programPlans}</strong>
              <span>Program Plans</span>
            </button>
            <button type="button" className="cm-counter" onClick={() => go("/admin/program-management/scheduling")}>
              <strong>{records.schedules}</strong>
              <span>Schedules</span>
            </button>
          </div>
        </SaModal>
      ) : null}
      {restore ? (
        <Confirm
          title="Restore Course Version"
          body={`Restore ${course.code} to the version saved ${fmtStamp(restore.date)} by ${restore.by}? The current settings are kept in the history and can be restored again.`}
          okLabel="Confirm Restore"
          danger={false}
          busy={busy}
          onCancel={() => setRestore(null)}
          onOk={() => {
            const v = restore;
            setBusy(true);
            send(`/courses/${course.id}/history/${v.id}/restore`, "POST")
              .then((out) => {
                setRestore(null);
                notice.ok(out.message);
                reload();
                onRestored();
              })
              .catch((e) => notice.fail(errMsg(e, "Restore failed")))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit Session / Offering                                        */
/* ------------------------------------------------------------------ */

type Meeting = { day: string; start: string; end: string };
type SessionRec = { id: string; courseId: string; course: { id: string; code: string; title: string }; code: string; term: string; values: Data };

function MeetingsEditor({ value, onChange, weekdays }: { value: Meeting[]; onChange: (v: Meeting[]) => void; weekdays: string[] }) {
  const of = (d: string) => value.find((m) => m.day === d);
  const set = (day: string, next: Meeting | null) => {
    const rest = value.filter((m) => m.day !== day);
    onChange(next ? [...rest, next].sort((a, b) => weekdays.indexOf(a.day) - weekdays.indexOf(b.day)) : rest);
  };
  return (
    <div className="cm-weekly">
      <span className="mh-sa__label">Weekly Schedule</span>
      <div className="cm-weekly__days">
        {weekdays.map((d) => (
          <label key={d} className="mh-sa__check">
            <input type="checkbox" checked={Boolean(of(d))} onChange={(e) => set(d, e.target.checked ? { day: d, start: "09:00", end: "12:00" } : null)} /> {d}
          </label>
        ))}
      </div>
      {weekdays
        .filter((d) => of(d))
        .map((d) => (
          <div key={d} className="cm-weekly__row">
            <strong>{d}</strong>
            <span className="mh-sa__muted">Start</span>
            <TimePick label={`${d} start`} value={of(d)!.start} onChange={(v) => set(d, { ...of(d)!, start: v })} />
            <span className="mh-sa__muted">Finish</span>
            <TimePick label={`${d} finish`} value={of(d)!.end} onChange={(v) => set(d, { ...of(d)!, end: v })} />
          </div>
        ))}
    </div>
  );
}

export function GradingPreview({ schemeId, full }: { schemeId: string; full?: boolean }) {
  const { data, error } = useLoad<Row>(schemeId ? `/e/gradingSchemes/${schemeId}` : null, "Could not load the grading scheme");
  if (!schemeId) return null;
  if (!data) return <Loading error={error} />;
  const grades = arr(data.grades) as Data[];
  const cols: Array<[string, string]> = full
    ? [
        ["letter", "Letter"],
        ["percent", "Percent"],
        ["gradePoint", "Grade Point"],
        ["credit", "Credit"],
        ["condition", "Condition"],
      ]
    : [
        ["letter", "Letter"],
        ["credit", "Credit"],
        ["condition", "Condition"],
      ];
  return (
    <div className="mh-sa__table-wrap" style={{ marginTop: 10 }}>
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            {cols.map(([k, l]) => (
              <th key={k}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map((g) => (
            <tr key={str(g.id) || str(g.letter)}>
              {cols.map(([k]) => (
                <td key={k}>{str(g[k]) || "—"}</td>
              ))}
            </tr>
          ))}
          {!grades.length ? (
            <tr>
              <td colSpan={cols.length} className="mh-sa__empty-cell">
                This grading scheme has no grade rows yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

const seatsOf = (label: string) => Number(/\((\d+) seats\)/.exec(label)?.[1] ?? 0) || null;

export function SessionFormPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const courseId = sp?.get("course") ?? "";
  const id = sp?.get("id") || null;
  const { meta, error: metaError } = useMeta();
  const course = useLoad<CourseRec>(courseId ? `/courses/${courseId}` : null, "Could not load the course");
  const existing = useLoad<SessionRec>(id ? `/sessions/${id}` : null, "Could not load this session");
  const fields = useMemo(() => meta?.forms.session ?? [], [meta]);
  const [values, setValues] = useState<Data | null>(null);
  const [snap, setSnap] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    if (!meta || !course.data || (id && !existing.data) || values) return;
    const base = id
      ? existing.data!.values
      : { gradingScheme: str(course.data.sessionDefaults?.gradingScheme) || str(course.data.values.gradingScheme) || undefined, termId: "" };
    const v = { ...initialValues(fields, base as Data), meetings: arr((base as Data).meetings), termId: str((base as Data).termId) };
    setValues(v);
    setSnap(JSON.stringify(v));
  }, [meta, existing.data, course.data, id, fields, values]);
  useLeaveGuard(Boolean(values) && JSON.stringify(values) !== snap && !busy && !saved);
  const title = id ? `Edit Session / Offering${existing.data ? `: ${existing.data.course.code} ${existing.data.code}` : ""}` : "Add Session / Offering";
  const backHref = courseHref(courseId, "sessions");
  if (!meta || !values || !course.data)
    return (
      <Frame title={title} crumbs={[...CRUMB, "Session / Offering"]} active={HREF.courses}>
        <Loading error={metaError ?? course.error ?? existing.error} />
      </Frame>
    );
  const setValue = (k: string, v: unknown) =>
    setValues((s) => {
      if (!s) return s;
      const next = { ...s, [k]: v };
      if ((k === "sameAsClassroom" && v) || (k === "classroom" && s.sameAsClassroom)) {
        const room = meta.refs.classrooms?.find((o) => o.id === (k === "classroom" ? v : s.classroom));
        const seats = room ? seatsOf(room.label) : null;
        if (seats) next.maxEnrolments = seats;
      }
      if (k === "campus" && s.classroom && meta.refs.classrooms?.find((o) => o.id === s.classroom)?.tag !== v) next.classroom = "";
      return next;
    });
  const meetings = arr(values.meetings) as Meeting[];
  const render = (f: Field) => {
    if (f.key === "maxEnrolments" && values.sameAsClassroom)
      return (
        <>
          <span className="mh-sa__label">Maximum Enrolments</span>
          <input className="mh-sa__input" disabled value={str(values.maxEnrolments)} aria-label="Maximum Enrolments (classroom size)" />
          <span className="lx-hint">Uses the classroom size.</span>
        </>
      );
    return undefined;
  };
  const submit = () => {
    if (inFlight.current) return;
    setErr(null);
    const missing = missingRequired(fields, values);
    if (missing.length) {
      setErr(`Please complete: ${missing.join(", ")}`);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    (id ? send(`/sessions/${id}`, "PATCH", values) : send(`/courses/${courseId}/sessions`, "POST", values))
      .then((out) => {
        setSnap(JSON.stringify(values));
        setSaved(out.message || "Session saved");
        router.push(`${backHref}&notice=${encodeURIComponent(out.message)}`);
      })
      .catch((e) => {
        inFlight.current = false;
        setErr(errMsg(e, "Save failed"));
      })
      .finally(() => setBusy(false));
  };
  const medianNote = values.autoMedian ? (
    <p className="cm-muted">The median date is calculated automatically from the start and end dates.</p>
  ) : null;
  return (
    <Frame title={title} crumbs={[...CRUMB, course.data.code, id ? "Edit Session" : "Add Session"]} active={HREF.courses}>
      <p className="cm-muted" style={{ marginBottom: 10 }}>
        <Link href={backHref}>
          ← {course.data.code} — {course.data.title}
        </Link>
        {existing.data ? ` · ${existing.data.term}` : ""}
      </p>
      <form
        className="cm-modal-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {err ? <p className="cm-error" role="alert">{err}</p> : null}
        {saved ? <SaNotice tone="success">{saved}. Returning to the course…</SaNotice> : null}
        <Sections
          fields={fields}
          values={values}
          setValue={setValue}
          meta={meta}
          render={render}
          after={{
            "Session Schedule": (
              <>
                <label className="mh-sa__field">
                  <span className="mh-sa__label">Term</span>
                  <select className="mh-sa__input" value={str(values.termId)} onChange={(e) => setValue("termId", e.target.value)} aria-label="Term">
                    <option value="">Pick from the start date</option>
                    {(meta.refs.terms ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="lx-hint">Choose the term when terms overlap; the session dates must fall within it.</span>
                </label>
                <MeetingsEditor value={meetings} onChange={(v) => setValue("meetings", v)} weekdays={meta.options.weekdays} />
              </>
            ),
            "Additional Session Dates": medianNote,
            Grading: <GradingPreview schemeId={str(values.gradingScheme)} />,
            "Session Tuition": values.tuitionIncluded ? <p className="cm-muted">Tuition for this session is part of the program cost.</p> : null,
          }}
        />
        <div className="lx-sticky-actions">
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || Boolean(saved)}>
            {busy ? "Saving…" : saved ? "Saved" : "Save Session"}
          </button>
        </div>
      </form>
    </Frame>
  );
}

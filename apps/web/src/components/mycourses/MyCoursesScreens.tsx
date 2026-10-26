"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaField, SuperFrame } from "@/components/superadmin/shared";
import { CourseCell, ErrorNotice, ScheduleCell, TableState, errMsg, json, mc, useMc, type Offering, type Option } from "./common";

const HOME = ["/admin"];

function qs(params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/* ------------------------------------------------------------------ */
/* All My Courses / Schedule                                            */
/* ------------------------------------------------------------------ */

type Schedule = {
  termOptions: string[];
  statusOptions: string[];
  term: string;
  status: string;
  rows: Array<Offering & { role: string }>;
};

export function MyCoursesSchedule() {
  const router = useRouter();
  const sp = useSearchParams();
  const term = sp?.get("term") ?? "";
  const status = sp?.get("status") ?? "";
  const { data, error, setError } = useMc<Schedule>(`/schedule${qs({ term, status })}`, "Could not load your courses");
  const go = (next: { term?: string; status?: string }) =>
    router.push(`/admin/my-courses${qs({ term: next.term ?? data?.term ?? term, status: next.status ?? data?.status ?? status })}`);

  return (
    <SuperFrame title="MY COURSES" breadcrumbs={["Home", "My Courses"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses">
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <section className="mh-sa__card">
          <div className="wk-toolbar">
            <SaField label="Filter Term">
              <select className="mh-sa__input mh-sa__input--auto" value={data?.term ?? "All Terms"} onChange={(e) => go({ term: e.target.value })}>
                {(data?.termOptions ?? ["All Terms"]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Filter Status">
              <select className="mh-sa__input mh-sa__input--auto" value={data?.status ?? "Active & Upcoming Courses"} onChange={(e) => go({ status: e.target.value })}>
                {(data?.statusOptions ?? ["Active & Upcoming Courses", "Active Courses", "Upcoming Courses", "Completed Courses"]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </SaField>
          </div>
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Delivery Method</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {!data?.rows.length ? (
                  <TableState cols={6} loading={!data} error={error} empty="No course records were found." />
                ) : (
                  data.rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <CourseCell o={o} role={o.role} />
                      </td>
                      <td>{o.delivery}</td>
                      <td className="ur-nowrap">Enrolled: {o.enrolled}</td>
                      <td>{o.status}</td>
                      <td>{o.location}</td>
                      <td>
                        <ScheduleCell dates={o.dates} days={o.days} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Course Evaluations (shown only to callers who teach)                 */
/* ------------------------------------------------------------------ */

export function MyCourseEvaluations() {
  const { data, error, setError } = useMc<{ rows: Array<Offering & { evaluation: string }> }>("/evaluations", "Could not load course evaluations");
  return (
    <SuperFrame title="COURSE EVALUATION RESULTS" breadcrumbs={["Home", "Course Evaluation Results"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses/evaluations">
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <section className="mh-sa__card">
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Evaluation</th>
                  <th>Dates</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {!data?.rows.length ? (
                  <TableState cols={4} loading={!data} error={error} empty="No course evaluations were found." />
                ) : (
                  data.rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <CourseCell o={o} offeringBelow />
                      </td>
                      <td>{o.evaluation}</td>
                      <td className="ur-nowrap">{o.datesWithWeekday}</td>
                      <td>
                        <ScheduleCell days={o.days} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Course Repository (the caller's own courses only)                    */
/* ------------------------------------------------------------------ */

export function MyCourseRepository() {
  const router = useRouter();
  const sp = useSearchParams();
  const applied = sp?.get("course") ?? "";
  const [course, setCourse] = useState(applied);
  const { data, error, setError } = useMc<{ course: string; rows: Array<{ id: string; number: string; name: string; lms: string; workspaceHref: string }> }>(
    `/repository${qs({ course: applied })}`,
    "Could not search the repository",
  );
  useEffect(() => setCourse(applied), [applied]);

  function search(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/my-courses/repository${qs({ course: course.trim() })}`);
  }

  return (
    <SuperFrame title="COURSE CONTENT REPOSITORY" breadcrumbs={["Home", "Content Repository"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses/repository">
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <form className="mh-sa__card wk-toolbar" onSubmit={search}>
          <SaField label="Course Filter">
            <input className="mh-sa__input" placeholder="Enter Course Name / Number Here" value={course} onChange={(e) => setCourse(e.target.value)} />
          </SaField>
          <div className="mh-sa__field mh-sa__field--end">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Repository
            </button>
          </div>
        </form>
        <section className="mh-sa__card">
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course Name / Number</th>
                  <th>LMS</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {!data?.rows.length ? (
                  <TableState cols={3} loading={!data} error={error} empty="No courses were found in the repository." />
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="ur-name">{r.name}</div>
                        <div className="mh-sa__sub">{r.number}</div>
                      </td>
                      <td>{r.lms}</td>
                      <td className="ur-nowrap">
                        {r.workspaceHref ? (
                          <Link className="mh-sa__btn mh-sa__btn--sm" href={r.workspaceHref}>
                            Use &amp; edit course copy
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Pending Course Schedules                                             */
/* ------------------------------------------------------------------ */

type Pending = {
  type: string;
  typeOptions: string[];
  rows: Array<{ id: string; sectionId: string; courseId: string; code: string; offering: string; title: string; changeType: string; submitted: string }>;
};

export function MyPendingSchedules() {
  const router = useRouter();
  const sp = useSearchParams();
  const applied = sp?.get("type") ?? "";
  const { data, error, setError } = useMc<Pending>(`/pending-schedules${qs({ type: applied })}`, "Could not load pending course schedules");
  const [type, setType] = useState(applied || "All Types");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [decided, setDecided] = useState<string[]>([]);
  useEffect(() => {
    if (data?.type) setType(data.type);
  }, [data?.type]);
  const rows = (data?.rows ?? []).filter((r) => !decided.includes(r.id));

  async function decide(id: string, decision: "accept" | "decline") {
    let comment = "";
    if (decision === "decline") {
      const reason = window.prompt("Reason for declining (optional):", "");
      if (reason === null) return;
      comment = reason.trim();
    }
    setBusy(id);
    setError(null);
    setNotice(null);
    try {
      const r = await mc<{ message: string }>(`/pending-schedules/${id}/decide`, json("POST", { decision, comment }));
      setDecided((prev) => [...prev, id]);
      setNotice(r.message);
    } catch (e) {
      setError(errMsg(e, "Could not save your decision"));
    } finally {
      setBusy(null);
    }
  }

  function show(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/my-courses/pending-schedules${qs({ type: type === "All Types" ? "" : type })}`);
  }

  return (
    <SuperFrame title="PENDING COURSE SCHEDULES" breadcrumbs={["Home", "Pending Course Schedules"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses/pending-schedules">
      <div className="ur">
        {notice ? (
          <div className="mh-sa__notice mh-sa__notice--success" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <form className="mh-sa__card wk-toolbar" onSubmit={show}>
          <SaField label="Change Type">
            <select className="mh-sa__input mh-sa__input--auto" value={type} onChange={(e) => setType(e.target.value)}>
              {(data?.typeOptions ?? ["All Types", "New Sessions Only", "Changes Only"]).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </SaField>
          <div className="mh-sa__field mh-sa__field--end">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Show Courses
            </button>
          </div>
        </form>
        <section className="mh-sa__card">
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Change Type</th>
                  <th>Submitted</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? (
                  <TableState cols={4} loading={!data} error={error} empty="No pending course schedules were found." />
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <CourseCell o={r} sectionId={r.sectionId} />
                      </td>
                      <td>{r.changeType}</td>
                      <td className="ur-nowrap">{r.submitted}</td>
                      <td className="ur-nowrap">
                        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy !== null} onClick={() => void decide(r.id, "accept")}>
                          Accept
                        </button>{" "}
                        <button type="button" className="mh-sa__btn" disabled={busy !== null} onClick={() => void decide(r.id, "decline")}>
                          Decline
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Grades Submission                                                    */
/* ------------------------------------------------------------------ */

type Grades = {
  courseOptions: Option[];
  statusOptions: string[];
  course: string;
  status: string;
  rows: Array<Offering & { status: string; gradingType: string }>;
};

export function MyGradesSubmission() {
  const router = useRouter();
  const sp = useSearchParams();
  const applied = { course: sp?.get("course") ?? "", status: sp?.get("status") ?? "" };
  const { data, error, setError } = useMc<Grades>(`/grades${qs(applied)}`, "Could not load grade submissions");
  const [form, setForm] = useState({ course: applied.course, status: applied.status || "Submission Required" });
  useEffect(() => {
    if (data) setForm({ course: data.course, status: data.status });
  }, [data]);

  function search(e: FormEvent) {
    e.preventDefault();
    router.push(`/admin/my-courses/grades${qs(form)}`);
  }

  return (
    <SuperFrame title="GRADES SUBMISSION" breadcrumbs={["Home", "Grades Submission"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses/grades">
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <form className="mh-sa__card wk-toolbar" onSubmit={search}>
          <SaField label="Course">
            <select className="mh-sa__input mh-sa__input--auto" value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
              {(data?.courseOptions ?? [{ value: "", label: "All Courses" }]).map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </SaField>
          <SaField label="Submission Status">
            <select className="mh-sa__input mh-sa__input--auto" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {(data?.statusOptions ?? ["Submission Required", "Pending", "Approved"]).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </SaField>
          <div className="mh-sa__field mh-sa__field--end">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Courses
            </button>
          </div>
        </form>
        <section className="mh-sa__card">
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Status</th>
                  <th>Grading Type</th>
                  <th>Course Dates</th>
                  <th className="ur-col-actions" aria-label="Submit Grades" />
                </tr>
              </thead>
              <tbody>
                {!data?.rows.length ? (
                  <TableState cols={5} loading={!data} error={error} empty="No courses were found." />
                ) : (
                  data.rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <CourseCell o={o} />
                      </td>
                      <td className={o.status === "Submission Required" ? "mc-status-required" : undefined}>{o.status}</td>
                      <td className="mc-grading-type">{o.gradingType}</td>
                      <td className="ur-nowrap">{o.dates}</td>
                      <td className="ur-nowrap">
                        <Link className="mh-sa__btn mh-sa__btn--sm" href={`/admin/my-courses/grades/submit${qs({ section: o.id })}`}>
                          Submit Grades
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Course History                                                       */
/* ------------------------------------------------------------------ */

export function MyCourseHistory() {
  const { data, error, setError } = useMc<{ rows: Array<Offering & { room: string }> }>("/history", "Could not load course history");
  return (
    <SuperFrame title="COURSE HISTORY" breadcrumbs={["Home", "Course History"]} breadcrumbHrefs={HOME} activeHref="/admin/my-courses/history">
      <div className="ur">
        <ErrorNotice error={error} onClose={() => setError(null)} />
        <section className="mh-sa__card">
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Room</th>
                  <th>Dates</th>
                  <th>Schedule</th>
                </tr>
              </thead>
              <tbody>
                {!data?.rows.length ? (
                  <TableState cols={4} loading={!data} error={error} empty="No course records were found." />
                ) : (
                  data.rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <CourseCell o={o} />
                      </td>
                      <td>{o.room}</td>
                      <td className="ur-nowrap">{o.datesWithWeekday}</td>
                      <td>
                        <ScheduleCell days={o.days} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SuperFrame>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";

function Crumb({ items }: { items: string[] }) {
  return (
    <p className="mh-hcc-profile__crumb">
      {items.map((c, i) => (
        <span key={c}>
          {i > 0 ? <span> › </span> : null}
          {c}
        </span>
      ))}
    </p>
  );
}

export function HccMyCoursesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = config.hccMyCourses;
  const rows = d?.courses ?? [];
  const term = search.get("term") || d?.termFilter || "All Terms";
  const status = search.get("status") || d?.statusFilter || "Active & Upcoming Courses";
  const termOptions = d?.termOptions?.length
    ? d.termOptions
    : ["All Terms", "Fall 2026", "Fall 2025"];
  const statusOptions = d?.statusOptions?.length
    ? d.statusOptions
    : ["Active & Upcoming Courses", "All Courses", "Ended Courses"];

  function applyFilter(next: { term?: string; status?: string }) {
    const params = new URLSearchParams();
    const nextTerm = next.term ?? term;
    const nextStatus = next.status ?? status;
    if (nextTerm && nextTerm !== "All Terms") params.set("term", nextTerm);
    if (nextStatus && nextStatus !== "Active & Upcoming Courses") params.set("status", nextStatus);
    const qs = params.toString();
    router.push(qs ? `/instructor/sections?${qs}` : "/instructor/sections");
  }

  return (
    <div className="mh-hcc-page" data-figma-id={config.figmaId}>
      <Crumb items={["Home", "My Courses"]} />
      <h1>MY COURSES</h1>
      <div className="mh-hcc-filters">
        <label>
          <span>FILTER TERM</span>
          <select value={term} onChange={(e) => applyFilter({ term: e.target.value })}>
            {termOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>FILTER STATUS</span>
          <select value={status} onChange={(e) => applyFilter({ status: e.target.value })}>
            {statusOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE</th>
            <th>DELIVERY METHOD</th>
            <th>STUDENTS</th>
            <th>ATTENDANCE</th>
            <th>STATUS</th>
            <th>LOCATION</th>
            <th>SCHEDULE</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7}>No courses found.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="is-click" onClick={() => router.push(r.href)}>
                <td>
                  <strong>
                    {r.code} ({r.section})
                  </strong>
                  <div>{r.title}</div>
                  <em>Instructor</em>
                </td>
                <td>{r.delivery}</td>
                <td>{r.students}</td>
                <td
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(r.attendanceHref || `/instructor/attendance?sectionId=${encodeURIComponent(r.id)}`);
                  }}
                >
                  <span className={`mh-hcc-att-chip is-${r.attendanceTone || "muted"}`}>
                    {r.attendanceLabel || "Not taken yet"}
                  </span>
                </td>
                <td>
                  <span className="mh-hcc-pill">{r.status}</span>
                </td>
                <td>{r.location}</td>
                <td className="mh-hcc-pre">{r.schedule}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HccEvaluationsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const rows = config.hccEvaluations?.rows ?? [];
  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Course Evaluations"]} />
      <h1>COURSE EVALUATION RESULTS</h1>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE</th>
            <th>EVALUATION</th>
            <th>DATES</th>
            <th>SCHEDULE</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No evaluations found.</td>
            </tr>
          ) : (
            rows.map((r) => {
              const href =
                r.href ||
                (r.id
                  ? `/instructor/f/t36-course-evaluations?sectionId=${encodeURIComponent(r.id)}`
                  : "");
              return (
                <tr
                  key={r.id || `${r.course}-${r.offering}`}
                  className={href ? "is-click" : undefined}
                  onClick={() => href && router.push(href)}
                >
                  <td>
                    <strong>
                      {r.course} ({r.offering})
                    </strong>
                    <div>{r.title}</div>
                  </td>
                  <td>{r.evaluation}</td>
                  <td>{r.dates}</td>
                  <td className="mh-hcc-pre">{r.schedule}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HccCourseHistoryView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const d = config.hccCourseHistory;
  const rows = d?.rows ?? [];
  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Course History"]} />
      <h1>COURSE HISTORY</h1>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE</th>
            <th>ROOM</th>
            <th>INSTRUCTOR(S)</th>
            <th>DATES</th>
            <th>SCHEDULE</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>{d?.empty || "No course history was found."}</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id || `${r.course}-${r.offering}`}
                className={r.href ? "is-click" : undefined}
                onClick={() => {
                  if (r.href) router.push(r.href);
                }}
                style={r.href ? { cursor: "pointer" } : undefined}
              >
                <td>
                  <strong className="mh-hcc-course-link">
                    {r.course} ({r.offering})
                  </strong>
                  <div>{r.title}</div>
                  {r.term ? <div className="mh-teacher-muted">{r.term}</div> : null}
                </td>
                <td>{r.room}</td>
                <td>{r.instructor || ""}</td>
                <td className="mh-hcc-profile__pre">{r.dates}</td>
                <td className="mh-hcc-profile__pre">{r.schedule}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HccGradesSubmissionView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = config.hccGradesSubmission;
  const rows = d?.rows ?? [];
  const courseOptions = d?.courseOptions?.length ? d.courseOptions : ["All Courses"];
  const statusOptions = d?.statusOptions?.length
    ? d.statusOptions
    : ["Submission Required", "Submitted", "All Statuses"];
  const rawCourse = search.get("course") || d?.courseFilter || "All Courses";
  const rawStatus = search.get("status") || d?.statusFilter || "Submission Required";
  const course = courseOptions.includes(rawCourse)
    ? rawCourse
    : d?.courseFilter && courseOptions.includes(d.courseFilter)
      ? d.courseFilter
      : "All Courses";
  const status = statusOptions.includes(rawStatus)
    ? rawStatus
    : d?.statusFilter && statusOptions.includes(d.statusFilter)
      ? d.statusFilter
      : "Submission Required";

  function applyFilters(next: { course?: string; status?: string }) {
    const params = new URLSearchParams();
    params.set("mode", "submission");
    const nextCourse = next.course ?? course;
    const nextStatus = next.status ?? status;
    if (nextCourse && nextCourse !== "All Courses") params.set("course", nextCourse);
    if (nextStatus && nextStatus !== "Submission Required") params.set("status", nextStatus);
    router.push(`/instructor/f/t62-pending-grade-submissions?${params.toString()}`);
  }

  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Grades Submission"]} />
      <h1>GRADES SUBMISSION</h1>
      <div className="mh-hcc-filters">
        <label>
          <span>COURSE</span>
          <select value={course} onChange={(e) => applyFilters({ course: e.target.value })}>
            {courseOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>SUBMISSION STATUS</span>
          <select value={status} onChange={(e) => applyFilters({ status: e.target.value })}>
            {statusOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mh-hcc-btn" onClick={() => applyFilters({})}>
          Search Courses
        </button>
      </div>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE</th>
            <th>STATUS</th>
            <th>GRADING TYPE</th>
            <th>COURSE DATES</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No courses match the selected filters.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.id}
                className={
                  r.status === "Submission Required" ? "mh-hcc-table__row is-attention" : undefined
                }
              >
                <td>
                  <strong>
                    {r.course} ({r.offering})
                  </strong>
                  <div>{r.title}</div>
                </td>
                <td>
                  <span
                    className={
                      r.status === "Submission Required"
                        ? "mh-hcc-pill is-warn"
                        : "mh-hcc-pill is-ok"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                <td>{r.gradingType}</td>
                <td>{r.dates}</td>
                <td>
                  <button type="button" className="mh-hcc-link" onClick={() => router.push(r.href)}>
                    SUBMIT GRADES
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HccPendingGradesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = config.hccPendingGrades;
  const rows = d?.rows ?? [];
  const campus = search.get("campus") || d?.campusFilter || "All Campuses";
  const course = search.get("course") || d?.courseFilter || "All Courses";
  const faculty = search.get("faculty") || d?.facultyFilter || "All Faculty / Instructors";
  const campusOptions = d?.campusOptions?.length ? d.campusOptions : ["All Campuses"];
  const courseOptions = d?.courseOptions?.length ? d.courseOptions : ["All Courses"];
  const facultyOptions = d?.facultyOptions?.length
    ? d.facultyOptions
    : ["All Faculty / Instructors"];

  function applyFilters(next: { campus?: string; course?: string; faculty?: string } = {}) {
    const params = new URLSearchParams();
    const nextCampus = next.campus ?? campus;
    const nextCourse = next.course ?? course;
    const nextFaculty = next.faculty ?? faculty;
    if (nextCampus && nextCampus !== "All Campuses") params.set("campus", nextCampus);
    if (nextCourse && nextCourse !== "All Courses") params.set("course", nextCourse);
    if (nextFaculty && nextFaculty !== "All Faculty / Instructors") params.set("faculty", nextFaculty);
    const qs = params.toString();
    router.push(
      qs
        ? `/instructor/f/t62-pending-grade-submissions?${qs}`
        : "/instructor/f/t62-pending-grade-submissions",
    );
  }

  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Pending Grade Submissions"]} />
      <h1>PENDING GRADE SUBMISSIONS</h1>
      <div className="mh-hcc-filters">
        <label>
          <span>FILTER CAMPUS</span>
          <select value={campus} onChange={(e) => applyFilters({ campus: e.target.value })}>
            {campusOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>FILTER COURSE</span>
          <select value={course} onChange={(e) => applyFilters({ course: e.target.value })}>
            {courseOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>FACULTY / INSTRUCTOR</span>
          <select value={faculty} onChange={(e) => applyFilters({ faculty: e.target.value })}>
            {facultyOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mh-hcc-btn" onClick={() => applyFilters()}>
          Search Submissions
        </button>
      </div>
      <p className="mh-hcc-results">Results: {rows.length}</p>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE</th>
            <th>INSTRUCTOR(S)</th>
            <th>DATES</th>
            <th>SUBMITTED BY</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5}>No submissions match the selected filters.</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={`${r.course}-${r.offering}`}>
                <td>
                  <strong>
                    {r.course} ({r.offering})
                  </strong>
                  <div>{r.title}</div>
                </td>
                <td>{r.instructor}</td>
                <td>{r.dates}</td>
                <td>
                  {r.submittedBy}
                  <div>{r.submittedAt}</div>
                </td>
                <td>
                  <button type="button" className="mh-hcc-link" onClick={() => router.push(r.href)}>
                    REVIEW
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function HccAttendanceView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const d = config.hccAttendance;
  const [date, setDate] = useState(d?.dateFilter || new Date().toLocaleDateString("en-CA"));
  const [studentFilter, setStudentFilter] = useState(d?.studentFilter || "");
  const [courseFilter, setCourseFilter] = useState(d?.courseFilter || "All Courses");
  const [groups, setGroups] = useState(d?.groups ?? []);
  const [weekOpen, setWeekOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setDate(d?.dateFilter || new Date().toLocaleDateString("en-CA"));
    setStudentFilter(d?.studentFilter || "");
    setCourseFilter(d?.courseFilter || "All Courses");
    setGroups(d?.groups ?? []);
  }, [d?.dateFilter, d?.studentFilter, d?.courseFilter, d?.groups]);

  const courseOptions = [
    "All Courses",
    ...[...new Set((d?.groups ?? []).map((g) => `${g.course} (${g.offering})`))].sort(),
  ];

  function load(nextDate = date) {
    const qs = new URLSearchParams();
    if (nextDate) qs.set("date", nextDate);
    const picked = (d?.groups ?? []).find((g) => courseFilter === `${g.course} (${g.offering})`);
    if (picked?.sectionId) qs.set("sectionId", picked.sectionId);
    router.push(`/instructor/attendance?${qs.toString()}`);
  }

  function setStatus(sectionId: string | undefined, studentId: string, status: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.sectionId !== sectionId
          ? g
          : { ...g, students: g.students.map((s) => (s.id === studentId ? { ...s, status } : s)) },
      ),
    );
  }

  function setNote(sectionId: string | undefined, studentId: string, note: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.sectionId !== sectionId
          ? g
          : { ...g, students: g.students.map((s) => (s.id === studentId ? { ...s, note } : s)) },
      ),
    );
  }

  function rosterPayload() {
    return JSON.stringify({
      date,
      roster: groups.flatMap((g) =>
        g.students.map((s) => ({
          studentId: s.id,
          studentNumber: s.studentNumber,
          id: s.studentNumber,
          name: s.name,
          status: s.status,
          note: s.note,
          sectionId: g.sectionId,
        })),
      ),
    });
  }

  async function save(finalize: boolean) {
    const action = finalize
      ? d?.primaryAction || config.primaryAction || "Submit Attendance"
      : d?.secondaryAction || config.secondaryAction || "Save Draft";
    setToast(null);
    const ok = await live?.runAction?.(action, rosterPayload());
    if (!ok) return;
    if (finalize) setToast("Attendance submitted.");
    if (date !== d?.dateFilter) {
      const qs = new URLSearchParams({ date });
      if (d?.sectionId) qs.set("sectionId", d.sectionId);
      router.replace(`/instructor/attendance?${qs.toString()}`);
    }
  }

  const visible = groups
    .filter((g) => courseFilter === "All Courses" || courseFilter === `${g.course} (${g.offering})`)
    .map((g) => ({
      ...g,
      students: g.students.filter((s) => {
        const q = studentFilter.trim().toLowerCase();
        if (!q) return true;
        return s.name.toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q);
      }),
    }));

  const weekDates = (() => {
    const base = new Date(`${date}T12:00:00`);
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(base);
      x.setDate(base.getDate() - 3 + i);
      const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
      return {
        value: iso,
        label: x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        active: iso === date,
      };
    });
  })();

  return (
    <div className="mh-hcc-page mh-hcc-page--attendance">
      <div className="mh-hcc-att-head">
        <div>
          <Crumb items={["Home", "Course Attendance"]} />
          <h1>COURSE ATTENDANCE</h1>
        </div>
        <div className="mh-hcc-actions">
          <button type="button" className="mh-hcc-btn ghost" onClick={() => setWeekOpen((v) => !v)}>
            Week View
          </button>
          <button type="button" className="mh-hcc-btn ghost" onClick={() => window.print()}>
            Print Roster
          </button>
          <button type="button" className="mh-hcc-btn ghost" disabled={live?.busy} onClick={() => void save(false)}>
            {live?.busy ? "Saving…" : d?.secondaryAction || "Save Draft"}
          </button>
          <button type="button" className="mh-hcc-btn" disabled={live?.busy} onClick={() => void save(true)}>
            {live?.busy ? "Submitting…" : d?.primaryAction || "Submit Attendance"}
          </button>
        </div>
      </div>
      {toast ? (
        <p className="mh-hcc-att-toast" role="status">
          {toast}
        </p>
      ) : null}
      <div className="mh-hcc-filters">
        <label>
          <span>DATE FILTER</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          <span>STUDENT FILTER</span>
          <input
            placeholder="Student # or last name"
            value={studentFilter}
            onChange={(e) => setStudentFilter(e.target.value)}
          />
        </label>
        <label>
          <span>COURSE FILTER</span>
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            {courseOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mh-hcc-btn" onClick={() => load()}>
          Load Attendance
        </button>
      </div>
      {weekOpen ? (
        <nav className="mh-week-nav" aria-label="Week view">
          {weekDates.map((w) => (
            <button
              key={w.value}
              type="button"
              className={`mh-week-nav__item${w.active ? " is-active" : ""}`}
              onClick={() => load(w.value)}
            >
              {w.label}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="mh-hcc-date-nav">
        <button
          type="button"
          onClick={() => {
            const x = new Date(`${date}T12:00:00`);
            x.setDate(x.getDate() - 1);
            load(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`);
          }}
        >
          {d?.prevLabel || "Previous"}
        </button>
        <strong>{d?.centerLabel}</strong>
        <button
          type="button"
          onClick={() => {
            const x = new Date(`${date}T12:00:00`);
            x.setDate(x.getDate() + 1);
            load(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`);
          }}
        >
          {d?.nextLabel || "Next"}
        </button>
      </div>
      {visible.every((g) => g.students.length === 0) ? (
        <p className="mh-teacher-muted">No students were found. Please change the filters above to see other possibilities.</p>
      ) : (
        visible.map((g) =>
          g.students.length === 0 ? null : (
            <section key={g.sectionId || g.offering} className="mh-hcc-att-group">
              <h2>
                {g.course} ({g.offering}) — {g.title}
              </h2>
              <p className="mh-teacher-muted">{g.meta}</p>
              <table className="mh-hcc-table">
                <thead>
                  <tr>
                    <th>STUDENT</th>
                    <th>ATTENDANCE</th>
                    <th>NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {g.students.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="mh-hcc-student-cell">
                          <span className="mh-hcc-avatar" />
                          <span>
                            <strong>{s.name}</strong>
                            <div>{s.studentNumber}</div>
                          </span>
                        </div>
                      </td>
                      <td>
                        {(["Present", "Absent", "Late", "Excused"] as const).map((opt) => (
                          <label key={opt} style={{ marginRight: 10 }}>
                            <input
                              type="radio"
                              name={`att-${g.sectionId}-${s.id}`}
                              checked={s.status === opt}
                              onChange={() => setStatus(g.sectionId, s.id, opt)}
                            />{" "}
                            {opt}
                          </label>
                        ))}
                      </td>
                      <td>
                        <input
                          className="mh-teacher-field"
                          value={s.note}
                          onChange={(e) => setNote(g.sectionId, s.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ),
        )
      )}
    </div>
  );
}

export function HccStudentsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const live = useOptionalTeacherLive();
  const d = config.hccStudents;
  const rows = d?.rows ?? [];
  const statusFromUrl = search.get("status") || d?.filters.status || "All Statuses";
  const loading = Boolean(live?.loading);

  const FILTER_META: Array<{ key: string; label: string; kind?: "select" | "date" }> = [
    { key: "campus", label: "CAMPUS" },
    { key: "program", label: "PROGRAM" },
    { key: "pathway", label: "PATHWAY" },
    { key: "schedule", label: "SCHEDULE" },
    { key: "programTerm", label: "PROGRAM TERM" },
    { key: "admissionTerm", label: "ADMISSION TERM" },
    { key: "nationality", label: "NATIONALITY" },
    { key: "status", label: "STATUS" },
    { key: "agent", label: "AGENT" },
    { key: "advisor", label: "ADVISOR" },
    { key: "startDate", label: "START DATE", kind: "date" },
    { key: "endDate", label: "END DATE", kind: "date" },
  ];

  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = { ...(d?.filters || {}) };
    if (!base.status) base.status = statusFromUrl;
    return base;
  });

  useEffect(() => {
    const next: Record<string, string> = { ...(d?.filters || {}) };
    if (!next.status) next.status = statusFromUrl;
    setDraft(next);
  }, [d?.filters, statusFromUrl]);

  function applyFilters(
    overrides: Record<string, string> = {},
    letter?: string,
    paging?: { page?: number; perPage?: number },
  ) {
    const values = { ...draft, ...overrides };
    const params = new URLSearchParams();
    const defaults: Record<string, string> = {
      campus: "All Campuses",
      program: "All Programs",
      pathway: "All Pathways",
      schedule: "All Schedules",
      programTerm: "All Program Terms",
      admissionTerm: "All Admission Terms",
      nationality: "All Nationalities",
      status: "All Statuses",
      agent: "All Agents",
      advisor: "All Advisors",
    };
    for (const [k, v] of Object.entries(values)) {
      const val = (v || "").trim();
      if (!val) continue;
      if (val.startsWith("— ")) continue; // disabled section headings
      if (defaults[k] && val.toLowerCase() === defaults[k].toLowerCase()) continue;
      if (k === "status" && (val.toLowerCase() === "all statuses" || val.toLowerCase() === "all")) continue;
      if ((k === "program" || k === "schedule") && val.toLowerCase() === "all") continue;
      params.set(k, val);
    }
    const letterValue = letter !== undefined ? letter : (d?.letter || search.get("letter") || "ALL");
    if (letterValue && letterValue !== "ALL") params.set("letter", letterValue);
    const perPage = paging?.perPage ?? d?.perPage ?? 50;
    const filterChanged = Object.keys(overrides).length > 0 || letter !== undefined || Boolean(paging?.perPage);
    const page = paging?.page ?? (filterChanged ? 1 : d?.page ?? 1);
    if (perPage && perPage !== 50) params.set("perPage", String(perPage));
    if (page && page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `/instructor/f/t12-students-view?${qs}` : "/instructor/f/t12-students-view");
  }

  function onFilterChange(key: string, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Apply immediately via API (URL → live refetch). Preserve current alphabet filter.
    applyFilters({ [key]: value }, undefined, { page: 1 });
  }

  function renderSelectOptions(key: string, value: string) {
    const menu = d?.filterMenus?.[key];
    if (menu) {
      const nodes: ReactNode[] = [];
      nodes.push(
        <option key={`${key}-all`} value={menu.all}>
          {menu.all}
        </option>,
      );
      for (const lead of menu.leading || []) {
        nodes.push(
          <option key={`${key}-lead-${lead}`} value={lead}>
            {lead}
          </option>,
        );
      }
      for (const opt of menu.flat || []) {
        nodes.push(
          <option key={`${key}-flat-${opt}`} value={opt}>
            {opt}
          </option>,
        );
      }
      for (const g of menu.groups || []) {
        const kids: ReactNode[] = [];
        for (const opt of g.options) {
          kids.push(
            <option key={`${key}-${g.label}-${opt}`} value={opt}>
              {opt}
            </option>,
          );
        }
        for (const sec of g.sections || []) {
          kids.push(
            <option key={`${key}-${g.label}-h-${sec.heading}`} disabled>
              — {sec.heading} —
            </option>,
          );
          for (const opt of sec.options) {
            kids.push(
              <option key={`${key}-${g.label}-${sec.heading}-${opt}`} value={opt}>
                {opt}
              </option>,
            );
          }
        }
        nodes.push(
          <optgroup key={`${key}-g-${g.label}`} label={g.label}>
            {kids}
          </optgroup>,
        );
      }
      return nodes;
    }
    const options = d?.filterOptions?.[key];
    return (options && options.length ? options : [value || "All"]).map((opt) => (
      <option key={opt} value={opt}>
        {opt}
      </option>
    ));
  }

  const activeLetter = (d?.letter || search.get("letter") || "ALL").toUpperCase();
  const perPageOpts = d?.perPageOptions || ["10", "25", "50", "100"];
  const totalPages = d?.totalPages || 1;

  return (
    <div className="mh-hcc-students" data-figma-id={config.figmaId}>
      <aside className="mh-hcc-students__side">
        <h3>STUDENTS BY STATUS</h3>
        <ul>
          {(d?.sidebar || []).map((s) => (
            <li key={s.label}>
              <button
                type="button"
                className={s.active || s.label === statusFromUrl ? "is-active" : ""}
                onClick={() => router.push(s.href)}
              >
                <span>{s.label}</span>
                <em>({s.count})</em>
              </button>
            </li>
          ))}
        </ul>
        <h3>STUDENT MANAGEMENT</h3>
        <ul>
          {(d?.management || []).map((m) => (
            <li key={m.label}>
              <button type="button" onClick={() => router.push(m.href)}>
                <span>{m.label}</span>
                {m.count != null ? <em>({m.count})</em> : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="mh-hcc-students__main">
        <h1>{config.title || "STUDENTS"}</h1>
        <div className="mh-hcc-filters mh-hcc-filters--wrap">
          {FILTER_META.map((m) => {
            const value = draft[m.key] ?? "";
            if (m.kind === "date") {
              return (
                <label key={m.key}>
                  <span>{m.label}:</span>
                  <input
                    type="date"
                    value={value}
                    onChange={(e) => onFilterChange(m.key, e.target.value)}
                  />
                </label>
              );
            }
            return (
              <label key={m.key}>
                <span>{m.label}</span>
                <select
                  value={value || d?.filterMenus?.[m.key]?.all || d?.filterOptions?.[m.key]?.[0] || ""}
                  onChange={(e) => onFilterChange(m.key, e.target.value)}
                >
                  {renderSelectOptions(m.key, value)}
                </select>
              </label>
            );
          })}
          <button type="button" className="mh-hcc-btn" onClick={() => applyFilters()}>
            Search Students
          </button>
        </div>
        <div className="mh-hcc-alpha">
          {["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((ch) => (
            <button
              key={ch}
              type="button"
              className={activeLetter === ch ? "is-active" : ""}
              onClick={() => applyFilters({}, ch)}
            >
              {ch}
            </button>
          ))}
        </div>
        <div className="mh-hcc-results-bar">
          <span>
            Results: {loading ? "…" : (d?.results ?? rows.length).toLocaleString()}
            {loading ? " · Loading…" : ""}
          </span>
          <label>
            Results per page
            <select
              value={String(d?.perPage ?? 50)}
              onChange={(e) => applyFilters({}, undefined, { perPage: Number(e.target.value), page: 1 })}
            >
              {perPageOpts.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Page
            <select
              value={String(d?.page ?? 1)}
              onChange={(e) => applyFilters({}, undefined, { page: Number(e.target.value) })}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {d?.empty && rows.length === 0 ? (
          <p className="mh-teacher-muted">{d.empty}</p>
        ) : (
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th />
                <th>
                  NAME <span className="mh-hcc-sort">↕</span>
                </th>
                <th>STATUS</th>
                <th>ADVISORS</th>
                <th>PROGRAM</th>
                <th>PROGRAM TERM</th>
                <th>ADMISSION TERM</th>
                <th>DATE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="mh-hcc-avatar" />
                  </td>
                  <td>
                    <strong>{r.name}</strong>
                    <div>{r.studentNumber}</div>
                  </td>
                  <td>
                    <span className="mh-hcc-pill">{r.status}</span>
                  </td>
                  <td>{r.advisors}</td>
                  <td>{r.program}</td>
                  <td>{r.programTerm}</td>
                  <td>{r.admissionTerm}</td>
                  <td>{r.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function HccFlagsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const d = config.hccFlags;
  const rows = d?.rows ?? [];
  const [student, setStudent] = useState("");
  const [status, setStatus] = useState("Active");
  const [resolved, setResolved] = useState("All");
  const [flagType, setFlagType] = useState("All Flags");
  const needle = student.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (needle && !r.student.toLowerCase().includes(needle)) return false;
    if (status !== "All" && r.status !== status) return false;
    if (resolved !== "All" && (r.resolved || "No") !== resolved) return false;
    if (flagType !== "All Flags" && !r.description.toUpperCase().startsWith(flagType)) return false;
    return true;
  });

  async function act(action: "Dismiss Flag" | "Delete Flag", id: string) {
    if (action === "Delete Flag" && !window.confirm("Delete this flag? This cannot be undone.")) return;
    await live?.runAction(action, id);
  }

  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Student Flags"]} />
      <div className="mh-hcc-page__head">
        <h1>STUDENT FLAGS</h1>
        <button type="button" className="mh-hcc-btn" onClick={() => router.push("/instructor/f/t45-create-flag")}>
          Create Flag
        </button>
      </div>
      <div className="mh-hcc-filters">
        <label>
          <span>STUDENT FILTER</span>
          <input
            placeholder="Enter student # or name"
            value={student}
            onChange={(e) => setStudent(e.target.value)}
          />
        </label>
        <label>
          <span>STATUS</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Active</option>
            <option>Dismissed</option>
            <option>All</option>
          </select>
        </label>
        <label>
          <span>RESOLVED</span>
          <select value={resolved} onChange={(e) => setResolved(e.target.value)}>
            <option>All</option>
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>
        <label>
          <span>FLAG TYPE</span>
          <select value={flagType} onChange={(e) => setFlagType(e.target.value)}>
            <option>All Flags</option>
            {(d?.flagTypes ?? []).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mh-hcc-results">Results: {visible.length}</p>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th />
            <th>STUDENT</th>
            <th>DESCRIPTION</th>
            <th>STATUS</th>
            <th>APPLIES HOLD</th>
            <th>DATE</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={7}>
                {live?.loading
                  ? "Loading flags…"
                  : rows.length
                    ? "No flags match these filters."
                    : "You have not raised any student flags yet. Use Create Flag to add one."}
              </td>
            </tr>
          ) : null}
          {visible.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="mh-hcc-avatar" />
              </td>
              <td>
                {r.href ? (
                  <button type="button" className="mh-hcc-link" onClick={() => router.push(r.href!)}>
                    {r.student}
                  </button>
                ) : (
                  r.student
                )}
              </td>
              <td>{r.description}</td>
              <td>{r.status}</td>
              <td>{r.appliesHold}</td>
              <td>{r.date}</td>
              <td>
                {r.canEdit ? (
                  <>
                    {r.status !== "Dismissed" ? (
                      <button
                        type="button"
                        className="mh-hcc-link"
                        disabled={live?.busy}
                        onClick={() => void act("Dismiss Flag", r.id)}
                      >
                        DISMISS
                      </button>
                    ) : null}{" "}
                    <button
                      type="button"
                      className="mh-hcc-link"
                      disabled={live?.busy}
                      onClick={() => void act("Delete Flag", r.id)}
                    >
                      DELETE
                    </button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HccEmptyView({ config }: { config: TeacherScreenConfig }) {
  return (
    <div className="mh-hcc-page">
      <Crumb items={config.breadcrumbs || ["Home"]} />
      <h1>{config.title}</h1>
      <p className="mh-teacher-muted">{config.hccEmpty?.empty || "No records were found."}</p>
    </div>
  );
}

export function HccRepositoryView({ config }: { config: TeacherScreenConfig }) {
  const d = config.hccRepository;
  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Content Repository"]} />
      <h1>COURSE CONTENT REPOSITORY</h1>
      <div className="mh-hcc-filters">
        <label>
          <span>COURSE FILTER</span>
          <input placeholder={d?.placeholder || "Enter Course Name / Number Here"} />
        </label>
        <button type="button" className="mh-hcc-btn">
          Search Repository
        </button>
      </div>
      <table className="mh-hcc-table">
        <thead>
          <tr>
            <th>COURSE NAME / NUMBER</th>
            <th>LMS</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2}>{d?.empty || "No courses were found in the repository."}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function HccPendingSchedulesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = config.hccPendingSchedules;
  const changeType = search.get("type") || d?.changeType || "All Types";
  const show = search.get("show") === "1" || Boolean(d?.show);
  const rows = show ? d?.rows ?? [] : [];
  const typeOptions = d?.changeTypeOptions?.length
    ? d.changeTypeOptions
    : ["All Types", "New Schedule", "Schedule Change", "Schedule Update"];

  function apply(next: { type?: string; show?: boolean } = {}) {
    const params = new URLSearchParams();
    const nextType = next.type ?? changeType;
    const nextShow = next.show ?? true;
    if (nextType && nextType !== "All Types") params.set("type", nextType);
    if (nextShow) params.set("show", "1");
    const qs = params.toString();
    router.push(
      qs
        ? `/instructor/f/t38-pending-course-schedules?${qs}`
        : "/instructor/f/t38-pending-course-schedules",
    );
  }

  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Pending Course Schedules"]} />
      <h1>PENDING COURSE SCHEDULES</h1>
      <div className="mh-hcc-filters">
        <label>
          <span>CHANGE TYPE</span>
          <select
            value={changeType}
            onChange={(e) => {
              // Keep current show state when changing type if already showing
              apply({ type: e.target.value, show });
            }}
          >
            {typeOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="mh-hcc-btn" onClick={() => apply({ show: true })}>
          Show Courses
        </button>
      </div>

      {!show ? (
        <p className="mh-teacher-muted">
          {d?.empty || "Choose a change type, then click Show Courses."}
        </p>
      ) : (
        <>
          <p className="mh-hcc-results">Results: {rows.length}</p>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>COURSE</th>
                <th>CHANGE TYPE</th>
                <th>SCHEDULE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>{d?.empty || "No pending course schedules were found."}</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id || `${r.course}-${r.offering}-${r.type}`}>
                    <td>
                      <strong>
                        {r.course}
                        {r.offering ? ` (${r.offering})` : ""}
                      </strong>
                      {r.title ? <div>{r.title}</div> : null}
                      {r.location ? <div className="mh-teacher-muted">{r.location}</div> : null}
                    </td>
                    <td>{r.type}</td>
                    <td className="mh-hcc-profile__pre">{r.schedule || "TBA"}</td>
                    <td>
                      <span
                        className={`mh-teacher-badge ${
                          r.tone === "danger"
                            ? "is-danger"
                            : r.tone === "info"
                              ? "is-info"
                              : r.tone === "success"
                                ? "is-success"
                                : "is-warning"
                        }`}
                      >
                        {r.status || "Pending"}
                      </span>
                      {r.requested ? (
                        <div className="mh-teacher-muted">Requested {r.requested}</div>
                      ) : null}
                      {r.proposer ? <div className="mh-teacher-muted">{r.proposer}</div> : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mh-hcc-link"
                        onClick={() => router.push(r.href || "/instructor/sections")}
                      >
                        REVIEW
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export function HccTranscriptPendingView({ config }: { config: TeacherScreenConfig }) {
  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Pending Transcript Changes"]} />
      <h1>PENDING TRANSCRIPT CHANGES</h1>
      <div className="mh-hcc-banner-alert">{config.hccTranscriptPending?.banner}</div>
    </div>
  );
}

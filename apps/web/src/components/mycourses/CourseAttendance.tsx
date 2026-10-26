"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaField, SuperFrame } from "@/components/superadmin/shared";
import { errMsg, json, mc, offeringHref, type Option } from "./common";

type Mark = "" | "present" | "absent";
type Day = {
  date: string;
  weekday: string;
  label: string;
  previous: string;
  next: string;
  student: string;
  course: string;
  courseOptions: Option[];
  groups: Array<{
    course: { id: string; courseId: string; code: string; offering: string; title: string; dates: string };
    students: Array<{ id: string; name: string; studentNumber: string; status: Mark; note: string }>;
  }>;
  records: number;
  totalStudents: number;
  banner: string;
};

const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
const fmt = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : iso;
};
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

function attendanceUrl(p: { date: string; student: string; course: string }) {
  const sp = new URLSearchParams();
  if (p.date) sp.set("date", p.date);
  if (p.student.trim()) sp.set("student", p.student.trim());
  if (p.course) sp.set("course", p.course);
  const s = sp.toString();
  return `/admin/my-courses/attendance${s ? `?${s}` : ""}`;
}

const markKey = (sectionId: string, studentId: string) => `${sectionId}:${studentId}`;

export function CourseAttendance() {
  const router = useRouter();
  const sp = useSearchParams();
  const key = sp?.toString() ?? "";
  const params = useMemo(() => new URLSearchParams(key), [key]);
  const applied = { date: params.get("date") ?? "", student: params.get("student") ?? "", course: params.get("course") ?? "" };
  const [form, setForm] = useState(applied);
  const [day, setDay] = useState<Day | null>(null);
  const [marks, setMarks] = useState<Record<string, { status: Mark; note: string }>>({});
  const [weekOpen, setWeekOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams();
    for (const k of ["date", "student", "course"]) if (params.get(k)) q.set(k, params.get(k)!);
    setError(null);
    setDay(null);
    mc<Day>(`/attendance${q.toString() ? `?${q.toString()}` : ""}`)
      .then((d) => {
        setDay(d);
        setForm({ date: d.date, student: d.student, course: d.course });
        const next: Record<string, { status: Mark; note: string }> = {};
        for (const g of d.groups) for (const s of g.students) next[markKey(g.course.id, s.id)] = { status: s.status, note: s.note };
        setMarks(next);
      })
      .catch((e) => setError(errMsg(e, "Could not load attendance")));
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  function onLoad(e: FormEvent) {
    e.preventDefault();
    const url = attendanceUrl(form);
    if (url === attendanceUrl(applied)) load();
    else router.push(url);
  }

  const setMark = (k: string, patch: Partial<{ status: Mark; note: string }>) =>
    setMarks((m) => ({ ...m, [k]: { ...(m[k] ?? { status: "", note: "" }), ...patch } }));

  async function save() {
    if (!day) return;
    setBusy(true);
    setError(null);
    try {
      const payload = day.groups.flatMap((g) =>
        g.students.map((s) => {
          const m = marks[markKey(g.course.id, s.id)] ?? { status: "", note: "" };
          return { sectionId: g.course.id, studentId: s.id, status: m.status, note: m.note };
        }),
      );
      const r = await mc<{ message: string }>("/attendance", json("PUT", { date: day.date, marks: payload }));
      setNotice(r.message);
      load();
    } catch (e) {
      setError(errMsg(e, "Could not save attendance"));
    } finally {
      setBusy(false);
    }
  }

  const date = day?.date ?? applied.date;
  const weekDates = date ? Array.from({ length: 7 }, (_, i) => shift(date, i - 3)) : [];

  return (
    <SuperFrame
      title="COURSE ATTENDANCE"
      breadcrumbs={["Home", "Course Attendance"]}
      breadcrumbHrefs={["/admin"]}
      activeHref="/admin/my-courses/attendance"
      actions={
        <div className="wk-links wk-noprint">
          <button type="button" className="mh-sa__link" onClick={() => setWeekOpen((v) => !v)}>
            Week View
          </button>
          <button type="button" className="mh-sa__link" onClick={() => window.print()}>
            Print Roster
          </button>
        </div>
      }
    >
      <div className="ur wk-attendance">
        {notice ? (
          <div className="mh-sa__notice mh-sa__notice--success" role="status">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
        {error ? (
          <div className="mh-sa__notice mh-sa__notice--error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}

        <form className="mh-sa__card wk-noprint" onSubmit={onLoad}>
          <div className="wk-filters">
            <SaField label="Date Filter">
              <input className="mh-sa__input" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </SaField>
            <SaField label="Student Filter">
              <input className="mh-sa__input" placeholder="Student # or last name" value={form.student} onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))} />
            </SaField>
            <SaField label="Course Filter">
              <select className="mh-sa__input" value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))}>
                {(day?.courseOptions ?? [{ value: "", label: "All Courses" }]).map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </SaField>
            <div className="mh-sa__field mh-sa__field--end">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
                Load Attendance
              </button>
            </div>
          </div>
          {weekOpen && weekDates.length ? (
            <div className="wk-links">
              {weekDates.map((d) => (
                <Link key={d} href={attendanceUrl({ ...applied, date: d })} aria-current={d === date ? "date" : undefined}>
                  {d === date ? <strong>{fmt(d)}</strong> : fmt(d)}
                </Link>
              ))}
            </div>
          ) : null}
        </form>

        {day ? (
          <div className="wk-datebar">
            <Link className="wk-noprint" href={attendanceUrl({ ...applied, date: day.previous })}>
              « {fmt(day.previous)}
            </Link>
            <strong>
              ATTENDANCE FOR: {day.label.toUpperCase()} ({day.weekday.toUpperCase()})
            </strong>
            <Link className="wk-noprint" href={attendanceUrl({ ...applied, date: day.next })}>
              {fmt(day.next)} »
            </Link>
          </div>
        ) : null}

        {!day ? (
          error ? null : <p className="mh-sa__muted">Loading attendance…</p>
        ) : !day.groups.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No students were found. Please change the filters above to see other possibilities.</p>
          </section>
        ) : (
          <>
            {day.groups.map((g) => (
              <section key={g.course.id} className="mh-sa__card wk-roster">
                <div className="mh-sa__card-head">
                  <h2>
                    <Link href={offeringHref(g.course.id)}>
                      {g.course.code} ({g.course.offering})
                    </Link>{" "}
                    — {g.course.title} <span className="mc-group-meta">({g.course.dates})</span>
                  </h2>
                </div>
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Attendance</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.students.map((s) => {
                        const k = markKey(g.course.id, s.id);
                        const m = marks[k] ?? { status: "", note: "" };
                        return (
                          <tr key={k}>
                            <td>
                              <div className="mc-student">
                                <span className="mc-avatar" aria-hidden>
                                  {initials(s.name)}
                                </span>
                                <span>
                                  <div className="ur-name">{s.name}</div>
                                  <div className="mh-sa__sub">{s.studentNumber}</div>
                                </span>
                              </div>
                            </td>
                            <td className="ur-nowrap">
                              <span className="wk-marks" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                                {(["present", "absent"] as const).map((v) => (
                                  <label key={v} className={`wk-mark wk-mark--${v}${m.status === v ? " is-on" : ""}`}>
                                    <input type="radio" name={k} checked={m.status === v} onChange={() => setMark(k, { status: v })} />
                                    {v === "present" ? "Present" : "Absent"}
                                  </label>
                                ))}
                              </span>
                            </td>
                            <td>
                              <textarea className="mh-sa__input mc-note" rows={1} maxLength={500} value={m.note} onChange={(e) => setMark(k, { note: e.target.value })} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <section className="mh-sa__card mc-save-bar">
              <div className="mc-counters">
                <span>Attendance Records: {day.records}</span>
                <span>Total Students: {day.totalStudents}</span>
              </div>
              {day.banner ? <div className="mc-banner">{day.banner}</div> : null}
              <div className="mh-sa__actions wk-noprint">
                <span />
                <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save Attendance"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </SuperFrame>
  );
}

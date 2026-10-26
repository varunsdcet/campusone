"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaField, SuperFrame } from "@/components/superadmin/shared";
import { Notices, StudentCell, errMsg, fmtDate, fmtWeekday, json, useMeta, ws, type StudentRef } from "./common";

type Mark = "" | "present" | "absent";
type Day = {
  date: string;
  previous: string;
  next: string;
  total: number;
  groups: Array<{ workshop: { id: string; title: string; code: string; time: string; location: string }; students: Array<{ student: StudentRef; status: Mark; note: string }> }>;
};
type Week = {
  date: string;
  days: string[];
  previous: string;
  next: string;
  rows: Array<{ workshop: { id: string; title: string; code: string }; roster: number; cells: Array<{ date: string; scheduled: boolean; enrolled: number; present: number; absent: number }> }>;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function attendanceUrl(p: { date: string; student: string; workshop: string; view?: string }) {
  const sp = new URLSearchParams({ date: p.date });
  if (p.student.trim()) sp.set("student", p.student.trim());
  if (p.workshop) sp.set("workshop", p.workshop);
  if (p.view === "week") sp.set("view", "week");
  return `/admin/workshops/attendance?${sp.toString()}`;
}

const markKey = (workshopId: string, studentId: string) => `${workshopId}:${studentId}`;

export function WorkshopAttendance() {
  const router = useRouter();
  const sp = useSearchParams();
  const meta = useMeta();
  const key = sp?.toString() ?? "";
  const params = useMemo(() => new URLSearchParams(key), [key]);
  const applied = { date: params.get("date") || todayIso(), student: params.get("student") ?? "", workshop: params.get("workshop") ?? "", view: params.get("view") ?? "" };
  const [form, setForm] = useState(applied);
  const [day, setDay] = useState<Day | null>(null);
  const [week, setWeek] = useState<Week | null>(null);
  const [marks, setMarks] = useState<Record<string, { status: Mark; note: string }>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ date: params.get("date") || todayIso() });
    if (params.get("student")) q.set("student", params.get("student")!);
    if (params.get("workshop")) q.set("workshop", params.get("workshop")!);
    setError(null);
    if (params.get("view") === "week") {
      setWeek(null);
      ws<Week>(`/attendance/week?${q.toString()}`)
        .then(setWeek)
        .catch((e) => setError(errMsg(e, "Could not load the week view")));
      return;
    }
    setDay(null);
    ws<Day>(`/attendance?${q.toString()}`)
      .then((d) => {
        setDay(d);
        const next: Record<string, { status: Mark; note: string }> = {};
        for (const g of d.groups) for (const s of g.students) next[markKey(g.workshop.id, s.student.id)] = { status: s.status, note: s.note };
        setMarks(next);
        setDirty(false);
      })
      .catch((e) => setError(errMsg(e, "Could not load attendance")));
  }, [params]);

  useEffect(() => {
    setForm({ date: params.get("date") || todayIso(), student: params.get("student") ?? "", workshop: params.get("workshop") ?? "", view: params.get("view") ?? "" });
    load();
  }, [params, load]);

  function onLoad(e: FormEvent) {
    e.preventDefault();
    const url = attendanceUrl({ ...form, view: applied.view });
    if (url === attendanceUrl(applied)) load();
    else router.push(url);
  }

  const setMark = (k: string, patch: Partial<{ status: Mark; note: string }>) => {
    setMarks((m) => ({ ...m, [k]: { ...(m[k] ?? { status: "", note: "" }), ...patch } }));
    setDirty(true);
  };

  async function save() {
    if (!day) return;
    setBusy(true);
    setError(null);
    try {
      const payload = day.groups.flatMap((g) =>
        g.students.map((s) => {
          const m = marks[markKey(g.workshop.id, s.student.id)] ?? { status: "", note: "" };
          return { workshopId: g.workshop.id, studentId: s.student.id, status: m.status, note: m.note };
        }),
      );
      const r = await ws<{ message: string }>("/attendance", json("PUT", { date: day.date, marks: payload }));
      setNotice(r.message);
      load();
    } catch (e) {
      setError(errMsg(e, "Could not save attendance"));
    } finally {
      setBusy(false);
    }
  }

  const date = day?.date ?? week?.date ?? applied.date;
  const prev = day?.previous ?? week?.previous ?? "";
  const next = day?.next ?? week?.next ?? "";
  const isWeek = applied.view === "week";

  return (
    <SuperFrame title="WORKSHOP ATTENDANCE" breadcrumbs={["Home", "Workshop Attendance"]} breadcrumbHrefs={["/admin"]} activeHref="/admin/workshops/attendance">
      <div className="ur wk-attendance">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />

        <form className="mh-sa__card wk-noprint" onSubmit={onLoad}>
          <div className="wk-filters">
            <SaField label="Date Filter">
              <input className="mh-sa__input" type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </SaField>
            <SaField label="Student Filter">
              <input className="mh-sa__input" placeholder="Student # or last name" value={form.student} onChange={(e) => setForm((f) => ({ ...f, student: e.target.value }))} />
            </SaField>
            <SaField label="Workshop Filter">
              <select className="mh-sa__input" value={form.workshop} onChange={(e) => setForm((f) => ({ ...f, workshop: e.target.value }))}>
                <option value="">All Workshops</option>
                {(meta?.workshops ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
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
          <div className="wk-links">
            <Link href={attendanceUrl({ ...applied, view: isWeek ? "" : "week" })}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              {isWeek ? "Day View" : "Week View"}
            </Link>
            <button type="button" className="mh-sa__link" onClick={() => window.print()}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="7" />
              </svg>
              Print Roster
            </button>
          </div>
        </form>

        <div className="wk-datebar">
          {prev ? (
            <Link className="wk-noprint" href={attendanceUrl({ ...applied, date: prev })}>
              « {fmtDate(prev)}
            </Link>
          ) : (
            <span />
          )}
          <strong>
            {isWeek && week ? `WEEK OF: ${fmtDate(week.days[0]).toUpperCase()} – ${fmtDate(week.days[6]).toUpperCase()}` : `ATTENDANCE FOR: ${fmtDate(date).toUpperCase()} (${fmtWeekday(date).toUpperCase()})`}
          </strong>
          {next ? (
            <Link className="wk-noprint" href={attendanceUrl({ ...applied, date: next })}>
              {fmtDate(next)} »
            </Link>
          ) : (
            <span />
          )}
        </div>

        {isWeek ? (
          !week ? (
            error ? null : <p className="mh-sa__muted">Loading week…</p>
          ) : !week.rows.length ? (
            <section className="mh-sa__card">
              <p className="mh-sa__empty">No students were found. Please change the filters above to see other possibilities.</p>
            </section>
          ) : (
            <section className="mh-sa__card">
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table wk-week">
                  <thead>
                    <tr>
                      <th>Workshop</th>
                      {week.days.map((d) => (
                        <th key={d}>
                          <Link href={attendanceUrl({ ...applied, date: d, view: "" })}>
                            {fmtWeekday(d)} {fmtDate(d).replace(/, \d{4}$/, "")}
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {week.rows.map((r) => (
                      <tr key={r.workshop.id}>
                        <td>
                          <div className="ur-name">{r.workshop.title}</div>
                          <div className="mh-sa__sub">
                            {r.workshop.code} · {r.roster} student{r.roster === 1 ? "" : "s"}
                          </div>
                        </td>
                        {r.cells.map((c) => (
                          <td key={c.date} className={c.scheduled ? "wk-cell" : "wk-cell wk-cell--off"}>
                            {c.scheduled ? (
                              <Link href={attendanceUrl({ ...applied, date: c.date, workshop: r.workshop.id, view: "" })}>
                                <span className="wk-p">{c.present}P</span> <span className="wk-a">{c.absent}A</span>
                                <span className="mh-sa__sub">{Math.max(0, c.enrolled - c.present - c.absent)} unmarked</span>
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        ) : !day ? (
          error ? null : <p className="mh-sa__muted">Loading attendance…</p>
        ) : !day.groups.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No students were found. Please change the filters above to see other possibilities.</p>
          </section>
        ) : (
          <>
            {day.groups.map((g) => (
              <section key={g.workshop.id} className="mh-sa__card wk-roster">
                <div className="mh-sa__card-head">
                  <h2>
                    {g.workshop.title} <span className="wk-roster-meta">({g.workshop.code}{g.workshop.time ? ` · ${g.workshop.time}` : ""}{g.workshop.location ? ` · ${g.workshop.location}` : ""})</span>
                  </h2>
                  <div className="mh-sa__card-actions wk-noprint">
                    <button
                      type="button"
                      className="mh-sa__btn mh-sa__btn--sm"
                      onClick={() => {
                        for (const s of g.students) setMark(markKey(g.workshop.id, s.student.id), { status: "present" });
                      }}
                    >
                      Mark All Present
                    </button>
                  </div>
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
                        const k = markKey(g.workshop.id, s.student.id);
                        const m = marks[k] ?? { status: "", note: "" };
                        return (
                          <tr key={k}>
                            <td>
                              <StudentCell student={s.student} />
                            </td>
                            <td className="ur-nowrap">
                              <span className="wk-marks" role="radiogroup" aria-label={`Attendance for ${s.student.name}`}>
                                {(["present", "absent"] as const).map((v) => (
                                  <label key={v} className={`wk-mark wk-mark--${v}${m.status === v ? " is-on" : ""}`}>
                                    <input type="radio" name={k} checked={m.status === v} onChange={() => setMark(k, { status: v })} />
                                    {v === "present" ? "Present" : "Absent"}
                                  </label>
                                ))}
                                {m.status ? (
                                  <button type="button" className="mh-sa__link wk-noprint" onClick={() => setMark(k, { status: "" })}>
                                    Clear
                                  </button>
                                ) : null}
                              </span>
                            </td>
                            <td>
                              <input className="mh-sa__input" maxLength={500} value={m.note} placeholder="Optional" onChange={(e) => setMark(k, { note: e.target.value })} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
            <div className="mh-sa__actions wk-noprint">
              <span className="mh-sa__muted">
                Total Students: {day.total}
                {dirty ? " · unsaved changes" : ""}
              </span>
              <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={() => void save()}>
                {busy ? "Saving…" : "Save Attendance"}
              </button>
            </div>
          </>
        )}
      </div>
    </SuperFrame>
  );
}

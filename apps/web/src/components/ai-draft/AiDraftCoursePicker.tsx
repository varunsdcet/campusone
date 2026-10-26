"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, loadSession } from "@/lib/api";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";

type Row = NonNullable<TeacherScreenConfig["activeCourses"]>["rows"][number];

export function AiDraftCoursePicker() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (!session?.accessToken) return;
    api<{ payload?: Partial<TeacherScreenConfig> }>(
      `/instructor/sis/screen?path=${encodeURIComponent("/instructor/f/t56-active-courses")}`,
      {},
      session.accessToken,
    )
      .then((res) => setRows((res.payload?.activeCourses?.rows ?? []).filter((r) => r.id && /^[0-9a-z-]{36}$/i.test(r.id))))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your courses"));
  }, []);

  return (
    <div className="mh-teacher-stack">
      <section className="mh-teacher-card">
        <h2>AI Draft</h2>
        <p className="mh-teacher-muted">
          Pick one of your courses. AI Draft writes a lesson, a practice quiz and a narrated video slideshow from that course&apos;s
          catalogue record and topics, and adds it to the topic you choose — students see it on their course page.
        </p>
        {error ? <p role="alert">{error}</p> : null}
        {rows === null && !error ? <p className="mh-teacher-muted">Loading your courses…</p> : null}
        {rows && rows.length === 0 ? <p className="mh-teacher-muted">You are not assigned to any active course sections.</p> : null}
        {rows && rows.length ? (
          <table className="mh-teacher-table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Section</th>
                <th>Dates</th>
                <th>Enrolment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.code && r.title ? `${r.code} · ${r.title}` : r.course}</td>
                  <td>{r.section || "—"}</td>
                  <td>{r.dates}</td>
                  <td>{r.enrolment}</td>
                  <td>
                    <Link className="mh-teacher-btn" href={`/instructor/f/t56-active-courses?view=${encodeURIComponent(r.id!)}&aiDraft=1`}>
                      ✦ AI draft in this course
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </div>
  );
}

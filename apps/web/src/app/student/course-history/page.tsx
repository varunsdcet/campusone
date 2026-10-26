"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { formatHccDate } from "@/lib/hccCourseFormat";

type HistoryRow = {
  enrolmentId: string;
  courseCode: string;
  title: string;
  credits: number;
  termCode: string;
  termName: string;
  sectionCode: string;
  status: string;
  attemptNumber: number;
  isRetake: boolean;
  continuous?: boolean;
  averagePercent: number | null;
  letter: string;
  sectionId: string;
  instructorName?: string | null;
  room?: string | null;
  scheduleText?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
};

type HistoryPayload = {
  previous: HistoryRow[];
  current: HistoryRow[];
  withdrawn: HistoryRow[];
  retakes: HistoryRow[];
};

function formatHistoryDates(row: HistoryRow) {
  if (row.continuous) return "Continuous";
  const start = formatHccDate(row.startsOn);
  const end = formatHccDate(row.endsOn);
  if (start && end) {
    if (start === end) return start;
    return `${start}\n${end}`;
  }
  if (start || end) return start || end || "—";
  return "Continuous";
}

export default function CourseHistoryPage() {
  const router = useRouter();
  const [data, setData] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<HistoryPayload>("/student/course-history", {}, session.accessToken)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load course history"));
  }, [router]);

  const rows = useMemo(() => {
    if (!data) return [];
    const seen = new Set<string>();
    return [...data.current, ...data.previous, ...data.withdrawn, ...data.retakes].filter((row) => {
      if (seen.has(row.enrolmentId)) return false;
      seen.add(row.enrolmentId);
      return true;
    });
  }, [data]);

  return (
    <StudentSisShell title="" activeHref="/student/course-history" userName={name}>
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-12">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Course History
        </p>
        <h1>COURSE HISTORY</h1>
        {error ? <p className="mh-teacher-muted" style={{ color: "#b42318" }}>{error}</p> : null}
        {!data && !error ? <p className="mh-teacher-muted">Loading course history…</p> : null}
        {data ? (
          <table className="mh-hcc-table mh-hcc-table--campus">
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
                  <td colSpan={5}>No course history found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.enrolmentId}
                    className="is-click"
                    onClick={() => router.push(`/student/courses/${row.sectionId}`)}
                  >
                    <td>
                      <strong className="mh-hcc-course-link">{row.courseCode}</strong>
                      <div className="mh-hcc-course-title">{row.title}</div>
                      <div className="mh-hcc-course-ref">{row.sectionCode}</div>
                    </td>
                    <td>{row.room || ""}</td>
                    <td>{row.instructorName || ""}</td>
                    <td className="mh-hcc-pre">{formatHistoryDates(row)}</td>
                    <td className="mh-hcc-pre">{row.scheduleText || ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}
      </div>
    </StudentSisShell>
  );
}

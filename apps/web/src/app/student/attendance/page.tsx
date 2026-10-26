"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentAttendanceResponse } from "@myheritage/contracts";
import { Banner, Button, EmptyState, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { ApiError, api, clearSession, loadSession, type Session } from "@/lib/api";

type ViewState = "loading" | "ready" | "permission-denied" | "offline" | "error";

function toneForStatus(status: string): "success" | "danger" | "warning" | "neutral" {
  if (status === "present") return "success";
  if (status === "absent") return "danger";
  if (status === "late" || status === "excused") return "warning";
  return "neutral";
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudentAttendancePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentAttendanceResponse | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (activeSession: Session) => {
      setViewState("loading");
      setLoadError(null);
      try {
        const response = await api<StudentAttendanceResponse>("/student/attendance", {}, activeSession.accessToken);
        setData(response);
        const firstCourse = response.records[0]?.courseCode ?? null;
        setSelectedCourse((prev) => prev ?? firstCourse);
        setSelectedId((prev) => prev ?? response.records[0]?.id ?? null);
        setViewState("ready");
      } catch (err) {
        setData(null);
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          router.replace("/login");
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setViewState("permission-denied");
          return;
        }
        if ((typeof navigator !== "undefined" && !navigator.onLine) || err instanceof TypeError) {
          setViewState("offline");
          return;
        }
        setLoadError(err instanceof Error ? err.message : "Failed to load attendance");
        setViewState("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    if (!s.roles.includes("student")) {
      setViewState("permission-denied");
      return;
    }
    void load(s);
  }, [load, router]);

  const courses = useMemo(() => {
    const map = new Map<
      string,
      { courseCode: string; present: number; absent: number; late: number; excused: number; total: number }
    >();
    for (const row of data?.records ?? []) {
      const current = map.get(row.courseCode) ?? {
        courseCode: row.courseCode,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      };
      current.total += 1;
      if (row.status === "present") current.present += 1;
      if (row.status === "absent") current.absent += 1;
      if (row.status === "late") current.late += 1;
      if (row.status === "excused") current.excused += 1;
      map.set(row.courseCode, current);
    }
    return [...map.values()];
  }, [data]);

  const courseRecords = useMemo(
    () => (data?.records ?? []).filter((row) => !selectedCourse || row.courseCode === selectedCourse),
    [data, selectedCourse],
  );

  const selected = useMemo(
    () => (data?.records ?? []).find((row) => row.id === selectedId) ?? courseRecords[0] ?? null,
    [courseRecords, data, selectedId],
  );

  const totalMeetings = data?.records.length ?? 0;
  const presentCount = data?.presentCount ?? 0;
  const rate = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : null;

  if (!session) return null;

  return (
    <StudentSisShell
      title="Attendance"
      subtitle="Your recorded sessions only"
      activeHref="/student/attendance"
      userName={`${session.givenName} ${session.familyName}`}
    >
      <div className="mh-student-stack">
        {viewState === "loading" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Loading attendance" body="Fetching your recorded class sessions." />
          </section>
        ) : null}
        {viewState === "permission-denied" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Permission denied" body="Attendance is available only to the signed-in student." />
          </section>
        ) : null}
        {viewState === "offline" ? (
          <section className="mh-teacher-card">
            <EmptyState title="You're offline" body="Reconnect to load your attendance record." />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}
        {viewState === "error" ? (
          <section className="mh-teacher-card">
            <EmptyState title="Attendance unavailable" body={loadError ?? "The attendance record could not be loaded."} />
            <Button type="button" onClick={() => void load(session)}>
              Try again
            </Button>
          </section>
        ) : null}

        {viewState === "ready" && totalMeetings === 0 ? (
          <EmptyState
            title="No attendance posted yet"
            body="When instructors record sessions for your courses, they will appear here."
          />
        ) : null}

        {viewState === "ready" && totalMeetings > 0 ? (
          <>
            <div className="mh-teacher-dash__kpis">
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Present</div>
                <div className="mh-teacher-dash__kpi-value">{data?.presentCount ?? 0}</div>
                <div className="mh-teacher-dash__kpi-hint">Sessions</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Absent</div>
                <div className="mh-teacher-dash__kpi-value">{data?.absentCount ?? 0}</div>
                <div className="mh-teacher-dash__kpi-hint">Sessions</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Late</div>
                <div className="mh-teacher-dash__kpi-value">{data?.lateCount ?? 0}</div>
                <div className="mh-teacher-dash__kpi-hint">Sessions</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Rate</div>
                <div className="mh-teacher-dash__kpi-value">{rate == null ? "—" : `${rate}%`}</div>
                <div className="mh-teacher-dash__kpi-hint">{totalMeetings} recorded</div>
              </div>
            </div>

            <Banner tone="warning">
              Corrections are not self-serve. Use campus services if a session was recorded incorrectly.
            </Banner>

            <section className="mh-teacher-card">
              <div className="mh-student-lms__head">
                <div>
                  <h2>By course</h2>
                  <p className="mh-teacher-muted">Select a course to filter sessions</p>
                </div>
              </div>
              <div className="mh-student-course-grid" style={{ marginTop: 12 }}>
                {courses.map((course) => {
                  const courseRate = course.total ? Math.round((course.present / course.total) * 100) : 0;
                  const active = selectedCourse === course.courseCode;
                  return (
                    <button
                      key={course.courseCode}
                      type="button"
                      className="mh-student-course-card"
                      aria-pressed={active}
                      style={active ? { outline: "2px solid var(--mh-brand)", outlineOffset: 2 } : undefined}
                      onClick={() => {
                        setSelectedCourse(course.courseCode);
                        const first = (data?.records ?? []).find((row) => row.courseCode === course.courseCode);
                        setSelectedId(first?.id ?? null);
                      }}
                    >
                      <span className="mh-student-course-card__code">{course.courseCode}</span>
                      <strong>{courseRate}% present</strong>
                      <span>
                        {course.present} present · {course.absent} absent · {course.late} late · {course.total} total
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <div className="mh-student-lab__layout">
              <section className="mh-teacher-card">
                <div className="mh-student-lms__head">
                  <div>
                    <h2>{selectedCourse ?? "Sessions"}</h2>
                    <p className="mh-teacher-muted">
                      {courseRecords.length} session{courseRecords.length === 1 ? "" : "s"} — click for detail
                    </p>
                  </div>
                </div>
                <div className="mh-teacher-list" style={{ marginTop: 12 }}>
                  {courseRecords.map((row) => {
                    const active = selected?.id === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        className={`mh-teacher-list__item${active ? " is-active" : ""}`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <div>
                          <b>{row.meetingLabel}</b>
                          <span>{formatWhen(row.recordedAt)}</span>
                        </div>
                        <StatusPill tone={toneForStatus(row.status)}>{row.status}</StatusPill>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mh-teacher-card">
                {selected ? (
                  <>
                    <div className="mh-student-lms__head">
                      <div>
                        <h2>Session detail</h2>
                        <p className="mh-teacher-muted">{selected.meetingLabel}</p>
                      </div>
                      <StatusPill tone={toneForStatus(selected.status)}>{selected.status}</StatusPill>
                    </div>
                    <div className="mh-student-lab__facts" style={{ marginTop: 14 }}>
                      <div>
                        <span>Course</span>
                        <strong>{selected.courseCode}</strong>
                      </div>
                      <div>
                        <span>Recorded</span>
                        <strong>{formatWhen(selected.recordedAt)}</strong>
                      </div>
                      <div>
                        <span>Meeting</span>
                        <strong>{selected.meetingLabel}</strong>
                      </div>
                      <div>
                        <span>Status</span>
                        <strong style={{ textTransform: "capitalize" }}>{selected.status}</strong>
                      </div>
                      {selected.note ? (
                        <div>
                          <span>Instructor note</span>
                          <strong>{selected.note}</strong>
                        </div>
                      ) : null}
                    </div>
                    <div className="mh-student-lab__actions">
                      <Button type="button" variant="secondary" onClick={() => router.push("/student/f/st-16-services")}>
                        Request correction
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => router.push("/student/calendar")}>
                        Open calendar
                      </Button>
                    </div>
                  </>
                ) : (
                  <EmptyState title="Select a session" body="Choose a recorded meeting to see detail." />
                )}
              </section>
            </div>
          </>
        ) : null}
      </div>
    </StudentSisShell>
  );
}

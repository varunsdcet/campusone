"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { formatHccDate } from "@/lib/hccCourseFormat";

type PlanItem = {
  id: string;
  courseCode: string;
  title: string;
  credits: number;
  category: string;
  status: string;
  grade?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  scheduleText?: string | null;
  sectionId?: string | null;
  sortOrder?: number;
};

type PlanPayload = {
  planId: string | null;
  status: string;
  cohort: { code: string; label: string; intakeYear: number; intakeMonth: number; sectionLabel: string } | null;
  summary: {
    totalCredits: number;
    earnedCredits: number;
    averagePercent: number | null;
    cgpa: number | null;
    completed: number;
    failed: number;
    inProgress: number;
    notStarted: number;
    dropped: number;
  };
  main: PlanItem[];
  practicum: PlanItem[];
  makeup: PlanItem[];
};

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "in_progress") return "In Progress";
  if (status === "dropped") return "Dropped Course";
  return "Not Started";
}

function statusClass(status: string) {
  if (status === "completed") return "mh-hcc-status mh-hcc-status--done";
  if (status === "failed") return "mh-hcc-status mh-hcc-status--danger";
  if (status === "in_progress") return "mh-hcc-status mh-hcc-status--progress";
  if (status === "dropped") return "mh-hcc-status mh-hcc-status--dropped";
  return "mh-hcc-status mh-hcc-status--muted";
}

function formatPlanDates(item: PlanItem) {
  const start = formatHccDate(item.startsOn);
  const end = formatHccDate(item.endsOn);
  if (start && end) return `${start} - ${end}`;
  return start || end || "—";
}

function formatScheduleLines(text: string | null | undefined) {
  if (!text) return ["—"];
  return text
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProgramPlanPage() {
  const router = useRouter();
  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    api<PlanPayload>("/student/program-plan", {}, session.accessToken)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load program plan"));
  }, [router]);

  const allItems = useMemo(() => {
    if (!data) return [];
    return [...data.main, ...data.practicum, ...data.makeup].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
  }, [data]);

  const filtered = useMemo(() => {
    const q = courseFilter.trim().toLowerCase();
    return allItems.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.courseCode.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q)
      );
    });
  }, [allItems, statusFilter, courseFilter]);

  return (
    <StudentSisShell title="" activeHref="/student/f/st-23-program-plan" userName={name}>
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-19" data-figma-id="st-23">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Program Plan
        </p>
        <h1>PROGRAM PLAN</h1>

        <div className="mh-hcc-filters mh-hcc-filters--campus mh-hcc-filters--wrap">
          <label>
            <span>FILTER STATUS:</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
              <option value="dropped">Dropped Course</option>
              <option value="not_started">Not Started</option>
            </select>
          </label>
          <label>
            <span>FILTER COURSE:</span>
            <input
              type="search"
              placeholder="Code or title"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="mh-teacher-muted" style={{ color: "#b42318" }}>{error}</p> : null}
        {!data && !error ? <p className="mh-teacher-muted">Loading program plan…</p> : null}

        {data ? (
          <>
            {data.cohort ? (
              <section className="mh-sis-dash__card" style={{ marginBottom: 18 }}>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Assigned cohort</div>
                <h2 style={{ margin: "6px 0 2px" }}>{data.cohort.code} · {data.cohort.label}</h2>
                <p style={{ margin: 0, color: "var(--mh-text-muted)" }}>Intake {data.cohort.intakeMonth}/{data.cohort.intakeYear} · Section {data.cohort.sectionLabel}</p>
              </section>
            ) : null}
            {!data.planId ? (
              <p className="mh-teacher-muted">No program plan on file yet. Contact the registrar.</p>
            ) : (
              <table className="mh-hcc-table mh-hcc-table--campus">
                <thead>
                  <tr>
                    <th>DATES</th>
                    <th>COURSE</th>
                    <th>SCHEDULE</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No courses match these filters.</td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const planIndex = allItems.findIndex((x) => x.id === item.id);
                      const num = String((planIndex >= 0 ? planIndex : 0) + 1).padStart(2, "0");
                      const href = item.sectionId
                        ? `/student/courses/${item.sectionId}`
                        : `/student/courses?q=${encodeURIComponent(item.courseCode)}`;
                      const clickable = Boolean(item.sectionId);
                      return (
                        <tr
                          key={item.id}
                          className={clickable ? "is-click" : undefined}
                          tabIndex={clickable ? 0 : undefined}
                          role={clickable ? "link" : undefined}
                          onClick={() => {
                            if (clickable) router.push(href);
                          }}
                          onKeyDown={(e) => {
                            if (!clickable) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              router.push(href);
                            }
                          }}
                        >
                          <td>{formatPlanDates(item)}</td>
                          <td>
                            <div className="mh-hcc-plan-course">
                              <span className="mh-hcc-plan-course__num">({num})</span>
                              {clickable ? (
                                <button
                                  type="button"
                                  className="mh-hcc-plan-course__name"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(href);
                                  }}
                                >
                                  {item.title || item.courseCode}
                                </button>
                              ) : (
                                <strong className="mh-hcc-plan-course__name">{item.title || item.courseCode}</strong>
                              )}
                              <span className="mh-hcc-plan-course__code">{item.courseCode}</span>
                            </div>
                          </td>
                          <td>
                            {formatScheduleLines(item.scheduleText).map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </td>
                          <td>
                            <span className={statusClass(item.status)}>
                              {statusLabel(item.status)}
                              {(item.status === "completed" || item.status === "failed") && item.grade ? ` (${item.grade})` : ""}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>
    </StudentSisShell>
  );
}

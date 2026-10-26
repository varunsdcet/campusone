"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { allows, useMyAccess, type ModuleGate } from "@/lib/access";

type HomePayload = {
  standing?: string;
  programName?: string;
  studentNumber?: string;
  enrolledCourses?: number;
  gpa?: number;
  attendanceRate?: number;
  nextDeadline?: { title: string; dueAt: string; courseCode: string };
  announcements?: Array<{ id: string; title: string; body: string }>;
  pendingEvaluations?: Array<{
    id: string;
    courseCode: string;
    courseTitle: string;
    offeringCode?: string | null;
    dueAt: string | null;
    href: string;
  }>;
};

type CourseItem = {
  sectionId: string;
  code: string;
  title: string;
  sectionCode?: string;
  instructorName?: string;
  progressPct?: number;
  progressPercent?: number | null;
  nextItem?: string;
};

type CalItem = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  courseCode?: string | null;
  location?: string;
  type: string;
};

type AssignmentItem = {
  id: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  dueAt: string | null;
  state: "upcoming" | "due" | "overdue" | "draft" | "submitted" | "graded";
};

function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDue(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (d.getTime() - Date.now()) / 86400000;
  if (diff < 0) return `Due ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
  if (diff < 1.5) return "Due tomorrow";
  return `Due ${d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`;
}

function badgeClass(tone?: "success" | "warning" | "danger" | "info" | "muted" | "active") {
  const mapped =
    tone === "warning"
      ? "is-warning"
      : tone === "danger"
        ? "is-danger"
        : tone === "info"
          ? "is-info"
          : tone === "muted"
            ? "is-muted"
            : tone === "success"
              ? "is-success"
              : "is-active";
  return `mh-teacher-badge ${mapped}`;
}

function assignmentTone(state: AssignmentItem["state"]) {
  if (state === "overdue") return "danger" as const;
  if (state === "due") return "warning" as const;
  if (state === "submitted" || state === "graded") return "success" as const;
  return "info" as const;
}

function QuickAccessIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      );
    case "board":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M8 9h8M8 13h5M8 17h6" />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case "books":
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <path d="M8 7h8M8 11h6" />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          <path d="M12 8.5 13.2 11l2.5.4-1.8 1.8.4 2.5L12 14.5 10.7 15.7l.4-2.5-1.8-1.8 2.5-.4z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export default function StudentHomePage() {
  const router = useRouter();
  const access = useMyAccess();
  const [name, setName] = useState("Student");
  const [studentNumber, setStudentNumber] = useState("");
  const [home, setHome] = useState<HomePayload | null>(null);
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [calendar, setCalendar] = useState<CalItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("courses");

  const loadDashboard = useCallback(async () => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (!s.roles.includes("student")) {
      if (s.roles.includes("instructor")) router.replace("/instructor");
      else if (s.roles.includes("admin") || s.roles.includes("registrar")) router.replace("/admin");
      else if (s.roles.includes("applicant")) router.replace("/applicant");
      else if (s.roles.includes("employer")) router.replace("/employer");
      else router.replace("/login");
      return;
    }
    setName(`${s.givenName} ${s.familyName}`.trim() || s.givenName || "Student");
    setLoading(true);
    setError(null);
    try {
      const [h, c, cal, profile, asg] = await Promise.all([
        api<HomePayload>("/me/home", {}, s.accessToken),
        api<{ items: CourseItem[] }>("/courses/me", {}, s.accessToken),
        api<{ items: CalItem[] }>("/calendar/me", {}, s.accessToken),
        api<{ studentNumber?: string }>("/me/profile", {}, s.accessToken).catch(
          (): { studentNumber?: string } => ({}),
        ),
        api<{ assignments?: AssignmentItem[] }>("/student/assignments", {}, s.accessToken).catch(
          (): { assignments?: AssignmentItem[] } => ({ assignments: [] }),
        ),
      ]);
      setHome(h);
      setStudentNumber(h.studentNumber || profile.studentNumber || "");
      setCourses(
        (c.items ?? [])
          .map((course) => ({
            ...course,
            progressPct: course.progressPct ?? course.progressPercent ?? undefined,
          }))
          .sort((a, b) => {
            const rank = (code: string) => (/^ACSW\s*500$/i.test(code) ? 0 : 1);
            const diff = rank(a.code) - rank(b.code);
            if (diff !== 0) return diff;
            return a.code.localeCompare(b.code);
          }),
      );
      setCalendar(cal.items ?? []);
      setAssignments(asg.assignments ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const openAssignments = useMemo(
    () => assignments.filter((a) => a.state === "upcoming" || a.state === "due" || a.state === "overdue" || a.state === "draft"),
    [assignments],
  );

  const evaluations = home?.pendingEvaluations ?? [];

  const alerts = useMemo(() => {
    const rows: Array<{ id: string; title: string; body: string; tone: "critical" | "warning" | "info"; href: string }> = [];
    for (const e of evaluations) {
      rows.push({
        id: `eval-${e.id}`,
        title: `Course evaluation · ${e.courseCode}`,
        body: e.dueAt ? `${e.courseTitle} · ${fmtDue(e.dueAt)}` : e.courseTitle,
        tone: "critical",
        href: e.href,
      });
    }
    for (const a of openAssignments.filter((item) => item.state === "overdue" || item.state === "due").slice(0, 4)) {
      rows.push({
        id: `asg-${a.id}`,
        title: a.title,
        body: `${a.courseCode} · ${fmtDue(a.dueAt) || a.state}`,
        tone: a.state === "overdue" ? "critical" : "warning",
        href: `/student/assignments/${a.id}`,
      });
    }
    if (home?.nextDeadline && !rows.some((r) => r.title === home.nextDeadline!.title)) {
      rows.push({
        id: "ndl",
        title: home.nextDeadline.title,
        body: `${home.nextDeadline.courseCode} · ${fmtDue(home.nextDeadline.dueAt)}`,
        tone: "warning",
        href: "/student/assignments",
      });
    }
    return rows;
  }, [evaluations, openAssignments, home?.nextDeadline]);

  const todaySessions = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return calendar
      .filter((e) => {
        const t = +new Date(e.startsAt);
        return t >= +start && t <= +end;
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [calendar]);

  const scheduleItems = todaySessions.length ? todaySessions : calendar.slice(0, 6);

  const tabs = [
    { id: "courses", label: "My Courses" },
    { id: "assignments", label: "Assignments" },
    { id: "notifications", label: "Notifications" },
    { id: "alerts", label: "Alerts" },
    { id: "schedule", label: "Schedule" },
    { id: "info", label: "Student Info" },
  ] as const;

  const coursesGate: ModuleGate = { modules: ["courseManagement"] };
  const recordsGate: ModuleGate = { modules: ["studentRecords"] };

  const quickAccess = (
    [
      { label: "Settings", href: "/student/profile", tone: "navy", icon: "settings" },
      { label: "My Courses", href: "/student/courses", tone: "rose", icon: "plus", gate: coursesGate },
      { label: "Calendar", href: "/student/calendar", tone: "cyan", icon: "clock" },
      { label: "Messages", href: "/student/messages", tone: "red", icon: "mail", gate: { modules: ["emailMessaging"] } },
      { label: "Workshop", href: "/student/workshops", tone: "sky", icon: "board", gate: coursesGate },
      { label: "Grades", href: "/student/grades", tone: "blue", icon: "clipboard" },
      { label: "Degree Progress", href: "/student/degree", tone: "cyan", icon: "clipboard" },
      { label: "Program Plan", href: "/student/f/st-23-program-plan", tone: "violet", icon: "books" },
      { label: "Ask AI", href: "/student/ask", tone: "indigo", icon: "sparkles" },
      { label: "Documents", href: "/student/documents", tone: "navy", icon: "check", gate: recordsGate },
    ] as const
  ).filter((q) => allows(access, "gate" in q ? (q.gate as ModuleGate) : undefined));

  const stats = [
    {
      label: "Courses",
      value: home?.enrolledCourses ?? courses.length,
      icon: "book",
      href: "/student/courses",
      gate: coursesGate,
    },
    {
      label: "GPA",
      value: home?.gpa != null ? home.gpa.toFixed(2) : "—",
      icon: "user",
      href: "/student/grades",
    },
    {
      label: "Attendance",
      value: home?.attendanceRate != null ? `${home.attendanceRate}%` : "—",
      icon: "signal",
      href: "/student/attendance",
    },
    {
      label: "Due work",
      value: openAssignments.length || alerts.length,
      icon: "users",
      href: "/student/assignments",
      gate: undefined as ModuleGate | undefined,
    },
  ].filter((s) => allows(access, s.gate));

  const designation = home?.standing || "Student";
  const studentMeta = [studentNumber, home?.programName].filter(Boolean).join(" · ");
  const announcements = home?.announcements ?? [];

  return (
    <StudentSisShell title="" activeHref="/student" userName={name} studentNumber={studentNumber}>
      <div className="mh-ct-dash" data-stu="STU-03">
        <div className="mh-ct-dash__main">
          {error ? <p className="mh-teacher-error">{error}</p> : null}

          <div className="mh-ct-dash__stats">
            {stats.map((s) => (
              <button key={s.label} type="button" className="mh-ct-dash__stat" onClick={() => router.push(s.href)}>
                <span className={`mh-ct-dash__stat-icon mh-ct-dash__stat-icon--${s.icon}`} aria-hidden />
                <div>
                  <strong>{loading && s.value === 0 ? "…" : s.value}</strong>
                  <span>{s.label}</span>
                </div>
              </button>
            ))}
          </div>

          <section className="mh-ct-dash__controls">
            <h2>Dashboard Controls</h2>
            <div className="mh-ct-dash__controls-row">
              <div className="mh-ct-dash__designation">
                <strong>
                  {designation} · {name}
                </strong>
                {studentMeta ? <span>{studentMeta}</span> : null}
              </div>
              <button type="button" className="mh-ct-dash__control-chip" onClick={() => router.push("/student/f/st-23-program-plan")}>
                Program Plan
              </button>
              <button type="button" className="mh-ct-dash__control-chip" onClick={() => router.push("/student/ask")}>
                Ask CampusOne
              </button>
            </div>
          </section>

          <div className="mh-ct-dash__tabs" role="tablist" aria-label="Dashboard views">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`mh-ct-dash__tab${tab === t.id ? " is-active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <button type="button" className="mh-ct-dash__refresh" aria-label="Refresh" onClick={() => void loadDashboard()}>
              ↻
            </button>
          </div>

          <section className="mh-ct-dash__panel">
            <header className="mh-ct-dash__panel-head">
              <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
            </header>

            {tab === "courses" ? (
              <div className="mh-ct-dash__list">
                {loading ? <p className="mh-teacher-muted">Loading courses…</p> : null}
                {!loading && courses.length === 0 ? <p className="mh-teacher-muted">No enrolments yet.</p> : null}
                {courses.map((c) => (
                  <button
                    key={c.sectionId}
                    type="button"
                    className="mh-ct-dash__row"
                    onClick={() => router.push(`/student/courses/${c.sectionId}`)}
                  >
                    <span className="mh-ct-dash__row-time">{c.code}</span>
                    <span className="mh-ct-dash__row-body">
                      <strong>{c.title}</strong>
                      <em>
                        {c.sectionCode ? `Section ${c.sectionCode}` : "Enrolled"}
                        {c.instructorName ? ` · ${c.instructorName}` : ""}
                      </em>
                    </span>
                    <span className={badgeClass(c.progressPct != null && c.progressPct >= 100 ? "success" : "active")}>
                      {c.progressPct != null ? `${c.progressPct}%` : "Active"}
                    </span>
                    <span className="mh-ct-dash__row-go">Open</span>
                  </button>
                ))}
              </div>
            ) : null}

            {tab === "assignments" ? (
              <div className="mh-ct-dash__list">
                {openAssignments.length === 0 && !home?.nextDeadline ? (
                  <p className="mh-teacher-muted">No pending assignments.</p>
                ) : (
                  (openAssignments.length
                    ? openAssignments
                    : home?.nextDeadline
                      ? [
                          {
                            id: "ndl",
                            courseCode: home.nextDeadline.courseCode,
                            courseTitle: home.nextDeadline.title,
                            title: home.nextDeadline.title,
                            dueAt: home.nextDeadline.dueAt,
                            state: "due" as const,
                          },
                        ]
                      : []
                  ).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="mh-ct-dash__row"
                      onClick={() =>
                        router.push(row.id === "ndl" ? "/student/assignments" : `/student/assignments/${row.id}`)
                      }
                    >
                      <span className="mh-ct-dash__row-time">{row.courseCode}</span>
                      <span className="mh-ct-dash__row-body">
                        <strong>{row.title}</strong>
                        <em>{fmtDue(row.dueAt) || row.state}</em>
                      </span>
                      <span className={badgeClass(assignmentTone(row.state))}>{row.state}</span>
                      <span className="mh-ct-dash__row-go">Open</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {tab === "notifications" ? (
              <div className="mh-ct-dash__list">
                {announcements.length === 0 ? (
                  <p className="mh-teacher-muted">No notifications yet.</p>
                ) : (
                  announcements.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="mh-ct-dash__row mh-ct-dash__row--stack"
                      onClick={() => router.push("/student/notifications")}
                    >
                      <span className="mh-ct-dash__row-body">
                        <strong>{a.title}</strong>
                        <span className="mh-ct-dash__row-note">{a.body}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {tab === "alerts" ? (
              <div className="mh-ct-dash__list">
                {alerts.length === 0 ? (
                  <p className="mh-teacher-muted">No alerts.</p>
                ) : (
                  alerts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`mh-ct-dash__row mh-ct-dash__row--stack mh-ct-dash__alert--${a.tone === "critical" ? "critical" : a.tone === "warning" ? "warning" : "info"}`}
                      onClick={() => router.push(a.href)}
                    >
                      <span className="mh-ct-dash__row-body">
                        <strong>{a.title}</strong>
                        <span className="mh-ct-dash__row-note">{a.body}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {tab === "schedule" ? (
              <div className="mh-ct-dash__list">
                {scheduleItems.length === 0 ? (
                  <p className="mh-teacher-muted">No sessions loaded. Check Program Plan for upcoming dates.</p>
                ) : (
                  scheduleItems.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      className="mh-ct-dash__row"
                      onClick={() => router.push("/student/calendar")}
                    >
                      <span className="mh-ct-dash__row-time">{fmtTime(ev.startsAt)}</span>
                      <span className="mh-ct-dash__row-body">
                        <strong>{ev.title}</strong>
                        <em>{ev.location || ev.courseCode || "Scheduled"}</em>
                      </span>
                      <span className="mh-ct-dash__row-go">Open</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            {tab === "info" ? (
              <div className="mh-ct-dash__list">
                <button
                  type="button"
                  className="mh-ct-dash__row mh-ct-dash__row--stack"
                  onClick={() => router.push("/student/f/st-23-program-plan")}
                >
                  <span className="mh-ct-dash__row-body">
                    <strong>Programme Plan guidance</strong>
                    <span className="mh-ct-dash__row-note">
                      Schedule updates are pull-based — check Program Plan for course names, dates, and class timings.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="mh-ct-dash__row mh-ct-dash__row--stack"
                  onClick={() => router.push("/student/f/st-24-course-evaluation")}
                >
                  <span className="mh-ct-dash__row-body">
                    <strong>Course evaluations</strong>
                    <span className="mh-ct-dash__row-note">
                      Evaluations become available after a course ends. Complete them from Alerts when prompted.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="mh-ct-dash__row mh-ct-dash__row--stack"
                  onClick={() => router.push("/student/grades")}
                >
                  <span className="mh-ct-dash__row-body">
                    <strong>Final marks</strong>
                    <span className="mh-ct-dash__row-note">Published grades and GPA live under My Records.</span>
                  </span>
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="mh-ct-dash__aside">
          <h2>Quick Access</h2>
          <div className="mh-ct-dash__qa-grid">
            {quickAccess.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`mh-ct-dash__qa mh-ct-dash__qa--${item.tone}`}
                onClick={() => router.push(item.href)}
              >
                <span className="mh-ct-dash__qa-ico" aria-hidden>
                  <QuickAccessIcon name={item.icon} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <details className="mh-ct-dash__acc">
            <summary>Shared Files</summary>
            <button type="button" className="mh-hcc-link" onClick={() => router.push("/student/library")}>Open shared files</button>
          </details>
          <details className="mh-ct-dash__acc" open={Boolean(alerts.length || evaluations.length)}>
            <summary>To-do</summary>
            {alerts.length || evaluations.length ? (
              <ul className="mh-ct-dash__todo">
                {evaluations.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => router.push(e.href)}>
                      Evaluate · {e.courseCode}
                    </button>
                  </li>
                ))}
                {alerts
                  .filter((a) => !a.id.startsWith("eval-"))
                  .slice(0, 3)
                  .map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => router.push(a.href)}>
                        {a.title}
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mh-teacher-muted">Nothing pending.</p>
            )}
          </details>
        </aside>
      </div>
    </StudentSisShell>
  );
}

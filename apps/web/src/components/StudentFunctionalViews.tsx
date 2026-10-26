"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, EmptyState, Panel, StatusPill } from "@myheritage/ui";
import { ApiError, api, loadSession, type Session } from "@/lib/api";
import { StudentFrame } from "@/components/StudentSisShell";
import { DEFAULT_HCC_TIME_ZONE, HCC_TIME_ZONES, formatCurrentTime } from "@/lib/timeZones";
import { SUBMISSION_EXTENSIONS, fetchSubmissionFile, formatMegabytes, submissionFileProblem } from "@/lib/submissionFiles";

type LoadState = "loading" | "ready" | "offline" | "forbidden" | "error";

function useStudentResource<T>(path: string) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (activeSession: Session) => {
    setState("loading");
    setError(null);
    try {
      setData(await api<T>(path, {}, activeSession.accessToken));
      setState("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 403) {
        setState("forbidden");
        return;
      }
      if ((typeof navigator !== "undefined" && !navigator.onLine) || caught instanceof TypeError) {
        setState("offline");
        return;
      }
      setError(caught instanceof Error ? caught.message : "The page could not be loaded.");
      setState("error");
    }
  }, [path, router]);

  useEffect(() => {
    const activeSession = loadSession();
    if (!activeSession) {
      router.replace("/login");
      return;
    }
    setSession(activeSession);
    if (!activeSession.roles.includes("student")) {
      setState("forbidden");
      return;
    }
    void load(activeSession);
  }, [load, router]);

  return { session, data, state, error, refresh: () => session && load(session) };
}

function ResourceBoundary({
  state,
  error,
  onRetry,
  children,
}: {
  state: LoadState;
  error: string | null;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (state === "ready") return <>{children}</>;
  const copy = {
    loading: ["Loading", "Fetching your latest student record."],
    offline: ["You're offline", "Reconnect and try again."],
    forbidden: ["Permission denied", "This page is available only to the signed-in student."],
    error: ["Something went wrong", error ?? "The page could not be loaded."],
  }[state];
  return (
    <div className="mh-teacher-card">
      <EmptyState title={copy[0]} body={copy[1]} />
      {state === "offline" || state === "error" ? (
        <Button type="button" onClick={onRetry}>Try again</Button>
      ) : null}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No date set";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const listStyle: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 };
const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  flexWrap: "wrap",
  padding: 14,
  border: "1px solid var(--mh-border)",
  borderRadius: "var(--mh-radius-md)",
};

type Course = {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  termName: string;
  instructorName: string;
  credits: number;
  enrolmentStatus: "enrolled" | "completed";
  progressPercent: number | null;
};

type SubmissionFile = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  createdAt: string;
};

type Assignment = {
  id: string;
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  dueAt: string | null;
  maxScore: number;
  weightPercent: number;
  state: "upcoming" | "due" | "overdue" | "draft" | "submitted" | "graded";
  submission: null | {
    id: string;
    status: "draft" | "submitted" | "returned";
    submittedAt: string | null;
    files: SubmissionFile[];
    textBody?: string | null;
  };
  instructions?: string | null;
  availableFrom?: string | null;
  cutoffAt?: string | null;
  maxFiles?: number | null;
  maxFileBytes?: number | null;
  acceptedTypes?: string[];
  fileSubmissions?: boolean;
  onlineText?: boolean;
  grade?: null | {
    score: number | null;
    maxScore: number;
    letter: string | null;
    feedback: string | null;
    publishedAt: string | null;
  };
};

type CalendarEvent = {
  id: string;
  kind: "class" | "assignment_deadline" | "assessment" | "advising";
  sectionId: string | null;
  classSessionId?: string | null;
  sessionKind?: "lecture" | "lab" | null;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  joinUrl: string | null;
};

function sessionDetailHref(event: CalendarEvent) {
  const sessionId = event.classSessionId ?? event.id.replace(/^session-/, "");
  if (event.sessionKind === "lab") return `/student/labs`;
  return `/student/f/st-11-lecture-detail?sessionId=${sessionId}`;
}

export function StudentCoursesView() {
  const router = useRouter();
  const resource = useStudentResource<{ courses: Course[] }>("/courses/me");
  const courses = resource.data?.courses ?? [];
  return (
    <StudentFrame role="student" title="My courses" subtitle="Your active and completed enrolments" breadcrumb={["Student", "Courses"]} active="Courses">
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        {courses.length === 0 ? (
          <div className="mh-teacher-card">
            <EmptyState title="No courses" body="Your assigned courses will appear here." />
          </div>
        ) : (
          <div className="mh-student-course-grid">
            {courses.map((course) => {
              const pct = course.progressPercent ?? 0;
              return (
                <button
                  key={course.sectionId}
                  type="button"
                  className="mh-student-course-card"
                  onClick={() => router.push(`/student/courses/${course.sectionId}`)}
                >
                  <span className="mh-student-course-card__code">{course.courseCode}</span>
                  <strong>{course.courseTitle}</strong>
                  <span>{course.sectionCode} · {course.termName}</span>
                  <em>{course.instructorName}</em>
                  <div className="mh-student-course-card__progress">
                    <div>
                      <span>{course.enrolmentStatus}</span>
                      <span>{course.progressPercent == null ? "—" : `${pct}%`}</span>
                    </div>
                    <div className="mh-student-course-card__track">
                      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ResourceBoundary>
    </StudentFrame>
  );
}

type CourseLms = {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  academicBlock: { id: string; code: string; name: string; startsOn: string; endsOn: string } | null;
  dayBlocks: Array<{
    id: string;
    label: string;
    title: string;
    sortOrder: number;
    lessons: Array<{
      id: string;
      title: string;
      body: string;
      resourceHref: string | null;
      sortOrder: number;
      completed: boolean;
    }>;
  }>;
  folders: Array<{
    id: string;
    name: string;
    sortOrder: number;
    items: Array<{ id: string; title: string; kind: string; href: string | null; sizeLabel: string | null }>;
  }>;
  syllabus: Array<{ id: string; title: string; level: number; sortOrder: number }>;
};

export function StudentCourseDetailView({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const courses = useStudentResource<{ courses: Course[] }>("/courses/me");
  const assignments = useStudentResource<{ assignments: Assignment[] }>("/student/assignments");
  const calendar = useStudentResource<{ events: CalendarEvent[] }>("/calendar/me");
  const content = useStudentResource<{
    progressPct: number;
    completedCount: number;
    totalCount: number;
    items: Array<{
      id: string;
      kind: string;
      title: string;
      detail: string;
      href?: string | null;
      joinUrl?: string | null;
      completed: boolean;
    }>;
  }>(`/student/courses/${sectionId}/content`);
  const lms = useStudentResource<CourseLms>(`/student/courses/${sectionId}/lms`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lmsTab, setLmsTab] = useState<"days" | "syllabus" | "folders">("days");
  const course = courses.data?.courses.find((item) => item.sectionId === sectionId);
  const courseAssignments = assignments.data?.assignments.filter((item) => item.sectionId === sectionId) ?? [];
  const sessions = calendar.data?.events.filter((item) => item.sectionId === sectionId && item.kind === "class") ?? [];
  const states = [courses.state, assignments.state, calendar.state, content.state, lms.state];
  const state = states.includes("forbidden")
    ? "forbidden"
    : states.includes("error")
      ? "error"
      : states.includes("offline")
        ? "offline"
        : states.every((value) => value === "ready")
          ? "ready"
          : "loading";

  async function markComplete(itemId: string) {
    const session = loadSession();
    if (!session) return;
    setBusyId(itemId);
    try {
      await api(
        `/student/courses/${sectionId}/content/${encodeURIComponent(itemId)}/complete`,
        { method: "POST", body: "{}" },
        session.accessToken,
      );
      await Promise.all([content.refresh(), lms.refresh()]);
    } finally {
      setBusyId(null);
    }
  }

  const dayBlocks = lms.data?.dayBlocks ?? [];
  const folders = lms.data?.folders ?? [];
  const syllabus = lms.data?.syllabus ?? [];
  const block = lms.data?.academicBlock;
  const lessonTotal = dayBlocks.reduce((n, d) => n + d.lessons.length, 0);
  const lessonDone = dayBlocks.reduce((n, d) => n + d.lessons.filter((l) => l.completed).length, 0);

  return (
    <StudentFrame
      role="student"
      title={course ? `${course.courseCode} · ${course.courseTitle}` : "Course detail"}
      subtitle={course ? `${course.sectionCode} · ${course.instructorName}` : "Enrolment-scoped course information"}
      breadcrumb={["Student", "Courses", course?.courseCode ?? "Detail"]}
      active="Courses"
      activeHref="/student/courses"
    >
      <ResourceBoundary
        state={state}
        error={courses.error ?? assignments.error ?? calendar.error ?? content.error ?? lms.error}
        onRetry={() => {
          courses.refresh();
          assignments.refresh();
          calendar.refresh();
          content.refresh();
          lms.refresh();
        }}
      >
        {!course ? (
          <div className="mh-teacher-card">
            <EmptyState title="Course unavailable" body="This course is not part of your enrolment." />
          </div>
        ) : (
          <div className="mh-student-course-detail">
            <div className="mh-student-course-detail__toolbar">
              <button type="button" className="mh-teacher-link" onClick={() => router.push("/student/courses")}>
                ← All courses
              </button>
              {block ? (
                <span className="mh-student-course-detail__block">
                  Academic block · {block.code}
                </span>
              ) : null}
            </div>

            <div className="mh-teacher-dash__kpis">
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Credits</div>
                <div className="mh-teacher-dash__kpi-value">{course.credits}</div>
                <div className="mh-teacher-dash__kpi-hint">{course.termName}</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Enrolment</div>
                <div className="mh-teacher-dash__kpi-value" style={{ fontSize: 20, textTransform: "capitalize" }}>
                  {course.enrolmentStatus}
                </div>
                <div className="mh-teacher-dash__kpi-hint">{course.sectionCode}</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Content</div>
                <div className="mh-teacher-dash__kpi-value">{content.data?.progressPct ?? 0}%</div>
                <div className="mh-teacher-dash__kpi-hint">
                  {content.data?.completedCount ?? 0}/{content.data?.totalCount ?? 0} items
                </div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Day lessons</div>
                <div className="mh-teacher-dash__kpi-value">
                  {lessonDone}/{lessonTotal || "—"}
                </div>
                <div className="mh-teacher-dash__kpi-hint">{block?.name ?? "No block linked"}</div>
              </div>
            </div>

            {(dayBlocks.length > 0 || folders.length > 0 || syllabus.length > 0) ? (
              <section className="mh-teacher-card mh-student-lms">
                <div className="mh-student-lms__head">
                  <div>
                    <h2>Learning modules</h2>
                    <p className="mh-teacher-muted">
                      Day blocks, syllabus outline, and course folders for this section.
                    </p>
                  </div>
                  <div className="mh-teacher-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      className={`mh-teacher-tabs__item${lmsTab === "days" ? " is-active" : ""}`}
                      onClick={() => setLmsTab("days")}
                    >
                      Day blocks
                      <span className="mh-teacher-tabs__count">{dayBlocks.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`mh-teacher-tabs__item${lmsTab === "syllabus" ? " is-active" : ""}`}
                      onClick={() => setLmsTab("syllabus")}
                    >
                      Syllabus
                      <span className="mh-teacher-tabs__count">{syllabus.length}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      className={`mh-teacher-tabs__item${lmsTab === "folders" ? " is-active" : ""}`}
                      onClick={() => setLmsTab("folders")}
                    >
                      Folders
                      <span className="mh-teacher-tabs__count">{folders.length}</span>
                    </button>
                  </div>
                </div>

                {lmsTab === "days" ? (
                  dayBlocks.length === 0 ? (
                    <EmptyState title="No day blocks" body="Your instructor has not published day blocks yet." />
                  ) : (
                    <div className="mh-student-lms__days">
                      {dayBlocks.map((blockRow) => (
                        <article key={blockRow.id} className="mh-student-lms__day">
                          <header>
                            <span>{blockRow.label}</span>
                            <h3>{blockRow.title}</h3>
                          </header>
                          <ul className="mh-student-lms__lessons">
                            {blockRow.lessons.map((lesson) => (
                              <li key={lesson.id}>
                                <div>
                                  <strong>{lesson.title}</strong>
                                  <p>{lesson.body}</p>
                                </div>
                                <div className="mh-student-lms__lesson-actions">
                                  {lesson.completed ? (
                                    <span className="mh-teacher-pill is-success">Done</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="mh-teacher-btn mh-teacher-btn--secondary"
                                      disabled={busyId === `lesson:${lesson.id}`}
                                      onClick={() => void markComplete(`lesson:${lesson.id}`)}
                                    >
                                      {busyId === `lesson:${lesson.id}` ? "Saving…" : "Mark done"}
                                    </button>
                                  )}
                                  {lesson.resourceHref ? (
                                    <button
                                      type="button"
                                      className="mh-teacher-btn mh-teacher-btn--primary"
                                      onClick={() => {
                                        if (lesson.resourceHref!.startsWith("http")) {
                                          window.open(lesson.resourceHref!, "_blank", "noopener,noreferrer");
                                        } else {
                                          router.push(lesson.resourceHref!);
                                        }
                                      }}
                                    >
                                      Open
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                  )
                ) : null}

                {lmsTab === "syllabus" ? (
                  syllabus.length === 0 ? (
                    <EmptyState title="No syllabus topics" body="Syllabus outline will appear when published." />
                  ) : (
                    <ol className="mh-student-lms__syllabus">
                      {syllabus.map((topic) => (
                        <li
                          key={topic.id}
                          className={topic.level > 1 ? "is-nested" : undefined}
                          style={{ paddingLeft: Math.max(0, topic.level - 1) * 18 }}
                        >
                          {topic.title}
                        </li>
                      ))}
                    </ol>
                  )
                ) : null}

                {lmsTab === "folders" ? (
                  folders.length === 0 ? (
                    <EmptyState title="No folders" body="Course resources will appear in folders when uploaded." />
                  ) : (
                    <div className="mh-student-lms__folders">
                      {folders.map((folder) => (
                        <div key={folder.id} className="mh-student-lms__folder">
                          <h3>{folder.name}</h3>
                          <ul>
                            {folder.items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="mh-student-lms__file"
                                  disabled={!item.href}
                                  onClick={() => {
                                    if (!item.href) return;
                                    if (item.href.startsWith("http")) window.open(item.href, "_blank", "noopener,noreferrer");
                                    else router.push(item.href);
                                  }}
                                >
                                  <span className="mh-student-lms__file-kind">{item.kind}</span>
                                  <strong>{item.title}</strong>
                                  {item.sizeLabel ? <em>{item.sizeLabel}</em> : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )
                ) : null}
              </section>
            ) : null}

            <section className="mh-teacher-card">
              <h2>Upcoming classes</h2>
              {sessions.length === 0 ? (
                <EmptyState title="No scheduled classes" body="New sessions will appear when they are scheduled." />
              ) : (
                <div className="mh-teacher-list">
                  {sessions.map((event) => (
                    <div key={event.id} className="mh-teacher-list__item">
                      <div>
                        <b>{event.title}</b>
                        <span>
                          {formatDate(event.startsAt)} · {event.location ?? "Location TBA"}
                        </span>
                      </div>
                      <div className="mh-student-lms__lesson-actions">
                        <button
                          type="button"
                          className="mh-teacher-btn mh-teacher-btn--secondary"
                          onClick={() => router.push(sessionDetailHref(event))}
                        >
                          Detail
                        </button>
                        {event.joinUrl ? (
                          <button
                            type="button"
                            className="mh-teacher-btn mh-teacher-btn--primary"
                            onClick={() => window.open(event.joinUrl!, "_blank", "noopener,noreferrer")}
                          >
                            Join
                          </button>
                        ) : (
                          <span className="mh-teacher-pill">In person</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mh-teacher-card">
              <h2>Course materials</h2>
              {(content.data?.items?.length ?? 0) === 0 ? (
                <EmptyState title="No materials yet" body="Lectures, resources, and assigned work will appear here when published." />
              ) : (
                <div className="mh-teacher-list">
                  {(content.data?.items ?? []).map((item) => (
                    <div key={item.id} className="mh-teacher-list__item">
                      <div>
                        <b>{item.title}</b>
                        <span>
                          {item.kind === "lecture"
                            ? "Lecture"
                            : item.kind === "lab"
                              ? "Lab"
                              : "Resource"}{" "}
                          · {item.detail}
                        </span>
                      </div>
                      <div className="mh-student-lms__lesson-actions">
                        {item.completed ? <span className="mh-teacher-pill is-success">Done</span> : null}
                        {item.href ? (
                          <button
                            type="button"
                            className="mh-teacher-btn mh-teacher-btn--secondary"
                            onClick={() => {
                              if (item.href!.startsWith("http")) window.open(item.href!, "_blank", "noopener,noreferrer");
                              else router.push(item.href!);
                            }}
                          >
                            Open
                          </button>
                        ) : null}
                        {!item.completed ? (
                          <button
                            type="button"
                            className="mh-teacher-btn mh-teacher-btn--primary"
                            disabled={busyId === item.id}
                            onClick={() => void markComplete(item.id)}
                          >
                            {busyId === item.id ? "Saving…" : "Complete"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mh-teacher-card">
              <h2>Assignments</h2>
              {courseAssignments.length === 0 ? (
                <EmptyState title="No assignments" body="There is no assigned work for this course yet." />
              ) : (
                <div className="mh-teacher-list">
                  {courseAssignments.map((assignment) => (
                    <div key={assignment.id} className="mh-teacher-list__item">
                      <div>
                        <b>{assignment.title}</b>
                        <span>Due {formatDate(assignment.dueAt)}</span>
                      </div>
                      <button
                        type="button"
                        className="mh-teacher-btn mh-teacher-btn--secondary"
                        onClick={() => router.push(`/student/assignments/${assignment.id}`)}
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </ResourceBoundary>
    </StudentFrame>
  );
}

export function StudentAssignmentsView() {
  const router = useRouter();
  const resource = useStudentResource<{ assignments: Assignment[] }>("/student/assignments");
  const [query, setQuery] = useState("");
  const assignments = useMemo(() => (resource.data?.assignments ?? []).filter((assignment) => `${assignment.title} ${assignment.courseCode}`.toLowerCase().includes(query.toLowerCase())), [query, resource.data]);
  return (
    <StudentFrame role="student" title="Assignments" subtitle="Upload and track work for your enrolled courses" breadcrumb={["Student", "Assignments"]} active="Courses">
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        <label style={{ display: "grid", gap: 6, maxWidth: 420, marginBottom: 18 }}><span style={{ fontWeight: 600 }}>Search assignments</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Course or assignment" /></label>
        {assignments.length === 0 ? <EmptyState title="No matching assignments" body="Try another search or check back later." /> : (
          <ul style={listStyle}>{assignments.map((assignment) => <li key={assignment.id} style={rowStyle}><div><strong>{assignment.title}</strong><div style={{ color: "var(--mh-text-muted)" }}>{assignment.courseCode} · Due {formatDate(assignment.dueAt)}</div></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><StatusPill tone={assignment.state === "overdue" ? "danger" : assignment.state === "submitted" || assignment.state === "graded" ? "success" : "neutral"}>{assignment.state}</StatusPill><Button type="button" onClick={() => router.push(`/student/assignments/${assignment.id}`)}>Open</Button></div></li>)}</ul>
        )}
      </ResourceBoundary>
    </StudentFrame>
  );
}

function mimeForFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ({ pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", zip: "application/zip" } as Record<string, string>)[extension ?? ""] ?? file.type;
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function assignmentStatusTone(state: Assignment["state"]): "neutral" | "success" | "warning" | "danger" {
  if (state === "overdue") return "danger";
  if (state === "graded" || state === "submitted") return "success";
  if (state === "due") return "warning";
  return "neutral";
}

export function StudentAssignmentDetailView({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const resource = useStudentResource<{ assignment: Assignment }>(`/student/assignments/${assignmentId}`);
  const assignment = resource.data?.assignment;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const opensAt = assignment?.availableFrom ? new Date(assignment.availableFrom).getTime() : null;
  const notYetOpen = opensAt != null && opensAt > now;

  useEffect(() => {
    if (opensAt == null) return;
    const wait = opensAt - Date.now();
    // setTimeout overflows past ~24.8 days; a reload picks up later openings.
    if (wait <= 0 || wait > 2 ** 31 - 1) return;
    const timer = setTimeout(() => setNow(Date.now()), wait + 1000);
    return () => clearTimeout(timer);
  }, [opensAt]);

  async function upload(file: File | undefined) {
    if (!file || !resource.session) return;
    setNotice(null);
    const problem = submissionFileProblem(file, {
      acceptedTypes: assignment?.acceptedTypes,
      maxFileBytes: assignment?.maxFileBytes,
      fileSubmissions: assignment?.fileSubmissions,
    });
    if (problem) {
      setActionError(problem);
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const mimeType = mimeForFile(file);
      await api(
        `/student/assignments/${assignmentId}/files`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mimeType,
            sizeBytes: file.size,
            contentBase64: toBase64(new Uint8Array(await file.arrayBuffer())),
          }),
        },
        resource.session.accessToken,
      );
      setNotice("File uploaded as a new version.");
      await resource.refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(fileId: string) {
    if (!resource.session) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await api(`/student/submission-files/${fileId}`, { method: "DELETE" }, resource.session.accessToken);
      setNotice("File removed from the active submission. It remains recoverable for audit.");
      await resource.refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not remove file");
    } finally {
      setBusy(false);
    }
  }

  async function saveText() {
    if (!resource.session || textDraft == null) return false;
    await api(
      `/student/assignments/${assignmentId}/text`,
      { method: "PUT", body: JSON.stringify({ text: textDraft }) },
      resource.session.accessToken,
    );
    setTextDraft(null);
    return true;
  }

  async function saveTextOnly() {
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      if (await saveText()) setNotice("Online text saved as a draft.");
      await resource.refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not save online text");
    } finally {
      setBusy(false);
    }
  }

  async function openFile(fileId: string, mode: "open" | "download") {
    setActionError(null);
    try {
      await fetchSubmissionFile(`/student/submission-files/${encodeURIComponent(fileId)}`, mode);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not open the file");
    }
  }

  async function submit() {
    if (!resource.session) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await saveText();
      await api(`/student/assignments/${assignmentId}/submit`, { method: "POST", body: "{}" }, resource.session.accessToken);
      setNotice("Assignment submitted successfully.");
      await resource.refresh();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not submit assignment");
    } finally {
      setBusy(false);
    }
  }

  const files = assignment?.submission?.files ?? [];
  const canUpload = assignment?.submission?.status !== "submitted" && assignment?.state !== "graded";
  const canRemove = assignment?.submission?.status === "draft";
  const submittedLocked = !canUpload;
  const canEdit = canUpload && !notYetOpen;
  const allowsFiles = assignment?.fileSubmissions !== false;
  const allowsText = Boolean(assignment?.onlineText);
  const savedText = assignment?.submission?.textBody ?? "";
  const textValue = textDraft ?? savedText;
  const hasContent = files.length > 0 || (allowsText && textValue.trim().length > 0);
  const acceptList = assignment?.acceptedTypes?.length ? assignment.acceptedTypes : SUBMISSION_EXTENSIONS;
  const sizeLimit = Math.min(assignment?.maxFileBytes || Infinity, 10 * 1024 * 1024);
  const grade = assignment?.grade ?? null;

  return (
    <StudentFrame
      role="student"
      title={assignment?.title ?? "Assignment detail"}
      subtitle={assignment ? `${assignment.courseCode} · Due ${formatDate(assignment.dueAt)}` : "Submission workflow"}
      breadcrumb={["Student", "Assignments", assignment?.title ?? "Detail"]}
      activeHref="/student/assignments"
    >
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        {!assignment ? (
          <section className="mh-teacher-card">
            <EmptyState title="Assignment unavailable" body="This assignment is not part of your enrolment." />
            <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => router.push("/student/assignments")}>
              Back to assignments
            </button>
          </section>
        ) : (
          <div className="mh-student-assign">
            <div className="mh-student-assign__toolbar">
              <button type="button" className="mh-teacher-link" onClick={() => router.push("/student/assignments")}>
                ← All assignments
              </button>
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => router.push(`/student/courses/${assignment.sectionId}`)}
              >
                Open course
              </button>
            </div>

            <div className="mh-teacher-dash__kpis">
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Status</div>
                <div className="mh-teacher-dash__kpi-value" style={{ fontSize: 22, textTransform: "capitalize" }}>
                  {assignment.state}
                </div>
                <div className="mh-teacher-dash__kpi-hint">{assignment.courseCode}</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Points</div>
                <div className="mh-teacher-dash__kpi-value">{assignment.maxScore}</div>
                <div className="mh-teacher-dash__kpi-hint">Maximum score</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Weight</div>
                <div className="mh-teacher-dash__kpi-value">{assignment.weightPercent}%</div>
                <div className="mh-teacher-dash__kpi-hint">Course grade</div>
              </div>
              <div className="mh-teacher-dash__kpi">
                <div className="mh-teacher-dash__kpi-label">Due</div>
                <div className="mh-teacher-dash__kpi-value" style={{ fontSize: 18 }}>
                  {formatDate(assignment.dueAt)}
                </div>
                <div className="mh-teacher-dash__kpi-hint">{assignment.courseTitle}</div>
              </div>
            </div>

            <div className="mh-teacher-detail__grid">
              <section className="mh-teacher-card">
                <div className="mh-teacher-card__head">
                  <h2>Assignment</h2>
                  <StatusPill tone={assignmentStatusTone(assignment.state)}>{assignment.state}</StatusPill>
                </div>
                <div className="mh-teacher-section">
                  <div className="mh-teacher-section__label">OVERVIEW</div>
                  <div className="mh-teacher-fields">
                    <label>
                      <span>Course</span>
                      <div className="mh-teacher-field">
                        {assignment.courseCode} · {assignment.courseTitle}
                      </div>
                    </label>
                    <label>
                      <span>Title</span>
                      <div className="mh-teacher-field">{assignment.title}</div>
                    </label>
                    <label>
                      <span>Due date</span>
                      <div className="mh-teacher-field">{formatDate(assignment.dueAt)}</div>
                    </label>
                    <label>
                      <span>Grading</span>
                      <div className="mh-teacher-field">
                        {assignment.maxScore} points · {assignment.weightPercent}% weight
                      </div>
                    </label>
                    {assignment.availableFrom ? (
                      <label>
                        <span>Opens</span>
                        <div className="mh-teacher-field">{formatDate(assignment.availableFrom)}</div>
                      </label>
                    ) : null}
                    {assignment.cutoffAt ? (
                      <label>
                        <span>Late submissions until</span>
                        <div className="mh-teacher-field">{formatDate(assignment.cutoffAt)}</div>
                      </label>
                    ) : null}
                    <label>
                      <span>Submission type</span>
                      <div className="mh-teacher-field">
                        {[allowsFiles ? "File upload" : null, allowsText ? "Online text" : null].filter(Boolean).join(" and ")}
                      </div>
                    </label>
                  </div>
                </div>
                {assignment.instructions ? (
                  <div className="mh-teacher-section">
                    <div className="mh-teacher-section__label">INSTRUCTIONS</div>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{assignment.instructions}</p>
                  </div>
                ) : null}
                {grade ? (
                  <div className="mh-teacher-section">
                    <div className="mh-teacher-section__label">YOUR MARK</div>
                    <div className="mh-teacher-fields">
                      <label>
                        <span>Mark</span>
                        <div className="mh-teacher-field">
                          {grade.score == null ? "—" : `${grade.score} / ${grade.maxScore}`}
                          {grade.letter ? ` · ${grade.letter}` : ""}
                        </div>
                      </label>
                      <label>
                        <span>Published</span>
                        <div className="mh-teacher-field">{formatDate(grade.publishedAt)}</div>
                      </label>
                    </div>
                    <div className="mh-teacher-section__label" style={{ marginTop: 12 }}>INSTRUCTOR FEEDBACK</div>
                    <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{grade.feedback || "No written feedback was given."}</p>
                  </div>
                ) : null}
                {submittedLocked && assignment.submission?.submittedAt ? (
                  <div className="mh-teacher-banner" style={{ background: "#e8f5ee", borderColor: "rgba(1,127,63,0.22)", color: "#2563EB" }}>
                    Submitted {formatDate(assignment.submission.submittedAt)}
                    {assignment.state === "graded" ? " · Graded and published" : ""}
                  </div>
                ) : null}
              </section>

              <section className="mh-teacher-card mh-student-assign__submit">
                <div className="mh-teacher-card__head">
                  <h2>Your submission</h2>
                  <StatusPill tone={files.length ? "success" : "neutral"}>
                    {files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No files"}
                  </StatusPill>
                </div>

                {files.length ? (
                  <div className="mh-teacher-list">
                    {files.map((file) => (
                      <div key={file.id} className="mh-teacher-list__item">
                        <div>
                          <strong>{file.filename}</strong>
                          <span>
                            Version {file.version} · {(file.sizeBytes / 1024).toFixed(1)} KB · {formatDate(file.createdAt)}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void openFile(file.id, "open")}>
                            Open
                          </button>
                          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => void openFile(file.id, "download")}>
                            Download
                          </button>
                          {canRemove ? (
                            <button
                              type="button"
                              className="mh-teacher-btn mh-teacher-btn--secondary"
                              disabled={busy}
                              onClick={() => void archive(file.id)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : allowsFiles ? (
                  <p className="mh-teacher-muted" style={{ margin: 0 }}>
                    No files uploaded yet.
                  </p>
                ) : null}

                {allowsText ? (
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ fontWeight: 600 }}>Online text</span>
                    {canEdit ? (
                      <textarea
                        rows={8}
                        value={textValue}
                        disabled={busy}
                        maxLength={50_000}
                        onChange={(event) => setTextDraft(event.target.value)}
                      />
                    ) : (
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{savedText || (notYetOpen ? "" : "No online text was submitted.")}</p>
                    )}
                  </label>
                ) : null}

                {canUpload && notYetOpen ? (
                  <p className="mh-teacher-muted" style={{ margin: 0 }}>
                    Submissions open on {formatDate(assignment.availableFrom)}. You can upload and submit your work from then.
                  </p>
                ) : canUpload ? (
                  <>
                    {allowsFiles ? (
                    <label className="mh-teacher-dropzone mh-student-assign__drop">
                      <input
                        aria-label="Choose submission file"
                        type="file"
                        disabled={busy}
                        accept={acceptList.join(",")}
                        onChange={(event) => {
                          void upload(event.target.files?.[0]);
                          event.target.value = "";
                        }}
                      />
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path
                          d="M20 16.5a3.5 3.5 0 0 0-2.1-6.4A5.5 5.5 0 0 0 7.1 8.4 3.5 3.5 0 0 0 4 11.8"
                          stroke="#2563EB"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                        <path d="M8 19h8" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      <strong>{busy ? "Uploading…" : "Choose a file to upload"}</strong>
                      <span>
                        {acceptList.join(", ")} · up to {formatMegabytes(sizeLimit)}
                        {assignment.maxFiles ? ` · at most ${assignment.maxFiles} file${assignment.maxFiles === 1 ? "" : "s"}` : ""}
                      </span>
                    </label>
                    ) : null}
                    <div className="mh-teacher-actions">
                      {allowsText ? (
                        <button
                          type="button"
                          className="mh-teacher-btn mh-teacher-btn--secondary"
                          disabled={busy || textDraft == null}
                          onClick={() => void saveTextOnly()}
                        >
                          Save draft
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="mh-teacher-btn mh-teacher-btn--primary"
                        disabled={busy || !hasContent}
                        onClick={() => void submit()}
                      >
                        {busy ? "Working…" : "Submit assignment"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mh-teacher-muted" style={{ margin: 0 }}>
                    {assignment.state === "graded"
                      ? "This assignment has been graded. Resubmission is closed."
                      : "This submission is locked. Contact your instructor if you need a resubmission window."}
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </ResourceBoundary>
    </StudentFrame>
  );
}

export function StudentCalendarView() {
  const resource = useStudentResource<{ events: CalendarEvent[] }>("/calendar/me");
  const events = resource.data?.events ?? [];
  return <StudentFrame role="student" title="Schedule" subtitle="Classes and assignment deadlines" breadcrumb={["Student", "Schedule"]} active="Schedule"><ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>{events.length === 0 ? <EmptyState title="No scheduled items" body="Your enrolled class schedule will appear here." /> : <ul style={listStyle}>{events.map((event) => <li key={event.id} style={rowStyle}><div><strong>{event.title}</strong><div style={{ color: "var(--mh-text-muted)" }}>{formatDate(event.startsAt)} · {event.location ?? "Online"}</div></div><div style={{ display: "flex", gap: 10, alignItems: "center" }}><StatusPill tone="neutral">{event.kind.replace("_", " ")}</StatusPill>{event.joinUrl ? <Button type="button" onClick={() => window.open(event.joinUrl!, "_blank", "noopener,noreferrer")}>Join class</Button> : null}</div></li>)}</ul>}</ResourceBoundary></StudentFrame>;
}

type NotificationItem = { id: string; channel: string; title: string; body: string; readAt: string | null; createdAt: string };

export function StudentNotificationsView() {
  const resource = useStudentResource<{ items: NotificationItem[]; unreadCount: number }>("/notifications/me");
  const [actionError, setActionError] = useState<string | null>(null);
  async function markRead(id: string) {
    if (!resource.session) return;
    setActionError(null);
    try { await api(`/notifications/me/${id}/read`, { method: "PATCH", body: "{}" }, resource.session.accessToken); await resource.refresh(); }
    catch (caught) { setActionError(caught instanceof Error ? caught.message : "Could not update notification"); }
  }
  const items = resource.data?.items ?? [];
  return <StudentFrame role="student" title="Notifications" subtitle={`${resource.data?.unreadCount ?? 0} unread`} breadcrumb={["Student", "Notifications"]}>{actionError ? <Banner tone="danger">{actionError}</Banner> : null}<ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>{items.length === 0 ? <EmptyState title="You're all caught up" body="New campus notices will appear here." /> : <ul style={listStyle}>{items.map((item) => <li key={item.id} style={{ ...rowStyle, opacity: item.readAt ? 0.72 : 1 }}><div><strong>{item.title}</strong><div style={{ marginTop: 4 }}>{item.body}</div><div style={{ color: "var(--mh-text-muted)", marginTop: 4 }}>{formatDate(item.createdAt)}</div></div>{item.readAt ? <StatusPill tone="neutral">Read</StatusPill> : <Button type="button" onClick={() => void markRead(item.id)}>Mark read</Button>}</li>)}</ul>}</ResourceBoundary></StudentFrame>;
}

type Profile = {
  studentId: string;
  studentNumber: string;
  givenName: string;
  familyName: string;
  middleName?: string | null;
  preferredName?: string | null;
  primaryEmail: string;
  personalEmail?: string | null;
  phone?: string | null;
  dateOfBirth: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  programName: string;
  standing: string;
  timezone: string;
};

export function StudentProfileView() {
  const resource = useStudentResource<Profile>("/me/profile");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendingChange, setSendingChange] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

  useEffect(() => {
    if (resource.data) {
      setGivenName(resource.data.givenName);
      setFamilyName(resource.data.familyName);
      setMiddleName(resource.data.middleName ?? "");
      setPreferredName(resource.data.preferredName ?? "");
      setEmail(resource.data.personalEmail ?? "");
      setPhone(resource.data.phone ?? "");
      setEmergencyContactName(resource.data.emergencyContactName ?? "");
      setEmergencyContactPhone(resource.data.emergencyContactPhone ?? "");
    }
  }, [resource.data]);

  async function requestChange(event: FormEvent) {
    event.preventDefault();
    const profile = resource.data;
    if (!resource.session || !profile) return;
    setNotice(null);
    setActionError(null);
    setSendingChange(true);
    try {
      await api(
        "/me/profile-change-requests",
        {
          method: "POST",
          body: JSON.stringify({
            givenName: givenName.trim(),
            familyName: familyName.trim(),
            middleName: middleName.trim() || undefined,
            preferredName: preferredName.trim() || undefined,
            primaryEmail: profile.primaryEmail,
            ...(email.trim() ? { personalEmail: email.trim() } : {}),
            phone: phone.trim(),
            emergencyContactName: emergencyContactName.trim(),
            emergencyContactPhone: emergencyContactPhone.trim(),
            reason: reason.trim(),
          }),
        },
        resource.session.accessToken,
      );
      setNotice("Personal-details request sent to the registrar for approval.");
      setReason("");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not request profile change");
    } finally {
      setSendingChange(false);
    }
  }

  const profile = resource.data;
  const fullName = profile ? `${profile.givenName} ${profile.familyName}`.trim() : "Student";

  return (
    <StudentFrame role="student" title="" activeHref="/student/profile">
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        {profile ? (
          <div className="mh-hcc-page mh-hcc-profile" data-stu="STU-06">
            <p className="mh-hcc-profile__crumb">
              Home <span>›</span> My Profile / Settings <span>›</span> Request to Update Personal Details
            </p>

            <header className="mh-hcc-profile__head mh-student-profile-request__head">
              <button
                type="button"
                className="mh-hcc-profile__avatar"
                onClick={() => setZoomOpen(true)}
                aria-label="Zoom profile photo"
              >
                <svg viewBox="0 0 64 64" width="88" height="88" aria-hidden>
                  <circle cx="32" cy="32" r="32" fill="#e8eef2" />
                  <path
                    d="M32 12c8 0 14 8 8 16-7 2-9 6-8 10 8 1 16 6 18 14H14c2-8 10-13 18-14 1-4-1-8-8-10-6-8 0-16 8-16z"
                    fill="#9aa7b2"
                  />
                </svg>
              </button>
              <div>
                <h1>Request to update personal details</h1>
                <p className="mh-teacher-muted">
                  Submitted values route to registrar approval before the official record updates.
                </p>
              </div>
            </header>

            <section className="mh-hcc-panel">
              <form className="mh-teacher-form mh-student-profile-request__form" onSubmit={requestChange}>
                <div className="mh-teacher-fields">
                  <label>
                    <span>Last name *</span>
                    <input className="mh-teacher-field" value={familyName} onChange={(e) => setFamilyName(e.target.value)} required />
                  </label>
                  <label>
                    <span>First name *</span>
                    <input className="mh-teacher-field" value={givenName} onChange={(e) => setGivenName(e.target.value)} required />
                  </label>
                  <label>
                    <span>Middle name</span>
                    <input className="mh-teacher-field" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                  </label>
                  <label>
                    <span>Preferred name</span>
                    <input className="mh-teacher-field" value={preferredName} onChange={(e) => setPreferredName(e.target.value)} />
                  </label>
                  <label>
                    <span>Phone number *</span>
                    <input className="mh-teacher-field" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={7} />
                  </label>
                  <label>
                    <span>Official college e-mail</span>
                    <input className="mh-teacher-field" type="email" value={profile.primaryEmail} readOnly aria-readonly="true" />
                  </label>
                  <label>
                    <span>Personal e-mail</span>
                    <input
                      className="mh-teacher-field"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Emergency contact name *</span>
                    <input
                      className="mh-teacher-field"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Emergency contact phone *</span>
                    <input
                      className="mh-teacher-field"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      required
                      minLength={7}
                    />
                  </label>
                  <label style={{ gridColumn: "1 / -1" }}>
                    <span>Reason *</span>
                    <textarea
                      className="mh-teacher-field"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={10}
                      required
                      rows={3}
                    />
                  </label>
                </div>
                <div className="mh-teacher-actions">
                  <button type="submit" className="mh-hcc-modal__save" disabled={sendingChange}>
                    {sendingChange ? "Sending…" : "Continue"}
                  </button>
                </div>
              </form>
            </section>

            {zoomOpen ? (
              <div className="mh-hcc-avatar-zoom" role="dialog" aria-modal="true" aria-label={`${fullName} profile photo`}>
                <button type="button" className="mh-hcc-avatar-zoom__backdrop" onClick={() => setZoomOpen(false)} aria-label="Close" />
                <div className="mh-hcc-avatar-zoom__card">
                  <svg viewBox="0 0 64 64" width="160" height="160" aria-hidden>
                    <circle cx="32" cy="32" r="32" fill="#e8eef2" />
                    <path
                      d="M32 12c8 0 14 8 8 16-7 2-9 6-8 10 8 1 16 6 18 14H14c2-8 10-13 18-14 1-4-1-8-8-10-6-8 0-16 8-16z"
                      fill="#9aa7b2"
                    />
                  </svg>
                  <p>{fullName}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </ResourceBoundary>
    </StudentFrame>
  );
}

export function StudentSecurityView() {
  const router = useRouter();
  const resource = useStudentResource<Profile>("/me/profile");
  const [verified, setVerified] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!verified) {
    return (
      <StudentFrame role="student" title="Security settings" subtitle="Account verification required" breadcrumb={["Student", "Security"]} activeHref="/student/security">
        <div className="mh-hcc-verify">
          <h1>ACCOUNT VERIFICATION REQUIRED</h1>
          <p>To continue, first verify that it&apos;s you by entering your current password.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!currentPassword.trim()) {
                setError("Enter your current password.");
                return;
              }
              setError(null);
              setVerified(true);
            }}
          >
            <label>
              <span>Current Password</span>
              <input type="password" className="mh-teacher-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            {error ? <p className="mh-teacher-error">{error}</p> : null}
            <button type="submit" className="mh-hcc-modal__save">Continue</button>
          </form>
        </div>
      </StudentFrame>
    );
  }

  return (
    <StudentFrame role="student" title="Security settings" subtitle="Password and session security" breadcrumb={["Student", "Security"]} activeHref="/student/security">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <div className="mh-hcc-verify">
        <h1>Security Settings</h1>
        <p className="mh-teacher-muted">Account verified. Manage password from here. Other sessions will be signed out after a password change.</p>
        <p>Student: <strong>{resource.data ? `${resource.data.givenName} ${resource.data.familyName}` : "…"}</strong></p>
        <form
          className="mh-teacher-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!resource.session) return;
            setBusy(true);
            setError(null);
            try {
              await api(
                "/auth/change-password",
                { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) },
                resource.session.accessToken,
                { skipAuthRedirect: true },
              );
              setNotice("Password updated. Sign in again with your new password.");
              setNewPassword("");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Could not change password");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            <span>New password</span>
            <input className="mh-teacher-field" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required />
          </label>
          <div className="mh-teacher-actions">
            <button type="submit" className="mh-hcc-modal__save" disabled={busy}>{busy ? "Updating…" : "Save password"}</button>
            <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => router.push("/student/profile")}>Back to profile</button>
          </div>
        </form>
      </div>
    </StudentFrame>
  );
}

export function StudentTimezoneView() {
  const resource = useStudentResource<Profile>("/me/profile");
  const [zone, setZone] = useState<string>(DEFAULT_HCC_TIME_ZONE);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!resource.data?.timezone) return;
    const stored = resource.data.timezone;
    if ((HCC_TIME_ZONES as readonly string[]).includes(stored)) {
      setZone(stored);
      return;
    }
    const byIana: Record<string, string> = {
      "America/Vancouver": DEFAULT_HCC_TIME_ZONE,
      "America/Edmonton": "(UTC-07:00) Mountain Time (US & Canada)",
      "America/Winnipeg": "(UTC-06:00) Central Time (US & Canada)",
      "America/Toronto": "(UTC-05:00) Eastern Time (US & Canada)",
      UTC: "(UTC+00:00) UTC",
      "Asia/Kolkata": "(UTC+05:30) New Delhi",
    };
    setZone(byIana[stored] || DEFAULT_HCC_TIME_ZONE);
  }, [resource.data]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentTime = useMemo(() => formatCurrentTime(zone), [zone, tick]);

  return (
    <StudentFrame role="student" title="" activeHref="/student/timezone">
      <div className="mh-hcc-page" data-stu="STU-05">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> My Profile / Settings <span>›</span> Change Time Zone
        </p>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
          <div className="mh-hcc-timezone">
            <h1>CHANGE YOUR TIME ZONE</h1>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!resource.session) return;
                setBusy(true);
                setError(null);
                setNotice(null);
                try {
                  await api(
                    "/me/preferences",
                    { method: "PATCH", body: JSON.stringify({ timezone: zone }) },
                    resource.session.accessToken,
                  );
                  setNotice(`Time zone updated · ${zone}`);
                  await resource.refresh();
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Could not save time zone");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                <span>Current Time</span>
                <input className="mh-teacher-field" value={currentTime} readOnly />
              </label>
              <label>
                <span>New Time Zone</span>
                <select
                  className="mh-teacher-field mh-hcc-timezone__select"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  size={12}
                >
                  {HCC_TIME_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="mh-hcc-modal__save" disabled={busy}>
                {busy ? "Saving…" : "Save Time Zone"}
              </button>
            </form>
          </div>
        </ResourceBoundary>
      </div>
    </StudentFrame>
  );
}

type SearchGroup = { type: string; items: Array<{ id: string; label: string; sub?: string | null; href?: string | null }> };

export function StudentSearchView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeQuery = (searchParams.get("q") ?? "").trim();
  useEffect(() => {
    const active = loadSession();
    if (!active) router.replace("/login");
    else setSession(active);
  }, [router]);
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setQuery(q);
    if (!q.trim() || !session) {
      setGroups([]);
      return;
    }
    setBusy(true);
    setError(null);
    api<{ groups: SearchGroup[] }>(`/search?q=${encodeURIComponent(q.trim())}`, {}, session.accessToken)
      .then((result) => setGroups(result.groups))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Search failed"))
      .finally(() => setBusy(false));
  }, [searchParams, session]);
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    router.push(`/student/search?q=${encodeURIComponent(query.trim())}`);
  }
  return (
    <StudentFrame
      role="student"
      title="Search"
      subtitle="Search your courses, assignments, library, and student services."
      breadcrumb={["Student", "Search"]}
    >
      <form onSubmit={search} style={{ display: "flex", gap: 10, marginBottom: 18, maxWidth: 680 }}>
        <input
          aria-label="Search student portal"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your portal"
          style={{ flex: 1 }}
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {!busy && groups.length === 0 ? (
        <EmptyState
          title={activeQuery ? `No results for “${activeQuery}”` : "Search your portal"}
          body={
            activeQuery
              ? "Try a course code, assignment, lab, service, credential, or library keyword."
              : "Results are limited to records and services available to your student account."
          }
        />
      ) : (
        groups.map((group) => (
          <Panel key={group.type} title={group.type[0]?.toUpperCase() + group.type.slice(1)}>
            <ul style={listStyle}>
              {group.items.map((item) => (
                <li key={item.id} style={rowStyle}>
                  <div>
                    <strong>{item.label}</strong>
                    {item.sub ? <div style={{ color: "var(--mh-text-muted)" }}>{item.sub}</div> : null}
                  </div>
                  {item.href ? (
                    <Button type="button" variant="secondary" onClick={() => router.push(item.href!)}>
                      Open
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>
        ))
      )}
    </StudentFrame>
  );
}

type PortalHubView = {
  title: string;
  subtitle: string;
  metrics: Array<{ label: string; value: string; hint?: string }>;
  sections: Array<{ title: string; rows: Array<{ primary: string; secondary?: string; meta?: string; href?: string }> }>;
  actions: Array<{ label: string; href?: string; variant?: string }>;
};

const SERVICE_LINKS: Array<{ title: string; body: string; href: string }> = [
  { title: "Active courses", body: "Open enrolled sections, lectures, and resources.", href: "/student/courses" },
  { title: "Grades & final marks", body: "Published scores and letter grades.", href: "/student/grades" },
  { title: "Assignments", body: "Due work, uploads, and submission status.", href: "/student/assignments" },
  { title: "Calendar & Join Class", body: "Upcoming classes and meeting links.", href: "/student/calendar" },
  { title: "Campus services", body: "Workshops, advising, and campus request forms.", href: "/student/f/st-16-services" },
  { title: "Program plan", body: "Program standing and progress overview.", href: "/student/f/st-23-program-plan" },
  { title: "My documents", body: "ID card and uploaded student documents.", href: "/student/documents" },
  { title: "Workshops", body: "Browse and register for campus workshops.", href: "/student/workshops" },
  { title: "Fees & statements", body: "Balances, tuition, and financial records.", href: "/student/fees" },
  { title: "Tax documents", body: "T2202 and other tax forms.", href: "/student/f/st-26-tax-documents" },
  { title: "Required tasks", body: "Pending and completed student tasks.", href: "/student/f/st-27-required-tasks" },
  { title: "Extracurricular & badges", body: "Activities and digital accomplishments.", href: "/student/f/st-25-extracurricular" },
  { title: "Messages", body: "Inbox threads with instructors and campus.", href: "/student/messages" },
  { title: "Leave of absence", body: "Start a request form for registrar review.", href: "/student/leave-of-absence" },
  { title: "Ask CampusOne", body: "Grounded answers from your campus records.", href: "/student/ask" },
  { title: "Profile & settings", body: "Timezone, security, and correction requests.", href: "/student/profile" },
];

export function StudentServicesView() {
  const router = useRouter();
  const resource = useStudentResource<PortalHubView>("/portal/view?path=%2Fstudent%2Fadvising");
  const advisingRows = resource.data?.sections.flatMap((section) => section.rows) ?? [];

  return (
    <StudentFrame
      role="student"
      active="Services"
      title="Student services"
      subtitle="Advising, records, workshops, fees, and request forms for your student account."
      breadcrumb={["Student", "Services"]}
    >
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="Advising appointments">
            {advisingRows.length ? (
              <ul style={listStyle}>
                {advisingRows.map((row) => (
                  <li key={`${row.primary}-${row.meta ?? ""}`} style={rowStyle}>
                    <div>
                      <strong>{row.primary}</strong>
                      {row.secondary ? <div style={{ color: "var(--mh-text-muted)" }}>{row.secondary}</div> : null}
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {row.meta ? <StatusPill tone="warning">{row.meta}</StatusPill> : null}
                      <Button type="button" variant="secondary" onClick={() => router.push("/student/messages")}>
                        Message advisor
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No advising bookings yet" body="When an advisor books a check-in, it will appear here." />
            )}
          </Panel>

          <Panel title="My campus hub">
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {SERVICE_LINKS.map((link) => (
                <button
                  key={link.href + link.title}
                  type="button"
                  onClick={() => router.push(link.href)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    border: "1px solid var(--mh-border)",
                    borderRadius: "var(--mh-radius-md)",
                    background: "var(--mh-surface)",
                    cursor: "pointer",
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <strong>{link.title}</strong>
                  <span style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>{link.body}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </ResourceBoundary>
    </StudentFrame>
  );
}

export { StudentFeesView } from "@/components/StudentFinanceViews";

export function StudentDocumentsView() {
  const router = useRouter();
  const resource = useStudentResource<{ items: Array<{ id: string; recordName: string; recordDate: string | null; docLabel: string | null; downloadUrl: string | null; status: string }> }>("/student/documents");
  const rows = resource.data?.items ?? [];
  return (
    <StudentFrame role="student" title="My documents" subtitle="Student ID and campus document records." breadcrumb={["Student", "Documents"]} activeHref="/student/documents">
      <ResourceBoundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
        <Panel title="Documents">
          {rows.length ? (
            <ul style={listStyle}>
              {rows.map((row) => (
                <li key={row.id} style={rowStyle}>
                  <div>
                    <strong>{row.recordName}</strong>
                    {row.docLabel ? <div style={{ color: "var(--mh-text-muted)" }}>{row.docLabel}</div> : null}
                    {row.recordDate ? <div style={{ color: "var(--mh-text-muted)", fontSize: 12 }}>{row.recordDate}</div> : null}
                  </div>
                  <StatusPill tone="success">{row.status}</StatusPill>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No documents yet" body="Uploaded and issued student documents will list here." />
          )}
          <div style={{ marginTop: 14 }}>
            <Button type="button" variant="secondary" onClick={() => router.push("/student/advising")}>Student services</Button>
          </div>
        </Panel>
      </ResourceBoundary>
    </StudentFrame>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@myheritage/ui";
import { ApiError, api, loadSession, type Session } from "@/lib/api";
import { StudentFrame } from "@/components/StudentSisShell";
import { courseStatusLabel, courseStatusTone, formatHccDateRange, parseDate } from "@/lib/hccCourseFormat";
import { liveClassRef, openClassLink } from "@/lib/liveClass";
import { LiveClassPanel } from "@/components/LiveClassPanel";
import { AiDraftVideoPlayer } from "@/components/ai-draft/AiDraftVideoPlayer";
import { LessonBody, LmsActivitySettings, LmsAssignmentSummary, LmsFileCard, LmsUrlCard } from "@/components/lms/LmsScreens";
import type { AiDraftStoryboard } from "@/lib/aiDraftSamples";
import type { LmsAssignmentSettings } from "@/lib/teacherCatalog";

type LoadState = "loading" | "ready" | "offline" | "forbidden" | "notFound" | "error";

type Course = {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  termName: string;
  instructorName: string;
  credits: number;
  enrolmentStatus: "enrolled" | "completed" | "waitlisted";
  courseStatus?: "completed" | "failed" | "in_progress" | "not_started" | "dropped";
  progressPercent: number | null;
  deliveryMethod?: string | null;
  location?: string | null;
  scheduleText?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
};

type CalendarEvent = {
  id: string;
  kind: string;
  sectionId: string | null;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
};

type LmsActivity = {
  id: string;
  type: string;
  name: string;
  body?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  modified?: string;
  note?: string;
  joinUrl?: string | null;
  gradingMethod?: string;
  questions?: Array<{ id: string; text: string; answers: string[]; mark?: string }>;
  /** Present (null until submitted) only on auto-graded quizzes. */
  quizAttempt?: { score: number; maxScore: number; submittedAt: string } | null;
  quizMinutes?: number | null;
  storyboard?: AiDraftStoryboard;
  description?: string;
  url?: string;
  settings?: Record<string, string>;
  assignmentId?: string;
  assignment?: LmsAssignmentSettings;
  choice?: {
    options: string[];
    multiple: boolean;
    displayMode: "horizontal" | "vertical";
    response?: { selected: string[]; submittedAt: string } | null;
  };
};

type CourseLms = {
  academicBlock: { code: string; name: string; startsOn: string; endsOn: string } | null;
  dayBlocks: Array<{
    id: string;
    label: string;
    title: string;
    lessons: Array<{
      id: string;
      title: string;
      body: string;
      resourceHref: string | null;
      completed: boolean;
    }>;
  }>;
  folders: Array<{
    id: string;
    name: string;
    items: Array<{ id: string; title: string; kind: string; href: string | null }>;
  }>;
  syllabus: Array<{ id: string; title: string; level: number }>;
  topics?: Array<{ id: string; title: string; summary?: string; activities: LmsActivity[] }>;
  evaluationRows?: Array<{ component: string; weight: string }>;
  gradeScheme?: Array<{ title: string; weightPercent: number }>;
  sessionLabel?: string;
  location?: string;
  instructorName?: string;
  joinUrl?: string | null;
};

type GradeRow = {
  id: string;
  title: string;
  weightPercent: number;
  score: number | null;
  maxScore: number;
  letter: string | null;
  feedback?: string | null;
};

const EVAL_COLORS = ["#2f9e44", "#1971c2", "#e8590c", "#9c36b5", "#868e96"];

function EvaluationCriteriaCard({
  courseCode,
  courseTitle,
  rows,
  modified,
  compact = false,
}: {
  courseCode: string;
  courseTitle: string;
  rows: Array<{ component: string; weight: string }>;
  modified?: string;
  compact?: boolean;
}) {
  const list = rows.filter((r) => r.component !== "Total");
  const totalRow = rows.find((r) => r.component === "Total");
  const total = totalRow?.weight ?? `${Number(list.reduce((n, r) => n + (Number.parseFloat(r.weight) || 0), 0).toFixed(2))}%`;
  return (
    <div className={`mh-student-eval-card${compact ? " is-compact" : ""}`} data-screen="evaluation">
      <header>
        <div className="mh-student-eval-card__cap" aria-hidden>
          ▨
        </div>
        <div>
          <strong>EVALUATION CRITERIA</strong>
          <span>Course Grade Distribution — Out of 100%</span>
        </div>
        <em className="mh-student-eval-card__pill">
          {courseCode.replace(/\s+/g, "")} {courseTitle}
        </em>
      </header>
      <p className="mh-student-eval-card__section">COURSE EVALUATION</p>
      {list.length === 0 ? (
        <p className="mh-teacher-muted">Your instructor has not published the evaluation criteria for this course yet.</p>
      ) : null}
      <ul>
        {list.map((row, i) => {
          const pct = Number.parseFloat(row.weight) || 0;
          return (
            <li key={row.component}>
              <span className="mh-student-eval-card__dot" style={{ background: EVAL_COLORS[i % EVAL_COLORS.length] }} />
              <div>
                <strong>{row.component}</strong>
                <div className="mh-student-eval-card__bar">
                  <i style={{ width: `${pct}%`, background: EVAL_COLORS[i % EVAL_COLORS.length] }} />
                </div>
              </div>
              <em>{row.weight}</em>
            </li>
          );
        })}
      </ul>
      {list.length ? (
        <footer>
          <span>TOTAL</span>
          <span>{total}</span>
        </footer>
      ) : null}
      {modified ? <p className="mh-teacher-muted mh-student-eval-card__mod">Last modified: {modified}</p> : null}
    </div>
  );
}

type SyllabusInfo =
  | { available: true; name: string; mime: string; size: number | null; updatedAt: string | null; description: string }
  | { available: false; description: string };

function formatBytes(n: number | null) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fileFormat(mime: string, name: string) {
  if (/pdf/i.test(mime)) return "PDF";
  if (/word/i.test(mime) || /\.docx?$/i.test(name)) return "Word";
  if (/^image\//i.test(mime)) return "Image";
  if (/^text\//i.test(mime)) return "Text";
  return "File";
}

function SyllabusDocumentCard({
  sectionId,
  courseCode,
  courseTitle,
}: {
  sectionId: string;
  courseCode: string;
  courseTitle: string;
}) {
  const [info, setInfo] = useState<SyllabusInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (!session) return;
    let live = true;
    api<SyllabusInfo>(`/me/courses/${encodeURIComponent(sectionId)}/syllabus`, {}, session.accessToken)
      .then((r) => live && setInfo(r))
      .catch((e: unknown) => live && setLoadError(e instanceof Error ? e.message : "The syllabus could not be loaded."));
    return () => {
      live = false;
    };
  }, [sectionId]);

  async function download() {
    const session = loadSession();
    if (!session) return;
    setDownloading(true);
    setLoadError(null);
    try {
      const file = await api<{ name: string; mime: string; base64: string }>(
        `/me/courses/${encodeURIComponent(sectionId)}/syllabus/file`,
        {},
        session.accessToken,
      );
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mime || "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name || "syllabus";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "The syllabus could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  }

  const ready = info?.available ? info : null;
  return (
    <div className="mh-student-syllabus" data-screen="syllabus">
      <div className="mh-student-syllabus__hero">
        {ready ? <span className="mh-student-syllabus__badge">{fileFormat(ready.mime, ready.name).toUpperCase()}</span> : null}
        <div>
          <p className="mh-student-activity-type">FILE</p>
          <h2>Course Syllabus</h2>
          <p>
            {courseCode}: {courseTitle}
          </p>
        </div>
      </div>
      <div className="mh-student-syllabus__body">
        {info?.description ? <p>{info.description}</p> : null}
        {loadError ? <p className="mh-teacher-error">{loadError}</p> : null}
        {!info && !loadError ? <p className="mh-teacher-muted">Loading syllabus…</p> : null}
        {info && !ready ? (
          <p className="mh-teacher-muted">No syllabus has been released to students for this course yet.</p>
        ) : null}
        {ready ? (
          <>
            <dl>
              <div>
                <dt>Document</dt>
                <dd>{ready.name}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>
                  {fileFormat(ready.mime, ready.name)}
                  {ready.size != null ? ` · ${formatBytes(ready.size)}` : ""}
                </dd>
              </div>
              {ready.updatedAt ? (
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(ready.updatedAt)}</dd>
                </div>
              ) : null}
            </dl>
            <button type="button" className="mh-hcc-btn" onClick={() => void download()} disabled={downloading}>
              {downloading ? "Downloading…" : "Download syllabus"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function activityIcon(type: string) {
  const t = type.toUpperCase();
  if (t === "QUIZ") return "Q";
  if (t === "BIGBLUEBUTTON") return "▶";
  if (t === "PAGE") return "P";
  if (t === "FOLDER") return "F";
  if (t === "FILE") return "PDF";
  return "•";
}

function useStudentResource<T>(path: string) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (activeSession: Session) => {
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
        if (caught instanceof ApiError && caught.status === 404) {
          setState("notFound");
          return;
        }
        if ((typeof navigator !== "undefined" && !navigator.onLine) || caught instanceof TypeError) {
          setState("offline");
          return;
        }
        setError(caught instanceof Error ? caught.message : "The page could not be loaded.");
        setState("error");
      }
    },
    [path, router],
  );

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

  return { data, state, error, refresh: () => session && void load(session) };
}

function formatDate(value: string | null | undefined) {
  const d = value ? parseDate(value) : null;
  if (!d) return "—";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Boundary({
  state,
  error,
  onRetry,
  children,
}: {
  state: LoadState;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (state === "ready") return <>{children}</>;
  const copy = {
    loading: ["Loading", "Fetching your courses…"],
    offline: ["You're offline", "Reconnect and try again."],
    forbidden: ["Permission denied", "This page is available only to the signed-in student."],
    notFound: ["You're not enrolled in this course", "This course was not found or is not part of your enrolment."],
    error: ["Something went wrong", error ?? "The page could not be loaded."],
  }[state];
  return (
    <div className="mh-hcc-panel">
      <EmptyState title={copy[0]} body={copy[1]} />
      {state === "offline" || state === "error" ? (
        <button type="button" className="mh-hcc-btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
      {state === "notFound" ? (
        <Link href="/student/courses" className="mh-hcc-btn">
          Back to My Courses
        </Link>
      ) : null}
    </div>
  );
}

export function StudentCoursesPremiumView() {
  const router = useRouter();
  const search = useSearchParams();
  const resource = useStudentResource<{ courses: Course[] }>("/courses/me");
  const courses = resource.data?.courses ?? [];
  const term = search.get("term") || "All Terms";
  const status = search.get("status") || "Active & Upcoming Courses";

  const termOptions = useMemo(() => {
    const set = new Set(courses.map((c) => c.termName).filter(Boolean));
    return ["All Terms", ...[...set].sort()];
  }, [courses]);

  const statusOptions = ["Active & Upcoming Courses", "All Courses", "Completed Courses", "Failed Courses"];

  const filtered = useMemo(() => {
    const rows = courses.filter((c) => {
      if (term !== "All Terms" && c.termName !== term) return false;
      const failed = c.courseStatus === "failed";
      const done = c.courseStatus ? c.courseStatus === "completed" : c.enrolmentStatus === "completed";
      if (status === "Completed Courses") return done;
      if (status === "Failed Courses") return failed;
      if (status === "Active & Upcoming Courses") return !done && !failed;
      return true;
    });
    return [...rows].sort((a, b) => {
      const rank = (code: string) => (/^ACSW\s*500$/i.test(code) ? 0 : 1);
      const diff = rank(a.courseCode) - rank(b.courseCode);
      if (diff !== 0) return diff;
      return a.courseCode.localeCompare(b.courseCode);
    });
  }, [courses, term, status]);

  function applyFilter(next: { term?: string; status?: string }) {
    const params = new URLSearchParams();
    const nextTerm = next.term ?? term;
    const nextStatus = next.status ?? status;
    if (nextTerm !== "All Terms") params.set("term", nextTerm);
    if (nextStatus !== "Active & Upcoming Courses") params.set("status", nextStatus);
    const qs = params.toString();
    router.push(qs ? `/student/courses?${qs}` : "/student/courses");
  }

  return (
    <StudentFrame role="student" title="" activeHref="/student/courses">
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-11">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> My Courses
        </p>
        <h1>MY COURSES</h1>
        <div className="mh-hcc-filters mh-hcc-filters--campus">
          <label>
            <span>FILTER TERM:</span>
            <select value={term} onChange={(e) => applyFilter({ term: e.target.value })}>
              {termOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>FILTER STATUS:</span>
            <select value={status} onChange={(e) => applyFilter({ status: e.target.value })}>
              {statusOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Boundary state={resource.state} error={resource.error} onRetry={resource.refresh}>
          <table className="mh-hcc-table mh-hcc-table--campus">
            <thead>
              <tr>
                <th>COURSE</th>
                <th>DELIVERY METHOD</th>
                <th>INSTRUCTOR(S)</th>
                <th>STATUS</th>
                <th>LOCATION</th>
                <th>SCHEDULE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>No courses found.</td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const dateRange = formatHccDateRange(c.startsOn, c.endsOn);
                  return (
                    <tr
                      key={c.sectionId}
                      className="is-click"
                      onClick={() => router.push(`/student/courses/${c.sectionId}`)}
                    >
                      <td>
                        <strong className="mh-hcc-course-link">
                          {c.courseCode} ({c.sectionCode})
                        </strong>
                        <div className="mh-hcc-course-title">{c.courseTitle}</div>
                      </td>
                      <td>{c.deliveryMethod || ""}</td>
                      <td>{c.instructorName}</td>
                      <td>
                        <span className={`mh-hcc-status mh-hcc-status--${courseStatusTone(c)}`}>
                          {courseStatusLabel(c)}
                        </span>
                      </td>
                      <td>{c.location || "TBD"}</td>
                      <td className="mh-hcc-schedule">
                        {dateRange ? (
                          <div className="mh-hcc-schedule__dates">Dates: {dateRange}</div>
                        ) : null}
                        {c.scheduleText ? <div className="mh-hcc-pre">{c.scheduleText}</div> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Boundary>
      </div>
    </StudentFrame>
  );
}

export function StudentCourseDetailPremiumView({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get("tab") || "Course").toLowerCase() === "grades" ? "Grades" : "Course";
  const activityId = search.get("aid");
  const quizMode = search.get("quiz") === "attempt";
  const courses = useStudentResource<{ courses: Course[] }>("/courses/me");
  const calendar = useStudentResource<{ events: CalendarEvent[] }>("/calendar/me");
  const lms = useStudentResource<CourseLms>(`/student/courses/${sectionId}/lms`);
  const grades = useStudentResource<{
    courses: Array<{ sectionId: string; code: string; items: GradeRow[] }>;
  }>("/grades/me");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoScheduleView, setInfoScheduleView] = useState<"week" | "calendar">("week");
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [choiceSelections, setChoiceSelections] = useState<Record<string, string[]>>({});
  const [choiceSubmitting, setChoiceSubmitting] = useState(false);
  const [choiceMessage, setChoiceMessage] = useState("");
  const [quizResult, setQuizResult] = useState<{
    activityId: string;
    score: number;
    maxScore: number;
    results: Array<{ id: string; correct: boolean }>;
  } | null>(null);

  const course = courses.data?.courses.find((item) => item.sectionId === sectionId);
  const sessions = (calendar.data?.events ?? []).filter((e) => e.sectionId === sectionId && e.kind === "class");
  const gradeItems =
    grades.data?.courses.find((c) => c.sectionId === sectionId || c.code === course?.courseCode)?.items ?? [];
  const topics = lms.data?.topics ?? [];
  const evaluationRows = lms.data?.evaluationRows ?? [];
  const gradeScheme = lms.data?.gradeScheme ?? [];
  const block = lms.data?.academicBlock;
  const location = lms.data?.location || sessions.find((s) => s.location)?.location || course?.location || "TBA";
  const instructorName = lms.data?.instructorName || course?.instructorName || "TBA";
  const sessionLabel =
    lms.data?.sessionLabel ||
    `${course?.sectionCode || ""}${
      formatHccDateRange(block?.startsOn || course?.startsOn, block?.endsOn || course?.endsOn)
        ? `: ${formatHccDateRange(block?.startsOn || course?.startsOn, block?.endsOn || course?.endsOn)}`
        : ""
    }`;
  const startDate = block?.startsOn || course?.startsOn || sessions[0]?.startsAt || null;
  const endDate = block?.endsOn || course?.endsOn || sessions[sessions.length - 1]?.endsAt || null;
  const joinUrl = lms.data?.joinUrl || null;

  const allActivities = useMemo(() => topics.flatMap((t) => t.activities), [topics]);
  const viewed = allActivities.find((a) => a.id === activityId) || null;
  const viewedIsEvaluation = viewed?.id === "act-evaluation-criteria" && !viewed.fileId;
  const viewedIsSyllabus = viewed?.type === "FILE" && viewed.id === "act-course-syllabus" && !viewed.fileId;

  const gradesTable =
    gradeItems.length > 0
      ? gradeItems
      : gradeScheme.map((g, i) => ({
          id: `scheme-${i}`,
          title: g.title,
          weightPercent: g.weightPercent,
          score: null as number | null,
          maxScore: 100,
          letter: null as string | null,
          feedback: null as string | null,
        }));

  const weekDays = useMemo(() => {
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const buckets: Record<string, string[]> = Object.fromEntries(labels.map((d) => [d, []]));
    for (const s of sessions) {
      const d = new Date(s.startsAt);
      const key = labels[d.getDay()]!;
      const end = s.endsAt ? ` - ${formatTime(s.endsAt)}` : "";
      buckets[key]!.push(`${formatTime(s.startsAt)}${end}`);
    }
    return labels.map((label) => ({ label, entries: buckets[label] || [] }));
  }, [sessions]);

  const lmsState: LoadState = lms.state === "forbidden" && courses.state === "ready" ? "notFound" : lms.state;
  const states = [courses.state, calendar.state, lmsState, grades.state];
  const combinedState: LoadState = states.includes("forbidden")
    ? "forbidden"
    : states.includes("notFound")
      ? "notFound"
      : states.includes("error")
        ? "error"
        : states.includes("offline")
          ? "offline"
          : states.every((s) => s === "ready")
            ? "ready"
            : "loading";

  function setTab(next: "Course" | "Grades") {
    const params = new URLSearchParams(search.toString());
    params.delete("aid");
    params.delete("quiz");
    if (next === "Course") params.delete("tab");
    else params.set("tab", "Grades");
    const qs = params.toString();
    router.push(qs ? `/student/courses/${sectionId}?${qs}` : `/student/courses/${sectionId}`);
  }

  function openActivity(aid: string, quizAttempt = false) {
    const activity = allActivities.find((item) => item.id === aid);
    if (activity && !quizAttempt && !["QUIZ", "ASSIGNMENT", "CHOICE"].includes(activity.type)) {
      const session = loadSession();
      if (session?.accessToken) {
        void api(
          `/student/courses/${sectionId}/content/${encodeURIComponent(`activity:${aid}`)}/complete`,
          { method: "POST", body: "{}" },
          session.accessToken,
        ).then(() => courses.refresh()).catch(() => undefined);
      }
    }
    const params = new URLSearchParams(search.toString());
    params.delete("tab");
    params.set("aid", aid);
    if (quizAttempt) params.set("quiz", "attempt");
    else params.delete("quiz");
    router.push(`/student/courses/${sectionId}?${params.toString()}`);
  }

  function clearActivity() {
    const params = new URLSearchParams(search.toString());
    params.delete("aid");
    params.delete("quiz");
    const qs = params.toString();
    router.push(qs ? `/student/courses/${sectionId}?${qs}` : `/student/courses/${sectionId}`);
  }

  const scheduleColors: Record<string, string> = {
    Mon: "#dbeafe",
    Tue: "#e9d5ff",
    Wed: "#fce7f3",
    Thu: "#fef08a",
  };

  /** ACSW 500 / Family Studies: Mon–Thu 5:00pm–10:00pm when calendar is empty. */
  const scheduleDays = useMemo(() => {
    if (weekDays.some((d) => d.entries.length > 0)) return weekDays;
    const isFamily = /ACSW\s*500/i.test(course?.courseCode || "") || /family\s*studies/i.test(course?.courseTitle || "");
    if (!isFamily) return weekDays;
    return weekDays.map((d) =>
      ["Mon", "Tue", "Wed", "Thu"].includes(d.label)
        ? { ...d, entries: ["5:00pm - 10:00pm"] }
        : d,
    );
  }, [weekDays, course?.courseCode, course?.courseTitle]);

  const calendarCells = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDay: Record<number, string[]> = {};

    const pushSlot = (dayNum: number, text: string) => {
      if (!byDay[dayNum]) byDay[dayNum] = [];
      if (!byDay[dayNum].includes(text)) byDay[dayNum].push(text);
    };

    for (const s of sessions) {
      const d = new Date(s.startsAt);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const end = s.endsAt ? ` – ${formatTime(s.endsAt)}` : "";
        pushSlot(d.getDate(), `${formatTime(s.startsAt)}${end}`);
      }
    }

    // Fallback recurring Mon–Thu slots for ACSW 500 when no calendar events
    if (sessions.length === 0) {
      const isFamily =
        /ACSW\s*500/i.test(course?.courseCode || "") || /family\s*studies/i.test(course?.courseTitle || "");
      if (isFamily) {
        for (let day = 1; day <= daysInMonth; day++) {
          const dow = new Date(year, month, day).getDay();
          if (dow >= 1 && dow <= 4) pushSlot(day, "5:00pm – 10:00pm");
        }
      }
    }

    const cells: Array<{ day: number | null; slots: string[]; inRange: boolean }> = [];
    for (let i = 0; i < firstDow; i++) cells.push({ day: null, slots: [], inRange: false });
    const rangeStart = startDate ? parseDate(startDate) : null;
    const rangeEnd = endDate ? parseDate(endDate) : null;
    if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
    if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);
    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(year, month, day);
      const inRange =
        (!rangeStart || cellDate >= rangeStart) && (!rangeEnd || cellDate <= rangeEnd);
      cells.push({ day, slots: byDay[day] || [], inRange });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, slots: [], inRange: false });
    return cells;
  }, [calMonth, sessions, course?.courseCode, course?.courseTitle, startDate, endDate]);

  const calMonthLabel = calMonth.toLocaleDateString("en-CA", { month: "long", year: "numeric" });

  const showingActivity = Boolean(viewed);
  const showingGrades = tab === "Grades" && !showingActivity;

  async function submitQuiz(activity: LmsActivity) {
    const questions = activity.questions || [];
    const unanswered = questions.filter((q) => answers[q.id] == null).length;
    const warning = unanswered ? `${unanswered} question(s) are not answered and will be marked wrong. ` : "";
    if (!window.confirm(`${warning}Submit your answers? Only your first attempt is graded.`)) return;
    const session = loadSession();
    if (!session?.accessToken) return;
    setQuizSubmitting(true);
    setQuizError("");
    try {
      const res = await api<{ score: number; maxScore: number; results: Array<{ id: string; correct: boolean }> }>(
        `/student/courses/${sectionId}/quizzes/${encodeURIComponent(activity.id)}/attempts`,
        { method: "POST", body: JSON.stringify({ answers: Object.fromEntries(questions.map((q) => [q.id, answers[q.id] ?? -1])) }) },
        session.accessToken,
      );
      setQuizResult({ activityId: activity.id, ...res });
      lms.refresh();
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Could not submit the quiz");
      if (err instanceof ApiError && err.status === 409) lms.refresh();
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function submitChoice(activity: LmsActivity) {
    const choice = activity.choice;
    if (!choice) return;
    const selected = choiceSelections[activity.id] ?? choice.response?.selected ?? [];
    if (!selected.length) {
      setChoiceMessage("Select an option first.");
      return;
    }
    const session = loadSession();
    if (!session?.accessToken) return;
    setChoiceSubmitting(true);
    setChoiceMessage("");
    try {
      await api(
        `/student/courses/${sectionId}/choices/${encodeURIComponent(activity.id)}/responses`,
        { method: "POST", body: JSON.stringify({ selected }) },
        session.accessToken,
      );
      setChoiceMessage("Your choice has been saved.");
      lms.refresh();
    } catch (err) {
      setChoiceMessage(err instanceof Error ? err.message : "Could not save your choice.");
    } finally {
      setChoiceSubmitting(false);
    }
  }

  function joinSession(url: string | null | undefined) {
    if (!openClassLink(url)) {
      window.alert("This room is ready. Your instructor will share the live join link when class begins.");
    }
  }

  return (
    <StudentFrame role="student" title="" activeHref="/student/courses">
      <Boundary
        state={combinedState}
        error={courses.error || lms.error || grades.error}
        onRetry={() => {
          courses.refresh();
          calendar.refresh();
          lms.refresh();
          grades.refresh();
        }}
      >
        {!course ? (
          <div className="mh-hcc-page">
            <EmptyState title="Course unavailable" body="This course is not part of your enrolment." />
          </div>
        ) : (
          <div className="mh-hcc-page mh-student-course-premium" data-stu="STU-07">
            {/* Screen chrome shared by all 8 student course screens */}
            <header className="mh-student-course-premium__moodle-head">
              <h1>
                {course.courseCode}: {course.courseTitle.toUpperCase()}
              </h1>
              <p>
                {sessionLabel}
                <br />
                {location}
              </p>
              <button type="button" className="mh-teacher-link" onClick={() => setInfoOpen(true)}>
                ALL COURSE INFORMATION
              </button>
            </header>

            {!showingActivity ? (
              <div className="mh-hcc-profile__tabs mh-student-course-premium__tabs">
                <button type="button" className={tab === "Course" ? "is-active" : ""} onClick={() => setTab("Course")}>
                  Course
                </button>
                <button type="button" className={tab === "Grades" ? "is-active" : ""} onClick={() => setTab("Grades")}>
                  Grades
                </button>
              </div>
            ) : null}

            {showingGrades ? (
              /* Screen 3 — Grades */
              <section className="mh-hcc-panel" data-stu="STU-08" data-screen="grades">
                <table className="mh-hcc-table mh-student-grades-table">
                  <thead>
                    <tr>
                      <th>PROJECT / ASSIGNMENT</th>
                      <th>FEEDBACK / DETAILS</th>
                      <th>MARK</th>
                      <th>GRADE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradesTable.length === 0 ? (
                      <tr>
                        <td colSpan={4}>No grade items for this course yet.</td>
                      </tr>
                    ) : (
                      gradesTable.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <strong>{g.title}</strong>
                            <div className="mh-teacher-muted">Weight: {Number(g.weightPercent).toFixed(2)}%</div>
                          </td>
                          <td style={{ whiteSpace: "pre-wrap" }}>
                            {g.score != null ? g.feedback || "—" : "No grades have been posted."}
                          </td>
                          <td>{g.score != null ? `${g.score} / ${g.maxScore}` : "—"}</td>
                          <td>{g.letter || "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            ) : viewed && quizMode && viewed.type === "QUIZ" ? (
              /* Screen 6 — Quiz attempt */
              <section className="mh-student-quiz-attempt" data-stu="STU-QUIZ" data-screen="quiz-attempt">
                <button type="button" className="mh-student-quiz-back" onClick={() => openActivity(viewed.id)}>
                  ← Back
                </button>
                <div className="mh-student-activity-badge">
                  <span className="mh-student-activity-badge__icon is-quiz" aria-hidden>
                    Q
                  </span>
                  <div>
                    <p className="mh-student-activity-type">QUIZ</p>
                    <h2>{viewed.name}</h2>
                  </div>
                </div>
                <div className="mh-student-quiz-list">
                  {(viewed.questions || []).map((q, idx) => (
                    <article key={q.id} className="mh-student-quiz-q">
                      <aside>
                        <strong>Question {idx + 1}</strong>
                        <span className={answers[q.id] != null ? "is-answered" : ""}>
                          {answers[q.id] != null ? "Answer saved" : "Not yet answered"}
                        </span>
                        <span>Marked out of {q.mark || "1.00"}</span>
                        <button
                          type="button"
                          className="mh-student-quiz-flag"
                          aria-pressed={Boolean(flaggedQuestions[q.id])}
                          onClick={() => setFlaggedQuestions((current) => ({ ...current, [q.id]: !current[q.id] }))}
                        >
                          {flaggedQuestions[q.id] ? "Unflag question" : "Flag question"}
                        </button>
                      </aside>
                      <div className="mh-student-quiz-q__prompt">
                        <p>{q.text}</p>
                        <ul>
                          {(q.answers || []).map((opt, oi) => (
                            <li key={opt}>
                              <label className={answers[q.id] === oi ? "is-selected" : ""}>
                                <input
                                  type="radio"
                                  name={q.id}
                                  checked={answers[q.id] === oi}
                                  onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                                />
                                <span>
                                  <b>{String.fromCharCode(97 + oi)}.</b> {opt}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
                {(viewed.questions || []).length === 0 ? (
                  <p className="mh-teacher-muted">No questions published for this quiz yet.</p>
                ) : null}
                {viewed.quizAttempt !== undefined ? (
                  <div className="mh-student-quiz-footer">
                    {quizError ? (
                      <p className="mh-teacher-muted" role="alert">
                        {quizError}
                      </p>
                    ) : null}
                    {quizResult?.activityId === viewed.id ? (
                      <p role="status">
                        <strong>
                          Score: {quizResult.score} / {quizResult.maxScore}
                        </strong>{" "}
                        — questions answered incorrectly:{" "}
                        {quizResult.results
                          .map((r, i) => (r.correct ? null : i + 1))
                          .filter((n) => n !== null)
                          .join(", ") || "none"}
                        . Review the module lessons for any you missed.
                      </p>
                    ) : viewed.quizAttempt ? (
                      <p role="status">
                        Already submitted on {formatDate(viewed.quizAttempt.submittedAt)} — score {viewed.quizAttempt.score} /{" "}
                        {viewed.quizAttempt.maxScore}.
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="mh-hcc-btn"
                        disabled={quizSubmitting || !(viewed.questions || []).length}
                        onClick={() => void submitQuiz(viewed)}
                      >
                        {quizSubmitting ? "Submitting…" : "Submit all and finish"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mh-student-quiz-footer">
                    <button type="button" className="mh-hcc-btn">
                      Next page
                    </button>
                  </div>
                )}
              </section>
            ) : viewed ? (
              /* Screens 1 gate / 4 BBB / 5 PAGE / 8 Evaluation */
              <section className="mh-student-activity-view" data-stu="STU-ACT" data-screen={`activity-${viewed.type.toLowerCase()}`}>
                <button type="button" className="mh-hcc-btn ghost" onClick={clearActivity}>
                  Back
                </button>
                {viewedIsEvaluation || viewedIsSyllabus ? null : (
                  <div className="mh-student-activity-badge">
                    <span
                      className={`mh-student-activity-badge__icon is-${viewed.type.toLowerCase()}`}
                      aria-hidden
                    >
                      {viewed.type === "QUIZ" ? "Q" : viewed.type === "BIGBLUEBUTTON" ? "▶" : "P"}
                    </span>
                    <div>
                      <p className="mh-student-activity-type">
                        {viewed.type === "BIGBLUEBUTTON" ? "BIGBLUEBUTTON" : viewed.type}
                      </p>
                      <h2>{viewed.name}</h2>
                    </div>
                  </div>
                )}
                {viewed.type === "BIGBLUEBUTTON" && liveClassRef(viewed.joinUrl || joinUrl) ? (
                  /* Screen 4 — BigBlueButton live class (student + teacher same room) */
                  <div data-screen="bbb">
                    <LiveClassPanel
                      sectionId={liveClassRef(viewed.joinUrl || joinUrl)!.sectionId}
                      provider={liveClassRef(viewed.joinUrl || joinUrl)!.provider}
                    />
                  </div>
                ) : viewed.type === "BIGBLUEBUTTON" ? (
                  <div className="mh-lms-bbb mh-student-bbb" data-screen="bbb">
                    <p className="mh-student-bbb__brand">Online Class Link</p>
                    <h3>Online Class Link</h3>
                    <p>{viewed.note || "This room is ready. You can join the session now."}</p>
                    {(viewed.joinUrl || joinUrl) ? (
                      <p className="mh-teacher-muted" style={{ wordBreak: "break-all" }}>
                        {viewed.joinUrl || joinUrl}
                      </p>
                    ) : null}
                    <button type="button" className="mh-hcc-btn" onClick={() => joinSession(viewed.joinUrl || joinUrl)}>
                      Join session
                    </button>
                  </div>
                ) : viewed.type === "QUIZ" && viewed.quizAttempt !== undefined ? (
                  <div className="mh-student-quiz-gate" data-screen="quiz-gate">
                    {viewed.body ? <LessonBody body={viewed.body} empty="" /> : null}
                    {viewed.quizAttempt ? (
                      <p>
                        <strong>
                          Your score: {viewed.quizAttempt.score} / {viewed.quizAttempt.maxScore}
                        </strong>{" "}
                        (submitted {formatDate(viewed.quizAttempt.submittedAt)})
                      </p>
                    ) : (
                      <button type="button" className="mh-hcc-btn" onClick={() => openActivity(viewed.id, true)}>
                        Attempt quiz
                      </button>
                    )}
                    <p className="mh-teacher-muted">
                      {(viewed.questions || []).length} questions
                      {viewed.quizMinutes ? ` · ${viewed.quizMinutes} minutes` : ""} · one attempt, graded automatically
                    </p>
                  </div>
                ) : viewed.type === "QUIZ" ? (
                  /* Screen 1 — Attempt quiz gate (FINAL EXAM) */
                  <div className="mh-student-quiz-gate" data-screen="quiz-gate">
                    <button type="button" className="mh-hcc-btn" onClick={() => openActivity(viewed.id, true)}>
                      Attempt quiz
                    </button>
                    <p className="mh-teacher-muted">Grading method: Highest grade</p>
                  </div>
                ) : viewedIsEvaluation ? (
                  /* Screen 8 — Evaluation criteria PAGE */
                  <EvaluationCriteriaCard
                    courseCode={course.courseCode}
                    courseTitle={course.courseTitle}
                    rows={evaluationRows}
                    modified={viewed.modified}
                  />
                ) : viewedIsSyllabus ? (
                  <SyllabusDocumentCard
                    sectionId={sectionId}
                    courseCode={course.courseCode}
                    courseTitle={course.courseTitle}
                  />
                ) : viewed.type === "FILE" || viewed.type === "FOLDER" ? (
                  <>
                    {viewed.description ? <p style={{ whiteSpace: "pre-wrap" }}>{viewed.description}</p> : null}
                    <LmsFileCard activity={viewed} sectionId={sectionId} audience="student" />
                  </>
                ) : viewed.type === "URL" ? (
                  <LmsUrlCard url={viewed.url} description={viewed.description} />
                ) : viewed.type === "BOOK" ? (
                  <div className="mh-lms-pagebody" data-screen="book">
                    {viewed.description ? <p style={{ whiteSpace: "pre-wrap" }}>{viewed.description}</p> : null}
                    <LessonBody body={viewed.body} empty={viewed.fileId ? "" : "Your instructor has not added book content yet."} />
                    {viewed.fileId ? <LmsFileCard activity={viewed} sectionId={sectionId} audience="student" /> : null}
                  </div>
                ) : viewed.type === "CHOICE" && viewed.choice ? (
                  <div className="mh-lms-pagebody mh-lms-choice" data-screen="choice">
                    <LessonBody body={viewed.body} empty="Choose one of the available options." />
                    {viewed.description ? <p style={{ whiteSpace: "pre-wrap" }}>{viewed.description}</p> : null}
                    <div className={`mh-lms-choice-options${viewed.choice.displayMode === "horizontal" ? " is-horizontal" : ""}`}>
                      {viewed.choice.options.map((option) => {
                        const selected = choiceSelections[viewed.id] ?? viewed.choice?.response?.selected ?? [];
                        return (
                          <label key={option} className="mh-lms-check">
                            <input
                              type={viewed.choice?.multiple ? "checkbox" : "radio"}
                              name={`choice-${viewed.id}`}
                              checked={selected.includes(option)}
                              onChange={(event) =>
                                setChoiceSelections((previous) => ({
                                  ...previous,
                                  [viewed.id]: viewed.choice?.multiple
                                    ? event.target.checked
                                      ? [...new Set([...selected, option])]
                                      : selected.filter((item) => item !== option)
                                    : [option],
                                }))
                              }
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                    <button type="button" className="mh-hcc-btn" disabled={choiceSubmitting} onClick={() => void submitChoice(viewed)}>
                      {choiceSubmitting ? "Saving…" : viewed.choice.response ? "Update choice" : "Submit choice"}
                    </button>
                    {choiceMessage ? <p role="status" className="mh-teacher-muted">{choiceMessage}</p> : null}
                    {viewed.choice.response ? <p className="mh-teacher-muted">Last submitted {formatDate(viewed.choice.response.submittedAt)}</p> : null}
                  </div>
                ) : viewed.type === "ASSIGNMENT" ? (
                  <div data-screen="assignment">
                    <LmsAssignmentSummary assignment={viewed.assignment} description={viewed.description} />
                    {viewed.fileId ? (
                      <div className="mh-lms-attachment-block">
                        <h3>Assignment attachment</h3>
                        <LmsFileCard activity={viewed} sectionId={sectionId} audience="student" />
                      </div>
                    ) : null}
                    {viewed.assignmentId ? (
                      <button
                        type="button"
                        className="mh-hcc-btn"
                        onClick={() => router.push(`/student/assignments/${viewed.assignmentId}`)}
                      >
                        Open assignment and submit
                      </button>
                    ) : (
                      <p className="mh-teacher-muted">Online submission is not open for this item.</p>
                    )}
                  </div>
                ) : (
                  /* Screen 5 — PAGE (Brief Course Description / Learning Objectives) */
                  <div className="mh-lms-pagebody mh-student-pagebody" data-screen="page">
                    {viewed.storyboard ? <AiDraftVideoPlayer key={viewed.id} storyboard={viewed.storyboard} /> : null}
                    {viewed.description ? <p style={{ whiteSpace: "pre-wrap" }}>{viewed.description}</p> : null}
                    {viewed.body ? <LessonBody body={viewed.body} empty="" /> : null}
                    {viewed.fileId ? <LmsFileCard activity={viewed} sectionId={sectionId} audience="student" /> : null}
                    {!viewed.storyboard && !viewed.description && !viewed.body && !viewed.fileId ? (
                      <p className="mh-teacher-muted">{viewed.name} content will appear here when published by your instructor.</p>
                    ) : null}
                    {viewed.modified ? (
                      <p className="mh-teacher-muted">Last modified: {viewed.modified}</p>
                    ) : null}
                  </div>
                )}
                {(viewed.type === "URL" || viewed.type === "BIGBLUEBUTTON") && viewed.body ? (
                  <div className="mh-lms-pagebody">
                    <LessonBody body={viewed.body} empty="" />
                  </div>
                ) : null}
                <LmsActivitySettings settings={viewed.settings} audience="student" />
              </section>
            ) : (
              /* Screen 7 — Course outline: RESOURCES → EVALUATION → DAY 1–8 */
              <section className="mh-lms-course mh-student-lms-course" data-screen="course-outline">
                <div className="mh-lms-course__toolbar">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      for (const t of topics) next[t.id] = true;
                      setCollapsed(next);
                    }}
                  >
                    Collapse all
                  </button>
                </div>
                {topics.length === 0 ? (
                  <p className="mh-teacher-muted">No course content published yet.</p>
                ) : (
                  topics.map((topic) => {
                    const shut = Boolean(collapsed[topic.id]);
                    const isEval = topic.id === "topic-eval";
                    const isResources = topic.id === "topic-resources";
                    return (
                      <article
                        key={topic.id}
                        className={`mh-lms-topic mh-student-topic${isEval ? " is-eval" : ""}${isResources ? " is-resources" : ""}`}
                        data-topic={topic.id}
                      >
                        <header className="mh-lms-topic__head">
                          <button
                            type="button"
                            className="mh-lms-topic__toggle"
                            onClick={() =>
                              setCollapsed((prev) => ({ ...prev, [topic.id]: !prev[topic.id] }))
                            }
                          >
                            {shut ? "▸" : "▾"}
                          </button>
                          <h2>{topic.title}</h2>
                        </header>
                        {shut ? null : (
                          <div className="mh-lms-topic__body">
                            {isEval ? (
                              <EvaluationCriteriaCard
                                courseCode={course.courseCode}
                                courseTitle={course.courseTitle}
                                rows={evaluationRows}
                                compact
                              />
                            ) : null}
                            {topic.activities.map((activity) => {
                              if (isEval && (activity.id === "act-evaluation-criteria" || /evaluation/i.test(activity.name))) {
                                return null;
                              }
                              return (
                                <div key={activity.id} className="mh-lms-activity mh-student-activity-row">
                                  <span
                                    className={`mh-lms-activity__type is-${activity.type.toLowerCase()}`}
                                    aria-hidden
                                  >
                                    {activityIcon(activity.type)}
                                  </span>
                                  <div>
                                    <button
                                      type="button"
                                      className="mh-lms-activity__name"
                                      onClick={() => openActivity(activity.id)}
                                    >
                                      {activity.name}
                                    </button>
                                    {activity.note ? <p>{activity.note}</p> : null}
                                    {activity.fileName ? (
                                      <p className="mh-teacher-muted">{activity.fileName}</p>
                                    ) : null}
                                    {activity.type === "QUIZ" ? (
                                      <p className="mh-teacher-muted">Click to open · Attempt when ready</p>
                                    ) : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="mh-student-activity-open"
                                    onClick={() => openActivity(activity.id)}
                                  >
                                    Open
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </section>
            )}

            {infoOpen ? (
              /* Screen 2 — ALL COURSE INFORMATION modal */
              <div
                className="mh-hcc-modal"
                role="dialog"
                aria-modal="true"
                aria-label="All Course Information"
                data-stu="STU-09"
                data-screen="course-info"
              >
                <button
                  type="button"
                  className="mh-hcc-modal__backdrop"
                  aria-label="Close"
                  onClick={() => setInfoOpen(false)}
                />
                <div className="mh-hcc-modal__panel mh-student-course-premium__modal">
                  <header className="mh-hcc-modal__head">
                    <div>
                      <p className="mh-teacher-muted">{course.courseTitle.toUpperCase()}</p>
                      <h2>
                        {course.courseCode} ({course.sectionCode})
                      </h2>
                    </div>
                    <button
                      type="button"
                      className="mh-hcc-modal__x"
                      onClick={() => setInfoOpen(false)}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </header>
                  <div className="mh-hcc-modal__body">
                    <div className="mh-student-course-info-top">
                      <dl className="mh-student-course-premium__meta">
                        <div>
                          <dt>Course dates</dt>
                          <dd>
                            {formatDate(startDate)} – {formatDate(endDate)}
                          </dd>
                        </div>
                        <div>
                          <dt>Instructor(s)</dt>
                          <dd>{instructorName}</dd>
                        </div>
                        <div>
                          <dt>Location</dt>
                          <dd>Campus: {location}</dd>
                        </div>
                      </dl>
                      <div className="mh-student-course-info-views" role="tablist" aria-label="Schedule view">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={infoScheduleView === "week"}
                          className={`mh-teacher-link${infoScheduleView === "week" ? " is-active" : ""}`}
                          onClick={() => setInfoScheduleView("week")}
                        >
                          Weekly View
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={infoScheduleView === "calendar"}
                          className={`mh-teacher-link${infoScheduleView === "calendar" ? " is-active" : ""}`}
                          onClick={() => {
                            setInfoScheduleView("calendar");
                            const d = startDate ? parseDate(startDate) : null;
                            if (d) setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                          }}
                        >
                          Calendar View
                        </button>
                      </div>
                    </div>
                    <h3>{infoScheduleView === "week" ? "Course schedule" : "Course calendar"}</h3>
                    {infoScheduleView === "week" ? (
                      <div className="mh-student-course-premium__week">
                        {scheduleDays.map((d) => (
                          <div
                            key={d.label}
                            className={d.entries.length ? "has-slot" : ""}
                            style={
                              d.entries.length && scheduleColors[d.label]
                                ? { background: scheduleColors[d.label] }
                                : undefined
                            }
                          >
                            <strong>{d.label}</strong>
                            {d.entries.length === 0 ? (
                              <p className="mh-teacher-muted">—</p>
                            ) : (
                              d.entries.map((e) => <p key={e}>{e}</p>)
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mh-student-course-cal">
                        <div className="mh-student-course-cal__nav">
                          <button
                            type="button"
                            className="mh-hcc-btn ghost"
                            onClick={() =>
                              setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
                            }
                          >
                            ← Prev
                          </button>
                          <strong>{calMonthLabel}</strong>
                          <button
                            type="button"
                            className="mh-hcc-btn ghost"
                            onClick={() =>
                              setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
                            }
                          >
                            Next →
                          </button>
                        </div>
                        <div className="mh-student-course-cal__grid" role="grid" aria-label={calMonthLabel}>
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                            <div key={d} className="mh-student-course-cal__dow">
                              {d}
                            </div>
                          ))}
                          {calendarCells.map((cell, idx) => (
                            <div
                              key={`c-${idx}`}
                              className={`mh-student-course-cal__cell${cell.day ? "" : " is-empty"}${
                                cell.slots.length ? " has-slot" : ""
                              }${cell.inRange ? " in-range" : ""}`}
                            >
                              {cell.day ? <span className="mh-student-course-cal__day">{cell.day}</span> : null}
                              {cell.slots.map((s) => (
                                <span key={s} className="mh-student-course-cal__slot">
                                  {s}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Boundary>
    </StudentFrame>
  );
}

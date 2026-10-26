"use client";

import { useMemo, useRef, useState } from "react";
import type { CourseLmsState, LmsAssignmentSettings, LmsQuizData } from "@/lib/teacherCatalog";
import { api, loadSession } from "@/lib/api";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";
import { liveClassRef, openClassLink } from "@/lib/liveClass";
import { LiveClassPanel } from "@/components/LiveClassPanel";
import { AiDraftVideoPlayer } from "@/components/ai-draft/AiDraftVideoPlayer";
import type { AiDraftStoryboard } from "@/lib/aiDraftSamples";
import { downloadLmsFile, formatFileSize } from "@/lib/lmsFiles";
import { LmsAccessRestrictionsEditor } from "./LmsAccessRestrictions";

export function AttendancePanel({
  lms,
  attendance,
  sectionId,
}: {
  lms: CourseLmsState;
  attendance?: {
    meetings: Array<{
      label: string;
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    }>;
    rows: Array<{
      studentId: string;
      name: string;
      studentNumber: string;
      status: string;
      meetingLabel: string;
      recordedAt: string;
    }>;
    markHref?: string;
    emptyMessage?: string;
  };
  sectionId?: string;
}) {
  const meetings = attendance?.meetings ?? [];
  const dates =
    meetings.length > 0
      ? meetings.map((m) => m.label)
      : lms.attendanceDates?.length
        ? lms.attendanceDates
        : [];
  const [date, setDate] = useState(dates[0] || "");
  const activeMeeting = meetings.find((m) => m.label === date) || meetings[0];
  const rows = (attendance?.rows ?? []).filter((r) => !date || r.meetingLabel === (activeMeeting?.label || date));
  const markHref =
    attendance?.markHref ||
    (sectionId ? `/instructor/attendance?sectionId=${encodeURIComponent(sectionId)}` : "/instructor/attendance");

  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
        {dates.length ? (
          <label>
            <span className="mh-teacher-sr-only">Attendance date</span>
            <select className="mh-teacher-field" value={date || dates[0]} onChange={(e) => setDate(e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <a className="mh-teacher-btn" href={markHref}>
          Mark attendance
        </a>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => window.print()}>
          PRINT ROSTER
        </button>
      </div>
      <h2>Attendance</h2>
      {activeMeeting ? (
        <p className="mh-teacher-muted">
          {activeMeeting.label} · Present {activeMeeting.present} · Absent {activeMeeting.absent}
          {activeMeeting.late ? ` · Late ${activeMeeting.late}` : ""}
          {activeMeeting.excused ? ` · Excused ${activeMeeting.excused}` : ""} · Total {activeMeeting.total}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="mh-teacher-muted">
          {attendance?.emptyMessage || "No attendance/students were found. Submit attendance first, then open this tab."}
        </p>
      ) : (
        <div className="mh-teacher-list">
          {rows.map((r) => (
            <div key={`${r.meetingLabel}-${r.studentId}`} className="mh-teacher-list__item">
              <div>
                <strong>{r.name}</strong>
                <span>
                  {r.studentNumber}
                  {r.meetingLabel ? ` · ${r.meetingLabel}` : ""}
                </span>
              </div>
              <span
                className={
                  /absent/i.test(r.status)
                    ? "mh-teacher-badge mh-teacher-badge--danger"
                    : /late/i.test(r.status)
                      ? "mh-teacher-badge mh-teacher-badge--warning"
                      : "mh-teacher-badge mh-teacher-badge--ok"
                }
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ClassListPanel({
  roster,
}: {
  roster: Array<{
    studentId?: string;
    name: string;
    studentNumber: string;
    program: string;
    standing: string;
    email: string;
  }>;
}) {
  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar">
        <h2>Class List</h2>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary">
          Print Class List
        </button>
      </div>
      {roster.length === 0 ? (
        <p className="mh-teacher-muted">No students are currently registered in this course offering</p>
      ) : (
        <div className="mh-teacher-list">
          {roster.map((s) => (
            <div key={s.studentNumber || s.email || s.name} className="mh-teacher-list__item">
              <div>
                <strong>{s.name}</strong>
                <span>
                  {s.studentNumber}
                  {s.program ? ` · ${s.program}` : ""}
                </span>
              </div>
              <span className="mh-teacher-muted">{s.email}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function GradesBoard({
  lms,
  onAddItem,
  onPostMarks,
}: {
  lms: CourseLmsState;
  onAddItem: () => void;
  onPostMarks: () => void;
}) {
  const live = useOptionalTeacherLive();
  return (
    <section className="mh-teacher-card mh-lms-grades">
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={live?.busy} onClick={onAddItem}>
          Add Item
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={live?.busy} onClick={onPostMarks}>
          Post Class Marks
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={live?.busy} onClick={() => void live?.runAction?.("Export Grades")}>
          Export Grades
        </button>
        <button type="button" className="mh-teacher-link" aria-label="Expand / full-screen view">
          Expand
        </button>
      </div>
      {lms.gradeBoard ? (
        <LiveGradeTable board={lms.gradeBoard} emptyMessage={lms.gradeEmpty} />
      ) : (
        <>
          <div className="mh-lms-grade-wrap">
            <table className="mh-lms-grade-table">
              <thead>
                <tr>
                  {lms.gradeColumns.map((col) => (
                    <th key={col} scope="col">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lms.gradeWeights ? (
                  <tr className="mh-lms-grade-table__row--muted">
                    {lms.gradeWeights.map((w, i) => (
                      <td key={`${lms.gradeColumns[i] ?? i}-w`}>{w || "—"}</td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mh-teacher-muted mh-lms-grade-empty">{lms.gradeEmpty || "No students registered"}</p>
        </>
      )}
    </section>
  );
}

function LiveGradeTable({
  board,
  emptyMessage,
}: {
  board: NonNullable<CourseLmsState["gradeBoard"]>;
  emptyMessage?: string;
}) {
  const statusLabel = (status: string) => (status === "pending_publish" ? "pending approval" : status.replace("_", " "));
  return (
    <>
      <div className="mh-lms-toolbar">
        <a className="mh-teacher-link" href={board.gradebookHref}>
          Open full gradebook
        </a>
        <a className="mh-teacher-link" href={board.submissionsHref}>
          View submissions
        </a>
      </div>
      <div className="mh-lms-grade-wrap">
        <table className="mh-lms-grade-table">
          <thead>
            <tr>
              <th scope="col">Student</th>
              {board.assignments.map((a) => (
                <th key={a.id} scope="col">
                  {a.title}
                </th>
              ))}
              <th scope="col">Weighted total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="mh-lms-grade-table__row--muted">
              <td>Weight · submitted</td>
              {board.assignments.map((a) => (
                <td key={`${a.id}-w`}>
                  {a.weightPercent}% · {a.submitted} submitted
                </td>
              ))}
              <td>—</td>
            </tr>
            {board.rows.map((row) => (
              <tr key={row.studentId}>
                <td>
                  <strong>{row.name}</strong>
                  <div className="mh-teacher-muted">{row.studentNumber}</div>
                </td>
                {row.cells.map((cell) => (
                  <td key={`${row.studentId}-${cell.assignmentId}`}>
                    {cell.mark ?? "—"}
                    <div className="mh-teacher-muted">{statusLabel(cell.status)}</div>
                  </td>
                ))}
                <td>{row.total ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!board.rows.length ? (
        <p className="mh-teacher-muted mh-lms-grade-empty">{emptyMessage || "No students registered"}</p>
      ) : !board.assignments.length ? (
        <p className="mh-teacher-muted mh-lms-grade-empty">No graded items yet. Add an assignment to start grading.</p>
      ) : null}
    </>
  );
}

export function AddGradeItemPanel({ onCancel }: { onCancel: () => void }) {
  const live = useOptionalTeacherLive();
  const [name, setName] = useState("");
  const [outOf, setOutOf] = useState("100");
  const [weight, setWeight] = useState("5");
  const [method, setMethod] = useState("Manual Grading");
  return (
    <section className="mh-teacher-card">
      <h2>Add Grading Item</h2>
      <h3>Grading Item Details</h3>
      <div className="mh-teacher-fields">
        <label>
          <span>Item name / title</span>
          <input className="mh-teacher-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>Out of / Highest Mark</span>
          <input className="mh-teacher-field" value={outOf} onChange={(e) => setOutOf(e.target.value)} />
        </label>
        <label>
          <span>Grading weight (%)</span>
          <input className="mh-teacher-field" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </label>
        <label>
          <span>Due / Release date</span>
          <input className="mh-teacher-field" type="datetime-local" />
        </label>
        <label>
          <span>Grading Method</span>
          <select className="mh-teacher-field" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Manual Grading</option>
            <option>Grade Guide</option>
            <option>Rubric</option>
          </select>
        </label>
      </div>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn"
          disabled={live?.busy || !name.trim()}
          onClick={() => void live?.runAction?.("Create Grading Item", JSON.stringify({ Name: name, OutOf: outOf, Weight: weight, Method: method }))}
        >
          Create Grading Item
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function PostMarksModal({ onClose }: { onClose: () => void }) {
  const live = useOptionalTeacherLive();
  return (
    <div className="mh-lms-chooser-overlay" role="presentation" onClick={onClose}>
      <div className="mh-lms-confirm" role="dialog" aria-modal="true" aria-labelledby="post-marks-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="post-marks-title">Post Class Marks</h2>
          <button type="button" className="mh-lms-chooser-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <p>Are you sure you want to post your class marks?</p>
        <p className="mh-teacher-muted">Students will only be able to see their own personal marks.</p>
        <div className="mh-lms-toolbar">
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={live?.busy}
            onClick={() => {
              void live?.runAction?.("Confirm Post");
              onClose();
            }}
          >
            Confirm Post
          </button>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function LogsPanel({
  lms,
  title,
}: {
  lms: CourseLmsState;
  title?: string;
}) {
  const logs = lms.reporting?.logs || [];
  const participants = useMemo(
    () => ["All participants", ...new Set(logs.map((row) => row.participant))],
    [logs],
  );
  const activities = useMemo(
    () => ["All activities", ...new Set(logs.map((row) => row.activity))],
    [logs],
  );
  const sources = useMemo(() => ["All sources", ...new Set(logs.map((row) => row.source))], [logs]);
  const actions = useMemo(() => ["All actions", ...new Set(logs.map((row) => row.action))], [logs]);
  const [filters, setFilters] = useState({ participants: "All participants", activities: "All activities", actions: "All actions", sources: "All sources" });
  const set = (key: keyof typeof filters, value: string) => setFilters((p) => ({ ...p, [key]: value }));
  const rows = logs.filter(
    (row) =>
      (filters.participants === "All participants" || row.participant === filters.participants) &&
      (filters.activities === "All activities" || row.activity === filters.activities) &&
      (filters.actions === "All actions" || row.action === filters.actions) &&
      (filters.sources === "All sources" || row.source === filters.sources),
  );
  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar">
        <h2>{title || "Logs"}</h2>
        {lms.reporting?.generatedAt ? <span className="mh-teacher-muted">Updated {formatReportDate(lms.reporting.generatedAt)}</span> : null}
      </div>
      <div className="mh-lms-logs">
        <label>
          <span>Participants</span>
          <select className="mh-teacher-field" value={filters.participants} onChange={(e) => set("participants", e.target.value)}>
            {participants.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Activities</span>
          <select className="mh-teacher-field" value={filters.activities} onChange={(e) => set("activities", e.target.value)}>
            {activities.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Actions</span>
          <select className="mh-teacher-field" value={filters.actions} onChange={(e) => set("actions", e.target.value)}>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Sources</span>
          <select className="mh-teacher-field" value={filters.sources} onChange={(e) => set("sources", e.target.value)}>
            {sources.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>
      {rows.length ? (
        <ReportTable
          headings={["Time", "Participant", "Action", "Activity", "Source", "Detail"]}
          rows={rows.map((row) => [formatReportDate(row.at), row.participant, row.action, row.activity, row.source, row.detail || "—"])}
        />
      ) : (
        <p className="mh-teacher-muted">No saved course actions, submissions, quiz attempts, choice responses, or progress updates match these filters.</p>
      )}
    </section>
  );
}

function formatReportDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function ReportTable({ headings, rows }: { headings: string[]; rows: string[][] }) {
  return (
    <div className="mh-lms-review mh-lms-report-table">
      <table>
        <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${cellIndex}-${cell}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function ActivityReportPanel({ lms }: { lms: CourseLmsState }) {
  const rows = lms.reporting?.activities || [];
  return (
    <section className="mh-teacher-card">
      <h2>Activity report</h2>
      <p className="mh-teacher-muted">Counts come from saved assignment submissions, quiz attempts, choice responses, and completion records.</p>
      {rows.length ? (
        <ReportTable
          headings={["Activity", "Type", "Completed", "Submissions", "Quiz attempts", "Choice responses", "Last activity"]}
          rows={rows.map((row) => [row.name, row.type, String(row.completions), String(row.submissions), String(row.attempts), String(row.responses), formatReportDate(row.lastActivityAt)])}
        />
      ) : <p className="mh-teacher-muted">No course activities have been added yet.</p>}
    </section>
  );
}

export function CourseParticipationPanel({ lms }: { lms: CourseLmsState }) {
  const rows = lms.reporting?.participation || [];
  return (
    <section className="mh-teacher-card">
      <h2>Course participation</h2>
      <p className="mh-teacher-muted">One row per enrolled student. The report updates after students submit or complete saved course work.</p>
      {rows.length ? (
        <ReportTable
          headings={["Student", "Student #", "Status", "Completed", "Assignments", "Quiz attempts", "Choices", "Last activity"]}
          rows={rows.map((row) => [row.name, row.studentNumber, row.status, String(row.completed), String(row.submissions), String(row.quizAttempts), String(row.choiceResponses), formatReportDate(row.lastActivityAt)])}
        />
      ) : <p className="mh-teacher-muted">No students are enrolled in this course offering.</p>}
    </section>
  );
}

export function ReportNav({
  current,
  onSelect,
}: {
  current: string;
  onSelect: (id: string) => void;
}) {
  const items = [
    { id: "competency-breakdown", label: "Competency breakdown" },
    { id: "logs", label: "Logs" },
    { id: "live-logs", label: "Live logs" },
    { id: "activity-report", label: "Activity report" },
    { id: "course-participation", label: "Course participation" },
  ];
  return (
    <aside className="mh-lms-report-nav">
      {items.map((item) => (
        <button key={item.id} type="button" className={current === item.id ? "is-active" : ""} onClick={() => onSelect(item.id)}>
          {item.label}
        </button>
      ))}
    </aside>
  );
}

export function CompetencyBreakdownPanel({ lms, onAdd }: { lms: CourseLmsState; onAdd: () => void }) {
  const rows = lms.reporting?.competencies || [];
  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar">
        <h2>Competency breakdown</h2>
        <button type="button" className="mh-teacher-btn" onClick={onAdd}>
          Add competencies
        </button>
      </div>
      {rows.length ? (
        <>
          <p className="mh-teacher-muted">Completion is calculated from the saved course activity linked by the competency resource name.</p>
          <ReportTable
            headings={["Competency", "Resource", "Linked activities", "Participants", "Completed", "Progress"]}
            rows={rows.map((row) => [row.name, row.resource, String(row.linkedActivities), String(row.participants), String(row.completed), `${row.progressPercent}%`])}
          />
        </>
      ) : <p className="mh-teacher-muted">No competencies are attached to this course. Select Add competencies to create one.</p>}
    </section>
  );
}

export function FiltersPanel() {
  return (
    <section className="mh-teacher-card">
      <h2>Filter settings</h2>
      <p className="mh-teacher-muted">Course context: Social Service Work Fundamentals</p>
      <div className="mh-teacher-fields">
        {["MathJax", "Multimedia plugins", "Display H5P", "Glossary auto-linking"].map((name) => (
          <label key={name}>
            <span>{name}</span>
            <select className="mh-teacher-field" defaultValue="Default (On)">
              <option>Default (On)</option>
              <option>Off</option>
              <option>On</option>
            </select>
          </label>
        ))}
      </div>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn">
          Save changes
        </button>
      </div>
    </section>
  );
}

export function SettingsPanel({ courseCode, title }: { courseCode: string; title: string }) {
  const live = useOptionalTeacherLive();
  return (
    <section className="mh-teacher-card mh-lms-addform">
      <h2>Edit course settings</h2>
      <details open className="mh-lms-addform__sec">
        <summary>General</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Course full name</span>
            <input className="mh-teacher-field" defaultValue={title} />
          </label>
          <label>
            <span>Course short name</span>
            <input className="mh-teacher-field" defaultValue={courseCode} />
          </label>
          <label>
            <span>Course visibility</span>
            <select className="mh-teacher-field" defaultValue="Show">
              <option>Hide</option>
              <option>Show</option>
            </select>
          </label>
          <label>
            <span>Course start date</span>
            <input className="mh-teacher-field" type="datetime-local" defaultValue="2026-04-27T09:00" />
          </label>
          <label>
            <span>Course end date</span>
            <div className="mh-lms-dt">
              <input className="mh-teacher-field" type="datetime-local" defaultValue="2026-05-01T17:00" />
              <label className="mh-lms-check">
                <input type="checkbox" defaultChecked />
                Enable
              </label>
            </div>
          </label>
          <label>
            <span>Course ID number</span>
            <input className="mh-teacher-field" defaultValue="ACSWAPR26-01" />
          </label>
        </div>
      </details>
      <details open className="mh-lms-addform__sec">
        <summary>Description</summary>
        <div className="mh-lms-addform__fields">
          <label className="mh-lms-addform__wide">
            <span>Course summary</span>
            <textarea className="mh-teacher-field" rows={5} defaultValue="Social Service Work Fundamentals" />
          </label>
          <label>
            <span>Course summary format</span>
            <select className="mh-teacher-field">
              <option>HTML format</option>
              <option>Moodle auto-format</option>
              <option>Plain text format</option>
              <option>Markdown format</option>
            </select>
          </label>
          <label className="mh-lms-addform__wide">
            <span>Course image</span>
            <div className="mh-teacher-dropzone">
              <input type="file" accept="image/*" />
              <p className="mh-teacher-muted">Maximum 8MB · Maximum 1 file · Accepted image formats</p>
            </div>
          </label>
        </div>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Course format</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Format</span>
            <select className="mh-teacher-field" defaultValue="Topics format">
              <option>Single activity format</option>
              <option>Social format</option>
              <option>Topics format</option>
              <option>Weekly format</option>
            </select>
          </label>
          <label>
            <span>Hidden sections</span>
            <select className="mh-teacher-field">
              <option>Hidden sections are shown as not available</option>
              <option>Hidden sections are completely invisible</option>
            </select>
          </label>
          <label>
            <span>Course layout</span>
            <select className="mh-teacher-field">
              <option>Show all sections on one page</option>
              <option>Show one section per page</option>
            </select>
          </label>
        </div>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Appearance</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Force language</span>
            <select className="mh-teacher-field">
              <option>Do not force</option>
              <option>English (en)</option>
            </select>
          </label>
          <label>
            <span>Number of announcements</span>
            <input className="mh-teacher-field" defaultValue="5" />
          </label>
          <label className="mh-lms-check">
            <input type="checkbox" defaultChecked />
            Show gradebook to students
          </label>
          <label className="mh-lms-check">
            <input type="checkbox" />
            Show activity reports
          </label>
          <label className="mh-lms-check">
            <input type="checkbox" defaultChecked />
            Show activity dates
          </label>
        </div>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Files and uploads</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Maximum upload size</span>
            <select className="mh-teacher-field">
              {["Site upload limit (200 MB)", "200 MB", "100 MB", "50 MB", "20 MB", "10 MB", "5 MB", "2 MB", "1 MB", "500 KB", "100 KB", "50 KB", "10 KB"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Completion tracking</summary>
        <label className="mh-lms-check">
          <input type="checkbox" defaultChecked />
          Enable completion tracking
        </label>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Groups</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Group mode</span>
            <select className="mh-teacher-field">
              <option>No groups</option>
              <option>Separate groups</option>
              <option>Visible groups</option>
            </select>
          </label>
          <label className="mh-lms-check">
            <input type="checkbox" />
            Force group mode
          </label>
          <label>
            <span>Default grouping</span>
            <select className="mh-teacher-field">
              <option>None</option>
            </select>
          </label>
        </div>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Role renaming</summary>
        <div className="mh-lms-addform__fields">
          {["Manager", "Course creator", "Teacher", "Non-editing teacher", "Student"].map((role) => (
            <label key={role}>
              <span>Your word for ‘{role}’</span>
              <input className="mh-teacher-field" />
            </label>
          ))}
        </div>
      </details>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" disabled={live?.busy} onClick={() => void live?.runAction?.("Save course settings")}>
          Save and display
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary">
          Cancel
        </button>
      </div>
    </section>
  );
}

export function EditSectionPanel({
  title,
  accessRestrictions = "",
  roster = [],
  groups = [],
  onSave,
  onCancel,
}: {
  title: string;
  accessRestrictions?: string;
  roster?: Array<{ studentId?: string; name: string; studentNumber: string; email?: string }>;
  groups?: Array<{ id: string; name: string; members: Array<{ id: string; name: string }> }>;
  onSave: (name: string, summary: string, accessRestrictions: string) => void;
  onCancel: () => void;
}) {
  const [custom, setCustom] = useState(true);
  const [name, setName] = useState(title);
  const [summary, setSummary] = useState("");
  const [restrictions, setRestrictions] = useState(accessRestrictions);
  const [restrictionsValid, setRestrictionsValid] = useState(true);
  return (
    <section className="mh-teacher-card">
      <h2>Edit section</h2>
      <div className="mh-teacher-fields">
        <label className="mh-lms-check mh-lms-addform__wide">
          <input type="checkbox" checked={custom} onChange={(e) => setCustom(e.target.checked)} />
          Custom
        </label>
        <label className="mh-lms-addform__wide">
          <span>Section name</span>
          <input className="mh-teacher-field" value={name} disabled={!custom} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mh-lms-addform__wide">
          <span>Summary</span>
          <textarea className="mh-teacher-field" rows={6} value={summary} onChange={(e) => setSummary(e.target.value)} />
        </label>
      </div>
      <details className="mh-lms-addform__sec">
        <summary>Restrict access</summary>
        <LmsAccessRestrictionsEditor value={restrictions} roster={roster} groups={groups} onChange={setRestrictions} onValidityChange={setRestrictionsValid} />
      </details>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" disabled={!name.trim() || !restrictionsValid} onClick={() => onSave(name, summary, restrictions)}>
          Save changes
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

type Activity = {
  id?: string;
  type: string;
  name: string;
  note?: string;
  body?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  modified?: string;
  joinUrl?: string | null;
  storyboard?: AiDraftStoryboard;
  description?: string;
  url?: string;
  settings?: Record<string, string>;
  assignmentId?: string;
  assignment?: LmsAssignmentSettings;
  quiz?: LmsQuizData;
};

function formatWhen(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

/** Absolute http(s) links only; anything else is shown as text, never as a clickable href. */
export function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function LmsUrlCard({ url, description }: { url?: string; description?: string }) {
  const href = safeExternalUrl(url);
  return (
    <div className="mh-lms-pagebody">
      {description ? <p style={{ whiteSpace: "pre-wrap" }}>{description}</p> : null}
      {href ? (
        <p>
          <a className="mh-teacher-btn" href={href} target="_blank" rel="noopener noreferrer">
            Open link
          </a>{" "}
          <span className="mh-teacher-muted" style={{ wordBreak: "break-all" }}>
            {href}
          </span>
        </p>
      ) : (
        <p className="mh-teacher-muted">No link has been added to this activity.</p>
      )}
    </div>
  );
}

/** Assignment rules shown identically to the instructor (preview) and the student. */
export function LmsAssignmentSummary({ assignment, description }: { assignment?: LmsAssignmentSettings; description?: string }) {
  const a = assignment || {};
  const types = [a.fileSubmissions !== false ? "File submissions" : "", a.onlineText ? "Online text" : ""].filter(Boolean);
  const rows: Array<[string, string]> = [
    ["Opens", formatWhen(a.availableFrom)],
    ["Due", formatWhen(a.dueAt)],
    ["Cut-off", formatWhen(a.cutoffAt)],
    ["Maximum grade", a.maxScore != null ? String(a.maxScore) : ""],
    ["Submission types", types.join(", ")],
    ["Maximum files", a.fileSubmissions !== false && a.maxFiles ? String(a.maxFiles) : ""],
    ["Maximum file size", a.fileSubmissions !== false && a.maxFileBytes ? formatFileSize(a.maxFileBytes) : ""],
    ["Accepted file types", a.fileSubmissions !== false && a.acceptedTypes ? a.acceptedTypes.split(",").join(", ") : ""],
  ];
  return (
    <div className="mh-lms-pagebody">
      {description ? <p style={{ whiteSpace: "pre-wrap" }}>{description}</p> : null}
      {a.instructions ? (
        <>
          <h3>Instructions</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{a.instructions}</p>
        </>
      ) : null}
      <table className="mh-lms-eval">
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function choiceOptions(settings?: Record<string, string>) {
  return Array.from({ length: 20 }, (_, index) => settings?.[`Option ${index + 1}`]?.trim() || "").filter(Boolean);
}

function LmsChoicePreview({ activity }: { activity: Pick<Activity, "body" | "description" | "settings"> }) {
  const options = choiceOptions(activity.settings);
  const multiple = /yes/i.test(activity.settings?.["Allow more than one choice to be selected"] || "");
  const horizontal = /horizontal/i.test(activity.settings?.["Display mode for options"] || "");
  return (
    <div className="mh-lms-pagebody mh-lms-choice-preview">
      <LessonBody body={activity.body} empty="Add a choice question in Edit settings." />
      {activity.description ? <p style={{ whiteSpace: "pre-wrap" }}>{activity.description}</p> : null}
      {options.length ? (
        <div className={`mh-lms-choice-options${horizontal ? " is-horizontal" : ""}`}>
          {options.map((option) => (
            <label key={option} className="mh-lms-check">
              <input type={multiple ? "checkbox" : "radio"} name="choice-preview" disabled />
              <span>{option}</span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mh-lms-qform__error">No choice options have been added. Edit this activity and complete Option 1.</p>
      )}
      <p className="mh-teacher-muted">Student preview · responses are enabled in the student portal.</p>
    </div>
  );
}

const ACTIVITY_CONTENT_SETTING_KEYS = new Set([
  "Name",
  "Description",
  "Page content",
  "Book content",
  "Choice question",
  "Activity content",
  "Additional files",
  "Book file",
  "Select files",
  "Files",
  "Package file",
  "Access restrictions",
]);

const STUDENT_HIDDEN_SETTING = /^(availability|id number|group mode|tags|manage tags|course competencies|upon activity completion|send content change notification|display description on course page)$/i;

/** Shows the values actually saved by an activity form instead of replacing them with an empty-page message. */
export function LmsActivitySettings({
  settings,
  audience,
}: {
  settings?: Record<string, string>;
  audience: "staff" | "student";
}) {
  const rows = Object.entries(settings || {}).filter(([key, value]) => {
    if (!value?.trim() || ACTIVITY_CONTENT_SETTING_KEYS.has(key)) return false;
    return audience === "staff" || !STUDENT_HIDDEN_SETTING.test(key);
  });
  if (!rows.length) return null;
  return (
    <details className="mh-lms-activity-data" open={audience === "staff"}>
      <summary>Saved activity details</summary>
      <dl className="mh-lms-activity-data__rows">
        {rows.map(([key, value]) => (
          <div key={key} className="mh-lms-activity-data__row">
            <dt>{key}</dt>
            <dd>{value === "yes" ? "Yes" : value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** FILE / FOLDER activity card shared by the admin, instructor and student course views. */
export function LmsFileCard({
  activity,
  sectionId,
  audience,
}: {
  activity: Pick<Activity, "id" | "type" | "name" | "fileName" | "fileId" | "fileSize" | "modified">;
  sectionId?: string;
  audience: "staff" | "student";
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const folder = activity.type.toUpperCase() === "FOLDER";
  const uploaded = Boolean(activity.fileId && sectionId);
  return (
    <div className="mh-student-file-card" data-screen="file">
      <div className="mh-student-file-card__icon" aria-hidden>
        {folder ? "F" : (activity.fileName?.split(".").pop() || "FILE").slice(0, 4).toUpperCase()}
      </div>
      <div>
        <strong>{activity.name}</strong>
        <p className="mh-teacher-muted">
          {uploaded
            ? `${activity.fileName || activity.name}${activity.fileSize ? ` · ${formatFileSize(activity.fileSize)}` : ""}`
            : audience === "staff"
              ? "No file uploaded yet. Add a File activity with an upload, then delete this placeholder."
              : "Your instructor has not uploaded this file yet."}
        </p>
        {activity.modified && uploaded ? <p className="mh-teacher-muted">Uploaded {activity.modified}</p> : null}
        {uploaded ? (
          <button
            type="button"
            className="mh-hcc-btn ghost"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError("");
              downloadLmsFile(sectionId!, activity.fileId!)
                .catch((e: unknown) => setError(e instanceof Error ? e.message : "Download failed"))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Downloading…" : "Download"}
          </button>
        ) : null}
        {error ? <p className="mh-lms-qform__error">{error}</p> : null}
      </div>
    </div>
  );
}

/** Page bodies are sanitized to a tag whitelist by the API before they are stored. */
export function LessonBody({ body, empty }: { body?: string; empty: string }) {
  if (!body?.trim()) return <p className="mh-teacher-muted">{empty}</p>;
  if (!/<[a-z][^>]*>/i.test(body)) return <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>;
  return <div className="mh-lms-lesson-html" dangerouslySetInnerHTML={{ __html: body }} />;
}

type QuizResults = {
  submitted: number;
  enrolled: number;
  students: Array<{ studentId: string; name: string; studentNumber: string; score: number | null; maxScore: number; submittedAt: string | null }>;
  questions: Array<{ id: string; correctRate: number | null }>;
};

function StaffQuizPanel({ quiz, activityId, path }: { quiz: LmsQuizData; activityId: string; path: string }) {
  const [results, setResults] = useState<QuizResults | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  async function loadResults() {
    const session = loadSession();
    if (!session?.accessToken || !path || !activityId) return;
    setLoading(true);
    setError("");
    try {
      setResults(
        await api<QuizResults>(
          `/instructor/lms-quiz-results?path=${encodeURIComponent(path)}&activityId=${encodeURIComponent(activityId)}`,
          undefined,
          session.accessToken,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results");
    } finally {
      setLoading(false);
    }
  }

  const rate = (id: string) => results?.questions.find((q) => q.id === id)?.correctRate;
  return (
    <div className="mh-ai-quiz-staff">
      <p className="mh-teacher-muted">
        {quiz.code} · {quiz.questions.length} questions{quiz.minutes ? ` · ${quiz.minutes} minutes` : ""} · auto-graded, first attempt counts. Students
        never receive the answer key.
      </p>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn" onClick={() => setShowKey((v) => !v)}>
          {showKey ? "Hide answer key" : "Show answer key"}
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={loading || !path} onClick={() => void loadResults()}>
          {loading ? "Loading…" : results ? "Refresh results" : "View results"}
        </button>
      </div>
      {error ? <p className="mh-teacher-muted">{error}</p> : null}
      {showKey ? (
        <ol>
          {quiz.questions.map((q) => (
            <li key={q.id}>
              <p>
                {q.text}
                {rate(q.id) != null ? <span className="mh-teacher-muted"> · {rate(q.id)}% correct</span> : null}
              </p>
              <ol type="A">
                {q.options.map((o, i) => (
                  <li key={i} className={i === q.answer ? "is-answer" : ""}>
                    {o}
                    {i === q.answer ? " ✓" : ""}
                  </li>
                ))}
              </ol>
              {q.rationale ? <p className="mh-teacher-muted">Rationale: {q.rationale}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {results ? (
        <table className="mh-teacher-table">
          <caption>
            {results.submitted} of {results.enrolled} students submitted
          </caption>
          <thead>
            <tr>
              <th>Student</th>
              <th>Number</th>
              <th>Score</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {results.students.map((s) => (
              <tr key={s.studentId}>
                <td>{s.name}</td>
                <td>{s.studentNumber}</td>
                <td>{s.score != null ? `${s.score} / ${s.maxScore}` : "—"}</td>
                <td>{s.submittedAt ? formatWhen(s.submittedAt) : "Not attempted"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

type RosterStudent = {
  studentId?: string;
  name: string;
  studentNumber: string;
  email: string;
};

export function ResourceView({
  activity,
  evaluationRows,
  roster = [],
  sectionId,
  onEdit,
  onMore,
  onPublished,
}: {
  activity: Activity;
  evaluationRows?: Array<{ component: string; weight: string }>;
  roster?: RosterStudent[];
  sectionId?: string;
  onEdit: () => void;
  onMore: (which: "filters" | "permissions") => void;
  onPublished?: () => void;
}) {
  const live = useOptionalTeacherLive();
  const type = activity.type.toUpperCase();
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [publishMsg, setPublishMsg] = useState("");
  const [publishing, setPublishing] = useState(false);
  const liveRoom = liveClassRef(activity.joinUrl) ||
    (!activity.joinUrl && sectionId ? { sectionId, provider: undefined } : null);

  function openJoin() {
    if (liveRoom) {
      openClassLink(activity.joinUrl || `/live/${liveRoom.sectionId}`);
      return;
    }
    if (!openClassLink(activity.joinUrl)) window.alert("The online class room is not linked yet for this section.");
  }

  async function publishMeeting() {
    if (!live?.runAction) {
      setPublishMsg("Live actions unavailable.");
      return;
    }
    if (audience === "selected" && selectedIds.length === 0) {
      setPublishMsg("Select at least one student, or choose All.");
      return;
    }
    setPublishing(true);
    setPublishMsg("");
    try {
      const ok = await live.runAction(
        "Publish online class",
        JSON.stringify({
          ActivityId: activity.id || "",
          Name: activity.name || "Online Class",
          Audience: audience === "all" ? "All enrolled students" : "Selected students",
          NotifyStudentIds: audience === "selected" ? selectedIds.join(",") : "",
          JoinUrl: activity.joinUrl || "",
          Provider: activity.settings?.Provider || "",
          SectionId: sectionId || "",
        }),
      );
      if (ok) {
        setPublishMsg("Published — students notified. Both of you can Join session now.");
        onPublished?.();
      } else {
        setPublishMsg("Publish failed. Try again.");
      }
    } finally {
      setPublishing(false);
    }
  }

  const selectable = roster.filter((s) => Boolean(s.studentId));

  return (
    <section className="mh-teacher-card mh-lms-resource">
      <p className="mh-lms-crumb">Course / {activity.name}</p>
      <header className="mh-lms-resource__head">
        <h2>{activity.name}</h2>
        <nav className="mh-lms-resource__tabs">
          <span className="is-active">
            {type === "BIGBLUEBUTTON"
              ? "Online Class"
              : type === "FILE" || type === "FOLDER"
                ? "Resource"
                : "Page"}
          </span>
          <button type="button" onClick={onEdit}>
            Settings
          </button>
          <details className="mh-lms-inline-more">
            <summary>More</summary>
            <button type="button" onClick={() => onMore("filters")}>
              Filters
            </button>
            <button type="button" onClick={() => onMore("permissions")}>
              Permissions
            </button>
            <button type="button">Backup</button>
            <button type="button">Restore</button>
          </details>
        </nav>
      </header>
      {type === "BIGBLUEBUTTON" ? (
        <div className="mh-lms-bbb">
          {liveRoom ? (
            <LiveClassPanel sectionId={liveRoom.sectionId} provider={liveRoom.provider} />
          ) : (
            <>
              <h3>Online Class Link</h3>
              <p>{activity.note || "This room is ready. You can join the session now."}</p>
              {activity.joinUrl ? (
                <p className="mh-teacher-muted" style={{ wordBreak: "break-all" }}>
                  {activity.joinUrl}
                </p>
              ) : null}
            </>
          )}
          <div className="mh-lms-online-publish">
            <h4>Publish meeting</h4>
            <p className="mh-teacher-muted">Notify students that class is on — they join the same room from their course page.</p>
            <div className="mh-lms-toolbar" style={{ flexWrap: "wrap", gap: 8 }}>
              <label className="mh-lms-check">
                <input
                  type="radio"
                  name="mh-online-audience"
                  checked={audience === "all"}
                  onChange={() => setAudience("all")}
                />
                All enrolled students
              </label>
              <label className="mh-lms-check">
                <input
                  type="radio"
                  name="mh-online-audience"
                  checked={audience === "selected"}
                  onChange={() => setAudience("selected")}
                />
                Selected students
              </label>
            </div>
            {audience === "selected" ? (
              <ul className="mh-lms-online-roster__list">
                {selectable.map((s) => {
                  const id = s.studentId!;
                  return (
                    <li key={id}>
                      <label className="mh-lms-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                            )
                          }
                        />
                        {s.name}
                        <span className="mh-teacher-muted"> · {s.studentNumber || s.email}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="mh-lms-toolbar">
              <button
                type="button"
                className="mh-teacher-btn"
                disabled={publishing || Boolean(live?.busy)}
                onClick={() => void publishMeeting()}
              >
                {publishing ? "Publishing…" : "Publish meeting"}
              </button>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={openJoin}>
                Join session
              </button>
            </div>
            {publishMsg ? <p className="mh-teacher-muted">{publishMsg}</p> : null}
          </div>
        </div>
      ) : type === "FILE" && activity.id === "act-evaluation-criteria" && !activity.fileId ? (
        <EvaluationTable rows={evaluationRows || []} />
      ) : type === "FILE" && activity.id === "act-course-syllabus" && !activity.fileId ? (
        <p className="mh-teacher-muted">
          Students download the syllabus file uploaded on the admin course record (Course Catalogue → this course → Syllabus) once
          its privacy is set to Enrolled Students or Public.
        </p>
      ) : type === "URL" ? (
        <LmsUrlCard url={activity.url} description={activity.description} />
      ) : type === "ASSIGNMENT" ? (
        <>
          <LmsAssignmentSummary assignment={activity.assignment} description={activity.description} />
          {activity.fileId ? (
            <div className="mh-lms-attachment-block">
              <h3>Assignment attachment</h3>
              <LmsFileCard activity={activity} sectionId={sectionId} audience="staff" />
            </div>
          ) : null}
          {activity.assignmentId && sectionId ? (
            <p>
              <a
                className="mh-teacher-btn mh-teacher-btn--secondary"
                href={`/instructor/submissions?sectionId=${encodeURIComponent(sectionId)}&assignmentId=${encodeURIComponent(activity.assignmentId)}`}
              >
                View submissions
              </a>
            </p>
          ) : (
            <p className="mh-teacher-muted">
              Students cannot submit to this item yet. Use Settings and save it once to open submissions for this section.
            </p>
          )}
        </>
      ) : type === "BOOK" ? (
        <div className="mh-lms-pagebody">
          {activity.description ? <p style={{ whiteSpace: "pre-wrap" }}>{activity.description}</p> : null}
          <LessonBody body={activity.body} empty={activity.fileId ? "" : "Add book content or upload a book file in Edit settings."} />
          {activity.fileId ? <LmsFileCard activity={activity} sectionId={sectionId} audience="staff" /> : null}
        </div>
      ) : type === "CHOICE" ? (
        <LmsChoicePreview activity={activity} />
      ) : (type === "FOLDER" || type === "FILE") && !activity.body ? (
        <LmsFileCard activity={activity} sectionId={sectionId} audience="staff" />
      ) : type === "QUIZ" && activity.quiz?.questions?.length ? (
        <div className="mh-lms-pagebody">
          <LessonBody body={activity.body} empty="" />
          <StaffQuizPanel quiz={activity.quiz} activityId={activity.id || ""} path={live?.path || ""} />
        </div>
      ) : (
        <div className="mh-lms-pagebody">
          {activity.storyboard ? <AiDraftVideoPlayer key={activity.id} storyboard={activity.storyboard} /> : null}
          {activity.description ? <p style={{ whiteSpace: "pre-wrap" }}>{activity.description}</p> : null}
          {activity.body ? <LessonBody body={activity.body} empty="" /> : null}
          {activity.fileId ? <LmsFileCard activity={activity} sectionId={sectionId} audience="staff" /> : null}
          {!activity.storyboard && !activity.description && !activity.body && !activity.fileId ? (
            <p className="mh-teacher-muted">No content has been added yet. Use Edit to add content, a description or a file.</p>
          ) : null}
          {activity.modified ? <p className="mh-teacher-muted">Last modified: {activity.modified}</p> : null}
        </div>
      )}
      {(type === "URL" || type === "BIGBLUEBUTTON") && activity.body ? (
        <div className="mh-lms-pagebody">
          <LessonBody body={activity.body} empty="" />
        </div>
      ) : null}
      <LmsActivitySettings settings={activity.settings} audience="staff" />
      <button type="button" className="mh-teacher-link" onClick={onEdit}>
        Edit
      </button>
    </section>
  );
}

export function EvaluationTable({ rows }: { rows: Array<{ component: string; weight: string }> }) {
  const data = rows.length
    ? rows
    : [
        { component: "Chapter quizzes", weight: "65%" },
        { component: "Final Exam", weight: "25%" },
        { component: "Class Participation", weight: "10%" },
        { component: "Total", weight: "100%" },
      ];
  return (
    <table className="mh-lms-eval">
      <thead>
        <tr>
          <th>Component</th>
          <th>Weight</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.component} className={row.component === "Total" ? "is-total" : ""}>
            <td>{row.component}</td>
            <td>{row.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PermissionsPanel({ onBack }: { onBack: () => void }) {
  const [role, setRole] = useState("");
  const roles = ["Manager", "Course creator", "Teacher", "Non-editing teacher", "Student", "Guest", "Authenticated user"];
  return (
    <section className="mh-teacher-card">
      <h2>Permissions in Page</h2>
      <div className="mh-lms-toolbar">
        <select className="mh-teacher-field" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Advanced role override">
          <option value="">Choose...</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input className="mh-teacher-field" placeholder="Filter" />
        <button type="button" className="mh-teacher-link">
          Clear
        </button>
      </div>
      <table className="mh-lms-perm">
        <thead>
          <tr>
            <th>Capability</th>
            <th>Risks</th>
            <th>Roles with permission</th>
            <th>Prohibited</th>
          </tr>
        </thead>
        <tbody>
          {[
            "Add embedded H5P",
            "RecordRTC audio/video",
            "View page content",
            "Insert H5P",
          ].map((cap) => (
            <tr key={cap}>
              <td>{cap}</td>
              <td>—</td>
              <td>
                <span className="mh-lms-chip">Teacher</span>
                <span className="mh-lms-chip">Manager</span>
              </td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
      {role ? (
        <div className="mh-lms-confirm mh-lms-confirm--inline">
          <h3>Allow role · Add embedded H5P</h3>
          <div className="mh-lms-toolbar">
            {roles.map((r) => (
              <label key={r} className="mh-lms-check">
                <input type="checkbox" defaultChecked={r === role} />
                {r}
              </label>
            ))}
          </div>
        </div>
      ) : null}
      <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onBack}>
        Back to page
      </button>
    </section>
  );
}

export type PageEditValues = { name: string; body: string; hidden: boolean; accessRestrictions: string };

export function PageEditPanel({
  activity,
  hidden = false,
  roster = [],
  groups = [],
  onSave,
  onCancel,
}: {
  activity: Activity;
  hidden?: boolean;
  roster?: Array<{ studentId?: string; name: string; studentNumber: string; email?: string }>;
  groups?: Array<{ id: string; name: string; members: Array<{ id: string; name: string }> }>;
  onSave: (values: PageEditValues) => void;
  onCancel: () => void;
}) {
  const live = useOptionalTeacherLive();
  const editorRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(activity.name);
  const [visibility, setVisibility] = useState(hidden ? "hide" : "show");
  const [restrictions, setRestrictions] = useState(activity.settings?.["Access restrictions"] || "");
  const [restrictionsValid, setRestrictionsValid] = useState(true);
  const initialHtml = useMemo(() => {
    const body = activity.body || "";
    if (!body.trim() || /<[a-z][^>]*>/i.test(body)) return body;
    return body
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");
  }, [activity.body]);

  return (
    <section className="mh-teacher-card mh-lms-addform">
      <h2>Updating Page: {activity.name}</h2>
      <details open className="mh-lms-addform__sec">
        <summary>General</summary>
        <div className="mh-lms-addform__fields">
          <label>
            <span>Name</span>
            <input className="mh-teacher-field" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        </div>
      </details>
      <details open className="mh-lms-addform__sec">
        <summary>Content</summary>
        {activity.storyboard ? (
          <p className="mh-teacher-muted">
            This page has an AI video lesson ({activity.storyboard.slides.length} slides). The video stays attached when you edit the text.
          </p>
        ) : null}
        <div className="mh-lms-addform__wide">
          <span>Page content</span>
          <div
            ref={editorRef}
            className="mh-teacher-field mh-teacher-field--tall mh-lms-lesson-html"
            contentEditable
            suppressContentEditableWarning
            style={{ minHeight: 220, overflow: "auto" }}
            dangerouslySetInnerHTML={{ __html: initialHtml }}
          />
        </div>
      </details>
      <details open className="mh-lms-addform__sec">
        <summary>Common module settings</summary>
        <label>
          <span>Availability</span>
          <select className="mh-teacher-field" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="show">Show on course page</option>
            <option value="hide">Hide from students</option>
          </select>
        </label>
      </details>
      <details className="mh-lms-addform__sec">
        <summary>Restrict access</summary>
        <LmsAccessRestrictionsEditor value={restrictions} roster={roster} groups={groups} onChange={setRestrictions} onValidityChange={setRestrictionsValid} />
      </details>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn"
          disabled={live?.busy || !name.trim() || !restrictionsValid}
          onClick={() =>
            onSave({
              name: name.trim(),
              body: editorRef.current?.innerHTML ?? activity.body ?? "",
              hidden: visibility === "hide",
              accessRestrictions: restrictions,
            })
          }
        >
          Save and return to course
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function CreateGroupForm({ onCancel }: { onCancel: () => void }) {
  const live = useOptionalTeacherLive();
  const [name, setName] = useState("");
  return (
    <section className="mh-teacher-card mh-lms-addform">
      <h2>Create group</h2>
      <div className="mh-lms-addform__fields">
        <label>
          <span>
            Group name <em className="mh-lms-required">!</em>
          </span>
          <input className="mh-teacher-field" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span>Group ID number</span>
          <input className="mh-teacher-field" />
        </label>
        <label className="mh-lms-addform__wide">
          <span>Group description</span>
          <textarea className="mh-teacher-field" rows={4} />
        </label>
        <label>
          <span>Enrolment key</span>
          <input className="mh-teacher-field" placeholder="Click to enter text" />
        </label>
        <label>
          <span>Group messaging</span>
          <select className="mh-teacher-field" defaultValue="No">
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>
        <label className="mh-lms-addform__wide">
          <span>New picture</span>
          <div className="mh-teacher-dropzone">
            <input type="file" accept="image/*" />
            <p className="mh-teacher-muted">Choose a file · Maximum 8MB</p>
          </div>
        </label>
      </div>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn"
          disabled={!name.trim() || live?.busy}
          onClick={() => {
            void live?.runAction?.("Create group", JSON.stringify({ Name: name }));
            onCancel();
          }}
        >
          Save changes
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

export function ActionMenu({
  items,
  label = "Actions",
}: {
  items: Array<{ label: string; onClick: () => void; danger?: boolean }>;
  label?: string;
}) {
  return (
    <details className="mh-lms-actmenu">
      <summary aria-label={label}>⋮</summary>
      <div className="mh-lms-actmenu__list" role="menu">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={item.danger ? "is-danger" : ""}
            onClick={(e) => {
              const root = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
              if (root) root.open = false;
              item.onClick();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export function QuestionPreview({
  question,
  onClose,
}: {
  question: {
    name: string;
    text: string;
    answers?: string[];
    correct?: number;
    mark?: string;
  };
  onClose: () => void;
}) {
  const answers = question.answers?.length
    ? question.answers
    : ["settlement houses", "friendly visiting", "charity organization societies", "casework"];
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  return (
    <section className="mh-teacher-card mh-lms-preview">
      <div className="mh-lms-toolbar">
        <h2>Preview question</h2>
        <button type="button" className="mh-teacher-link" onClick={onClose}>
          Close preview
        </button>
      </div>
      <p>
        <strong>{question.name}</strong>
      </p>
      <p>{question.text}</p>
      <div className="mh-lms-preview__answers" role="radiogroup">
        {answers.map((answer, idx) => (
          <label key={answer} className={done && idx === (question.correct ?? 0) ? "is-right" : ""}>
            <input type="radio" name="preview-answer" checked={picked === idx} onChange={() => setPicked(idx)} />
            {String.fromCharCode(97 + idx)}. {answer}
          </label>
        ))}
      </div>
      <div className="mh-lms-toolbar">
        <button
          type="button"
          className="mh-teacher-btn mh-teacher-btn--secondary"
          onClick={() => {
            setPicked(null);
            setDone(false);
          }}
        >
          Start again
        </button>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary">
          Save
        </button>
        <button
          type="button"
          className="mh-teacher-btn mh-teacher-btn--secondary"
          onClick={() => {
            setPicked(question.correct ?? 0);
            setDone(true);
          }}
        >
          Fill in correct responses
        </button>
        <button type="button" className="mh-teacher-btn" onClick={() => setDone(true)}>
          Submit and finish
        </button>
      </div>
      <details>
        <summary>Comments</summary>
        <p className="mh-teacher-muted">No comments yet.</p>
      </details>
      <div className="mh-lms-preview__opts">
        <h3>Preview options</h3>
        <p>Question version · How questions behave: Deferred feedback · Marked out of {question.mark || "1"}</p>
        <button type="button" className="mh-teacher-link">
          Start again with these options
        </button>
        <h3>Display options</h3>
        <ul>
          <li>Whether correct: Shown</li>
          <li>Marks: Show mark and max</li>
          <li>Decimal places in grades: 2</li>
          <li>Specific feedback: Shown</li>
          <li>General feedback: Shown</li>
          <li>Right answer: Shown</li>
          <li>Response history: Not shown</li>
        </ul>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary">
          Update display options
        </button>
      </div>
    </section>
  );
}

export function QuestionHistory({
  question,
  onClose,
}: {
  question: { name: string; status: string; version: string; createdByFirst: string; createdByLast: string; date: string };
  onClose: () => void;
}) {
  return (
    <section className="mh-teacher-card">
      <div className="mh-lms-toolbar">
        <h2>Question history</h2>
        <button type="button" className="mh-teacher-link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="mh-teacher-muted">No tag filters applied</p>
      <input className="mh-teacher-field" placeholder="Filter by tags" />
      <label className="mh-lms-check">
        <input type="checkbox" defaultChecked />
        Show question text in question list
      </label>
      <label className="mh-lms-check">
        <input type="checkbox" />
        Also show old questions
      </label>
      <table className="mh-lms-eval">
        <thead>
          <tr>
            <th>Question</th>
            <th>Status</th>
            <th>Version</th>
            <th>Created by</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{question.name}</td>
            <td>{question.status}</td>
            <td>{question.version}</td>
            <td>
              {question.createdByFirst} {question.createdByLast}
            </td>
            <td>{question.date}</td>
          </tr>
        </tbody>
      </table>
      <p className="mh-teacher-muted">With selected</p>
    </section>
  );
}

export function QuestionTagsModal({
  question,
  courseTitle,
  onClose,
}: {
  question: { name: string };
  courseTitle: string;
  onClose: () => void;
}) {
  return (
    <div className="mh-lms-chooser-overlay" role="presentation" onClick={onClose}>
      <div className="mh-lms-confirm" role="dialog" aria-modal="true" aria-labelledby="q-tags-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="q-tags-title">Question tags</h2>
          <button type="button" className="mh-lms-chooser-modal__close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <p>
          Question name: <strong>{question.name}</strong>
        </p>
        <p className="mh-teacher-muted">Current category: Quiz 5 · Course: {courseTitle}</p>
        <label>
          <span>Tags</span>
          <input className="mh-teacher-field" placeholder="Search selector / Any tags" />
        </label>
        <p className="mh-teacher-muted">No suggestions</p>
        <div className="mh-lms-toolbar">
          <button type="button" className="mh-teacher-btn" onClick={onClose}>
            Save changes
          </button>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function GroupsExtras({ onAuto, onImport }: { onAuto: () => void; onImport: () => void }) {
  return (
    <div className="mh-lms-toolbar">
      <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onAuto}>
        Auto-create groups
      </button>
      <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onImport}>
        Import groups
      </button>
    </div>
  );
}

export function ActivityCompetenciesPanel({ name, onBack }: { name: string; onBack: () => void }) {
  const live = useOptionalTeacherLive();
  return (
    <section className="mh-teacher-card">
      <h2>{name}</h2>
      <button type="button" className="mh-teacher-link">
        Edit Course Description
      </button>
      <label>
        <span>Competency rating</span>
        <select className="mh-teacher-field">
          <option>Not rated</option>
        </select>
      </label>
      <p className="mh-teacher-muted">No competencies have been linked to this activity or resource</p>
      <button type="button" className="mh-teacher-link" onClick={() => void live?.runAction?.("Manage competencies and frameworks")}>
        Manage competencies and frameworks
      </button>
      <div className="mh-lms-toolbar">
        <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onBack}>
          Back
        </button>
      </div>
    </section>
  );
}

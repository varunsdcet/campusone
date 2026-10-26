"use client";

import { Fragment, useEffect, useRef, useState, Suspense, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { CourseLmsView } from "@/components/CourseLmsView";
import {
  getTeacherScreen,
  type TeacherBadgeTone,
  type TeacherScreenConfig,
} from "@/lib/teacherCatalog";
import { api, loadSession } from "@/lib/api";
import { allows, useMyAccess, type ModuleGate } from "@/lib/access";
import {
  TeacherLiveProvider,
  mergeTeacherLive,
  useTeacherLive,
  useTeacherLivePayload,
  useOptionalTeacherLive,
} from "@/lib/useTeacherSisLive";
import { teacherLivePath } from "@/lib/teacherLivePath";
import {
  AccomplishmentsView,
  AvailabilityView,
  CompensationView,
  ProfileBioView,
  ProfileTopicsView,
  ScheduleView,
  SecurityView,
  SettingsView,
} from "@/components/FacultyProfileViews";
import {
  BulkActionsModal,
  COURSE_BULK_ACTIONS,
  ReviewTermView,
  ScheduleManageView,
} from "@/components/ProgramSchedulingViews";
import {
  HccAttendanceView,
  HccCourseHistoryView,
  HccEmptyView,
  HccEvaluationsView,
  HccFlagsView,
  HccGradesSubmissionView,
  HccMyCoursesView,
  HccPendingGradesView,
  HccPendingSchedulesView,
  HccRepositoryView,
  HccStudentsView,
  HccTranscriptPendingView,
} from "@/components/HccCampusViews";
import { HccBadgesView, ProgramSettingsView } from "@/components/ProgramSettingsViews";

function badgeClass(tone?: TeacherBadgeTone) {
  const t = tone || "active";
  const mapped =
    t === "review" || t === "warning"
      ? "is-warning"
      : t === "danger"
        ? "is-danger"
        : t === "info"
          ? "is-info"
          : t === "muted" || t === "draft"
            ? "is-muted"
            : t === "success"
              ? "is-success"
              : "is-active";
  return `mh-teacher-badge ${mapped}`;
}

/** Shared CTA — navigates when href is set, otherwise POSTs /instructor/sis/action. */
function ActionBtn({
  label,
  href,
  tone = "primary",
  rowKey,
  className,
}: {
  label: string;
  href?: string;
  tone?: "primary" | "secondary";
  rowKey?: string;
  className?: string;
}) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  return (
    <button
      type="button"
      className={className || `mh-teacher-btn mh-teacher-btn--${tone}`}
      disabled={live?.busy}
      onClick={() => {
        if (href) {
          router.push(href);
          return;
        }
        if (live?.runAction) {
          void live.runAction(label, rowKey);
          return;
        }
      }}
    >
      {label}
    </button>
  );
}

function TeacherLiveStatusBar() {
  const live = useOptionalTeacherLive();
  if (!live) return null;
  if (!live.loading && !live.error && !live.toast) return null;
  return (
    <div
      className="mh-teacher-muted"
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        marginBottom: 12,
        fontSize: 13,
      }}
      aria-live="polite"
    >
      {live.loading ? <span>Loading…</span> : null}
      {live.error ? <span style={{ color: "#b91c1c" }}>{live.error}</span> : null}
      {live.toast ? <span style={{ color: "#0f766e" }}>{live.toast}</span> : null}
    </div>
  );
}

function isCreateLikeAction(label: string) {
  const t = label.trim().replace(/^\+\s*/, "");
  return /^(add|create|quick-create|new|submit new|schedule event|upload|enroll)/i.test(t);
}

function isUploadAction(label: string) {
  return /^upload\b/i.test(label.trim().replace(/^\+\s*/, ""));
}

function fileMetaFromBrowserFile(file: File, folder = "Uploads") {
  const size =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(file.size / 1024))} KB`;
  return {
    name: file.name,
    type: fileKindLabel(file.name, file.type),
    size,
    updated: "Just now",
    visibility: "Hidden" as const,
    folder,
  };
}

function createFieldsForConfig(config: TeacherScreenConfig): string[] {
  const cols = (config.columns || []).filter(
    (c) => !/^(status|actions?|edit|view|opt-?out rate)$/i.test(c.trim()),
  );
  if (/leave|loa/i.test(config.path) || /loa/i.test(config.primaryAction || "")) {
    return ["Student", "Program", "LOA Type", "Start Date", "Expected Return"];
  }
  if (/textbook|t57/i.test(config.path) || /book/i.test(config.primaryAction || "")) {
    return ["Book Title & Publisher", "ISBN / ISBN-13", "Adoption", "Required/Optional"];
  }
  if (cols.length) return cols.slice(0, 6);
  if (
    config.archetype === "studentDetail" ||
    config.archetype === "alertList" ||
    /alert|flag/i.test(config.path) ||
    /alert|flag/i.test(config.primaryAction || "")
  ) {
    return ["Student Name", "Alert Type", "Description", "Priority"];
  }
  return ["Name", "Code", "Description"];
}

function fieldInputType(field: string): "text" | "date" | "textarea" {
  if (/description|reason|note/i.test(field)) return "textarea";
  if (/\bdate\b|return|starts?|ends?|due/i.test(field)) return "date";
  return "text";
}

const LOA_TYPES = ["Medical", "Family Leave", "Academic Prep", "Personal", "Other"];

function PageActions({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [backdropArmed, setBackdropArmed] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fields = createFieldsForConfig(config);
  const alertTypes = config.studentDetail?.alertTypes ?? [];
  const priorities = config.studentDetail?.priorities ?? [];
  const isLoa = /leave|loa/i.test(config.path) || /loa/i.test(config.primaryAction || "");
  const isBook = /textbook|t57/i.test(config.path) || /book/i.test(config.primaryAction || "");
  const queryStudent = searchParams.get("student") || "";
  const queryProgram = searchParams.get("program") || "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!createOpen) {
      setBackdropArmed(false);
      return;
    }
    // Avoid the opening click dismissing the portal backdrop immediately.
    const timer = window.setTimeout(() => setBackdropArmed(true), 120);
    return () => window.clearTimeout(timer);
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen) return;
    const init: Record<string, string> = {};
    for (const field of fields) {
      if ((field === "Student Name" || field === "Student") && (config.studentDetail?.name || queryStudent)) {
        init[field] = config.studentDetail?.name
          ? config.studentDetail.meta
            ? `${config.studentDetail.name} · ${config.studentDetail.meta.split("·")[0]?.trim() || ""}`.trim()
            : config.studentDetail.name
          : queryStudent;
      } else if (field === "Program" && (config.studentDetail?.meta || queryProgram)) {
        const parts = (config.studentDetail?.meta || "").split("·").map((p) => p.trim());
        init[field] = queryProgram || parts[1] || parts[0] || "";
      } else if (/status/i.test(field)) init[field] = "Active";
      else if (/required\/optional/i.test(field)) init[field] = "Required";
      else if (/priority/i.test(field)) init[field] = priorities[0] || "";
      else if (/alert type|flag type/i.test(field)) init[field] = alertTypes[0] || "";
      else if (/loa type/i.test(field)) init[field] = LOA_TYPES[0];
      else if (fieldInputType(field) === "date") init[field] = "";
      else init[field] = "";
    }
    setValues(init);
  }, [
    createOpen,
    config.path,
    config.studentDetail?.name,
    config.studentDetail?.meta,
    fields.join("|"),
    alertTypes.join("|"),
    priorities.join("|"),
    queryStudent,
    queryProgram,
  ]);

  // Auto-open LOA create form when arriving from student detail Leave tab
  useEffect(() => {
    if (isLoa && (queryStudent || searchParams.get("create") === "1")) {
      setCreateOpen(true);
    }
  }, [isLoa, queryStudent, searchParams]);

  if (!config.primaryAction && !config.secondaryAction) return null;

  // Form screens own their submit button — only keep Cancel / secondary in the header.
  const hidePrimary = config.archetype === "form";

  const uploadPrimary = Boolean(config.primaryAction) && isUploadAction(config.primaryAction || "");
  const shareLecturePrimary =
    Boolean(config.primaryAction) &&
    !hidePrimary &&
    !config.primaryActionHref &&
    /share with class/i.test(config.primaryAction || "") &&
    Boolean(config.lectureReview);
  const passwordPrimary =
    Boolean(config.primaryAction) &&
    !hidePrimary &&
    !config.primaryActionHref &&
    (config.archetype === "security" || /update password|change password/i.test(config.primaryAction || ""));
  const primaryNeedsForm =
    Boolean(config.primaryAction) &&
    !hidePrimary &&
    !config.primaryActionHref &&
    isCreateLikeAction(config.primaryAction || "") &&
    !uploadPrimary &&
    !shareLecturePrimary &&
    !passwordPrimary;

  async function onPickUploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length || !config.primaryAction) return;
    for (const file of picked) {
      await live?.runAction?.(config.primaryAction, JSON.stringify(fileMetaFromBrowserFile(file)));
    }
  }

  const modal =
    createOpen && mounted
      ? createPortal(
          <div
            className="mh-teacher-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={config.primaryAction || "Create"}
            onClick={() => {
              if (backdropArmed) setCreateOpen(false);
            }}
          >
            <div className="mh-teacher-card mh-teacher-modal" onClick={(e) => e.stopPropagation()}>
              <h2>{config.primaryAction}</h2>
              <p>
                {isLoa
                  ? "Choose leave dates with the calendar, then save the LOA request."
                  : isBook
                    ? "Add a course textbook adoption. Save stores it on this screen."
                    : "Fill in the fields below, then save to create the record."}
              </p>
              <div className="mh-teacher-fields">
                {fields.map((field) => {
                  const selectOptions = /alert type|flag type/i.test(field)
                    ? alertTypes
                    : /priority/i.test(field)
                      ? priorities
                      : /loa type/i.test(field)
                        ? LOA_TYPES
                        : /required\/optional/i.test(field)
                          ? ["Required", "Optional"]
                          : null;
                  const useSelect = Boolean(selectOptions && selectOptions.length);
                  const inputType = fieldInputType(field);
                  return (
                    <label key={field}>
                      <span>{field}</span>
                      {inputType === "textarea" ? (
                        <textarea
                          className="mh-teacher-field mh-teacher-field--tall"
                          value={values[field] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                          rows={3}
                        />
                      ) : useSelect ? (
                        <select
                          className="mh-teacher-field"
                          value={values[field] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        >
                          {selectOptions!.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="mh-teacher-field"
                          type={inputType}
                          value={values[field] ?? ""}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field]: e.target.value }))}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <div className="mh-teacher-actions">
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                  disabled={
                    live?.busy ||
                    (isLoa
                      ? !(values["Start Date"] || "").trim() || !(values["Expected Return"] || "").trim()
                      : !(
                          values["Book Title & Publisher"] ||
                          values.Name ||
                          Object.values(values).find((v) => v.trim()) ||
                          ""
                        ).trim())
                  }
                  onClick={() => {
                    void (async () => {
                      if (live?.runAction && config.primaryAction) {
                        await live.runAction(config.primaryAction, JSON.stringify(values));
                      }
                      setCreateOpen(false);
                    })();
                  }}
                >
                  {live?.busy ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="mh-teacher-actions">
        {config.secondaryAction ? (
          <ActionBtn label={config.secondaryAction} href={config.secondaryActionHref} tone="secondary" />
        ) : null}
        {config.primaryAction && !hidePrimary ? (
          uploadPrimary ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                onChange={(event) => void onPickUploadFiles(event)}
              />
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--primary"
                disabled={live?.busy}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                {live?.busy ? "Uploading…" : config.primaryAction}
              </button>
            </>
          ) : shareLecturePrimary && config.lectureReview ? (
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--primary"
              disabled={live?.busy}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void live?.runAction?.(config.primaryAction!, lectureSharePayload(config.lectureReview!));
              }}
            >
              {live?.busy ? "Sharing…" : config.primaryAction}
            </button>
          ) : passwordPrimary ? (
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById("mh-teacher-password-form")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
                document.getElementById("mh-teacher-current-password")?.focus();
              }}
            >
              {config.primaryAction}
            </button>
          ) : primaryNeedsForm ? (
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCreateOpen(true);
              }}
            >
              {config.primaryAction}
            </button>
          ) : (
            <ActionBtn label={config.primaryAction} href={config.primaryActionHref} />
          )
        ) : null}
      </div>
      {modal}
    </>
  );
}


function PageHead({
  config,
  badge,
  hideActions = false,
}: {
  config: TeacherScreenConfig;
  badge?: string;
  hideActions?: boolean;
}) {
  return (
    <div className="mh-teacher-page-head">
      <div>
        <div className="mh-teacher-page-head__row">
          <h2>{config.title}</h2>
          {badge ? <span className={badgeClass("active")}>{badge}</span> : null}
        </div>
        {config.subtitle ? <p>{config.subtitle}</p> : null}
      </div>
      {hideActions ? null : <PageActions config={config} />}
    </div>
  );
}

/* ——— Existing archetype views ——— */

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
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
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
    case "check":
      return (
        <svg {...common}>
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
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
    case "megaphone":
      return (
        <svg {...common}>
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11.5 15.5V19a2 2 0 0 1-2 2h-1" />
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
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function DashboardView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const d = config.dashboard;
  const sections = d?.timetable || [];
  const gradeSubs = d?.gradeSubmissions || [];
  const announcements = d?.announcements || [];
  const alerts = d?.alerts || [];
  const [tab, setTab] = useState("sections");

  const studentCount = live?.bootstrap?.studentCount ?? 0;
  const sectionCount = live?.bootstrap?.sectionCount ?? sections.length;
  const courseCount = live?.bootstrap?.courseCount ?? (new Set(sections.map((s) => s.code)).size || sections.length);
  const draftGradeCount = live?.bootstrap?.draftGradeCount ?? gradeSubs.length;
  const instructorName = d?.name || live?.bootstrap?.displayName || "Instructor";
  const instructorMeta = d?.meta || live?.bootstrap?.email || "";
  const designation = d?.statusBadge || (sectionCount ? "Instructor" : "Instructor");

  const tabs = [
    { id: "sections", label: "My Sections" },
    { id: "grades", label: "Pending Grade Submissions" },
    { id: "notifications", label: "Notifications" },
    { id: "alerts", label: "Alerts" },
    { id: "schedule", label: "Schedule" },
    { id: "office", label: "Office Hours" },
  ] as const;

  const access = useMyAccess();
  const courses: ModuleGate = { modules: ["courseManagement"] };
  const students: ModuleGate = { modules: ["studentRecords"] };

  const quickAccess = (
    [
      { label: "Settings", href: "/instructor/f/t15-settings", tone: "navy", icon: "settings" },
      { label: "My Courses", href: "/instructor/sections", tone: "rose", icon: "plus", gate: courses },
      { label: "Availability", href: "/instructor/f/t04-profile-availability", tone: "cyan", icon: "clock" },
      { label: "Messages", href: "/instructor/messages", tone: "red", icon: "mail" },
      { label: "Workshop", href: "/instructor/f/t11-workshops?list=mine", tone: "sky", icon: "board", gate: courses },
      { label: "Interviews", href: "/instructor/interviews", tone: "cyan", icon: "clock" },
      { label: "Student", href: "/instructor/f/t12-students-view", tone: "blue", icon: "megaphone", gate: students },
      { label: "AI Draft", href: "/instructor/ai-draft", tone: "violet", icon: "books", gate: courses },
      { label: "Ask AI", href: "/instructor/ask", tone: "indigo", icon: "sparkles" },
      { label: "Submit Grade", href: "/instructor/gradebook", tone: "sky", icon: "clipboard", gate: courses },
    ] as const
  ).filter((q) => allows(access, "gate" in q ? q.gate : undefined));

  const stats = [
    { label: "Students", value: studentCount, icon: "users", href: "/instructor/f/t12-students-view", gate: students },
    { label: "Courses", value: courseCount, icon: "book", href: "/instructor/sections", gate: courses },
    { label: "Active Sections", value: sectionCount, icon: "signal", href: "/instructor/sections", gate: courses },
    { label: "Draft Grades", value: draftGradeCount, icon: "user", href: "/instructor/gradebook", gate: courses },
  ].filter((s) => allows(access, s.gate));

  return (
    <div className="mh-ct-dash" data-figma-id={config.figmaId}>
      <div className="mh-ct-dash__main">
        <div className="mh-ct-dash__stats">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              className="mh-ct-dash__stat"
              onClick={() => router.push(s.href)}
            >
              <span className={`mh-ct-dash__stat-icon mh-ct-dash__stat-icon--${s.icon}`} aria-hidden />
              <div>
                <strong>{s.value}</strong>
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
                {designation} · {instructorName}
              </strong>
              {instructorMeta ? <span>{instructorMeta}</span> : null}
            </div>
            <button type="button" className="mh-ct-dash__control-chip" onClick={() => router.push("/instructor/ai-draft")}>
              AI Draft
            </button>
            <button type="button" className="mh-ct-dash__control-chip" onClick={() => router.push("/instructor/ask")}>
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
          <button
            type="button"
            className="mh-ct-dash__refresh"
            aria-label="Refresh"
            onClick={() => void live?.refresh()}
          >
            ↻
          </button>
        </div>

        <section className="mh-ct-dash__panel">
          <header className="mh-ct-dash__panel-head">
            <h2>{tabs.find((t) => t.id === tab)?.label}</h2>
          </header>

          {tab === "sections" ? (
            <div className="mh-ct-dash__list">
              {sections.length === 0 ? (
                <p className="mh-teacher-muted">No sections assigned yet.</p>
              ) : (
                sections.map((row) => (
                  <button
                    key={row.time + row.code + row.room}
                    type="button"
                    className="mh-ct-dash__row"
                    onClick={() => router.push(row.href || "/instructor/sections")}
                  >
                    <span className="mh-ct-dash__row-time">{row.code}</span>
                    <span className="mh-ct-dash__row-body">
                      <strong>{row.title}</strong>
                      <em>
                        Section {row.room}
                        {row.time ? ` · Term ${row.time}` : ""}
                      </em>
                    </span>
                    <span className={badgeClass(row.statusTone)}>{row.status}</span>
                    <span className="mh-ct-dash__row-go">{row.action || "Open"}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          {tab === "grades" ? (
            <div className="mh-ct-dash__list">
              {gradeSubs.length === 0 ? (
                <p className="mh-teacher-muted">No pending grade submissions.</p>
              ) : (
                gradeSubs.map((row) => (
                  <button
                    key={row.sectionCode}
                    type="button"
                    className="mh-ct-dash__row"
                    onClick={() => router.push(row.href || "/instructor/gradebook")}
                  >
                    <span className="mh-ct-dash__row-time">{row.code}</span>
                    <span className="mh-ct-dash__row-body">
                      <strong>{row.title}</strong>
                      <em>
                        {row.sectionCode} · {row.missing} missing
                      </em>
                    </span>
                    <span className={badgeClass(row.statusTone)}>{row.status}</span>
                    <span className="mh-ct-dash__row-go">Submit</span>
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
                    key={a.title + a.when}
                    type="button"
                    className="mh-ct-dash__row mh-ct-dash__row--stack"
                    onClick={() => router.push("/instructor/notifications")}
                  >
                    <span className="mh-ct-dash__row-body">
                      <strong>{a.title}</strong>
                      <em>{a.when}</em>
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
                alerts.map((a, i) => (
                  <button
                    key={`${a.title}-${i}`}
                    type="button"
                    className={`mh-ct-dash__row mh-ct-dash__row--stack mh-ct-dash__alert--${a.tone}`}
                    onClick={() =>
                      router.push(
                        /grade|draft|submit/i.test(`${a.title} ${a.body}`)
                          ? "/instructor/gradebook"
                          : "/instructor/notifications",
                      )
                    }
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
              {sections.length === 0 ? (
                <p className="mh-teacher-muted">No schedule items yet.</p>
              ) : (
                sections.map((row) => (
                  <button
                    key={`sched-${row.code}-${row.room}`}
                    type="button"
                    className="mh-ct-dash__row"
                    onClick={() => router.push(row.href || "/instructor/f/t06-profile-schedule")}
                  >
                    <span className="mh-ct-dash__row-time">{row.time}</span>
                    <span className="mh-ct-dash__row-body">
                      <strong>
                        {row.code} · {row.title}
                      </strong>
                      <em>{row.room}</em>
                    </span>
                    <span className="mh-ct-dash__row-go">Open</span>
                  </button>
                ))
              )}
            </div>
          ) : null}

          {tab === "office" ? (
            <div className="mh-ct-dash__list">
              {(d?.officeHours || []).length === 0 ? (
                <p className="mh-teacher-muted">No office hours listed.</p>
              ) : (
                (d?.officeHours || []).map((h) => (
                  <div key={h.day + h.window} className="mh-ct-dash__row mh-ct-dash__row--static">
                    <span className="mh-ct-dash__row-time">{h.day}</span>
                    <span className="mh-ct-dash__row-body">
                      <strong>{h.window}</strong>
                      <em>
                        {h.mode}
                        {h.remaining ? ` · ${h.remaining}` : ""}
                      </em>
                    </span>
                  </div>
                ))
              )}
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
          <button type="button" className="mh-hcc-link" onClick={() => router.push("/instructor/f/t60-course-resources-management")}>Manage shared files</button>
        </details>
        <details className="mh-ct-dash__acc" open={Boolean(gradeSubs.length || alerts.length)}>
          <summary>To-do</summary>
          {alerts.length || gradeSubs.length ? (
            <ul className="mh-ct-dash__todo">
              {gradeSubs.slice(0, 3).map((g) => (
                <li key={g.sectionCode}>
                  <button type="button" onClick={() => router.push(g.href || "/instructor/gradebook")}>
                    Submit Grade · {g.code}
                  </button>
                </li>
              ))}
              {alerts.slice(0, 3).map((a, i) => (
                <li key={`${a.title}-${i}`}>{a.title}</li>
              ))}
            </ul>
          ) : (
            <p className="mh-teacher-muted">Nothing pending.</p>
          )}
        </details>
      </aside>
    </div>
  );
}

function activeCourseViewHref(row: { id?: string; viewHref: string }) {
  if (row.id) return `/instructor/f/t56-active-courses?view=${encodeURIComponent(row.id)}`;
  if (row.viewHref.includes("t56-active-courses")) return row.viewHref;
  const sectionMatch = row.viewHref.match(/\/instructor\/sections\/([^/?#]+)/);
  if (sectionMatch?.[1]) return `/instructor/f/t56-active-courses?view=${encodeURIComponent(sectionMatch[1])}`;
  return `/instructor/f/t56-active-courses?view=${encodeURIComponent(row.viewHref)}`;
}

function ActiveCoursesView({ config }: { config: TeacherScreenConfig }) {
  const data = config.activeCourses;
  const router = useRouter();
  const searchParams = useSearchParams();
  const live = useOptionalTeacherLive();
  const viewId = searchParams.get("view");
  const [campus, setCampus] = useState(data?.filters.campus.value ?? "ALL CAMPUSES");
  const [course, setCourse] = useState(data?.filters.course.value ?? "All Courses");
  const [term, setTerm] = useState(data?.filters.term.value ?? "ALL TERMS");
  const [student, setStudent] = useState(data?.filters.student.value ?? "");
  const [faculty, setFaculty] = useState(data?.filters.faculty.value ?? "ALL FACULTY / INSTRUCTORS");
  const [perPage, setPerPage] = useState(data?.perPage ?? "250");
  const [page, setPage] = useState(data?.page ?? "1");
  const [applied, setApplied] = useState(true);

  useEffect(() => {
    if (!data) return;
    setCampus(data.filters.campus.value);
    setCourse(data.filters.course.value);
    setTerm(data.filters.term.value);
    setStudent(data.filters.student.value);
    setFaculty(data.filters.faculty.value);
    setPerPage(data.perPage);
    setPage(data.page);
  }, [data]);

  if (viewId) {
    const selected = data?.rows.find((row) => row.id === viewId) || data?.rows.find((row) => row.viewHref.includes(viewId));
    const fallbackDetail: TeacherScreenConfig["courseDetail"] = selected
      ? {
          code: selected.code || selected.course,
          title: selected.title || selected.course,
          meta: [selected.location, selected.room || "Room Not Set", selected.dates, `Enrolment ${selected.enrolment}`]
            .filter(Boolean)
            .join(" · "),
          status: /ACSW\s*200/i.test(selected.code || "") ? "Ended" : "Active",
          tabs: ["Course", "Class List", "Attendance", "Grades", "Badges", "More"],
          activeTab: "Course",
          overview: [
            { label: "Course", value: selected.title || selected.course },
            { label: "Section", value: selected.section || "—" },
            { label: "Location", value: selected.location },
            { label: "Room", value: selected.room || "Room Not Set" },
            { label: "Instructor(s)", value: selected.instructors || "Not Set" },
            { label: "Dates", value: selected.dates },
            { label: "Enrolment", value: selected.enrolment },
          ],
          modules: [],
          team: [],
          roster: [],
          assessments: [],
          lectures: [],
          labs: [],
          resources: [],
        }
      : undefined;
    const courseDetail = config.courseDetail ?? fallbackDetail;
    const crumbs = ["Home", "Active Courses", courseDetail?.title || selected?.title || selected?.course || "Course"];
    const detailTitle =
      courseDetail?.code && courseDetail.title && courseDetail.code !== courseDetail.title
        ? `${courseDetail.code} · ${courseDetail.title}`
        : courseDetail?.title || config.title;
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <SisCrumb crumbs={crumbs} />
        <button
          type="button"
          className="mh-teacher-link mh-teacher-active-back"
          onClick={() => router.push("/instructor/f/t56-active-courses")}
        >
          ← Active Courses
        </button>
        {courseDetail ? (
          <CourseDetailView
            config={{
              ...config,
              title: detailTitle,
              subtitle: courseDetail.meta || "",
              courseDetail,
            } as TeacherScreenConfig}
          />
        ) : (
          <p className="mh-teacher-muted">{live?.loading ? "Opening course…" : "Course detail is not available yet."}</p>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <SisCrumb crumbs={config.breadcrumbs ?? ["Home", "Active Courses"]} />
        <PageHead config={config} hideActions />
        <p className="mh-teacher-muted">No active course filters available.</p>
      </div>
    );
  }

  const q = student.trim().toLowerCase();
  const rows = applied
    ? data.rows.filter((row) => {
        const hay = `${row.course} ${row.code ?? ""} ${row.title ?? ""} ${row.section ?? ""} ${row.instructors} ${row.enrolment}`.toLowerCase();
        if (course !== "All Courses") {
          const code = course.split(":")[0]?.trim() || course;
          if (!hay.includes(code.toLowerCase()) && row.course !== course) return false;
        }
        if (campus !== "ALL CAMPUSES" && row.location !== campus) return false;
        if (faculty !== "ALL FACULTY / INSTRUCTORS" && !row.instructors.includes(faculty)) return false;
        if (q && !hay.includes(q)) return false;
        return true;
      })
    : data.rows;

  const size = Number(perPage) || 250;
  const pageCount = Math.max(1, Math.ceil(rows.length / size));
  const pageNum = Math.min(Math.max(1, Number(page) || 1), pageCount);
  const paged = rows.slice((pageNum - 1) * size, pageNum * size);
  const pageOptions =
    pageCount === data.pageOptions.length
      ? data.pageOptions
      : Array.from({ length: pageCount }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs ?? ["Home", "Active Courses"]} />
      <PageHead config={config} hideActions />
      <section className="mh-teacher-card mh-teacher-active-filters">
        <div className="mh-teacher-active-filters__grid">
          <label>
            <span>{data.filters.campus.label}</span>
            <select className="mh-teacher-field" value={campus} onChange={(e) => setCampus(e.target.value)}>
              {data.filters.campus.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{data.filters.course.label}</span>
            <select className="mh-teacher-field" value={course} onChange={(e) => setCourse(e.target.value)}>
              {data.filters.course.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{data.filters.term.label}</span>
            <select className="mh-teacher-field" value={term} onChange={(e) => setTerm(e.target.value)}>
              {data.filters.term.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{data.filters.student.label}</span>
            <input
              className="mh-teacher-field"
              value={student}
              placeholder={data.filters.student.placeholder}
              onChange={(e) => setStudent(e.target.value)}
            />
          </label>
          <label>
            <span>{data.filters.faculty.label}</span>
            <select className="mh-teacher-field" value={faculty} onChange={(e) => setFaculty(e.target.value)}>
              {data.filters.faculty.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mh-teacher-active-filters__actions">
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--dark"
              onClick={() => {
                setApplied(true);
                setPage("1");
              }}
            >
              {data.showLabel || "Show Courses"}
            </button>
          </div>
        </div>
      </section>

      <div className="mh-teacher-active-results">
        <strong>Results: {rows.length.toLocaleString()}</strong>
        <div className="mh-teacher-active-results__pager">
          <label>
            <span>Results per page:</span>
            <select
              className="mh-teacher-field"
              value={perPage}
              onChange={(e) => {
                setPerPage(e.target.value);
                setPage("1");
              }}
            >
              {data.perPageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Page:</span>
            <select className="mh-teacher-field" value={String(pageNum)} onChange={(e) => setPage(e.target.value)}>
              {pageOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="mh-teacher-card mh-teacher-active-table">
        <div
          className="mh-teacher-table mh-teacher-active-table__grid"
          style={{
            gridTemplateColumns:
              "minmax(200px,1.5fr) minmax(160px,1.1fr) minmax(120px,0.8fr) minmax(140px,0.95fr) minmax(80px,0.45fr) minmax(190px,0.9fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>Course</span>
            <span>Location</span>
            <span>Instructor(s)</span>
            <span>Dates</span>
            <span>Enrolment</span>
            <span aria-hidden="true" />
          </div>
          {paged.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / -1" }}>
                No courses match the current filters.
              </span>
            </div>
          ) : (
            paged.map((row, index) => {
              const href = activeCourseViewHref(row);
              const codeLine = row.section ? `${row.code || row.course} (${row.section})` : row.code || row.course;
              const titleLine = row.title || "";
              return (
                <div
                  key={row.id || `${row.course}-${row.location}-${index}`}
                  className="mh-teacher-table__row mh-teacher-active-row"
                >
                  <button type="button" className="mh-teacher-active-course" onClick={() => router.push(href)}>
                    <strong>{codeLine}</strong>
                    {titleLine ? <span>{titleLine}</span> : null}
                  </button>
                  <span className="mh-teacher-active-cell">
                    <strong>{row.location}</strong>
                    <em>{row.room || "Room Not Set"}</em>
                  </span>
                  <span>{row.instructors || "Not Set"}</span>
                  <span className="mh-teacher-active-dates">{row.dates}</span>
                  <span>{row.enrolment}</span>
                  <span className="mh-teacher-active-actions">
                    <button type="button" className="mh-teacher-link mh-teacher-link--view" onClick={() => router.push(href)}>
                      VIEW COURSE
                    </button>
                    <span aria-hidden="true">|</span>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--attendance"
                      onClick={() => router.push(row.attendanceHref)}
                    >
                      ATTENDANCE
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function CourseListView({ config }: { config: TeacherScreenConfig }) {
  const cl = config.courseList;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("All terms");
  const [status, setStatus] = useState("All statuses");

  if (config.archetype === "cards" && config.cards) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <div className="mh-teacher-courses__grid">
          {config.cards.items.map((item) => (
            <button
              key={item.title}
              type="button"
              className="mh-teacher-course-card"
              onClick={() => item.href && router.push(item.href)}
            >
              <div className="mh-teacher-course-card__top">
                <h3>{item.title}</h3>
                {item.badge ? <span className={badgeClass(item.badgeTone)}>{item.badge}</span> : null}
              </div>
              <p>{item.subtitle}</p>
              <span className="mh-teacher-muted">{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (!cl) return null;

  const courses = cl.courses ?? [];
  const termOptions = ["All terms", ...Array.from(new Set(courses.map((c) => c.term).filter(Boolean)))];
  const statusOptions = ["All statuses", ...Array.from(new Set(courses.map((c) => c.status).filter(Boolean)))];
  const q = query.trim().toLowerCase();
  const rows = courses.filter((row) => {
    if (term !== "All terms" && row.term !== term) return false;
    if (status !== "All statuses" && row.status !== status) return false;
    if (!q) return true;
    return `${row.code} ${row.title} ${row.section ?? ""} ${row.schedule} ${row.room}`.toLowerCase().includes(q);
  });

  return (
    <div className="mh-teacher-stack mh-teacher-mycourses" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs ?? ["Home", "My Courses"]} />
      <PageHead config={{ ...config, subtitle: "" }} hideActions />

      {cl.kpis?.length ? (
        <div className="mh-teacher-dash__kpis mh-teacher-mycourses__kpis">
          {cl.kpis.map((k) => (
            <div key={k.label} className="mh-teacher-dash__kpi">
              <span className="mh-teacher-dash__kpi-label">{k.label}</span>
              <strong className="mh-teacher-dash__kpi-value">{k.value}</strong>
              {k.hint ? <span className="mh-teacher-dash__kpi-hint">{k.hint}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      <section className="mh-teacher-card mh-teacher-active-filters">
        <div className="mh-teacher-mycourses__toolbar">
          <label>
            <span>Search</span>
            <input
              className="mh-teacher-field"
              type="search"
              value={query}
              placeholder={cl.searchPlaceholder || "Search course name or number"}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span>Term</span>
            <select className="mh-teacher-field" value={term} onChange={(e) => setTerm(e.target.value)}>
              {termOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select className="mh-teacher-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <div className="mh-teacher-active-filters__actions">
            <button type="button" className="mh-teacher-btn mh-teacher-btn--dark">
              Show Courses
            </button>
          </div>
        </div>
      </section>

      {cl.week?.length ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-mycourses__week-head">
            <h2>This week</h2>
            <span className="mh-teacher-muted">
              {cl.week.length} session{cl.week.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mh-teacher-mycourses__week">
            {cl.week.map((slot, i) => (
              <button
                key={`${slot.day}-${slot.time}-${slot.course}-${i}`}
                type="button"
                className="mh-teacher-mycourses__slot"
                onClick={() => slot.href && router.push(slot.href)}
              >
                <em>{slot.day}</em>
                <strong>{slot.time}</strong>
                <span>{slot.course}</span>
                <span className="mh-teacher-muted">{slot.room}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mh-teacher-active-results">
        <strong>Results: {rows.length.toLocaleString()}</strong>
      </div>

      <section className="mh-teacher-card mh-teacher-active-table">
        <div
          className="mh-teacher-table mh-teacher-active-table__grid"
          style={{
            gridTemplateColumns:
              "minmax(200px,1.5fr) minmax(90px,0.55fr) minmax(150px,1fr) minmax(140px,1fr) minmax(90px,0.55fr) minmax(90px,0.55fr) minmax(180px,0.9fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>Course</span>
            <span>Section</span>
            <span>Schedule</span>
            <span>Location</span>
            <span>Enrolment</span>
            <span>Status</span>
            <span aria-hidden="true" />
          </div>
          {rows.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / -1" }}>
                {q || term !== "All terms" || status !== "All statuses"
                  ? "No courses match the current filters."
                  : "No teaching sections assigned yet."}
              </span>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.id || `${row.code}-${row.section || row.href}`} className="mh-teacher-table__row mh-teacher-active-row">
                <button type="button" className="mh-teacher-active-course" onClick={() => router.push(row.href)}>
                  <strong>
                    {row.code}
                    {row.section ? ` (${row.section})` : ""}
                  </strong>
                  <span>{row.title}</span>
                </button>
                <span>{row.section || "—"}</span>
                <span className="mh-teacher-active-dates">{row.schedule}</span>
                <span className="mh-teacher-active-cell">
                  <strong>{row.location || row.room}</strong>
                  {row.location && row.room ? <em>{row.room}</em> : null}
                </span>
                <span>
                  {row.enrolled} / {row.capacity}
                </span>
                <span>
                  <span className={badgeClass(row.statusTone)}>{row.status}</span>
                </span>
                <span className="mh-teacher-active-actions">
                  <button type="button" className="mh-teacher-link mh-teacher-link--view" onClick={() => router.push(row.href)}>
                    VIEW COURSE
                  </button>
                  <span aria-hidden="true">|</span>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--attendance"
                    onClick={() => router.push(row.attendanceHref || "/instructor/attendance")}
                  >
                    ATTENDANCE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CourseDetailView({ config }: { config: TeacherScreenConfig }) {
  return <CourseLmsView config={config} />;
}

function CourseMgmtView({ config }: { config: TeacherScreenConfig }) {
  const cm = config.courseMgmt;
  const router = useRouter();
  if (!cm) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-card-grid">
        {cm.tools.map((t) => (
          <button
            key={t.title}
            type="button"
            className="mh-teacher-card mh-teacher-card--interactive"
            onClick={() => router.push(t.href)}
          >
            <div className="mh-teacher-card__head">
              <h3>{t.title}</h3>
              {t.badge ? <span className={badgeClass("review")}>{t.badge}</span> : null}
            </div>
            <p>{t.detail}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function ModulesBoardView({ config }: { config: TeacherScreenConfig }) {
  const board = config.modulesBoard;
  const router = useRouter();
  if (!board) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <p className="mh-teacher-muted">No modules available yet for your sections.</p>
      </div>
    );
  }
  const items = board.items ?? [];
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <p className="mh-teacher-muted">{board.course}</p>
      {items.length === 0 ? (
        <section className="mh-teacher-card">
          <p className="mh-teacher-muted">
            No module items yet. Add assessments to a section and they will appear here as module units.
          </p>
          <div className="mh-teacher-actions" style={{ marginTop: 12 }}>
            <ActionBtn label="My courses" href="/instructor/sections" tone="secondary" />
            <ActionBtn label="Assessments" href="/instructor/assessments" />
          </div>
        </section>
      ) : (
        <div className="mh-teacher-list">
          {items.map((m, i) => (
            <button
              key={`${m.course}-${m.title}-${i}`}
              type="button"
              className="mh-teacher-list__item mh-teacher-list__item--button"
              onClick={() => {
                if (m.href) router.push(m.href);
              }}
            >
              <div>
                <strong>{m.title}</strong>
                <span>
                  {m.course}
                  {m.due ? ` · Due ${m.due}` : ""}
                  {` · ${m.items} item(s)`}
                </span>
              </div>
              <span className={badgeClass("info")}>{m.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementsView({ config }: { config: TeacherScreenConfig }) {
  const a = config.announcements;
  const live = useOptionalTeacherLive();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sectionId, setSectionId] = useState("");
  const sections = a?.sections ?? [];
  const chosenSection = sections.find((s) => s.id === sectionId)?.id || a?.sectionId || sections[0]?.id || "";
  if (!a) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <p className="mh-teacher-muted">No announcement workspace available yet.</p>
      </div>
    );
  }
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <p className="mh-teacher-muted">{a.course}</p>
      <section className="mh-teacher-card">
        <h2>Compose announcement</h2>
        <div className="mh-teacher-fields">
          <label>
            <span>Title</span>
            <input
              className="mh-teacher-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title"
            />
          </label>
          <label>
            <span>Body</span>
            <textarea
              className="mh-teacher-field mh-teacher-field--tall"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Message for enrolled students"
              rows={4}
            />
          </label>
          <label>
            <span>Course section</span>
            <select
              className="mh-teacher-field"
              value={chosenSection}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={sections.length === 0}
            >
              {sections.length === 0 ? <option value="">No teaching sections</option> : null}
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {typeof s.enrolled === "number" ? ` (${s.enrolled} enrolled)` : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Audience</span>
            <div className="mh-teacher-field">All enrolled students in this section</div>
          </label>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--primary"
            disabled={live?.busy || !title.trim() || !body.trim() || !chosenSection}
            onClick={() => {
              void (async () => {
                await live?.runAction?.(
                  "Publish announcement",
                  JSON.stringify({ title: title.trim(), body: body.trim(), sectionId: chosenSection }),
                );
                setTitle("");
                setBody("");
              })();
            }}
          >
            Publish announcement
          </button>
        </div>
      </section>
      <section className="mh-teacher-card">
        <h2>Published posts</h2>
        {(a.posts ?? []).length === 0 ? (
          <p className="mh-teacher-muted">No announcements published yet.</p>
        ) : (
          <div className="mh-teacher-announcements">
            {a.posts.map((p, i) => (
              <div key={`${p.title}-${p.when}-${i}`} className="mh-teacher-announcements__item">
                <div className="mh-teacher-announcements__top">
                  <strong>
                    {p.pinned ? "📌 " : ""}
                    {p.title}
                  </strong>
                  <span>{p.when}</span>
                </div>
                <p>{p.body}</p>
                <span className="mh-teacher-muted">{p.audience}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VersionEditorView({ config }: { config: TeacherScreenConfig }) {
  const v = config.versionEditor;
  const live = useOptionalTeacherLive();
  const [title, setTitle] = useState(v?.editor.title ?? "");
  const [body, setBody] = useState(v?.editor.body ?? "");
  useEffect(() => { if (v) { setTitle(v.editor.title); setBody(v.editor.body); } }, [v]);
  if (!v) return null;
  return (
    <div className="mh-teacher-studio-editor" data-figma-id={config.figmaId}>
      <PageHead config={config} badge={v.version} hideActions />
      <div className="mh-teacher-banner">{v.notice}</div>
      <div className="mh-teacher-split">
        <aside className="mh-teacher-card">
          <h2>Outline · {v.course}</h2>
          {v.outline.map((n) => (
            <div key={n.id} className="mh-teacher-outline-node">
              <strong>{n.label}</strong>
              {(n.children || []).map((c) => (
                <div key={c} className="mh-teacher-outline-child">
                  {c}
                </div>
              ))}
            </div>
          ))}
        </aside>
        <section className="mh-teacher-card">
          <label style={{ display: "grid", gap: 6 }}><span>Version title</span><input className="mh-teacher-field" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label style={{ display: "grid", gap: 6, marginTop: 12 }}><span>Change content</span><textarea className="mh-teacher-field" rows={10} value={body} onChange={(e) => setBody(e.target.value)} /></label>
          <span className="mh-teacher-muted">{v.editor.wordCount}</span>
          <div className="mh-teacher-actions" style={{ marginTop: 12 }}>
            <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" disabled={live?.busy} onClick={() => void live?.runAction?.("Save Draft", JSON.stringify({ Title: title, Body: body }))}>Save Draft</button>
            <button type="button" className="mh-teacher-btn" disabled={live?.busy} onClick={() => void live?.runAction?.("Submit for Approval", JSON.stringify({ Title: title, Body: body }))}>Submit for Approval</button>
          </div>
          <h3>Versions</h3>
          <div className="mh-teacher-list">
            {v.versions.map((x) => (
              <div key={x.label} className="mh-teacher-list__item">
                <div>
                  <strong>{x.label}</strong>
                  <span>
                    {x.when} · {x.author}
                  </span>
                </div>
                {x.current ? <span className={badgeClass("active")}>Current</span> : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function EvaluationsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const e = config.evaluations;
  if (!e) return null;
  const backHref =
    config.primaryActionHref ||
    (searchParams.get("sectionId") ? "/instructor/f/t36-course-evaluations" : "");
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      {backHref ? (
        <p className="mh-hcc-profile__crumb">
          <button type="button" className="mh-hcc-link" onClick={() => router.push(backHref)}>
            ← Back to Course Evaluations
          </button>
        </p>
      ) : null}
      <PageHead config={config} hideActions={!config.primaryActionHref} />
      <div className="mh-teacher-dash__kpis">
        {e.summary.map((s) => (
          <div key={s.label} className="mh-teacher-dash__kpi">
            <div className="mh-teacher-dash__kpi-label">{s.label}</div>
            <div className="mh-teacher-dash__kpi-value">{s.value}</div>
            <div className="mh-teacher-dash__kpi-hint">{s.hint}</div>
          </div>
        ))}
      </div>
      <section className="mh-teacher-card">
        <h2>Student Comments</h2>
        <div className="mh-teacher-list">
          {e.comments.length === 0 ? (
            <div className="mh-teacher-list__item">
              <div>
                <strong>No submitted comments yet.</strong>
                <span>Results appear after students complete end-of-course evaluations.</span>
              </div>
            </div>
          ) : (
            e.comments.map((c) => (
              <div key={`${c.term}-${c.rating}-${c.text}`} className="mh-teacher-list__item">
                <div>
                  <strong>{c.text}</strong>
                  <span>
                    {c.term} · Rating {c.rating}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RepositoryView({ config }: { config: TeacherScreenConfig }) {
  const r = config.repository;
  if (!r) return null;
  return (
    <div className="mh-teacher-split" data-figma-id={config.figmaId}>
      <aside className="mh-teacher-card">
        <h2>Folders</h2>
        <div className="mh-teacher-list">
          {r.folders.map((f) => (
            <div key={f.name} className="mh-teacher-list__item">
              <div>
                <strong>{f.name}</strong>
                <span>
                  {f.files} files · {f.updated}
                </span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="mh-teacher-card">
        <PageHead config={config} />
        <TableBlock config={config} />
        <h3>Recent Files</h3>
        <div className="mh-teacher-list">
          {r.files.map((f) => (
            <div key={f.name} className="mh-teacher-list__item">
              <div>
                <strong>{f.name}</strong>
                <span>
                  {f.type} · {f.updated}
                </span>
              </div>
              <span className="mh-teacher-muted">{f.size}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PendingSchedulesView({ config }: { config: TeacherScreenConfig }) {
  const p = config.pendingSchedules;
  if (!p) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-list">
        {p.requests.map((r) => (
          <div key={r.course} className="mh-teacher-card mh-teacher-list__item">
            <div>
              <strong>{r.course}</strong>
              <span>
                Requested {r.requested} · {r.proposer}
              </span>
            </div>
            <span className={badgeClass(r.tone)}>{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CourseHistoryView({ config }: { config: TeacherScreenConfig }) {
  const h = config.courseHistory;
  if (!h) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      {h.terms.map((t) => (
        <section key={t.term} className="mh-teacher-card">
          <h2>{t.term}</h2>
          <div className="mh-teacher-list">
            {t.courses.map((c) => (
              <div key={c.code} className="mh-teacher-list__item">
                <div>
                  <strong>
                    {c.code} · {c.title}
                  </strong>
                  <span>
                    Enrollment {c.enrollment} · Avg eval {c.avgEval}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TableBlock({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const cols = config.columns || [];
  const openRow = (href?: string) => {
    if (!href) return;
    if (/^https:\/\//i.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };
  if (!cols.length) return null;
  return (
    <section className="mh-teacher-card">
      <div className="mh-teacher-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>{config.title}</h2>
          {config.countLabel ? <p className="mh-teacher-muted">{config.countLabel}</p> : null}
        </div>
        <PageActions config={config} />
      </div>
      <div
        className="mh-teacher-table"
        style={{ gridTemplateColumns: config.columnTemplate || `repeat(${cols.length}, 1fr)` }}
      >
        <div className="mh-teacher-table__head">
          {cols.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        {(config.rows || []).length === 0 ? (
          <div className="mh-teacher-table__row">
            <span className="mh-teacher-muted" style={{ gridColumn: `1 / span ${cols.length}` }}>
              {config.emptyMessage || "No records to show yet."}
            </span>
          </div>
        ) : (
          (config.rows || []).map((r, i) => (
            <button
              key={i}
              type="button"
              className="mh-teacher-table__row mh-teacher-table__row--btn"
              onClick={() => openRow(r.href)}
            >
              {r.cells.map((cell, j) => (
                <span key={j}>
                  {j === r.cells.length - 1 && r.badge ? (
                    <span className={badgeClass(r.badgeTone)}>{r.badge}</span>
                  ) : (
                    cell
                  )}
                </span>
              ))}
            </button>
          ))
        )}
      </div>
    </section>
  );
}


function renderGroupedOptions(options: Array<{ label: string; value: string; group?: string }>) {
  const groups: Array<{ name: string; opts: typeof options }> = [];
  const ungrouped: typeof options = [];
  for (const o of options) {
    if (o.group) {
      const g = groups.find((x) => x.name === o.group);
      if (g) g.opts.push(o);
      else groups.push({ name: o.group, opts: [o] });
    } else ungrouped.push(o);
  }
  return (
    <>
      {ungrouped.map((o) => (
        <option key={`${o.value}-${o.label}`} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups.map((g) => (
        <optgroup key={g.name} label={g.name}>
          {g.opts.map((o) => (
            <option key={`${o.value}-${o.label}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function FormView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const f = config.form;
  const live = useOptionalTeacherLive();
  const isCreateStudent =
    config.path.includes("t43") || config.path.includes("create-student-profile");
  const isAddCourse =
    config.path.includes("t55") || config.path.includes("add-course-form") || config.path.includes("add-course");
  const isAddProgram =
    config.path.includes("t74") ||
    (config.path.includes("add-program") && !config.path.includes("add-program-type"));
  const isAddGradingScheme =
    config.path.includes("t64") || config.path.includes("add-grading-scheme");
  const gradingSchemeId = isAddGradingScheme ? searchParams.get("schemeId") || "" : "";
  const isAddProgramType =
    config.path.includes("t75") || config.path.includes("add-program-type");
  const isAddFaculty =
    config.path.includes("t81") || config.path.includes("add-faculty");
  const isCourseConfig =
    config.path.includes("t66") || config.path.includes("course-configuration");
  const isAddTerm =
    config.path.includes("t76-add-term") ||
    (config.path.includes("add-term") && !config.path.includes("create-term"));
  const isNewWorkshopEnrolment =
    config.path.includes("t42") ||
    config.path.includes("new-workshop-enrollment") ||
    config.path.includes("new-workshop-enrolment");
  const isAddSession =
    config.path.includes("t78") || config.path.includes("add-session-offering");
  const isAddTextbook =
    config.path.includes("t79") || config.path.includes("add-textbook");
  const isCreateContentCourse =
    config.path.includes("t80") || config.path.includes("create-content-course");
  const isAddAvailability =
    config.path.includes("t25") || config.path.includes("add-availability");
  const gradeEntryCfg = f?.gradeEntries;
  const designationCfg = f?.designations;
  const customEventCfg = f?.customEventDates;
  const enrolmentCfg = f?.enrolmentConditions;
  const deadlinesCfg = f?.deadlines;
  const weeklyTimingsCfg = f?.weeklyTimings;
  const examScheduleCfg = f?.examSchedule;
  const gradingPreviewCfg = f?.gradingPreview;
  const linkedCourseCfg = f?.linkedCourses;
  const emptyDraft = {
    letter: "",
    percent: "",
    percentUp: "0.00",
    gradePoint: "",
    credit: "Yes",
    condition: "None",
  };
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of f?.groups ?? []) {
      for (const field of g.fields) {
        init[field.label] = field.value;
        if (field.type === "pair") init[`${field.label} Unit`] = field.unitValue ?? field.unitOptions?.[0]?.value ?? "";
      }
    }
    return init;
  });
  const [gradeDraft, setGradeDraft] = useState(() => ({
    ...emptyDraft,
    ...(gradeEntryCfg?.draft ?? {}),
  }));
  const [gradeEntries, setGradeEntries] = useState(
    () => gradeEntryCfg?.entries?.map((e) => ({ ...e })) ?? [],
  );
  const [designations, setDesignations] = useState(
    () => designationCfg?.rows?.map((r) => ({ ...r })) ?? [],
  );
  const [customEvents, setCustomEvents] = useState(
    () => customEventCfg?.events?.map((e) => ({ ...e })) ?? [],
  );
  const [weeklyTimings, setWeeklyTimings] = useState(
    () => weeklyTimingsCfg?.days?.map((d) => ({ ...d })) ?? [],
  );
  const [exams, setExams] = useState(
    () => examScheduleCfg?.exams?.map((e) => ({ ...e })) ?? [],
  );
  const [linkedCourses, setLinkedCourses] = useState(
    () => linkedCourseCfg?.rows?.map((r) => ({ ...r })) ?? [],
  );
  const [linkedCoursePick, setLinkedCoursePick] = useState("");
  const [designationOpen, setDesignationOpen] = useState(false);
  const [designationValues, setDesignationValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of designationCfg?.modal?.groups ?? []) {
      for (const field of g.fields) init[field.label] = field.value;
    }
    return init;
  });
  useEffect(() => {
    setValues((prev) => {
      const init: Record<string, string> = {};
      for (const g of f?.groups ?? []) {
        for (const field of g.fields) {
          const existing = prev[field.label] ?? "";
          if (existing.trim()) {
            if (!field.options?.length || field.options.some((o) => o.value === existing)) {
              init[field.label] = existing;
            } else {
              init[field.label] = field.value;
            }
          } else {
            init[field.label] = field.value;
          }
          if (field.type === "pair") {
            const unitKey = `${field.label} Unit`;
            const existingUnit = prev[unitKey] ?? "";
            init[unitKey] =
              existingUnit && (!field.unitOptions?.length || field.unitOptions.some((o) => o.value === existingUnit))
                ? existingUnit
                : (field.unitValue ?? field.unitOptions?.[0]?.value ?? "");
          }
        }
      }
      return init;
    });
    if (gradeEntryCfg) {
      setGradeDraft({ ...emptyDraft, ...(gradeEntryCfg.draft ?? {}) });
      setGradeEntries(gradeEntryCfg.entries?.map((e) => ({ ...e })) ?? []);
    }
    if (designationCfg) {
      setDesignations(designationCfg.rows?.map((r) => ({ ...r })) ?? []);
      const init: Record<string, string> = {};
      for (const g of designationCfg.modal?.groups ?? []) {
        for (const field of g.fields) init[field.label] = field.value;
      }
      setDesignationValues(init);
    }
    if (customEventCfg) {
      setCustomEvents(customEventCfg.events?.map((e) => ({ ...e })) ?? []);
    }
    if (weeklyTimingsCfg) {
      setWeeklyTimings(weeklyTimingsCfg.days?.map((d) => ({ ...d })) ?? []);
    }
    if (examScheduleCfg) {
      setExams(examScheduleCfg.exams?.map((e) => ({ ...e })) ?? []);
    }
    if (linkedCourseCfg) {
      setLinkedCourses(linkedCourseCfg.rows?.map((r) => ({ ...r })) ?? []);
      setLinkedCoursePick("");
    }
  }, [f]);
  if (!f) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} hideActions />
        <p className="mh-teacher-muted">No form fields available for this screen.</p>
      </div>
    );
  }

  const setFieldValue = (label: string, next: string) => {
    setValues((prev) => {
      const updated: Record<string, string> = { ...prev, [label]: next };
      for (const g of f.groups) {
        for (const field of g.fields) {
          if (field.dependsOn !== label || !field.options?.length) continue;
          const stillValid = field.options.some(
            (o) => o.value === updated[field.label] && (!o.filterKey || o.filterKey === next),
          );
          if (!stillValid) {
            const fallback = field.options.find((o) => !o.filterKey || o.filterKey === next);
            updated[field.label] = fallback?.value ?? "";
          }
        }
      }
      if (label === "Course" && isCreateContentCourse) {
        const option = f.groups
          .flatMap((g) => g.fields)
          .find((field) => field.label === "Course")
          ?.options?.find((o) => o.value === next);
        const fromLabel = option?.label?.includes(":")
          ? option.label.slice(option.label.indexOf(":") + 1).trim()
          : option?.label || "";
        if (!(prev["Note / Name"] || "").trim() || prev["Note / Name"] === (prev.__lastCourseName || "")) {
          updated["Note / Name"] = fromLabel;
        }
        updated.__lastCourseName = fromLabel;
      }
      return updated;
    });
  };

  const programName = (values["Program Name"] || "").trim();
  const programTypeName = (values["Program Type Name"] || "").trim();
  const termName = (values["Term Name"] || "").trim();
  const courseName = (values["Course Name"] || "").trim();
  const schemeName = (values["Grading Scheme Name"] || "").trim();
  const givenName = (values["Given Name"] || "").trim();
  const familyName = (values["Family Name"] || "").trim();
  const email = (values.Email || "").trim();
  const sectionValue = (values.Section || "").trim();
  const textbookName = (values["Textbook Name"] || "").trim();
  const contentCourse = (values.Course || "").trim();
  const programTypeId = isAddProgramType ? searchParams.get("typeId") || "" : "";
  const termId = isAddTerm ? searchParams.get("termId") || "" : "";
  const textbookId = isAddTextbook ? searchParams.get("textbookId") || "" : "";
  const contentCourseId = isCreateContentCourse ? searchParams.get("courseId") || "" : "";
  const facultyId = isAddFaculty ? searchParams.get("facultyId") || "" : "";
  const courseConfigId = isCourseConfig ? searchParams.get("courseId") || "" : "";
  const rowKey = JSON.stringify(
    isAddGradingScheme
      ? { ...values, __gradeEntries: gradeEntries, __schemeId: gradingSchemeId }
      : isAddProgram
        ? { ...values, __designations: designations }
        : isAddFaculty
          ? { ...values, facultyId }
        : isCourseConfig
          ? { ...values, courseId: courseConfigId }
        : isAddTerm
          ? { ...values, __customEvents: customEvents, __termId: termId }
          : isAddSession
            ? { ...values, __weeklyTimings: weeklyTimings, __exams: exams }
            : isAddProgramType
              ? { ...values, __typeId: programTypeId }
              : isAddTextbook
                ? { ...values, __linkedCourses: linkedCourses, __textbookId: textbookId }
                : isCreateContentCourse
                  ? { ...values, __contentCourseId: contentCourseId }
                  : values,
  );
  const programSelect = (values.Program || "").trim();
  const termSelect = (values.Term || "").trim();
  const calendarName = (values.Name || "").trim();
  const isCreateMaster = config.path.includes("create-master-schedule");
  const isCreateTerm = config.path.includes("create-term-schedule");
  const isCreateCalendar = config.path.includes("create-academic-calendar");
  const canSubmit = isCreateStudent
    ? Boolean(givenName && familyName && email && sectionValue)
    : isAddCourse
      ? Boolean(courseName)
      : isAddProgram
        ? Boolean(programName)
        : isAddFaculty
          ? Boolean((values["Faculty Name"] || "").trim())
        : isCourseConfig
          ? Boolean((values["Course Name"] || "").trim())
        : isAddProgramType
          ? Boolean(programTypeName)
          : isAddTerm
            ? Boolean(termName)
            : isAddGradingScheme
              ? Boolean(schemeName)
              : isCreateMaster
                ? Boolean(programSelect)
                : isCreateTerm
                  ? Boolean(termSelect)
                  : isCreateCalendar
                    ? Boolean(calendarName)
                    : isNewWorkshopEnrolment
                      ? Boolean((values.Student || "").trim() && (values.Workshop || "").trim())
                      : isAddTextbook
                        ? Boolean(textbookName)
                        : isCreateContentCourse
                          ? Boolean(contentCourse)
                          : isAddAvailability
                            ? Boolean((values.Date || "").trim() && (values.Type || values["Availability Type"] || "").trim())
                    : Object.values(values).some((v) => v.trim());

  function addGradeEntry() {
    if (!gradeEntryCfg) return;
    const letter = gradeDraft.letter.trim();
    if (!letter && !gradeDraft.percent.trim() && !gradeDraft.gradePoint.trim()) return;
    setGradeEntries((prev) => [...prev, { ...gradeDraft, letter }]);
    setGradeDraft({ ...emptyDraft, ...(gradeEntryCfg.draft ?? {}), letter: "", percent: "", gradePoint: "" });
  }

  function resetDesignationModal() {
    const init: Record<string, string> = {};
    for (const g of designationCfg?.modal?.groups ?? []) {
      for (const field of g.fields) init[field.label] = field.value;
    }
    setDesignationValues(init);
  }

  function saveDesignation() {
    const label = (designationValues["Designation Label"] || "").trim();
    if (!label) return;
    const condition = designationValues["Designation Condition"] || "—";
    const required = designationValues["Required Average"] || "0.0000";
    const type = designationValues["Designation Type"] || "Standing";
    setDesignations((prev) => [
      ...prev,
      {
        label,
        condition: `${type} · ${condition}`,
        requirement: `Avg ≥ ${required}`,
      },
    ]);
    setDesignationOpen(false);
    resetDesignationModal();
  }

  async function submit(actionLabel: string) {
    const ok = await live?.runAction?.(actionLabel, rowKey);
    if (!ok) return;
    if (isCreateStudent) {
      router.push("/instructor/f/t12-students-view");
    } else if (isAddCourse) {
      router.push(config.secondaryActionHref || "/instructor/f/t54-courses-sessions");
    } else if (isAddProgram) {
      router.push(config.secondaryActionHref || "/instructor/f/t13-program-management");
    } else if (isAddFaculty) {
      if (!facultyId) {
        window.location.assign(config.path);
      } else {
        router.push(config.secondaryActionHref || "/instructor/f/t13-program-management");
      }
    } else if (isCourseConfig) {
      router.push(config.secondaryActionHref || "/instructor/f/t66-course-configurations");
    } else if (isAddProgramType) {
      router.push(config.secondaryActionHref || "/instructor/f/t50-program-types");
    } else if (isAddTerm) {
      router.push(config.secondaryActionHref || "/instructor/f/t51-manage-terms");
    } else if (isAddSession) {
      const courseId = new URLSearchParams(window.location.search).get("courseId");
      const href = config.secondaryActionHref || "/instructor/f/t77-course-admin";
      router.push(courseId ? `${href}?courseId=${encodeURIComponent(courseId)}` : href);
    } else if (isAddGradingScheme) {
      router.push(config.secondaryActionHref || "/instructor/f/t61-grading-schemes");
    } else if (isAddTextbook) {
      router.push(config.secondaryActionHref || "/instructor/f/t57-course-textbooks");
    } else if (isCreateContentCourse) {
      router.push(config.secondaryActionHref || "/instructor/f/t37-course-repository");
    } else if (isAddAvailability) {
      router.push(config.secondaryActionHref || "/instructor/f/t04-profile-availability");
    } else if (isNewWorkshopEnrolment) {
      router.push("/instructor/f/t40-workshop-enrollment-status?status=pending");
    } else if (config.path.includes("create-master-schedule") || config.path.includes("create-term-schedule")) {
      router.push("/instructor/f/t53-master-scheduling");
    } else if (config.path.includes("create-academic-calendar")) {
      router.push("/instructor/f/t52-academic-calendars");
    }
  }

  const creditOptions = gradeEntryCfg?.creditOptions ?? [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];
  const conditionOptions = gradeEntryCfg?.conditionOptions ?? [
    { label: "None", value: "None" },
    { label: "Pass", value: "Pass" },
    { label: "Fail", value: "Fail" },
  ];

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <PageHead config={config} hideActions />
      {f.stepLabel ? <p className="mh-teacher-step-label">{f.stepLabel}</p> : null}
      {f.warning ? <div className="mh-teacher-banner mh-teacher-banner--warning">{f.warning}</div> : null}
      {f.groups
        .filter((g) => !g.visibleWhen || (values[g.visibleWhen] || "").trim())
        .map((g) => (
        <section key={g.title} className="mh-teacher-card">
          <h2>{g.title}</h2>
          <div className="mh-teacher-fields">
            {g.fields
              .filter((field) => {
                if (!field.visibleWhen) return true;
                const v = (values[field.visibleWhen] || "").trim();
                if ((field as { visibleValue?: string }).visibleValue) {
                  return v === (field as { visibleValue?: string }).visibleValue;
                }
                return Boolean(v);
              })
              .map((field) => {
              const parentValue = field.dependsOn ? values[field.dependsOn] ?? "" : "";
              const options = (field.options ?? []).filter(
                (o) => !field.dependsOn || !o.filterKey || o.filterKey === parentValue,
              );
              const useSelect =
                field.type === "select" ||
                (field.type !== "checkbox" &&
                  field.type !== "checkboxes" &&
                  field.type !== "date" &&
                  field.type !== "time" &&
                  field.type !== "file" &&
                  field.type !== "weekdays" &&
                  field.type !== "pair" &&
                  options.length > 0);
              const weekdayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const selectedDays = new Set(
                (values[field.label] ?? "")
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
              );
              const selectedChecks = new Set(
                (values[field.label] ?? "")
                  .split("|")
                  .map((d) => d.trim())
                  .filter(Boolean),
              );
              const hasEmptyOption = options.some((o) => o.value === "");
              const blockClass =
                field.type === "weekdays" ||
                field.type === "textarea" ||
                field.type === "file" ||
                field.type === "checkbox" ||
                field.type === "checkboxes" ||
                field.type === "pair"
                  ? "mh-teacher-field--block"
                  : undefined;
              const FieldWrap =
                field.type === "weekdays" || field.type === "pair" || field.type === "checkboxes" ? "div" : "label";
              const showSectionNote =
                field.sublabel &&
                (field.label === "Start Date" || field.label === "Midterm Date");
              return (
                <Fragment key={field.label}>
                  {showSectionNote ? (
                    <p className="mh-teacher-form-section-note">{field.sublabel}</p>
                  ) : null}
                <FieldWrap className={blockClass}>
                  {field.type === "checkbox" ? null : (
                    <span>
                      {field.label}
                      {field.optional && field.label !== "Midterm Date" ? (
                        <em className="mh-teacher-optional"> Optional</em>
                      ) : null}
                    </span>
                  )}
                  {field.type === "textarea" ? (
                    <textarea
                      className="mh-teacher-field mh-teacher-field--tall"
                      value={values[field.label] ?? ""}
                      onChange={(e) => setFieldValue(field.label, e.target.value)}
                      rows={4}
                    />
                  ) : field.type === "checkbox" ? (
                    <span className="mh-teacher-check">
                      <input
                        type="checkbox"
                        checked={(values[field.label] ?? "") === "true"}
                        onChange={(e) => setFieldValue(field.label, e.target.checked ? "true" : "false")}
                      />
                      <em>{field.label}</em>
                    </span>
                  ) : field.type === "checkboxes" ? (
                    <div className="mh-teacher-checkboxes">
                      {options.map((o) => {
                        const checked = selectedChecks.has(o.value);
                        return (
                          <label key={o.value} className="mh-teacher-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const next = new Set(selectedChecks);
                                if (checked) next.delete(o.value);
                                else next.add(o.value);
                                setFieldValue(field.label, [...next].join("|"));
                              }}
                            />
                            <em>{o.label}</em>
                          </label>
                        );
                      })}
                    </div>
                  ) : field.type === "pair" ? (
                    <div className="mh-teacher-pair">
                      <select
                        className="mh-teacher-field"
                        value={values[field.label] ?? ""}
                        onChange={(e) => setFieldValue(field.label, e.target.value)}
                      >
                        {options.map((o) => (
                          <option key={`${o.value}-${o.label}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="mh-teacher-field"
                        value={values[`${field.label} Unit`] ?? field.unitValue ?? ""}
                        onChange={(e) => setFieldValue(`${field.label} Unit`, e.target.value)}
                      >
                        {(field.unitOptions ?? []).map((o) => (
                          <option key={`${o.value}-${o.label}`} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : field.type === "file" ? (
                    <div className="mh-teacher-file">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          setFieldValue(field.label, file?.name ?? "");
                        }}
                      />
                      <span className="mh-teacher-muted">
                        {(values[field.label] || "").trim() ? values[field.label] : "Add / Browse"}
                      </span>
                    </div>
                  ) : field.type === "weekdays" ? (
                    <div className="mh-teacher-weekdays" role="group" aria-label={field.label}>
                      {weekdayLabels.map((day) => {
                        const on = selectedDays.has(day);
                        return (
                          <label key={day} className={`mh-teacher-weekday${on ? " is-on" : ""}`}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => {
                                const next = new Set(selectedDays);
                                if (on) next.delete(day);
                                else next.add(day);
                                setFieldValue(
                                  field.label,
                                  weekdayLabels.filter((d) => next.has(d)).join(","),
                                );
                              }}
                            />
                            <span>{day.slice(0, 3)}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : useSelect ? (
                    <select
                      className="mh-teacher-field"
                      value={values[field.label] ?? ""}
                      disabled={Boolean(field.dependsOn && !parentValue)}
                      onChange={(e) => setFieldValue(field.label, e.target.value)}
                    >
                      {!hasEmptyOption ? (
                        <option value="">{options.length ? "Select…" : "No options available"}</option>
                      ) : null}
                      {renderGroupedOptions(options)}
                    </select>
                  ) : field.prefix ? (
                    <span className="mh-teacher-currency">
                      <em className="mh-teacher-currency__prefix">{field.prefix}</em>
                      <input
                        className="mh-teacher-field"
                        inputMode="decimal"
                        value={values[field.label] ?? ""}
                        onChange={(e) => setFieldValue(field.label, e.target.value)}
                        onBlur={() => {
                          const n = Number.parseFloat(String(values[field.label] ?? "").replace(/[^0-9.]/g, ""));
                          setFieldValue(field.label, Number.isFinite(n) ? n.toFixed(2) : "0.00");
                        }}
                      />
                    </span>
                  ) : (
                    <input
                      className="mh-teacher-field"
                      type={
                        field.type === "date" ? "date" : field.type === "time" ? "time" : field.type === "number" ? "text" : "text"
                      }
                      inputMode={field.type === "number" ? "decimal" : undefined}
                      placeholder={field.hint}
                      value={values[field.label] ?? ""}
                      disabled={
                        field.readOnly ||
                        (field.label === "Maximum Enrolments" &&
                          (values["Same as classroom size"] ?? "") === "true") ||
                        (field.label === "Median Date" &&
                          (values["Automatically calculate median date"] ?? "") === "true")
                      }
                      onChange={(e) => setFieldValue(field.label, e.target.value)}
                    />
                  )}
                  {field.language ? <em className="mh-teacher-field-lang">{field.language}</em> : null}
                  {field.hint && field.type !== "text" && field.type !== "number" ? (
                    <em className="mh-teacher-field-lang">{field.hint}</em>
                  ) : null}
                  {field.hint && field.type === "text" && (field.label === "Instructor(s)" || field.readOnly) ? (
                    <em className="mh-teacher-field-lang">{field.hint}</em>
                  ) : null}
                </FieldWrap>
                </Fragment>
              );
            })}
            {g.title === "Session Tuition" && f.tuitionNote ? (
              <p className="mh-teacher-muted mh-teacher-tuition-note">{f.tuitionNote}</p>
            ) : null}
            {g.title === "Grading" && gradingPreviewCfg ? (
              <div
                className="mh-teacher-table mh-teacher-grading-preview"
                style={{ gridTemplateColumns: "minmax(80px,0.6fr) minmax(80px,0.6fr) minmax(140px,1.2fr)" }}
              >
                <div className="mh-teacher-table__head">
                  {(gradingPreviewCfg.columns || ["LETTER", "CREDIT", "CONDITION"]).map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                {(gradingPreviewCfg.rows || []).map((row) => (
                  <div key={row.letter} className="mh-teacher-table__row">
                    <strong>{row.letter}</strong>
                    <span>{row.credit}</span>
                    <span>{row.condition}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ))}

      {isAddSession && weeklyTimingsCfg ? (
        <section className="mh-teacher-card">
          <h2>{weeklyTimingsCfg.title || "Daily Timings"}</h2>
          <div className="mh-teacher-weekly-timings">
            {(() => {
              const selected = new Set(
                (values["Weekly Schedule"] || "")
                  .split(",")
                  .map((d) => d.trim())
                  .filter(Boolean),
              );
              const rows = weeklyTimings.filter((d) => selected.has(d.day));
              if (!rows.length) {
                return <p className="mh-teacher-muted">Select weekdays above to set daily timings.</p>;
              }
              return rows.map((day) => (
                <div key={day.day} className="mh-teacher-weekly-timings__row">
                  <strong>{day.day}</strong>
                  <label>
                    <span>Start</span>
                    <input
                      className="mh-teacher-field"
                      value={`${day.startHour}:${day.startMinute}`}
                      onChange={(e) => {
                        const [h = "08", m = "00"] = e.target.value.split(":");
                        setWeeklyTimings((prev) =>
                          prev.map((r) =>
                            r.day === day.day ? { ...r, startHour: h, startMinute: m } : r,
                          ),
                        );
                      }}
                    />
                  </label>
                  <label>
                    <span>Finish</span>
                    <input
                      className="mh-teacher-field"
                      value={`${day.finishHour}:${day.finishMinute}`}
                      onChange={(e) => {
                        const [h = "13", m = "00"] = e.target.value.split(":");
                        setWeeklyTimings((prev) =>
                          prev.map((r) =>
                            r.day === day.day ? { ...r, finishHour: h, finishMinute: m } : r,
                          ),
                        );
                      }}
                    />
                  </label>
                </div>
              ));
            })()}
          </div>
        </section>
      ) : null}

      {isAddSession && examScheduleCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>{examScheduleCfg.title || "Exam Schedule"}</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() =>
                setExams((prev) => [
                  ...prev,
                  {
                    id: `exam-${Date.now()}`,
                    date: "",
                    startTime: "09:00",
                    finishTime: "12:00",
                    location: "Not Set",
                  },
                ])
              }
            >
              {examScheduleCfg.addLabel || "+ Add Exam Date"}
            </button>
          </div>
          <div className="mh-teacher-exam-schedule">
            {exams.map((exam, idx) => (
              <div key={exam.id} className="mh-teacher-exam-schedule__row">
                <input
                  className="mh-teacher-field"
                  type="date"
                  aria-label="Exam date"
                  value={exam.date}
                  onChange={(e) =>
                    setExams((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, date: e.target.value } : row)),
                    )
                  }
                />
                <input
                  className="mh-teacher-field"
                  type="time"
                  aria-label="Start time"
                  value={exam.startTime}
                  onChange={(e) =>
                    setExams((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, startTime: e.target.value } : row)),
                    )
                  }
                />
                <input
                  className="mh-teacher-field"
                  type="time"
                  aria-label="Finish time"
                  value={exam.finishTime}
                  onChange={(e) =>
                    setExams((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, finishTime: e.target.value } : row)),
                    )
                  }
                />
                <input
                  className="mh-teacher-field"
                  aria-label="Location"
                  value={exam.location}
                  onChange={(e) =>
                    setExams((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, location: e.target.value } : row)),
                    )
                  }
                />
                <button
                  type="button"
                  className="mh-teacher-link"
                  onClick={() => setExams((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {customEventCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>{customEventCfg.title || "Custom Event Dates"}</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() =>
                setCustomEvents((prev) => [
                  ...prev,
                  { id: `evt-${Date.now()}`, name: "", date: "" },
                ])
              }
            >
              {customEventCfg.addLabel || "+ Add Event Date"}
            </button>
          </div>
          {customEvents.length === 0 ? (
            <p className="mh-teacher-muted">No custom event dates yet.</p>
          ) : (
            <div className="mh-teacher-custom-events">
              {customEvents.map((evt, idx) => (
                <div key={evt.id} className="mh-teacher-custom-events__row">
                  <input
                    className="mh-teacher-field"
                    placeholder="Event name"
                    value={evt.name}
                    onChange={(e) =>
                      setCustomEvents((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)),
                      )
                    }
                  />
                  <input
                    className="mh-teacher-field"
                    type="date"
                    value={evt.date}
                    onChange={(e) =>
                      setCustomEvents((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, date: e.target.value } : row)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() => setCustomEvents((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {enrolmentCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>{enrolmentCfg.title || "Enrolment Conditions"}</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() => void live?.runAction?.("Add Enrolment Condition")}
            >
              {enrolmentCfg.addLabel || "Add Enrolment Condition"}
            </button>
          </div>
          <div
            className="mh-teacher-table"
            style={{
              gridTemplateColumns: "minmax(140px,1fr) minmax(140px,1fr) minmax(140px,1fr) minmax(140px,1fr)",
            }}
          >
            <div className="mh-teacher-table__head">
              {(enrolmentCfg.columns || [
                "Enrolment Dates",
                "Programs",
                "Completion Conditions",
                "Standing Conditions",
              ]).map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {(enrolmentCfg.rows || []).length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / -1" }}>
                  {enrolmentCfg.emptyMessage || "No enrolment conditions exist for this term."}
                  {enrolmentCfg.disabledNote ? (
                    <>
                      <br />
                      {enrolmentCfg.disabledNote}
                    </>
                  ) : null}
                </span>
              </div>
            ) : (
              (enrolmentCfg.rows || []).map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>{row.enrolmentDates}</span>
                  <span>{row.programs}</span>
                  <span>{row.completion}</span>
                  <span>{row.standing}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {deadlinesCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>{deadlinesCfg.title || "Deadlines"}</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() => void live?.runAction?.("Add Deadline")}
            >
              {deadlinesCfg.addLabel || "Add Deadline"}
            </button>
          </div>
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(160px,1.2fr) minmax(120px,1fr) minmax(120px,1fr)" }}
          >
            <div className="mh-teacher-table__head">
              {(deadlinesCfg.columns || ["Condition", "Type", "Penalty"]).map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {(deadlinesCfg.rows || []).length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / -1" }}>
                  {deadlinesCfg.emptyMessage || "No deadlines exist for this term."}
                </span>
              </div>
            ) : (
              (deadlinesCfg.rows || []).map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>{row.condition}</span>
                  <span>{row.type}</span>
                  <span>{row.penalty}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {designationCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>Designations</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() => {
                resetDesignationModal();
                setDesignationOpen(true);
              }}
            >
              {designationCfg.addLabel || "Add Designation"}
            </button>
          </div>
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(140px,1.2fr) minmax(160px,1.4fr) minmax(120px,1fr)" }}
          >
            <div className="mh-teacher-table__head">
              {(designationCfg.columns || ["LABEL", "CONDITION", "REQUIREMENT"]).map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            {designations.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / -1" }}>
                  No designations yet. Click Add Designation to create one.
                </span>
              </div>
            ) : (
              designations.map((row, idx) => (
                <div key={`${row.label}-${idx}`} className="mh-teacher-table__row">
                  <strong>{row.label}</strong>
                  <span>{row.condition}</span>
                  <span>{row.requirement}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {designationOpen && designationCfg?.modal ? (
        <div className="mh-teacher-modal" role="dialog" aria-modal="true" aria-label={designationCfg.modal.title}>
          <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={() => setDesignationOpen(false)} />
          <div className="mh-teacher-modal__panel">
            <div className="mh-teacher-modal__head">
              <h2>{designationCfg.modal.title}</h2>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setDesignationOpen(false)}>
                Close
              </button>
            </div>
            <div className="mh-teacher-modal__body">
              {designationCfg.modal.groups.map((g) => (
                <section key={g.title} className="mh-teacher-card">
                  <h3>{g.title}</h3>
                  <div className="mh-teacher-fields">
                    {g.fields.map((field) => {
                      const options = field.options ?? [];
                      const hasEmptyOption = options.some((o) => o.value === "");
                      if (field.type === "checkbox") {
                        return (
                          <label key={field.label} className="mh-teacher-field--block">
                            <span className="mh-teacher-check">
                              <input
                                type="checkbox"
                                checked={(designationValues[field.label] ?? "") === "true"}
                                onChange={(e) =>
                                  setDesignationValues((prev) => ({
                                    ...prev,
                                    [field.label]: e.target.checked ? "true" : "false",
                                  }))
                                }
                              />
                              <em>{field.label}</em>
                            </span>
                          </label>
                        );
                      }
                      return (
                        <label key={field.label}>
                          <span>
                            {field.label}
                            {field.sublabel ? <em className="mh-teacher-sublabel"> · {field.sublabel}</em> : null}
                          </span>
                          {field.type === "textarea" ? (
                            <textarea
                              className="mh-teacher-field mh-teacher-field--tall"
                              rows={3}
                              value={designationValues[field.label] ?? ""}
                              onChange={(e) =>
                                setDesignationValues((prev) => ({ ...prev, [field.label]: e.target.value }))
                              }
                            />
                          ) : options.length > 0 || field.type === "select" ? (
                            <select
                              className="mh-teacher-field"
                              value={designationValues[field.label] ?? ""}
                              onChange={(e) =>
                                setDesignationValues((prev) => ({ ...prev, [field.label]: e.target.value }))
                              }
                            >
                              {!hasEmptyOption ? <option value="">Select…</option> : null}
                              {options.map((o) => (
                                <option key={`${o.value}-${o.label}`} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="mh-teacher-field"
                              type="text"
                              inputMode={field.type === "number" ? "decimal" : undefined}
                              value={designationValues[field.label] ?? ""}
                              onChange={(e) =>
                                setDesignationValues((prev) => ({ ...prev, [field.label]: e.target.value }))
                              }
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="mh-teacher-modal__foot">
              <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={saveDesignation}>
                {designationCfg.modal.submitLabel || "Save Designation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gradeEntryCfg ? (
        <section className="mh-teacher-card mh-teacher-grade-entries">
          <h2>Grade Entries</h2>
          <div className="mh-teacher-grade-entries__table">
            <div className="mh-teacher-grade-entries__head">
              <span>Letter</span>
              <span>Percent</span>
              <span>Grade Point</span>
              <span>Credit</span>
              <span>Condition</span>
              <span />
            </div>
            <div className="mh-teacher-grade-entries__row mh-teacher-grade-entries__row--draft">
              <input
                className="mh-teacher-field"
                aria-label="Letter"
                value={gradeDraft.letter}
                onChange={(e) => setGradeDraft((d) => ({ ...d, letter: e.target.value }))}
              />
              <div className="mh-teacher-grade-entries__percent">
                <input
                  className="mh-teacher-field"
                  aria-label="Percent"
                  inputMode="decimal"
                  value={gradeDraft.percent}
                  onChange={(e) => setGradeDraft((d) => ({ ...d, percent: e.target.value }))}
                />
                <span className="mh-teacher-grade-entries__up" title="Percent threshold / round-up margin">
                  <span aria-hidden>↑</span>
                  <input
                    className="mh-teacher-field mh-teacher-grade-entries__up-input"
                    aria-label="Percent up threshold"
                    inputMode="decimal"
                    value={gradeDraft.percentUp}
                    onChange={(e) => setGradeDraft((d) => ({ ...d, percentUp: e.target.value }))}
                  />
                </span>
              </div>
              <input
                className="mh-teacher-field"
                aria-label="Grade Point"
                inputMode="decimal"
                value={gradeDraft.gradePoint}
                onChange={(e) => setGradeDraft((d) => ({ ...d, gradePoint: e.target.value }))}
              />
              <select
                className="mh-teacher-field"
                aria-label="Credit"
                value={gradeDraft.credit}
                onChange={(e) => setGradeDraft((d) => ({ ...d, credit: e.target.value }))}
              >
                {creditOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="mh-teacher-field"
                aria-label="Condition"
                value={gradeDraft.condition}
                onChange={(e) => setGradeDraft((d) => ({ ...d, condition: e.target.value }))}
              >
                {conditionOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={addGradeEntry}>
                {gradeEntryCfg.addLabel || "Add"}
              </button>
            </div>
            {gradeEntries.map((entry, idx) => (
              <div key={`${entry.letter}-${idx}`} className="mh-teacher-grade-entries__row">
                <span>{entry.letter || "—"}</span>
                <span>
                  {entry.percent || "—"}
                  {entry.percentUp ? (
                    <em className="mh-teacher-grade-entries__up-meta">
                      {" "}
                      ↑ {entry.percentUp}
                    </em>
                  ) : null}
                </span>
                <span>{entry.gradePoint || "—"}</span>
                <span>{entry.credit || "—"}</span>
                <span>{entry.condition || "—"}</span>
                <button
                  type="button"
                  className="mh-teacher-link"
                  onClick={() => setGradeEntries((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {linkedCourseCfg ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-designation-head">
            <h2>{linkedCourseCfg.title || "Textbook Courses"}</h2>
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              onClick={() => {
                const option = (linkedCourseCfg.courseOptions ?? []).find((o) => o.value === linkedCoursePick);
                if (!option?.value) return;
                setLinkedCourses((prev) =>
                  prev.some((row) => row.id === option.value)
                    ? prev
                    : [...prev, { id: option.value, label: option.label }],
                );
                setLinkedCoursePick("");
              }}
            >
              {linkedCourseCfg.addLabel || "ADD"}
            </button>
          </div>
          <label className="mh-teacher-linked-course-pick">
            <span className="mh-teacher-sr-only">Course to add</span>
            <select
              className="mh-teacher-field"
              value={linkedCoursePick}
              onChange={(e) => setLinkedCoursePick(e.target.value)}
            >
              {(linkedCourseCfg.courseOptions ?? []).map((o) => (
                <option key={`${o.value}-${o.label}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {linkedCourses.length === 0 ? (
            <p className="mh-teacher-muted">{linkedCourseCfg.emptyLabel || "No courses linked yet."}</p>
          ) : (
            <ul className="mh-teacher-linked-courses">
              {linkedCourses.map((row) => (
                <li key={row.id}>
                  <span>{row.label}</span>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--danger"
                    onClick={() => setLinkedCourses((prev) => prev.filter((c) => c.id !== row.id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        {config.secondaryAction ? (
          config.secondaryActionHref ? (
            <ActionBtn label={config.secondaryAction} tone="secondary" href={config.secondaryActionHref} />
          ) : (
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              disabled={live?.busy || (isCreateStudent && !canSubmit)}
              onClick={() => void submit(config.secondaryAction || "Save as Draft")}
            >
              {config.secondaryAction}
            </button>
          )
        ) : null}
        <button
          type="button"
          className="mh-teacher-btn mh-teacher-btn--primary"
          disabled={live?.busy || !canSubmit}
          onClick={() => void submit(f.submitLabel || config.primaryAction || "Save Course")}
        >
          {live?.busy ? "Saving…" : f.submitLabel || config.primaryAction || "Save Course"}
        </button>
      </div>

      {config.programChangeHistory ? (
        <section className="mh-teacher-card" aria-labelledby="program-change-history-title">
          <div className="mh-teacher-card__head">
            <div>
              <h2 id="program-change-history-title">My submitted requests</h2>
              <p className="mh-teacher-muted">Status and decision updates made by Academic Administration.</p>
            </div>
            <span className="mh-teacher-badge is-muted">{config.programChangeHistory.rows.length}</span>
          </div>
          {config.programChangeHistory.rows.length ? (
            <div className="mh-teacher-list">
              {config.programChangeHistory.rows.map((request) => {
                const statusClass =
                  request.status === "Approved" || request.status === "Implemented"
                    ? "is-active"
                    : request.status === "Rejected"
                      ? "is-danger"
                      : request.status === "Submitted"
                        ? "is-review"
                        : "is-muted";
                return (
                  <article key={request.id} className="mh-teacher-list__item" style={{ alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong>{request.title}</strong>
                      <span>{request.programme} · {request.type || "Other"}</span>
                      <span>
                        Effective: {request.effectiveTerm || "Not specified"} · Submitted: {new Date(request.submittedAt).toLocaleString()}
                      </span>
                      {request.decisionNote ? <span><strong>Decision note:</strong> {request.decisionNote}</span> : null}
                      {request.history.length ? (
                        <details style={{ marginTop: 10 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Status history ({request.history.length})</summary>
                          <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "grid", gap: 8 }}>
                            {request.history.map((entry, index) => (
                              <li key={`${request.id}-${entry.at}-${index}`}>
                                <strong>{entry.status || entry.action}</strong>
                                <span> · {entry.actor} · {new Date(entry.at).toLocaleString()}</span>
                                {entry.note ? <div className="mh-teacher-muted">{entry.note}</div> : null}
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                    </div>
                    <span className={`mh-teacher-badge ${statusClass}`}>{request.status}</span>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mh-teacher-muted">No programme change requests submitted yet.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

function SplitPaneView({ config }: { config: TeacherScreenConfig }) {
  const s = config.splitPane;
  if (!s) return null;
  return (
    <div className="mh-teacher-split" data-figma-id={config.figmaId}>
      <aside className="mh-teacher-card">
        <h2>{s.leftTitle}</h2>
        <div className="mh-teacher-list">
          {s.leftItems.map((i) => (
            <div key={i.label} className={`mh-teacher-list__item${i.active ? " is-active" : ""}`}>
              <div>
                <strong>{i.label}</strong>
                <span>{i.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <section className="mh-teacher-card">
        <PageHead config={config} />
        <h2>{s.rightTitle}</h2>
        <div className="mh-teacher-fields">
          {s.rightFields.map((f) => (
            <label key={f.label}>
              <span>{f.label}</span>
              <div className="mh-teacher-field">{f.value}</div>
            </label>
          ))}
        </div>
        {s.resources ? (
          <div className="mh-teacher-list">
            {s.resources.map((r) => (
              <div key={r.name} className="mh-teacher-list__item">
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.type}</span>
                </div>
                <span className="mh-teacher-muted">{r.size}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function LecturesView({ config }: { config: TeacherScreenConfig }) {
  const l = config.lectures;
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const [scheduling, setScheduling] = useState(false);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  if (!l) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <p className="mh-teacher-muted">
          {live?.loading ? "Loading lectures…" : live?.error ? `Could not load lectures: ${live.error}` : "No lecture sessions for your sections yet."}
        </p>
      </div>
    );
  }
  const sessions = Array.isArray(l.sessions) ? l.sessions : [];
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} hideActions />
      <div className="mh-teacher-actions">
        <button type="button" className="mh-teacher-btn" onClick={() => setScheduling((open) => !open)}>
          {scheduling ? "Cancel" : "Schedule Lecture"}
        </button>
      </div>
      {scheduling ? (
        <section className="mh-teacher-card" style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label style={{ display: "grid", gap: 6 }}><span>Lecture title</span><input className="mh-teacher-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Weekly lecture" /></label>
          <label style={{ display: "grid", gap: 6 }}><span>Date and time</span><input className="mh-teacher-field" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={live?.busy || !startsAt}
            onClick={async () => {
              const ok = await live?.runAction?.("Schedule Lecture", JSON.stringify({ Title: title, StartsAt: new Date(startsAt).toISOString() }));
              if (ok) setScheduling(false);
            }}
          >
            {live?.busy ? "Scheduling…" : "Schedule and notify students"}
          </button>
        </section>
      ) : null}
      <p className="mh-teacher-muted">{l.course}</p>
      {sessions.length === 0 ? (
        <p className="mh-teacher-muted">No lecture sessions scheduled yet.</p>
      ) : (
        <div className="mh-teacher-list">
          {sessions.map((s, idx) => {
            const href = s.href || "";
            const external = /^https?:\/\//i.test(href);
            const label = /ready|launch/i.test(s.status || "") && external ? "Launch" : "Review";
            return (
              <div key={`${s.title}-${idx}`} className="mh-teacher-card mh-teacher-list__item">
                <div>
                  <strong>{s.title}</strong>
                  <span>
                    {s.when} · {s.duration}
                  </span>
                </div>
                <span className={badgeClass(s.tone)}>{s.status}</span>
                {href ? (
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--secondary"
                    onClick={() => {
                      if (external) window.open(href, "_blank", "noopener,noreferrer");
                      else router.push(href);
                    }}
                  >
                    {label}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="mh-teacher-btn mh-teacher-btn--secondary"
                    onClick={() => router.push("/instructor/f/in-09-lecture-review")}
                  >
                    Review
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function lectureSharePayload(review: NonNullable<TeacherScreenConfig["lectureReview"]>) {
  const highlights = (review.highlights ?? []).map((h) => `• ${h}`).join("\n");
  return JSON.stringify({
    sectionId: review.sectionId || undefined,
    title: `Lecture notes · ${review.title}`,
    body: [
      review.meta,
      "",
      review.transcript,
      highlights ? `\nHighlights:\n${highlights}` : "",
      review.aiNotes ? `\nInstructor notes:\n${review.aiNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim(),
  });
}

function LectureReviewView({ config }: { config: TeacherScreenConfig }) {
  const l = config.lectureReview;
  const live = useOptionalTeacherLive();
  const [sharedMsg, setSharedMsg] = useState<string | null>(null);

  async function shareWithClass() {
    if (!l || !live?.runAction) return;
    setSharedMsg(null);
    const ok = await live.runAction("Share with Class", lectureSharePayload(l));
    setSharedMsg(ok ? "Lecture notes shared with the class." : "Could not share lecture notes. Try again.");
  }

  if (!l) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} hideActions />
        <p className="mh-teacher-muted">
          {live?.loading
            ? "Loading lecture review…"
            : live?.error
              ? `Could not load lecture review: ${live.error}`
              : "No lecture review data yet. Open a completed lecture from Lectures."}
        </p>
        <ActionBtn label="Back to Lectures" href="/instructor/lectures" tone="secondary" />
      </div>
    );
  }
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} hideActions />
      <div className="mh-teacher-actions" style={{ marginBottom: 12 }}>
        <ActionBtn label="Back to Lectures" href="/instructor/lectures" tone="secondary" />
        <button
          type="button"
          className="mh-teacher-btn mh-teacher-btn--primary"
          disabled={live?.busy}
          onClick={() => void shareWithClass()}
        >
          {live?.busy ? "Sharing…" : "Share with Class"}
        </button>
      </div>
      {sharedMsg || live?.toast ? (
        <p className="mh-teacher-muted" style={{ color: "#0f766e", marginBottom: 12 }} aria-live="polite">
          {sharedMsg || live?.toast}
        </p>
      ) : null}
      <p className="mh-teacher-muted">{l.meta}</p>
      <section className="mh-teacher-card">
        <h2>{l.title}</h2>
        <p>{l.transcript}</p>
      </section>
      <section className="mh-teacher-card">
        <h2>Highlights</h2>
        <ul>
          {(l.highlights ?? []).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <p className="mh-teacher-muted">{l.aiNotes}</p>
      </section>
    </div>
  );
}

function LabSessionView({ config }: { config: TeacherScreenConfig }) {
  const l = config.labSession;
  const router = useRouter();
  const live = useOptionalTeacherLive();
  if (!l) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <p className="mh-teacher-muted">
          {live?.loading
            ? "Loading lab sessions…"
            : live?.error
              ? `Could not load labs: ${live.error}`
              : "No lab sessions for your sections yet."}
        </p>
      </div>
    );
  }
  const labs = Array.isArray(l.labs) ? l.labs : [];
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <p className="mh-teacher-muted">{l.course}</p>
      {labs.length === 0 ? (
        <p className="mh-teacher-muted">No lab sessions scheduled yet.</p>
      ) : (
        <div className="mh-teacher-list">
          {labs.map((lab, idx) => (
            <div key={`${lab.title}-${idx}`} className="mh-teacher-card mh-teacher-list__item">
              <div>
                <strong>{lab.title}</strong>
                <span>
                  {lab.when} · {lab.room} · {lab.capacity}
                </span>
              </div>
              <span className={badgeClass(lab.tone)}>{lab.status}</span>
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--secondary"
                onClick={() => router.push(lab.href || "/instructor/roster")}
              >
                Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalView({ config }: { config: TeacherScreenConfig }) {
  const a = config.approval;
  if (!a) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <p className="mh-teacher-muted">{a.course}</p>
      <div className="mh-teacher-stepper">
        {a.steps.map((s) => (
          <div key={s.label} className={`mh-teacher-stepper__step is-${s.state}`}>
            <span className="mh-teacher-stepper__dot" />
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="mh-teacher-split">
        <section className="mh-teacher-card">
          <h2>Summary</h2>
          <div className="mh-teacher-fields">
            {a.summary.map((f) => (
              <label key={f.label}>
                <span>{f.label}</span>
                <div className="mh-teacher-field">{f.value}</div>
              </label>
            ))}
          </div>
        </section>
        <section className="mh-teacher-card">
          <h2>Reviewers</h2>
          <div className="mh-teacher-list">
            {a.reviewers.map((r) => (
              <div key={r.name} className="mh-teacher-list__item">
                <div>
                  <strong>{r.name}</strong>
                  <span>{r.role}</span>
                </div>
                <span className={badgeClass("info")}>{r.status}</span>
              </div>
            ))}
          </div>
          <h3>Comments</h3>
          {a.comments.map((c) => (
            <div key={c.author + c.when} className="mh-teacher-announcements__item">
              <div className="mh-teacher-announcements__top">
                <strong>{c.author}</strong>
                <span>{c.when}</span>
              </div>
              <p>{c.body}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function ModalView({ config }: { config: TeacherScreenConfig }) {
  const m = config.modal;
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const field of m?.fields ?? []) init[field.label] = field.value;
    return init;
  });
  useEffect(() => {
    const init: Record<string, string> = {};
    for (const field of m?.fields ?? []) init[field.label] = field.value;
    setValues(init);
  }, [m]);
  if (!m) return null;
  const requiredFields = m.fields.filter((f) => f.required);
  const canSubmit = requiredFields.length
    ? requiredFields.every((f) => (values[f.label] ?? "").trim().length > 0)
    : Object.values(values).some((v) => v.trim().length > 0);
  return (
    <div
      className="mh-teacher-modal-backdrop"
      data-figma-id={config.figmaId}
      onClick={() => m.backdropHref && router.push(m.backdropHref)}
    >
      <div className="mh-teacher-card mh-teacher-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{m.title}</h2>
        <p>{m.description}</p>
        <div className="mh-teacher-fields">
          {m.fields.map((f) => (
            <label key={f.label}>
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
              {f.type === "select" && f.options ? (
                <select
                  className="mh-teacher-field"
                  value={values[f.label] ?? ""}
                  required={f.required}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  className="mh-teacher-field mh-teacher-field--tall"
                  value={values[f.label] ?? ""}
                  required={f.required}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                  rows={3}
                />
              ) : (
                <input
                  className="mh-teacher-field"
                  type="text"
                  value={values[f.label] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.label]: e.target.value }))}
                />
              )}
            </label>
          ))}
        </div>
        <div className="mh-teacher-actions">
          <ActionBtn label={m.cancelLabel} href={m.backdropHref} tone="secondary" />
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--primary"
            disabled={live?.busy || !canSubmit}
            onClick={() => {
              void (async () => {
                const ok = live?.runAction ? await live.runAction(m.confirmLabel, JSON.stringify(values)) : true;
                if (ok && m.backdropHref) router.push(m.backdropHref);
              })();
            }}
          >
            {live?.busy ? "Saving…" : m.confirmLabel}
          </button>
        </div>
        <button type="button" className="mh-teacher-link" onClick={() => m.backdropHref && router.push(m.backdropHref)}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ——— New Figma-parity screens ——— */

function AiStudioView({ config }: { config: TeacherScreenConfig }) {
  const data = config.aiStudio;
  const [tab, setTab] = useState(data?.activeTab || "Sources");
  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} badge="AI Studio" />
        <p className="mh-teacher-muted">AI studio data is not available for this section yet.</p>
      </div>
    );
  }
  return (
    <div className="mh-teacher-studio-hero" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card mh-teacher-studio-hero__banner">
        <div>
          <div className="mh-teacher-section__label">
            <img src="/brand/icons/sparkle.svg" alt="" width={16} height={16} />
            {data.eyebrow}
          </div>
          <h1>{data.courseTitle}</h1>
          <p className="mh-teacher-muted">{config.subtitle}</p>
        </div>
        <PageActions config={config} />
      </section>

      <div className="mh-teacher-split">
        <aside className="mh-teacher-drafts">
          <h2>Active Drafts</h2>
          {data.drafts.map((d) => (
            <div key={d.version} className="mh-teacher-card mh-teacher-drafts__item">
              <div className="mh-teacher-drafts__top">
                <strong>{d.version}</strong>
                <span className={badgeClass(d.tone)}>{d.status}</span>
              </div>
              {d.detail ? <p className="mh-teacher-muted">{d.detail}</p> : null}
            </div>
          ))}
        </aside>

        <section className="mh-teacher-card">
          <div className="mh-teacher-tabs">
            {data.tabs.map((t) => (
              <button
                key={t}
                type="button"
                className={`mh-teacher-tabs__item${tab === t ? " is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {tab === "Sources" ? (
            <div className="mh-teacher-sources">
              <h3>Active Knowledge Graph Sources</h3>
              {data.sources.map((s) => (
                <div key={s.name} className="mh-teacher-sources__row">
                  <span>{s.name}</span>
                  <strong className="mh-teacher-sources__status">{s.status}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mh-teacher-muted">{tab} workspace — switch to Sources for the knowledge graph.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function StudioGenerationView({ config }: { config: TeacherScreenConfig }) {
  const data = config.studioGeneration;
  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} badge="Studio" />
        <p className="mh-teacher-muted">Studio generation draft is not available yet.</p>
      </div>
    );
  }
  return (
    <div className="mh-teacher-gen" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <div className="mh-teacher-page-head__row">
            <h1>{data.wizardTitle}</h1>
            {data.badge ? <span className={badgeClass("info")}>{data.badge}</span> : null}
          </div>
          <p className="mh-teacher-muted">{config.subtitle}</p>
        </div>
      </div>
      <section className="mh-teacher-card">
        <div className="mh-teacher-stepper">
          {data.steps.map((s, i) => (
            <div key={s.label} className={`mh-teacher-stepper__step is-${s.state}`}>
              <span className="mh-teacher-stepper__dot">
                {s.state === "done" ? "✓" : String(i + 1)}
              </span>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mh-teacher-split">
        <aside className="mh-teacher-card mh-teacher-sources">
          <h2>Studio Progress</h2>
          <div className="mh-teacher-progress">
            <div className="mh-teacher-progress__meta">
              <strong>{data.progressLabel}</strong>
              <span>{data.progressPct}% Completed</span>
            </div>
            <div className="mh-teacher-progress__track">
              <div className="mh-teacher-progress__fill" style={{ width: `${data.progressPct}%` }} />
            </div>
          </div>
          <h3 className="mh-teacher-section__label">Active Sources</h3>
          {data.sources.map((s) => (
            <div key={s} className="mh-teacher-sources__row">
              <img src="/brand/icons/file-text.svg" alt="" width={14} height={14} />
              <span>{s}</span>
            </div>
          ))}
        </aside>
        <section className="mh-teacher-card mh-teacher-gen-cards">
          <div className="mh-teacher-card__head">
            <h2>Generated Syllabus Components</h2>
            <span className={badgeClass("info")}>Real-time Synthesis</span>
          </div>
          {data.cards.map((c) => (
            <article key={c.kind} className="mh-teacher-gen-card">
              <div className="mh-teacher-gen-card__top">
                <span className="mh-teacher-gen-card__kind">{c.kind}</span>
                {c.drafted ? <span className="mh-teacher-muted">{c.drafted}</span> : null}
              </div>
              {c.title ? <h3>{c.title}</h3> : null}
              {c.body ? <p>{c.body}</p> : null}
              <div className="mh-teacher-gen-card__cites">
                {c.citations.map((cite) => (
                  <div key={cite} className="mh-teacher-gen-card__cite">
                    <img src="/brand/icons/school.svg" alt="" width={14} height={14} />
                    <span>{cite}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

function OutcomeMappingView({ config }: { config: TeacherScreenConfig }) {
  const data = config.outcomeMapping;
  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} badge="Workspace" />
        <p className="mh-teacher-muted">Outcome mapping is not available for this section yet.</p>
      </div>
    );
  }
  return (
    <div className="mh-teacher-outcomes" data-figma-id={config.figmaId}>
      <PageHead config={config} badge="Workspace" />
      <div className="mh-teacher-split">
        <aside className="mh-teacher-card">
          <h2>Syllabus Outcomes</h2>
          {data.clos.map((c) => (
            <div key={c.id} className="mh-teacher-outcomes__clo">
              <div className="mh-teacher-card__head">
                <strong className="mh-teacher-outcomes__id">{c.id}</strong>
                <span className="mh-teacher-muted">Coverage</span>
              </div>
              <p>{c.label}</p>
              <div className="mh-teacher-progress__track">
                <div className="mh-teacher-progress__fill" style={{ width: `${c.coverage}%` }} />
              </div>
              <span className="mh-teacher-muted mh-teacher-outcomes__pct">{c.coverage}% mapped</span>
            </div>
          ))}
        </aside>
        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>Bloom&apos;s Taxonomy Map</h2>
            <span className="mh-teacher-muted">Drag outcome tags into cognitive level cells below</span>
          </div>
          <div className="mh-teacher-outcomes__bloom">
            {data.bloomRows.map((row) => {
              const tags = row.tags ?? row.cells?.flatMap((cell) => cell.tags) ?? [];
              return (
                <div key={row.level} className="mh-teacher-outcomes__bloom-row">
                  <div className="mh-teacher-outcomes__bloom-label">
                    <strong>{row.level}</strong>
                    {row.verb ? <span className="mh-teacher-muted">{row.verb}</span> : null}
                  </div>
                  <div className="mh-teacher-dropzone mh-teacher-outcomes__drop">
                    {tags.length ? (
                      tags.map((tag) => (
                        <span key={tag} className="mh-teacher-chip">
                          {tag}
                          <span aria-hidden>×</span>
                        </span>
                      ))
                    ) : (
                      <span className="mh-teacher-muted">No mapped outcomes. Drop here.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuestionGeneratorView({ config }: { config: TeacherScreenConfig }) {
  const data = config.questionGenerator;
  const [selected, setSelected] = useState<string[]>(() => data?.questions.map((q) => q.id) || []);
  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} badge="Generator Module" />
        <p className="mh-teacher-muted">Question generator data is not available yet.</p>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="mh-teacher-questions" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <div className="mh-teacher-page-head__row">
            <h2>{config.title}</h2>
            <span className={badgeClass("info")}>Generator Module</span>
          </div>
          <p>{config.subtitle}</p>
        </div>
      </div>
      <div className="mh-teacher-split">
        <aside className="mh-teacher-card mh-teacher-questions__config">
          <h2>Configuration Parameters</h2>
          <label>
            <span>Assessment Topic</span>
            <div className="mh-teacher-field">{data.topic}</div>
          </label>
          <label>
            <span>Target Difficulty</span>
            <div className="mh-teacher-field mh-teacher-field--select">{data.difficulty}</div>
          </label>
          <label>
            <span>Question Format</span>
            <div className="mh-teacher-field mh-teacher-field--select">{data.type}</div>
          </label>
          <div className="mh-teacher-card__head">
            <span>Generate Count</span>
            <strong className="mh-teacher-outcomes__id">{data.count}</strong>
          </div>
          <ActionBtn label="Generate Questions" rowKey={JSON.stringify({ Topic: data.topic })} />
        </aside>
        <section className="mh-teacher-card">
          <div className="mh-teacher-card__head">
            <h2>Generated Output</h2>
            <div className="mh-teacher-actions">
              <span className="mh-teacher-muted">{selected.length} selected</span>
              <ActionBtn label="Add to Question Bank" rowKey={JSON.stringify({ questions: data.questions.filter((q) => selected.includes(q.id)) })} tone="secondary" />
            </div>
          </div>
          <div className="mh-teacher-questions__list">
            {data.questions.map((q) => {
              const isOn = selected.includes(q.id);
              return (
                <article key={q.id} className={`mh-teacher-questions__item${isOn ? " is-selected" : ""}`}>
                  <div className="mh-teacher-card__head">
                    <div className="mh-teacher-questions__badges">
                      <span className={badgeClass("info")}>MCQ</span>
                      <span className={badgeClass("active")}>MEDIUM</span>
                    </div>
                    <button
                      type="button"
                      className={`mh-teacher-questions__checkbtn${isOn ? " is-on" : ""}`}
                      aria-pressed={isOn}
                      onClick={() => toggle(q.id)}
                    >
                      {isOn ? "✓" : ""}
                    </button>
                  </div>
                  <p className="mh-teacher-questions__prompt">{q.prompt}</p>
                  {q.options.length > 1 ? (
                    <div className="mh-teacher-questions__options">
                      {q.options.map((o) => (
                        <div
                          key={o.key}
                          className={`mh-teacher-questions__option${o.correct ? " is-correct" : ""}`}
                        >
                          {o.key}. {o.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function RubricGeneratorView({ config }: { config: TeacherScreenConfig }) {
  const data = config.rubricGenerator;
  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} badge="Rubric Tool" />
        <p className="mh-teacher-muted">Rubric generator data is not available yet.</p>
      </div>
    );
  }
  return (
    <div className="mh-teacher-rubric" data-figma-id={config.figmaId}>
      <PageHead config={config} badge="Rubric Tool" />
      <section className="mh-teacher-card">
        <h2>Rubric Dimensions matrix</h2>
        <div className="mh-teacher-rubric__grid">
          <div className="mh-teacher-rubric__head">
            <span>Criteria</span>
            <span>Excellent (4 pts)</span>
            <span>Proficient (3 pts)</span>
            <span>Developing (2 pts)</span>
            <span>Beginning (1 pt)</span>
          </div>
          {data.criteria.map((c) => (
            <div key={c.name} className="mh-teacher-rubric__row">
              <div>
                <strong>{c.name}</strong>
                <span className="mh-teacher-outcomes__id">Weight: {c.weight}</span>
              </div>
              <div className="mh-teacher-rubric__cell is-excellent">{c.excellent}</div>
              <div className="mh-teacher-rubric__cell">{c.proficient}</div>
              <div className="mh-teacher-rubric__cell">{c.developing}</div>
              <div className="mh-teacher-rubric__cell">{c.beginning}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MessagesView({ config }: { config: TeacherScreenConfig }) {
  const data = config.messages;
  const live = useOptionalTeacherLive();
  const router = useRouter();
  const threads = Array.isArray(data?.threads) ? data.threads : [];
  const threadKey = threads.map((t) => t?.id).filter(Boolean).join("|");
  const [activeId, setActiveId] = useState(data?.activeThreadId || threads[0]?.id || "");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!threads.length) {
      setActiveId((prev) => (prev ? "" : prev));
      return;
    }
    setActiveId((prev) => {
      if (threads.some((t) => t?.id === prev)) return prev;
      return data?.activeThreadId || threads[0]?.id || "";
    });
  }, [threadKey, data?.activeThreadId]);

  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <p className="mh-teacher-muted">
          {live?.loading
            ? "Loading messages…"
            : live?.error
              ? `Could not load messages: ${live.error}`
              : "No message threads yet. Students can start a secure conversation from their portal."}
        </p>
      </div>
    );
  }

  const active = threads.find((t) => t?.id === activeId) || threads[0];
  const chat = (Array.isArray(active?.chat) ? active.chat : null) ??
    (Array.isArray(data.chat) ? data.chat : []) ??
    [];
  const safeChat = chat.filter((item): item is NonNullable<typeof item> => Boolean(item && typeof item === "object"));
  const ctx = active?.context ?? data.context;
  const canSend = Boolean(active?.id && draft.trim() && !live?.busy);

  async function sendMessage() {
    if (!active?.id || !draft.trim() || !live?.runAction) return;
    const body = draft.trim();
    const ok = await live.runAction("Send", JSON.stringify({ threadId: active.id, body }));
    if (ok) setDraft("");
  }

  return (
    <div className="mh-teacher-chat" data-figma-id={config.figmaId}>
      <aside className="mh-teacher-chat__threads">
        <div className="mh-teacher-chat__threads-head">Inbox</div>
        {threads.length === 0 ? (
          <p className="mh-teacher-muted" style={{ padding: "16px" }}>
            No threads yet.
          </p>
        ) : (
          threads.map((t, idx) => (
            <button
              key={t.id || `thread-${idx}`}
              type="button"
              className={`mh-teacher-chat__thread${active && t.id === active.id ? " is-active" : ""}`}
              onClick={() => t.id && setActiveId(t.id)}
            >
              <div className="mh-teacher-chat__thread-top">
                <strong className="mh-teacher-chat__thread-name">{t.name || "Conversation"}</strong>
                <span className="mh-teacher-chat__thread-meta">{t.time || ""}</span>
              </div>
              <span className="mh-teacher-chat__thread-meta">{t.role || "Participant"}</span>
              <p className="mh-teacher-chat__thread-preview">{t.preview || ""}</p>
              {t.unread ? <span className="mh-teacher-chat__unread">{t.unread}</span> : null}
            </button>
          ))
        )}
      </aside>

      <section className="mh-teacher-chat__conversation">
        <div className="mh-teacher-chat__conv-head">
          <div>
            <strong>{active?.name || "Select a thread"}</strong>
            <span className="mh-teacher-chat__thread-meta">{active?.role || "Messages"}</span>
          </div>
        </div>
        <div className="mh-teacher-chat__messages">
          {safeChat.length === 0 ? (
            <p className="mh-teacher-muted">No messages in this thread yet.</p>
          ) : (
            safeChat.map((item, i) => {
              if (!("kind" in item) || !item.kind) return null;
              if (item.kind === "attachment") {
                return (
                  <div key={`att-${item.name || i}-${i}`} className="mh-teacher-chat__message">
                    <div className="mh-teacher-chat__attachment">
                      <img src="/brand/icons/file-text.svg" alt="" width={16} height={16} />
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {item.size} · {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              if (item.kind === "system") {
                return (
                  <div key={`sys-${i}`} className="mh-teacher-chat__message is-system">
                    {item.text}
                  </div>
                );
              }
              if (item.kind !== "message") return null;
              return (
                <div
                  key={`msg-${i}-${item.time || i}`}
                  className={`mh-teacher-chat__message${item.from === "me" ? " is-reply" : ""}`}
                >
                  <p>{item.text}</p>
                  <span className="mh-teacher-chat__message-time">{item.time}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="mh-teacher-chat__composer">
          <input
            type="text"
            placeholder="Write a secure reply…"
            aria-label="Message"
            value={draft}
            disabled={!active?.id || live?.busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            disabled={!canSend}
            onClick={() => void sendMessage()}
          >
            Send
          </button>
        </div>
        {live?.toast ? <p className="mh-teacher-chat__toast">{live.toast}</p> : null}
      </section>

      <aside className="mh-teacher-chat__context">
        <div className="mh-teacher-chat__context-section">
          <h3>Student Context</h3>
          <div className="mh-teacher-chat__stat">
            <span>Program</span>
            <strong>{ctx?.program || "—"}</strong>
          </div>
          <div className="mh-teacher-chat__stat">
            <span>Current Grade</span>
            <strong>
              {ctx?.grade || "—"} · {ctx?.gradePct || "—"}
            </strong>
          </div>
          <div className={`mh-teacher-chat__stat${/risk|warn/i.test(ctx?.attendanceTone || "") ? " is-danger" : ""}`}>
            <span>Attendance</span>
            <strong>
              {ctx?.attendance || "—"}
              {ctx?.attendanceTone ? ` · ${ctx.attendanceTone}` : ""}
            </strong>
          </div>
          <div className="mh-teacher-chat__stat">
            <span>Missing work</span>
            <strong>{ctx?.missing || "—"}</strong>
          </div>
        </div>

        <div className="mh-teacher-chat__context-section">
          <h3>Shared files</h3>
          {(ctx?.sharedFiles ?? []).length === 0 ? (
            <p>No shared files.</p>
          ) : (
            (ctx?.sharedFiles ?? []).map((f) => (
              <div key={f.name} className="mh-teacher-chat__stat">
                <span>{f.name}</span>
                <strong>{f.size}</strong>
              </div>
            ))
          )}
        </div>

        <div className="mh-teacher-chat__context-actions">
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            onClick={() =>
              router.push(
                active?.studentId
                  ? `/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(active.studentId)}`
                  : "/instructor/f/t12-students-view",
              )
            }
          >
            View Student Profile
          </button>
          <button
            type="button"
            className="mh-teacher-btn"
            disabled={live?.busy || !active?.name}
            onClick={() =>
              void live?.runAction?.(
                "Create academic alert",
                JSON.stringify({
                  "Student Name": active?.name || "",
                  "Flag Type": "Academic Advising",
                  Priority: "Medium",
                  Notes: `Flagged from messages thread with ${active?.name || "student"}`,
                }),
              )
            }
          >
            Flag for Academic Advisor
          </button>
        </div>
      </aside>
    </div>
  );
}

function notifIcon(category: string, explicit?: string) {
  if (explicit) return `/brand/icons/${explicit}.svg`;
  const key = category.toLowerCase();
  if (key.includes("attend")) return "/brand/icons/user-check.svg";
  if (key.includes("assign") || key.includes("grad")) return "/brand/icons/file-text.svg";
  if (key.includes("system")) return "/brand/icons/bell.svg";
  if (key.includes("message") || key.includes("chat")) return "/brand/icons/user.svg";
  if (key.includes("calendar") || key.includes("sched")) return "/brand/icons/calendar.svg";
  return "/brand/icons/bell.svg";
}

function NotificationsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.notifications;
  const filters = data?.filters ?? [{ label: "All Alerts" }, { label: "Unread" }];
  const [filter, setFilter] = useState(filters[0]?.label || "All Alerts");
  const [readIds, setReadIds] = useState<string[]>([]);
  if (!data) return null;

  const rawItems = data.items ?? [];
  const keyOf = (i: { id?: string; title: string }) => i.id || i.title;
  const items =
    filter === "All Alerts"
      ? rawItems
      : filter === "Unread"
        ? rawItems.filter((i) => i.unread && !readIds.includes(keyOf(i)))
        : rawItems.filter((i) => i.category === filter || i.category === filter.replace(/s$/, ""));

  function markRead(item: { id?: string; title: string }) {
    const key = keyOf(item);
    setReadIds((prev) => (prev.includes(key) ? prev : [...prev, key]));
    if (item.id) void live?.runAction?.("Mark notification read", item.id);
  }

  function markAllRead() {
    setReadIds(rawItems.map(keyOf));
    void live?.runAction?.("Mark All as Read");
  }

  return (
    <div className="mh-teacher-notif" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <div className="mh-teacher-page-head__row">
            <h2>Notifications</h2>
          </div>
          <p>{config.subtitle || "Alerts and updates about your courses, students and account."}</p>
        </div>
        <div className="mh-teacher-actions mh-teacher-notif__actions">
          <button type="button" className="mh-teacher-btn mh-teacher-btn--dark" onClick={markAllRead} disabled={live?.busy}>
            Mark All as Read
          </button>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--violet"
            onClick={() => void live?.runAction?.("Notification Preferences")}
          >
            Notification Preferences
          </button>
        </div>
      </div>

      <div className="mh-teacher-notif__bar">
        <div className="mh-teacher-notif__filters">
          {filters.map((f) => {
            const label = typeof f.count === "number" ? `${f.label} (${f.count})` : f.label;
            return (
              <button
                key={f.label}
                type="button"
                className={`mh-teacher-notif__filter${filter === f.label ? " is-active" : ""}`}
                onClick={() => setFilter(f.label)}
              >
                {label}
              </button>
            );
          })}
        </div>
        {data.termLabel ? <span className="mh-teacher-notif__term">{data.termLabel}</span> : null}
      </div>

      <div className="mh-teacher-notif__list">
        {items.length === 0 ? <p className="mh-teacher-muted">No notifications in this view.</p> : null}
        {items.map((n, idx) => {
          const unread = Boolean(n.unread) && !readIds.includes(keyOf(n));
          return (
            <article key={n.id || `${n.title}-${idx}`} className={`mh-teacher-notif__card${unread ? " is-unread" : ""}`}>
              <div className="mh-teacher-notif__icon">
                <img src={notifIcon(n.category, n.icon)} alt="" width={18} height={18} />
              </div>
              <div className="mh-teacher-notif__body">
                <div className="mh-teacher-notif__title-row">
                  <h3 className="mh-teacher-notif__title">{n.title}</h3>
                  <span className="mh-teacher-notif__time">{n.when}</span>
                </div>
                <p className="mh-teacher-notif__text">{n.body}</p>
                {n.cta ? (
                  <button
                    type="button"
                    className="mh-teacher-notif__cta"
                    onClick={() => (n.href ? router.push(n.href) : undefined)}
                  >
                    {n.cta}
                    <img src="/brand/icons/chevron-right.svg" alt="" width={12} height={12} />
                  </button>
                ) : null}
              </div>
              <div className="mh-teacher-notif__aside">
                {unread ? <span className="mh-teacher-notif__dot" aria-label="Unread" /> : null}
                <button
                  type="button"
                  className="mh-teacher-notif__check"
                  aria-label={unread ? "Mark as read" : "Read"}
                  onClick={() => markRead(n)}
                >
                  <img src="/brand/icons/check-circle.svg" alt="" width={14} height={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mh-teacher-notif__pager">
        <span>{data.pagination}</span>
      </div>
    </div>
  );
}

function TimetableView({ config }: { config: TeacherScreenConfig }) {
  const data = config.timetable;
  const views = data?.views ?? ["Week"];
  const filters = data?.filters ?? ["Show All"];
  const [view, setView] = useState(data?.activeView || views[0] || "Week");
  const [filter, setFilter] = useState(filters[0] || "Show All");
  if (!data) return null;

  return (
    <div className="mh-teacher-cal" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <div className="mh-teacher-section__label">{data.termLabel}</div>
          <h2>{data.rangeLabel}</h2>
          <p>{config.subtitle}</p>
        </div>
        <div className="mh-teacher-cal__views">
          {views.map((v) => (
            <button
              key={v}
              type="button"
              className={`mh-teacher-tabs__item${view === v ? " is-active" : ""}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="mh-teacher-filters">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            className={`mh-teacher-chip${filter === f ? " is-active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="mh-teacher-cal__grid">
        {(data.days ?? []).map((day) => (
          <div key={day.label} className="mh-teacher-cal__day">
            <div className="mh-teacher-cal__day-head">
              <strong>{day.label}</strong>
              <span>{day.date}</span>
            </div>
            {day.events
              .filter((e) => {
                if (filter === "Show All") return true;
                if (filter === "Classes") return e.tone === "blue" || e.tone === "purple";
                if (filter === "Office Hours") return e.tone === "green";
                if (filter === "Committees" || filter === "Deadlines") return e.tone === "orange";
                return true;
              })
              .map((e, idx) => (
                <div key={e.id || `${e.title}-${e.time}-${idx}`} className={`mh-teacher-cal__event is-${e.tone}`}>
                  <strong>{e.title}</strong>
                  <span>{e.time}</span>
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function fileKindLabel(name: string, mimeOrType?: string) {
  const raw = `${name} ${mimeOrType ?? ""}`.toLowerCase();
  if (raw.includes("pdf")) return "PDF";
  if (raw.includes("ppt") || raw.includes("slide")) return "Slides";
  if (raw.includes("xls") || raw.includes("sheet") || raw.includes("csv")) return "Sheet";
  if (raw.includes("doc") || raw.includes("word")) return "Doc";
  if (raw.includes("png") || raw.includes("jpg") || raw.includes("jpeg") || raw.includes("image")) return "Image";
  if (raw.includes("mp4") || raw.includes("video")) return "Video";
  return mimeOrType && mimeOrType.length < 12 ? mimeOrType : "File";
}

/** Shared fallback so missing files/tree keep a stable identity for the sync effect below. */
const NO_ITEMS: never[] = [];

function FileManagerView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const data = config.fileManager;
  const files = data?.files ?? NO_ITEMS;
  const tree = data?.tree ?? NO_ITEMS;
  const breadcrumbs = data?.breadcrumbs ?? ["Files"];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFolder, setActiveFolder] = useState(() => tree.find((n) => n.active)?.name || tree[0]?.name || "All files");
  const [selected, setSelected] = useState<string[]>(() => files.filter((f) => f.selected).map((f) => f.name));
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [localFiles, setLocalFiles] = useState(files);
  const [localTree, setLocalTree] = useState(tree);

  useEffect(() => {
    setLocalFiles(files);
    setLocalTree(tree);
    setActiveFolder((current) => {
      if (tree.some((n) => n.name === current)) return current;
      return tree.find((n) => n.active)?.name || tree[0]?.name || "All files";
    });
  }, [files, tree]);

  if (!data) {
    return (
      <div className="mh-teacher-files">
        <p className="mh-teacher-muted">No course files are available for this section yet.</p>
      </div>
    );
  }

  const visibleFiles = localFiles.filter((f) => !f.folder || f.folder === activeFolder || activeFolder === "All files");

  function toggle(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  }

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!picked.length) return;
    const uploaded = picked.map((file) => ({
      name: file.name,
      type: fileKindLabel(file.name, file.type),
      size: file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
      updated: "Just now",
      visibility: "Hidden" as const,
      folder: activeFolder === "All files" ? "Uploads" : activeFolder,
    }));
    setLocalFiles((current) => [...uploaded, ...current]);
    setSelected(uploaded.map((f) => f.name));
    for (const file of uploaded) {
      await live?.runAction?.("Upload Files", JSON.stringify(file));
    }
  }

  async function onCreateFolder(event: FormEvent) {
    event.preventDefault();
    const name = folderDraft.trim();
    if (!name) return;
    if (!localTree.some((n) => n.name.toLowerCase() === name.toLowerCase())) {
      setLocalTree((current) => [{ name, children: [], active: true }, ...current.map((n) => ({ ...n, active: false }))]);
    }
    setActiveFolder(name);
    setFolderDraft("");
    setAddingFolder(false);
    await live?.runAction?.("Create Folder", JSON.stringify({ name }));
  }

  return (
    <div className="mh-teacher-files" data-figma-id={config.figmaId}>
      <div className="mh-teacher-files__toolbar">
        <div>
          <nav className="mh-teacher-files__breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb}>
                {index > 0 ? " / " : ""}
                {index === breadcrumbs.length - 1 ? <strong>{crumb}</strong> : crumb}
              </span>
            ))}
          </nav>
          <h2 style={{ margin: "6px 0 0" }}>{data.courseTitle}</h2>
          <p className="mh-teacher-muted" style={{ margin: "4px 0 0" }}>
            {config.subtitle}
          </p>
        </div>
        <div className="mh-teacher-actions">
          {addingFolder ? (
            <form className="mh-teacher-files__folder-form" onSubmit={(event) => void onCreateFolder(event)}>
              <input
                value={folderDraft}
                onChange={(event) => setFolderDraft(event.target.value)}
                placeholder="Folder name"
                aria-label="Folder name"
                autoFocus
              />
              <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={live?.busy || !folderDraft.trim()}>
                Save
              </button>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setAddingFolder(false)}>
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setAddingFolder(true)}>
              Create Folder
            </button>
          )}
          <input ref={fileInputRef} type="file" hidden multiple onChange={(event) => void onUpload(event)} />
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--primary"
            disabled={live?.busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload Files
          </button>
        </div>
      </div>

      <div className="mh-teacher-files__layout">
        <aside className="mh-teacher-files__tree">
          <h2>Course directory</h2>
          <button
            type="button"
            className={`mh-teacher-files__tree-item${activeFolder === "All files" ? " is-active" : ""}`}
            onClick={() => setActiveFolder("All files")}
          >
            All files
          </button>
          {localTree.map((node) => (
            <div key={node.name}>
              <button
                type="button"
                className={`mh-teacher-files__tree-item${activeFolder === node.name ? " is-active" : ""}`}
                onClick={() => setActiveFolder(node.name)}
              >
                {node.name}
              </button>
              {node.children?.length ? (
                <div className="mh-teacher-files__tree-children">
                  {node.children.map((child) => (
                    <div key={child} className="mh-teacher-files__tree-child">
                      {child}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </aside>

        <section>
          <div className="mh-teacher-files__table">
            <div className="mh-teacher-files__table-head">
              <span />
              <span>Name</span>
              <span>Type</span>
              <span>Size</span>
              <span>Updated</span>
              <span>Visibility</span>
            </div>
            {visibleFiles.length === 0 ? (
              <p className="mh-teacher-files__empty">
                {live?.loading ? "Loading course files…" : `No files in ${activeFolder} yet. Upload a file or choose another folder.`}
              </p>
            ) : (
              visibleFiles.map((file) => (
                <label
                  key={`${file.folder ?? ""}:${file.name}`}
                  className={`mh-teacher-files__row${selected.includes(file.name) ? " is-selected" : ""}`}
                >
                  <input type="checkbox" checked={selected.includes(file.name)} onChange={() => toggle(file.name)} />
                  <strong>{file.name}</strong>
                  <span>{fileKindLabel(file.name, file.type)}</span>
                  <span>{file.size}</span>
                  <span>{file.updated}</span>
                  <span className={`mh-teacher-files__visibility ${file.visibility === "Published" ? "is-published" : "is-hidden"}`}>
                    {file.visibility}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="mh-teacher-files__upload">
            <button type="button" className="mh-teacher-dropzone" onClick={() => fileInputRef.current?.click()}>
              <img src="/brand/icons/file-text.svg" alt="" width={18} height={18} />
              <p>
                <strong>Drop files here or click to upload</strong>
                PDF, slides, sheets, and documents for this section.
              </p>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function HelpSupportView({ config }: { config: TeacherScreenConfig }) {
  const data = config.helpSupport;
  const live = useOptionalTeacherLive();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(data?.topics[0]?.title || "General");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const topics = data?.topics ?? [];
    const first = topics[0]?.title;
    if (!first) return;
    setCategory((current) => (topics.some((t) => t.title === current) ? current : first));
  }, [data]);

  if (!data) {
    return <p className="mh-teacher-muted">Support center is loading…</p>;
  }

  const topics = data.topics;
  const tickets = data.tickets;
  const openCount = data.tickets.filter((t) => !/resolved|closed/i.test(t.status)).length;

  async function consult(event?: FormEvent) {
    event?.preventDefault();
    const text = query.trim();
    if (!text) return;
    if (!live?.runAction) return;
    await live.runAction("Consult AI", JSON.stringify({ query: text }));
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !details.trim() || !live?.runAction) return;
    const ok = await live.runAction(
      "Submit Ticket",
      JSON.stringify({
        Category: category,
        Subject: subject.trim(),
        Details: details.trim(),
      }),
    );
    if (ok) {
      setSubject("");
      setDetails("");
    }
  }

  function pickTopic(title: string) {
    setCategory(title);
    if (!subject.trim()) setSubject(title);
  }

  async function openGuide(name: string) {
    if (!live?.runAction) return;
    await live.runAction("Consult AI", JSON.stringify({ query: name }));
  }

  return (
    <div className="mh-teacher-help" data-figma-id={config.figmaId}>
      <div className="mh-teacher-help__main">
        <section className="mh-teacher-help__hero">
          <div className="mh-teacher-section__label">FACULTY SUPPORT CENTER</div>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
          <form className="mh-teacher-help__search" onSubmit={(event) => void consult(event)}>
            <img src="/brand/icons/search.svg" alt="" width={14} height={14} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about gradebook, attendance, studio, or security…"
              aria-label="Search help or consult AI"
            />
            <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={live?.busy || !query.trim()}>
              Ask AI
            </button>
          </form>
          {data.aiReply?.answer ? (
            <article className="mh-teacher-help__ai" aria-live="polite">
              <strong>AI consult</strong>
              {data.aiReply.query ? <span>Re: {data.aiReply.query}</span> : null}
              <p>{data.aiReply.answer}</p>
            </article>
          ) : null}
        </section>

        <div className="mh-teacher-help__stats">
          <div>
            <strong>{openCount}</strong>
            <span>Open tickets</span>
          </div>
          <div>
            <strong>{data.topics.length}</strong>
            <span>Help topics</span>
          </div>
          <div>
            <strong>{data.hours || "Mon–Fri"}</strong>
            <span>Support hours</span>
          </div>
        </div>

        <div className="mh-teacher-help__topics">
          {topics.length === 0 ? (
            <p className="mh-teacher-muted">Help topics will appear here.</p>
          ) : (
            topics.map((t) => (
              <button
                key={t.title}
                type="button"
                className={`mh-teacher-help__topic${t.title === category ? " is-active" : ""}`}
                onClick={() => pickTopic(t.title)}
              >
                {t.icon ? (
                  <span className="mh-teacher-help__topic-icon">
                    <img src={`/brand/icons/${t.icon}.svg`} alt="" width={18} height={18} />
                  </span>
                ) : null}
                <h3>{t.title}</h3>
                <p>{t.detail}</p>
              </button>
            ))
          )}
        </div>

        <section className="mh-teacher-help__ticket-panel">
          <div className="mh-teacher-help__ticket-head">
            <h2>Your tickets</h2>
            <span>{tickets.length} total</span>
          </div>
          <div className="mh-teacher-help__tickets">
            {tickets.length === 0 ? (
              <p className="mh-teacher-muted">No tickets yet. Use the form to open a secure request.</p>
            ) : (
              tickets.map((t) => (
                <article key={t.id} className="mh-teacher-help__ticket">
                  <div>
                    <span className="mh-teacher-help__ticket-id">{t.id}</span>
                    <strong>{t.subject}</strong>
                    {t.updated ? <span className="mh-teacher-help__ticket-meta">{t.updated}</span> : null}
                  </div>
                  <span className={badgeClass(t.tone)}>{t.status}</span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <aside className="mh-teacher-help__side">
        <form className="mh-teacher-help__form" onSubmit={(event) => void submitTicket(event)}>
          <h3>Open a secure ticket</h3>
          <p className="mh-teacher-help__form-lead">Registrar and IT receive this with your instructor context.</p>
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Ticket category">
              {(data.topics.length ? data.topics.map((t) => t.title) : ["General"]).map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              aria-label="Ticket subject"
            />
          </label>
          <label>
            Details
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What you tried, course/section, and what failed."
              rows={5}
              aria-label="Ticket details"
            />
          </label>
          <button
            type="submit"
            className="mh-teacher-btn mh-teacher-btn--primary mh-teacher-btn--block"
            disabled={live?.busy || !subject.trim() || !details.trim()}
          >
            {live?.busy ? "Submitting…" : "Submit ticket"}
          </button>
        </form>

        <div className="mh-teacher-help__refs">
          <h4>Faculty guides</h4>
          {data.references.map((r) => (
            <button key={r.name} type="button" className="mh-teacher-help__ref-link" onClick={() => void openGuide(r.name)}>
              <strong>{r.name}</strong>
              <span>{r.meta}</span>
            </button>
          ))}
        </div>

        {data.contacts?.length ? (
          <div className="mh-teacher-help__contacts">
            <h4>Direct contacts</h4>
            {data.contacts.map((c) => (
              <p key={c.label}>
                <span>{c.label}</span>
                <a href={`mailto:${c.value}`}>{c.value}</a>
              </p>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function SyllabusDiffView({ config }: { config: TeacherScreenConfig }) {
  const d = config.syllabusDiff;
  if (!d) return null;
  if (!d.current.length && !d.proposed.length) {
    return (
      <div className="mh-teacher-stack mh-teacher-syllabus" data-figma-id={config.figmaId}>
        <PageHead config={config} badge={d.badge} />
        <section className="mh-teacher-card">
          <p className="mh-teacher-muted">{d.emptyMessage || "There is nothing to review yet."}</p>
        </section>
      </div>
    );
  }
  return (
    <div className="mh-teacher-stack mh-teacher-syllabus" data-figma-id={config.figmaId}>
      <PageHead config={config} badge={d.badge} />
      <div className="mh-teacher-syllabus__grid">
        <div className="mh-teacher-syllabus__main">
          <section className="mh-teacher-card">
            <h2>{d.currentTitle}</h2>
            <div className="mh-teacher-syllabus__fields">
              {d.current.map((f, i) => (
                <div key={`${f.label}-${i}`}>
                  <strong>{f.label}</strong>
                  <p>{f.value}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="mh-teacher-card">
            <h2 className="mh-teacher-syllabus__proposed">{d.proposedTitle}</h2>
            <div className="mh-teacher-syllabus__fields">
              {d.proposed.map((f, i) => (
                <div key={`${f.label}-${i}`}>
                  <strong>{f.label}</strong>
                  {f.removed ? <p className="mh-teacher-diff-block is-removed">{f.removed}</p> : null}
                  {f.added ? <p className="mh-teacher-diff-block is-added">{f.added}</p> : null}
                  {f.value ? <p>{f.value}</p> : null}
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="mh-teacher-card mh-teacher-syllabus__comments">
          <h2>Review Comments ({d.comments.length})</h2>
          {d.comments.length === 0 ? <p className="mh-teacher-muted">No reviewer comments yet.</p> : null}
          {d.comments.map((c, i) => (
            <article key={`${c.author}-${c.when}-${i}`} className="mh-teacher-comment">
              <div className="mh-teacher-comment__head">
                <strong>{c.author}</strong>
                <span>{c.when}</span>
              </div>
              <span className="mh-teacher-comment__role">{c.role}</span>
              <p>{c.body}</p>
            </article>
          ))}
        </aside>
      </div>
    </div>
  );
}

function WorkshopsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const w = config.workshops;
  const live = useOptionalTeacherLive();
  if (!w) return null;
  const tabs = w.tabs ?? ["My Workshops"];
  const cards = w.cards ?? [];
  const registrations = w.registrations ?? [];
  function tabHref(tab: string) {
    if (/available/i.test(tab)) return "/instructor/f/t11-workshops?list=available";
    if (/completed/i.test(tab)) return "/instructor/f/t11-workshops?list=completed";
    return "/instructor/f/t11-workshops?list=mine";
  }
  return (
    <div className="mh-teacher-stack mh-teacher-workshops" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <div className="mh-teacher-workshops__top">
        <div className="mh-teacher-tabs" role="tablist" aria-label="Workshop lists">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={tab === w.activeTab}
              className={`mh-teacher-tabs__item${tab === w.activeTab ? " is-active" : ""}`}
              onClick={() => router.push(tabHref(tab))}
            >
              {tab}
            </button>
          ))}
        </div>
        {w.credits ? <p className="mh-teacher-workshops__credits">{w.credits}</p> : null}
      </div>
      <PageActions config={config} />
      <div className="mh-teacher-workshops__grid">
        <div className="mh-teacher-workshops__list">
          {live?.loading ? (
            <div className="mh-teacher-workshops__empty" role="status">Loading workshops…</div>
          ) : null}
          {!live?.loading && cards.length === 0 ? (
            <div className="mh-teacher-workshops__empty">
              <strong>No workshops were found</strong>
              <span>Try another tab or check again after a workshop is assigned.</span>
            </div>
          ) : null}
          {cards.map((card) => (
            <article
              key={card.href || card.title}
              className="mh-teacher-workshop-card is-clickable"
              role="link"
              tabIndex={0}
              onClick={() => router.push(card.href || "/instructor/f/t24-workshop-detail")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(card.href || "/instructor/f/t24-workshop-detail");
                }
              }}
            >
              <div className="mh-teacher-workshop-card__top">
                <div className="mh-teacher-workshop-card__tags">
                  <span className={badgeClass("info")}>{card.tag}</span>
                  <span>{card.org}</span>
                </div>
                <span className={badgeClass("active")}>{card.seats}</span>
              </div>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <div className="mh-teacher-workshop-card__meta">
                <span>
                  <img src="/brand/icons/calendar.svg" alt="" width={14} height={14} />
                  {card.when}
                </span>
                <span>
                  <img src="/brand/icons/school.svg" alt="" width={14} height={14} />
                  {card.where}
                </span>
              </div>
              <div className="mh-teacher-workshop-card__foot">
                <Link
                  href={card.href || "/instructor/f/t24-workshop-detail"}
                  className="mh-teacher-btn"
                  role="button"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Workshop
                </Link>
              </div>
            </article>
          ))}
        </div>
        <aside className="mh-teacher-workshops__aside" aria-label="My workshop summary">
          <div className="mh-teacher-workshops__aside-head">
            <div>
              <span>YOUR WORKSHOPS</span>
              <strong>{registrations.length}</strong>
            </div>
            <img src="/brand/icons/calendar.svg" alt="" width={20} height={20} />
          </div>
          {registrations.length ? (
            <ul>
              {registrations.map((registration, index) => (
                <li key={`${registration.title}-${registration.when}-${index}`}>
                  <strong>{registration.title}</strong>
                  <span>{registration.when}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No active workshop registrations.</p>
          )}
          <Link href="/instructor/f/t40-workshop-enrollment-status" className="mh-teacher-btn mh-teacher-btn--secondary">
            Manage enrolments
          </Link>
        </aside>
      </div>
    </div>
  );
}

function SisCrumb({ crumbs }: { crumbs?: string[] }) {
  if (!crumbs?.length) return null;
  return (
    <nav className="mh-sis-crumb" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb}-${index}`}>
          {index > 0 ? <span className="mh-sis-crumb__sep">›</span> : null}
          {index === 0 ? (
            <a href="/instructor">{crumb}</a>
          ) : (
            <span className={index === crumbs.length - 1 ? "is-current" : undefined}>{crumb}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

const ALPHA_LETTERS = ["ALL", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

function WorkshopEnrolmentsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const live = useOptionalTeacherLive();
  const data = config.workshopEnrolments;
  const [student, setStudent] = useState(data?.studentValue || "");
  const [workshop, setWorkshop] = useState(data?.workshopValue || "");
  const [status, setStatus] = useState(data?.statusValue || "pending");

  useEffect(() => {
    setStudent(data?.studentValue || "");
    setWorkshop(data?.workshopValue || "");
    setStatus(data?.statusValue || "pending");
  }, [data?.studentValue, data?.workshopValue, data?.statusValue]);

  if (!data) return null;

  function pushFilters(next: { student?: string; workshop?: string; status?: string; letter?: string }) {
    const qs = new URLSearchParams();
    const studentVal = next.student ?? student;
    const workshopVal = next.workshop ?? workshop;
    const statusVal = next.status ?? status;
    const letterVal = next.letter ?? data?.letter ?? "ALL";
    if (studentVal.trim()) qs.set("student", studentVal.trim());
    if (workshopVal) qs.set("workshop", workshopVal);
    qs.set("status", statusVal || "pending");
    if (letterVal && letterVal !== "ALL") qs.set("letter", letterVal);
    router.push(`/instructor/f/t40-workshop-enrollment-status?${qs.toString()}`);
  }

  const rows = data.rows ?? [];
  const letter = (searchParams.get("letter") || data.letter || "ALL").toUpperCase();

  return (
    <div className="mh-teacher-stack mh-workshop-enrolments" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <h2 className="mh-sis-page-title">{config.title}</h2>
      <section className="mh-teacher-card mh-teacher-active-filters">
        <div className="mh-teacher-active-filters__grid mh-workshop-enrolments__filters">
          <label>
            <span>Student Filter</span>
            <input
              className="mh-teacher-field"
              value={student}
              placeholder={data.studentPlaceholder}
              onChange={(e) => setStudent(e.target.value)}
            />
          </label>
          <label>
            <span>Workshop Filter</span>
            <select className="mh-teacher-field" value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
              {(data.workshopOptions ?? []).map((o) => (
                <option key={`${o.value}-${o.label}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status Filter</span>
            <select
              className="mh-teacher-field"
              value={status}
              onChange={(e) => {
                const next = e.target.value;
                setStatus(next);
                pushFilters({ status: next });
              }}
            >
              {(data.statusOptions ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mh-teacher-active-filters__actions">
            <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => pushFilters({})}>
              {data.searchLabel || "Search Workshops"}
            </button>
          </div>
        </div>
      </section>

      <nav className="mh-alpha-nav" aria-label="Alphabetical filter">
        {ALPHA_LETTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`mh-alpha-nav__item${letter === item ? " is-active" : ""}`}
            onClick={() => pushFilters({ letter: item })}
          >
            {item}
          </button>
        ))}
      </nav>

      <section className="mh-teacher-card">
        {live?.loading ? (
          <div className="mh-teacher-empty">
            <span className="mh-teacher-spinner" aria-label="Loading" />
            <p className="mh-teacher-muted">Searching workshop enrolments…</p>
          </div>
        ) : rows.length === 0 ? (
          <p className="mh-teacher-empty-msg">{data.emptyMessage}</p>
        ) : (
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(160px,1.3fr) minmax(110px,0.8fr) minmax(180px,1.4fr) minmax(90px,0.7fr) minmax(90px,0.7fr) minmax(140px,0.9fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Student</span>
              <span>Student #</span>
              <span>Workshop</span>
              <span>Status</span>
              <span>Enrolled</span>
              <span aria-hidden="true" />
            </div>
            {rows.map((row) => (
              <div key={row.id} className="mh-teacher-table__row">
                <span>
                  <strong>{row.studentName}</strong>
                </span>
                <span>{row.studentNumber}</span>
                <span>
                  {row.workshopId ? (
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() =>
                        router.push(
                          `/instructor/f/t24-workshop-detail?workshopId=${encodeURIComponent(row.workshopId!)}`,
                        )
                      }
                    >
                      {row.workshop}
                    </button>
                  ) : (
                    row.workshop
                  )}
                </span>
                <span>
                  <span className={badgeClass(row.statusTone)}>{row.status}</span>
                </span>
                <span>{row.enrolledOn}</span>
                <span className="mh-teacher-schemes-list__actions">
                  {row.status === "Pending" ? (
                    <>
                      <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.("Approve Enrolment", row.id)}>
                        APPROVE
                      </button>
                      <button type="button" className="mh-teacher-link mh-teacher-link--danger" disabled={live?.busy} onClick={() => void live?.runAction?.("Decline Enrolment", row.id)}>
                        DECLINE
                      </button>
                    </>
                  ) : row.status === "Approved" ? (
                    <button type="button" className="mh-teacher-link mh-teacher-link--danger" disabled={live?.busy} onClick={() => void live?.runAction?.("Drop Enrolment", row.id)}>
                      DROP
                    </button>
                  ) : row.status === "Declined" || row.status === "Dropped" ? (
                    <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.("Reinstate Enrolment", row.id)}>
                      REINSTATE
                    </button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WorkshopAttendanceView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.workshopAttendance;
  const [date, setDate] = useState(data?.date || "");
  const [student, setStudent] = useState(data?.studentValue || "");
  const [workshop, setWorkshop] = useState(data?.workshopValue || "");
  const [weekOpen, setWeekOpen] = useState(false);
  const [students, setStudents] = useState(data?.students || []);

  useEffect(() => {
    setDate(data?.date || "");
    setStudent(data?.studentValue || "");
    setWorkshop(data?.workshopValue || "");
    setStudents(data?.students || []);
  }, [data?.date, data?.studentValue, data?.workshopValue, data?.students]);

  if (!data) return null;

  function load(nextDate = date, nextStudent = student, nextWorkshop = workshop) {
    const qs = new URLSearchParams();
    if (nextDate) qs.set("date", nextDate);
    if (nextStudent.trim()) qs.set("student", nextStudent.trim());
    if (nextWorkshop) qs.set("workshop", nextWorkshop);
    router.push(`/instructor/f/t41-workshop-attendance?${qs.toString()}`);
  }

  function save() {
    void live?.runAction?.(
      "Save Attendance",
      JSON.stringify({
        date,
        roster: students.map((s) => ({
          studentId: s.studentId,
          workshopId: s.workshopId,
          status: s.status,
          note: s.note,
        })),
      }),
    );
  }

  return (
    <div className="mh-teacher-stack mh-workshop-attendance" data-figma-id={config.figmaId}>
      <div className="mh-workshop-attendance__head">
        <div>
          <SisCrumb crumbs={config.breadcrumbs} />
          <h2 className="mh-sis-page-title">{config.title}</h2>
        </div>
        <div className="mh-teacher-actions">
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setWeekOpen((v) => !v)}>
            Week View
          </button>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => window.print()}>
            Print Roster
          </button>
        </div>
      </div>

      <section className="mh-teacher-card mh-teacher-active-filters">
        <div className="mh-teacher-active-filters__grid mh-workshop-enrolments__filters">
          <label>
            <span>Date Filter</span>
            <input className="mh-teacher-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span>Student Filter</span>
            <input
              className="mh-teacher-field"
              value={student}
              placeholder={data.studentPlaceholder}
              onChange={(e) => setStudent(e.target.value)}
            />
          </label>
          <label>
            <span>Workshop Filter</span>
            <select className="mh-teacher-field" value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
              {(data.workshopOptions ?? []).map((o) => (
                <option key={`${o.value}-${o.label}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mh-teacher-active-filters__actions">
            <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" onClick={() => load()}>
              {data.loadLabel || "Load Attendance"}
            </button>
          </div>
        </div>
      </section>

      {weekOpen && data.weekDates?.length ? (
        <nav className="mh-week-nav" aria-label="Week view">
          {data.weekDates.map((d) => (
            <button
              key={d.value}
              type="button"
              className={`mh-week-nav__item${d.active ? " is-active" : ""}`}
              onClick={() => load(d.value)}
            >
              {d.label}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="mh-att-date-nav">
        <button type="button" className="mh-teacher-link" onClick={() => load(data.previousDate)}>
          {data.previousLabel}
        </button>
        <h3>{data.heading}</h3>
        <button type="button" className="mh-teacher-link" onClick={() => load(data.nextDate)}>
          {data.nextLabel}
        </button>
      </div>

      <section className="mh-teacher-card">
        {live?.loading ? (
          <div className="mh-teacher-empty">
            <span className="mh-teacher-spinner" aria-label="Loading" />
            <p className="mh-teacher-muted">Loading attendance…</p>
          </div>
        ) : students.length === 0 ? (
          <p className="mh-teacher-empty-msg">{data.emptyMessage}</p>
        ) : (
          <>
            <div className="mh-teacher-card__head">
              <h2>{data.totalLabel}</h2>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" disabled={live?.busy} onClick={save}>
                {live?.busy ? "Saving…" : data.saveLabel}
              </button>
            </div>
            <div className="mh-workshop-att-list">
              {students.map((s) => (
                <div key={s.id} className="mh-workshop-att-row">
                  <span className="mh-teacher__avatar mh-teacher__avatar--sm" aria-hidden>
                    {s.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((p) => p[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <div>
                    <strong>{s.name}</strong>
                    <span className="mh-teacher-muted">{s.studentNumber}</span>
                    {s.workshopTitle ? <span className="mh-teacher-muted">{s.workshopTitle}</span> : null}
                  </div>
                  <button
                    type="button"
                    className={`mh-teacher-att-pill mh-teacher-att-pill--${s.status.toLowerCase()}`}
                    onClick={() =>
                      setStudents((prev) =>
                        prev.map((row) => (row.id === s.id ? { ...row, status: row.status === "Present" ? "Absent" : "Present" } : row)),
                      )
                    }
                  >
                    {s.status}
                  </button>
                  <input
                    className="mh-teacher-field"
                    value={s.note}
                    placeholder="Note"
                    onChange={(e) =>
                      setStudents((prev) => prev.map((row) => (row.id === s.id ? { ...row, note: e.target.value } : row)))
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function WorkshopDetailView({ config }: { config: TeacherScreenConfig }) {
  const d = config.workshopDetail;
  if (!d) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <PageHead config={config} />
      <div className="mh-teacher-split">
        <section className="mh-teacher-card">
          <div className="mh-teacher-page-head__row">
            <h2 style={{ margin: 0 }}>{d.title}</h2>
            <span className={badgeClass("active")}>{d.status}</span>
          </div>
          <div className="mh-teacher-workshop-card__meta" style={{ margin: "12px 0 16px" }}>
            <span>
              <img src="/brand/icons/calendar.svg" alt="" width={14} height={14} />
              {d.when}
            </span>
            <span>
              <img src="/brand/icons/school.svg" alt="" width={14} height={14} />
              {d.where}
            </span>
            <span>{d.seats}</span>
          </div>
          <p className="mh-teacher-muted">{d.description}</p>
          <h3>Agenda</h3>
          <ol className="mh-teacher-agenda">
            {d.agenda.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ol>
          <Link href="/instructor/f/t11-workshops" className="mh-teacher-btn">
            ← All My Workshops
          </Link>
        </section>
        <aside className="mh-teacher-card">
          <h2>Materials</h2>
          <div className="mh-teacher-list">
            {d.materials.map((m) => (
              <div key={m.label} className="mh-teacher-list__item">
                <div>
                  <strong>{m.label}</strong>
                  <span>{m.meta}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StudentsDirectoryView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const d = config.studentsDirectory;
  const students = d?.students ?? [];
  const [selected, setSelected] = useState(students[0]?.id);
  const selectedStudent = students.find((s) => s.id === selected) ?? students[0];

  useEffect(() => {
    if (!students.length) return;
    if (!selected || !students.some((s) => s.id === selected)) {
      setSelected(students[0]?.id);
    }
  }, [students, selected]);

  const openDetail = (studentId: string) => {
    router.push(`/instructor/f/t22-student-detail-full-page?studentId=${encodeURIComponent(studentId)}`);
  };

  const drawer = selectedStudent
    ? {
        name: selectedStudent.name,
        meta: `${selectedStudent.id} // ${selectedStudent.program || "—"}`,
        alert:
          selectedStudent.riskTone === "danger" || selectedStudent.riskTone === "warning"
            ? "URGENT VERIFICATION"
            : "STUDENT SUMMARY",
        body: `${selectedStudent.name} — ${selectedStudent.risk} in ${selectedStudent.program || "program"}. Attendance ${selectedStudent.attendance}, GPA ${selectedStudent.gpa}, ${selectedStudent.missing} missing submission(s).`,
        action: "View full profile",
      }
    : (d?.drawer ?? {
        name: "Select a student",
        meta: "—",
        alert: "No student selected",
        body: "Choose a student from the roster to view details.",
        action: "View full profile",
      });

  if (!d) return null;
  return (
    <div className="mh-teacher-stack mh-teacher-students" data-figma-id={config.figmaId}>
      <div className="mh-teacher-students__filters">
        <button type="button" className="mh-teacher-chip">
          {d.rosterFilter ?? "All"} ▾
        </button>
        <button type="button" className="mh-teacher-chip">
          {d.riskFilter ?? "All risk"} ▾
        </button>
        <span className="mh-teacher-meta-note">{d.note}</span>
      </div>
      <div className="mh-teacher-students__grid">
        <section className="mh-teacher-card">
          <h2>Section Members</h2>
          {students.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`mh-teacher-student-row${selected === s.id ? " is-selected" : ""}`}
              onClick={() => {
                setSelected(s.id);
                openDetail(s.id);
              }}
            >
              <span className="mh-teacher__avatar mh-teacher__avatar--sm" aria-hidden>
                {(s.name ?? "?")
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span>
                <strong>{s.name}</strong>
                <span className="mh-teacher-muted">{s.program}</span>
              </span>
              <span className="mh-teacher-student-metric">
                <strong>{s.attendance}</strong>
                <span>ATTENDANCE</span>
              </span>
              <span className="mh-teacher-student-metric">
                <strong>{s.gpa}</strong>
                <span>CURR. GPA</span>
              </span>
              <span className="mh-teacher-student-metric">
                <strong className={s.missing !== "0" ? "is-warn" : undefined}>{s.missing}</strong>
                <span>MISSING SUBS</span>
              </span>
              <span className={badgeClass(s.riskTone)}>{s.risk}</span>
            </button>
          ))}
        </section>
        <aside className="mh-teacher-card mh-teacher-students__drawer">
          <div className="mh-teacher-students__drawer-profile">
            <span className="mh-teacher__avatar" aria-hidden>
              {drawer.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </span>
            <strong>{drawer.name}</strong>
            <span className="mh-teacher-comment__role">{drawer.meta}</span>
          </div>
          <div className="mh-teacher-students__alert">{drawer.alert}</div>
          <p>{drawer.body}</p>
          <button
            type="button"
            className="mh-teacher-btn"
            style={{ width: "100%" }}
            disabled={!selectedStudent}
            onClick={() => selectedStudent && openDetail(selectedStudent.id)}
          >
            {drawer.action}
          </button>
        </aside>
      </div>
    </div>
  );
}

function StudentDetailView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const d = config.studentDetail;
  const tabs = d?.tabs?.length ? d.tabs : ["Overview"];
  const [tab, setTab] = useState(tabs[0] || "Overview");

  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0] || "Overview");
  }, [tabs.join("|"), tab]);

  if (!d) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <section className="mh-teacher-card">
          <p className="mh-teacher-muted">No student profile loaded for this view yet.</p>
        </section>
      </div>
    );
  }

  const assessments = d.assessments ?? [];
  const requirements = d.requirements ?? [];
  const flags = d.flags ?? [];
  const leave = d.leave ?? [];

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-split">
        <section className="mh-teacher-card">
          <div className="mh-teacher-students__drawer-profile" style={{ alignItems: "flex-start", textAlign: "left" }}>
            <span className="mh-teacher__avatar" aria-hidden>
              {d.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              <strong style={{ fontSize: 22 }}>{d.name}</strong>
              <p className="mh-teacher-comment__role">{d.meta}</p>
            </div>
          </div>
          <div className="mh-teacher-tabs" style={{ marginTop: 16 }}>
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                className={`mh-teacher-tabs__item${tab === t ? " is-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Overview" ? (
            <div className="mh-teacher-fields" style={{ marginTop: 16 }}>
              {d.fields.map((f) => (
                <label key={f.label}>
                  <span>{f.label}</span>
                  <div className="mh-teacher-field">{f.value}</div>
                </label>
              ))}
            </div>
          ) : null}

          {tab === "Current Courses" ? (
            <div className="mh-teacher-list" style={{ marginTop: 16 }}>
              {d.courses.length === 0 ? (
                <p className="mh-teacher-muted">No active enrolments in your sections.</p>
              ) : (
                d.courses.map((c) => (
                  <div key={c.code} className="mh-teacher-list__item">
                    <div>
                      <strong>
                        {c.code} · {c.title}
                      </strong>
                      <span>
                        {c.grade} · {c.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "Assessments" ? (
            <div className="mh-teacher-list" style={{ marginTop: 16 }}>
              {assessments.length === 0 ? (
                <p className="mh-teacher-muted">No assessment records for this student in your sections.</p>
              ) : (
                assessments.map((a, i) => (
                  <div key={`${a.course}-${a.title}-${i}`} className="mh-teacher-list__item">
                    <div>
                      <strong>{a.title}</strong>
                      <span>
                        {a.course}
                        {a.due ? ` · Due ${a.due}` : ""}
                      </span>
                    </div>
                    <span className={badgeClass(a.status.toLowerCase().includes("missing") || a.score === "—" ? "warning" : "active")}>
                      {a.score} · {a.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "Requirements" ? (
            <div className="mh-teacher-list" style={{ marginTop: 16 }}>
              {requirements.length === 0 ? (
                <p className="mh-teacher-muted">No degree requirements linked for this student yet.</p>
              ) : (
                requirements.map((r) => (
                  <div key={`${r.code}-${r.title}`} className="mh-teacher-list__item">
                    <div>
                      <strong>
                        {r.code} · {r.title}
                      </strong>
                      <span>
                        {r.credits} cr · {r.kind}
                      </span>
                    </div>
                    <span className={badgeClass(/met|complete|done/i.test(r.status) ? "active" : "muted")}>{r.status}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}

          {tab === "Flags" ? (
            <div className="mh-teacher-stack" style={{ marginTop: 16, gap: 10 }}>
              {flags.length === 0 ? (
                <p className="mh-teacher-muted">No flags or academic alerts recorded for this student.</p>
              ) : (
                flags.map((f) => (
                  <article key={`${f.title}-${f.when}`} className="mh-teacher-card" style={{ boxShadow: "none" }}>
                    <div className="mh-teacher-page-head__row">
                      <h3 style={{ margin: 0, fontSize: 14 }}>{f.title}</h3>
                      <span className={badgeClass(f.tone)}>{f.tone}</span>
                    </div>
                    <p>{f.body}</p>
                    <span className="mh-teacher-muted">{f.when}</span>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {tab === "Leave" ? (
            <div className="mh-teacher-stack" style={{ marginTop: 16, gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--primary"
                    onClick={() =>
                    router.push(
                      `/instructor/f/t48-leave-of-absence?create=1&student=${encodeURIComponent(d.name)}&program=${encodeURIComponent(
                        d.meta.split("·")[1]?.trim() || "",
                      )}`,
                    )
                  }
                >
                  Submit New LOA
                </button>
              </div>
              {leave.length === 0 ? (
                <p className="mh-teacher-muted">No leave or withdrawal requests for this student.</p>
              ) : (
                leave.map((item) => (
                  <div key={`${item.title}-${item.when || item.status}`} className="mh-teacher-list__item">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                    </div>
                    <span className={badgeClass(/open|pending/i.test(item.status) ? "warning" : "active")}>
                      {item.status}
                      {item.when ? ` · ${item.when}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        <div className="mh-teacher-stack">
          {tab === "Overview" ? (
            <>
              {d.alerts.map((a, i) => (
                <section key={`${a.title}-${i}`} className="mh-teacher-card">
                  <h2>{a.title}</h2>
                  <p>{a.body}</p>
                  <span className={badgeClass(a.tone)}>{a.tone}</span>
                </section>
              ))}
              <section className="mh-teacher-card">
                <h2>Current Courses</h2>
                <div className="mh-teacher-list">
                  {d.courses.length === 0 ? <p className="mh-teacher-muted">No active enrolments in your sections.</p> : null}
                  {d.courses.map((c) => (
                    <div key={c.code} className="mh-teacher-list__item">
                      <div>
                        <strong>
                          {c.code} · {c.title}
                        </strong>
                        <span>
                          {c.grade} · {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="mh-teacher-card">
              <h2>{tab} summary</h2>
              <p className="mh-teacher-muted">
                {tab === "Current Courses"
                  ? `${d.courses.length} current course enrolment(s).`
                  : tab === "Assessments"
                  ? `${assessments.length} assessment row(s) from your gradebook.`
                  : tab === "Requirements"
                    ? `${requirements.length} program requirement(s).`
                    : tab === "Flags"
                      ? `${flags.length} flag/alert item(s).`
                      : `${leave.length} leave/withdraw request(s).`}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function FacultiesProgramsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.facultiesPrograms;
  const faculties = data?.faculties ?? [];
  const createFaculty = data?.createFacultyHref || "/instructor/f/t81-add-faculty";
  const createProgram = data?.createProgramHref || "/instructor/f/t74-add-program";

  async function removeFaculty(id: string) {
    if (!window.confirm("Delete this faculty?")) return;
    await live?.runAction?.("Delete Faculty", id);
    await live?.refresh?.();
  }

  async function removeProgram(id: string) {
    if (!window.confirm("Delete this program?")) return;
    await live?.runAction?.("Delete Program", id);
    await live?.refresh?.();
  }

  return (
    <div className="mh-teacher-stack mh-teacher-facprog" data-figma-id={config.figmaId}>
      <div className="mh-teacher-facprog__head">
        <div>
          <p className="mh-teacher-crumb">Home ▸ Faculties & Programs</p>
          <h1>MANAGE FACULTIES & PROGRAMS</h1>
        </div>
        <div className="mh-teacher-facprog__actions">
          <button type="button" className="mh-teacher-btn mh-teacher-btn--dark" onClick={() => router.push(createFaculty)}>
            Create Faculty
          </button>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--dark" onClick={() => router.push(createProgram)}>
            Create Program
          </button>
        </div>
      </div>
      {live?.loading && faculties.length === 0 ? (
        <p className="mh-teacher-muted">Loading faculties and programs…</p>
      ) : faculties.length === 0 ? (
        <section className="mh-teacher-card">
          <p className="mh-teacher-muted">No faculties yet. Use Create Faculty to add one.</p>
        </section>
      ) : (
        faculties.map((faculty) => (
          <section key={faculty.id} className="mh-teacher-facprog__block">
            <header className="mh-teacher-facprog__block-head">
              <h2>
                {faculty.name}
                <em className={faculty.active ? "is-active" : "is-inactive"}>
                  ({faculty.active ? "Active" : "Inactive"})
                </em>
              </h2>
              <div>
                <button
                  type="button"
                  className="mh-teacher-facprog__link"
                  onClick={() => router.push(`${createFaculty}?facultyId=${encodeURIComponent(faculty.id)}`)}
                >
                  EDIT
                </button>
                <button type="button" className="mh-teacher-facprog__link" onClick={() => void removeFaculty(faculty.id)}>
                  DELETE
                </button>
              </div>
            </header>
            <div
              className="mh-teacher-table mh-teacher-facprog__table"
              style={{ gridTemplateColumns: "minmax(240px,1.8fr) minmax(90px,0.6fr) minmax(70px,0.5fr) minmax(140px,0.8fr)" }}
            >
              <div className="mh-teacher-table__head">
                <span>Program Name</span>
                <span>Abbreviation</span>
                <span>Active</span>
                <span aria-hidden="true" />
              </div>
              {faculty.programs.length === 0 ? (
                <div className="mh-teacher-table__row">
                  <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 4" }}>
                    No programs in this faculty.
                  </span>
                </div>
              ) : (
                faculty.programs.map((program) => (
                  <div key={program.id} className="mh-teacher-table__row">
                    <span>
                      <button
                        type="button"
                        className="mh-teacher-facprog__name"
                        onClick={() => router.push(program.href || createProgram)}
                      >
                        {program.name}
                      </button>
                    </span>
                    <span>{program.abbreviation}</span>
                    <span className={program.active ? "mh-teacher-facprog__yes" : "mh-teacher-muted"}>
                      {program.active ? "Yes" : "No"}
                    </span>
                    <span className="mh-teacher-facprog__row-actions">
                      <button
                        type="button"
                        className="mh-teacher-facprog__link"
                        onClick={() => router.push(program.href || createProgram)}
                      >
                        SETTINGS
                      </button>
                      <button
                        type="button"
                        className="mh-teacher-facprog__link"
                        onClick={() => void removeProgram(program.id)}
                      >
                        DELETE
                      </button>
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function HubView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const hub = config.hub;
  const directory = config.programDirectory;
  const [query, setQuery] = useState("");
  if (!hub) return null;
  const q = query.trim().toLowerCase();
  const programs = (directory?.programs ?? []).filter((p) => {
    if (!q) return true;
    return `${p.name} ${p.code} ${p.type}`.toLowerCase().includes(q);
  });
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-hub-grid">
        {hub.cards.map((card) => (
          <button key={card.href} type="button" className="mh-teacher-card mh-teacher-hub-card" onClick={() => router.push(card.href)}>
            <div className="mh-teacher-page-head__row">
              <h2 style={{ margin: 0 }}>{card.title}</h2>
              {card.meta ? <span className={badgeClass("muted")}>{card.meta}</span> : null}
            </div>
            <p>{card.body}</p>
          </button>
        ))}
      </div>
      {directory ? (
        <section className="mh-teacher-card mh-teacher-program-dir">
          <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
            <h2 style={{ margin: 0 }}>{directory.title || "Programs"}</h2>
            <label className="mh-teacher-schemes-list__filter">
              <span className="mh-teacher-sr-only">Search programs</span>
              <input
                className="mh-teacher-field"
                type="search"
                placeholder={directory.searchPlaceholder || "Search programs"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(220px,1.6fr) minmax(90px,0.7fr) minmax(110px,0.8fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Program</span>
              <span>Code</span>
              <span>Type</span>
            </div>
            {programs.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 3" }}>
                  {live?.loading
                    ? "Loading programs…"
                    : q
                      ? `No programs match “${query.trim()}”.`
                      : directory.emptyMessage || "No programs yet."}
                </span>
              </div>
            ) : (
              programs.map((p) => (
                <div key={p.id} className="mh-teacher-table__row">
                  <span>
                    <strong>{p.name}</strong>
                  </span>
                  <span>{p.code}</span>
                  <span>{p.type}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function GradesQueueView({ config }: { config: TeacherScreenConfig }) {
  const grades = config.gradesQueue || [];
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <section className="mh-teacher-card">
        <div className="mh-teacher-table mh-teacher-grades-table">
          <div className="mh-teacher-table__head">
            <span>Course</span>
            <span>Instructor</span>
            <span>Submitted</span>
            <span>Enrolled</span>
            <span>Distribution</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {grades.map((g) => (
            <div key={g.code} className="mh-teacher-table__row">
              <span>
                <strong>{g.code}</strong>
                <span className="mh-teacher-muted">{g.title}</span>
              </span>
              <span>{g.instructor}</span>
              <span>{g.submitted}</span>
              <span>{g.enrolled}</span>
              <span>
                <span className="mh-teacher-muted">{g.distribution}</span>
                <span className="mh-teacher-dist-bar">
                  <i style={{ width: `${g.bars[0]}%`, background: "#1B7A3D" }} />
                  <i style={{ width: `${g.bars[1]}%`, background: "#849F38" }} />
                  <i style={{ width: `${g.bars[2]}%`, background: "#D97706" }} />
                  <i style={{ width: `${g.bars[3] || 0}%`, background: "#BA1A1A" }} />
                </span>
              </span>
              <span>
                <span className={badgeClass(g.status === "Ready" ? "active" : g.status === "Incomplete" ? "danger" : "review")}>
                  {g.status}
                </span>
              </span>
              <span className="mh-teacher-actions">
                <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary">
                  Open
                </button>
                <button type="button" className="mh-teacher-btn">
                  Submit
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssessmentBuilderView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const router = useRouter();
  const data = config.assessmentBuilder;
  const [sectionId, setSectionId] = useState(data?.sectionId ?? "");
  const [title, setTitle] = useState(data?.title ?? "");
  const [type, setType] = useState(data?.type ?? "Written Exam");
  const [weight, setWeight] = useState(data?.weight ?? "20%");
  const [openDate, setOpenDate] = useState(data?.openDate ?? "");
  const [dueDate, setDueDate] = useState(data?.dueDate ?? "");
  const [durationMinutes, setDurationMinutes] = useState(data?.durationMinutes ?? 60);
  const [questions, setQuestions] = useState(
    () => data?.questions ?? [{ id: "question-1", prompt: "", options: ["", ""], correct: 0 }],
  );
  const [rubricRows, setRubricRows] = useState(
    () => data?.rubricRows ?? [{ criterion: "", excellent: "", good: "", poor: "" }],
  );

  useEffect(() => {
    if (!data) return;
    setSectionId(data.sectionId ?? "");
    setTitle(data.title);
    setType(data.type);
    setWeight(data.weight);
    setOpenDate(data.openDate ?? "");
    setDueDate(data.dueDate ?? "");
    setDurationMinutes(data.durationMinutes ?? 60);
    setQuestions(data.questions?.length ? data.questions : [{ id: "question-1", prompt: "", options: ["", ""], correct: 0 }]);
    setRubricRows(data.rubricRows.length ? data.rubricRows : [{ criterion: "", excellent: "", good: "", poor: "" }]);
  }, [data]);

  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <p className="mh-teacher-muted">Loading assessment builder…</p>
      </div>
    );
  }

  const types = data.types?.length ? data.types : ["Written Exam", "Quiz", "Project", "Lab Practical", "Oral Exam"];
  const weightLabel = weight.includes("%") ? weight : `${weight}%`;
  const previewTitle = title.trim() || data.preview.title;
  const selectedSectionLabel = data.sections?.find((s) => s.id === sectionId)?.label.split(" — ")[0];
  const previewBadge = selectedSectionLabel
    ? `${selectedSectionLabel} • ${type.toUpperCase()}`
    : data.preview.badge.replace(/•.+$/, `• ${type.toUpperCase()}`);
  const formatPreview = (iso: string, fallback: string) => {
    if (!iso) return fallback;
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const payload = JSON.stringify({
    ...(sectionId ? { sectionId } : {}),
    title: title.trim(),
    type,
    weight: weightLabel,
    openDate,
    dueDate,
    durationMinutes,
    questions,
    rubricRows,
  });

  const updateRow = (index: number, key: keyof (typeof rubricRows)[number], value: string) => {
    setRubricRows((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  return (
    <div className="mh-teacher-assess" data-figma-id={config.figmaId}>
      <div className="mh-teacher-assess__main">
        <nav className="mh-teacher-assess__crumb" aria-label="Breadcrumb">
          {data.crumb.map((c, i) => (
            <span key={c}>
              {i > 0 ? <span className="mh-teacher-assess__crumb-sep">›</span> : null}
              <span className={i === data.crumb.length - 1 ? "is-active" : undefined}>{c}</span>
            </span>
          ))}
        </nav>
        <header className="mh-teacher-assess__intro">
          <h2>{data.heading}</h2>
          <p>{data.description}</p>
        </header>

        <section className="mh-teacher-card mh-teacher-assess__card">
          <h3>Basic Information</h3>
          {data.sections?.length ? (
            <label className="mh-teacher-assess__field">
              <span>Course Section</span>
              <select className="mh-teacher-field" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                {data.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="mh-teacher-assess__field">
            <span>Assessment Title</span>
            <input
              className="mh-teacher-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Examination"
            />
          </label>
          <div className="mh-teacher-assess__row">
            <label className="mh-teacher-assess__field">
              <span>Assessment Type</span>
              <select className="mh-teacher-field" value={type} onChange={(e) => setType(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="mh-teacher-assess__field">
              <span>Weighted Percentage</span>
              <input
                className="mh-teacher-field"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="20%"
              />
            </label>
          </div>
          <div className="mh-teacher-assess__row">
            <label className="mh-teacher-assess__field">
              <span>Open Date</span>
              <input
                className="mh-teacher-field"
                type="date"
                value={openDate}
                onChange={(e) => setOpenDate(e.target.value)}
              />
            </label>
            <label className="mh-teacher-assess__field">
              <span>Due Date</span>
              <input
                className="mh-teacher-field"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          </div>
        </section>

        {type === "Quiz" ? (
          <section className="mh-teacher-card mh-teacher-assess__card">
            <div className="mh-teacher-assess__card-head">
              <h3>Timed Quiz Questions</h3>
              <button
                type="button"
                className="mh-teacher-assess__add-criterion"
                onClick={() => setQuestions((rows) => [...rows, { id: crypto.randomUUID(), prompt: "", options: ["", ""], correct: 0 }])}
              >
                ADD QUESTION
              </button>
            </div>
            <label className="mh-teacher-assess__field">
              <span>Duration (minutes)</span>
              <input className="mh-teacher-field" type="number" min={1} max={480} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
            </label>
            <div className="mh-teacher-stack">
              {questions.map((question, questionIndex) => (
                <div key={question.id ?? `question-${questionIndex}`} className="mh-teacher-section">
                  <label className="mh-teacher-assess__field">
                    <span>Question {questionIndex + 1}</span>
                    <input
                      className="mh-teacher-field"
                      value={question.prompt ?? ""}
                      onChange={(e) => setQuestions((rows) => rows.map((row, i) => i === questionIndex ? { ...row, prompt: e.target.value } : row))}
                      placeholder="Enter the question"
                    />
                  </label>
                  {(question.options ?? ["", ""]).map((option, optionIndex) => (
                    <label key={`${question.id}-${optionIndex}`} className="mh-teacher-assess__field">
                      <span>
                        <input
                          type="radio"
                          name={`correct-${question.id}`}
                          checked={(question.correct ?? 0) === optionIndex}
                          onChange={() => setQuestions((rows) => rows.map((row, i) => i === questionIndex ? { ...row, correct: optionIndex } : row))}
                        /> Correct answer {optionIndex + 1}
                      </span>
                      <input
                        className="mh-teacher-field"
                        value={option}
                        onChange={(e) => setQuestions((rows) => rows.map((row, i) => i === questionIndex ? { ...row, options: (row.options ?? ["", ""]).map((value, j) => j === optionIndex ? e.target.value : value) } : row))}
                        placeholder={`Answer choice ${optionIndex + 1}`}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mh-teacher-card mh-teacher-assess__card">
          <div className="mh-teacher-assess__card-head">
            <h3>Grade Matching Rubric Builder</h3>
            <button
              type="button"
              className="mh-teacher-assess__add-criterion"
              onClick={() =>
                setRubricRows((rows) => [
                  ...rows,
                  { criterion: `Criterion ${rows.length + 1}`, excellent: "", good: "", poor: "" },
                ])
              }
            >
              ADD CRITERION
            </button>
          </div>
          <div className="mh-teacher-assess__rubric">
            <div className="mh-teacher-assess__rubric-head">
              {data.rubricHeaders.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {rubricRows.map((row, index) => (
              <div key={`rubric-${index}`} className="mh-teacher-assess__rubric-row">
                <input
                  className="mh-teacher-field"
                  value={row.criterion}
                  onChange={(e) => updateRow(index, "criterion", e.target.value)}
                  placeholder="Criterion"
                />
                <input
                  className="mh-teacher-field"
                  value={row.excellent}
                  onChange={(e) => updateRow(index, "excellent", e.target.value)}
                  placeholder="Excellent"
                />
                <input
                  className="mh-teacher-field"
                  value={row.good}
                  onChange={(e) => updateRow(index, "good", e.target.value)}
                  placeholder="Good"
                />
                <input
                  className="mh-teacher-field"
                  value={row.poor}
                  onChange={(e) => updateRow(index, "poor", e.target.value)}
                  placeholder="Poor"
                />
              </div>
            ))}
          </div>
        </section>

        <div className="mh-teacher-assess__upload">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 16.5a3.5 3.5 0 0 0-2.1-6.4A5.5 5.5 0 0 0 7.1 8.4 3.5 3.5 0 0 0 4 11.8" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M8 19h8" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <strong>{data.uploadHint}</strong>
          <span>{data.uploadFormats}</span>
        </div>
      </div>

      <aside className="mh-teacher-assess__preview">
        <p className="mh-teacher-assess__preview-label">STUDENT PORTAL PREVIEW</p>
        <div className="mh-teacher-assess__preview-card">
          <span className="mh-teacher-assess__preview-badge">{previewBadge}</span>
          <h3>{previewTitle}</h3>
          <p>{`Weight: ${weightLabel} of final grade`}</p>
          <hr />
          <div className="mh-teacher-assess__preview-meta">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="#2563EB" strokeWidth="1.6" />
                <path d="M3 10h18M8 3v4M16 3v4" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {`Open Date: ${formatPreview(openDate, data.preview.openDate.replace(/^Open Date:\s*/, ""))}`}
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 9v4M12 17h.01M10.3 4.3 2.8 17.3A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.7L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="#ef4444" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {`Due Date: ${formatPreview(dueDate, data.preview.dueDate.replace(/^Due Date:\s*/, ""))}`}
            </span>
          </div>
        </div>
        <div className="mh-teacher-assess__preview-actions">
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--primary"
            disabled={live?.busy || !title.trim()}
            onClick={() => {
              void (async () => {
                const ok = await live?.runAction?.("Publish Assessment", payload);
                if (ok) router.push("/instructor/assessments");
              })();
            }}
          >
            {live?.busy ? "Publishing…" : "Publish Assessment"}
          </button>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            disabled={live?.busy || !title.trim()}
            onClick={() => void live?.runAction?.("Save Draft", payload)}
          >
            Save Draft
          </button>
        </div>
        {live?.toast ? <p className="mh-teacher-muted" style={{ marginTop: 12 }}>{live.toast}</p> : null}
      </aside>
    </div>
  );
}

function GradingSchemesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.gradingSchemes;
  const [filter, setFilter] = useState("");
  if (!data) return null;

  const schemes = data.schemes ?? [];
  const isList = Array.isArray(data.schemes);
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? schemes.filter((s) => s.name.toLowerCase().includes(q) || (s.active ? "yes" : "no").includes(q))
    : schemes;

  if (isList) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <section className="mh-teacher-card">
          <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
            <label className="mh-teacher-schemes-list__filter">
              <span className="mh-teacher-sr-only">Filter</span>
              <input
                className="mh-teacher-field"
                type="search"
                placeholder={data.searchPlaceholder || config.searchPlaceholder || "Enter Search Filter Here"}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </label>
            <PageActions config={config} />
          </div>
          <div
            className="mh-teacher-table mh-teacher-schemes-list__table"
            style={{ gridTemplateColumns: "minmax(200px,1.6fr) minmax(80px,0.5fr) minmax(140px,0.7fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Grading Scheme Name</span>
              <span>Active</span>
              <span aria-hidden="true" />
            </div>
            {filtered.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 3" }}>
                  {live?.loading
                    ? "Loading grading schemes…"
                    : q
                      ? `No schemes match “${filter.trim()}”.`
                      : "No grading schemes yet. Use Create Grading Scheme to add one."}
                </span>
              </div>
            ) : (
              filtered.map((scheme) => (
                <div key={scheme.id} className="mh-teacher-table__row mh-teacher-schemes-list__row">
                  <span>
                    <strong>{scheme.name}</strong>
                  </span>
                  <span>{scheme.active ? "Yes" : "No"}</span>
                  <span className="mh-teacher-schemes-list__actions">
                    <button
                      type="button"
                      className="mh-teacher-link"
                      disabled={live?.busy}
                      onClick={() =>
                        router.push(
                          `/instructor/f/t64-add-grading-scheme?schemeId=${encodeURIComponent(scheme.id)}`,
                        )
                      }
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--danger"
                      disabled={live?.busy}
                      onClick={() => void live?.runAction?.("Delete Grading Scheme", scheme.id)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    );
  }

  if (!data.rows?.length) return null;
  return (
    <div className="mh-teacher-schemes" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card mh-teacher-schemes__main">
        <div className="mh-teacher-schemes__head">
          <h2>{data.schemeLabel || "Grading Scale Configuration"}</h2>
          <div className="mh-teacher-schemes__actions">
            <button type="button" className="mh-teacher-schemes__btn-outline" disabled={live?.busy} onClick={() => live?.runAction?.("Custom Standard Scheme")}>
              Custom Standard Scheme
            </button>
            <button type="button" className="mh-teacher-schemes__btn-solid" disabled={live?.busy} onClick={() => live?.runAction?.("+ New Scheme")}>
              + New Scheme
            </button>
          </div>
        </div>
        <div className="mh-teacher-schemes__table">
          <div className="mh-teacher-schemes__table-head">
            <span>LETTER GRADE</span>
            <span>MIN %</span>
            <span>MAX %</span>
            <span>GPA POINTS</span>
            <span>DESCRIPTION</span>
            <span>STATUS</span>
          </div>
          {data.rows.map((row) => (
            <div key={row.letter} className="mh-teacher-schemes__table-row">
              <strong className={`mh-teacher-schemes__letter is-${row.letterTone}`}>{row.letter}</strong>
              <span>{row.min}</span>
              <span>{row.max}</span>
              <span className="mh-teacher-schemes__gpa">{row.gpa}</span>
              <span className="mh-teacher-schemes__desc">{row.description}</span>
              <span>
                <span className={`mh-teacher-schemes__status is-${row.status === "PASS" ? "pass" : "fail"}`}>
                  {row.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <aside className="mh-teacher-card mh-teacher-schemes__side">
        <h3>Mock Distribution Preview</h3>
        <div className="mh-teacher-schemes__dist">
          {(data.distribution ?? []).map((d) => (
            <div key={d.label} className="mh-teacher-schemes__dist-row">
              <div className="mh-teacher-schemes__dist-meta">
                <span>{d.label}</span>
                <span>{d.meta}</span>
              </div>
              <div className="mh-teacher-schemes__dist-track">
                <i className={`is-${d.tone}`} style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mh-teacher-schemes__presets-label">SYSTEM PRESETS ACTIVE</p>
        <div className="mh-teacher-schemes__presets">
          {(data.presets ?? []).map((p) => (
            <div key={p.label} className="mh-teacher-schemes__preset">
              <span>{p.label}</span>
              <strong className={`is-${p.tone}`}>{p.value}</strong>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProgramTypesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.programTypes;
  const [filter, setFilter] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const types = data?.types ?? [];
  useEffect(() => {
    setOrder(types.map((t) => t.id));
  }, [types.map((t) => t.id).join("|")]);

  if (!data) return null;

  const byId = new Map(types.map((t) => [t.id, t]));
  const ordered = (order.length ? order : types.map((t) => t.id))
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? ordered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase().includes(q) ||
          (t.active ? "yes" : "no").includes(q),
      )
    : ordered;

  function moveType(fromId: string, toId: string) {
    if (fromId === toId) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(fromId);
      const to = next.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      void live?.runAction?.("Reorder Program Types", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
          <label className="mh-teacher-schemes-list__filter">
            <span>FILTER</span>
            <input
              className="mh-teacher-field"
              type="search"
              placeholder={data.searchPlaceholder || config.searchPlaceholder || "Enter Search Filter Here"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <PageActions config={config} />
        </div>
        <div
          className="mh-teacher-table mh-teacher-program-types__table"
          style={{
            gridTemplateColumns: "40px minmax(180px,1.6fr) minmax(90px,0.7fr) minmax(70px,0.5fr) minmax(120px,0.8fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span aria-hidden="true" />
            <span>Program Type Name</span>
            <span>Abbreviation</span>
            <span>Active</span>
            <span aria-hidden="true" />
          </div>
          {filtered.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 5" }}>
                {live?.loading
                  ? "Loading program types…"
                  : q
                    ? `No types match “${filter.trim()}”.`
                    : "No program types yet. Use Create Program Type to add one."}
              </span>
            </div>
          ) : (
            filtered.map((type) => (
              <div
                key={type.id}
                className={`mh-teacher-table__row mh-teacher-program-types__row${dragId === type.id ? " is-dragging" : ""}`}
                draggable
                onDragStart={() => setDragId(type.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveType(dragId, type.id);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <span className="mh-teacher-drag-handle" title="Drag to reorder" aria-label="Reorder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span>
                  <strong>{type.name}</strong>
                </span>
                <span>{type.abbreviation}</span>
                <span>{type.active ? "Yes" : "No"}</span>
                <span className="mh-teacher-schemes-list__actions">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    disabled={live?.busy}
                    onClick={() =>
                      router.push(
                        `/instructor/f/t75-add-program-type?typeId=${encodeURIComponent(type.id)}`,
                      )
                    }
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--danger"
                    disabled={live?.busy}
                    onClick={() => void live?.runAction?.("Delete Program Type", type.id)}
                  >
                    DELETE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CourseTypesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.courseTypes;
  const [filter, setFilter] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);

  const types = data?.types ?? [];
  useEffect(() => {
    setOrder(types.map((t) => t.id));
  }, [types.map((t) => t.id).join("|")]);

  if (!data) return null;

  const byId = new Map(types.map((t) => [t.id, t]));
  const ordered = (order.length ? order : types.map((t) => t.id))
    .map((id) => byId.get(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? ordered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase().includes(q) ||
          (t.active ? "yes" : "no").includes(q),
      )
    : ordered;

  function moveType(fromId: string, toId: string) {
    if (fromId === toId) return;
    setOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(fromId);
      const to = next.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, fromId);
      void live?.runAction?.("Reorder Course Types", JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <div className="mh-teacher-page-head">
        <h2 className="mh-sis-page-title">{config.title}</h2>
      </div>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
          <label className="mh-teacher-schemes-list__filter">
            <span>FILTER</span>
            <input
              className="mh-teacher-field"
              type="search"
              placeholder={data.searchPlaceholder || config.searchPlaceholder || "Enter Search Filter Here"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <PageActions config={config} />
        </div>
        <div
          className="mh-teacher-table mh-teacher-program-types__table"
          style={{
            gridTemplateColumns: "40px minmax(180px,1.6fr) minmax(90px,0.7fr) minmax(70px,0.5fr) minmax(120px,0.8fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span aria-hidden="true" />
            <span>Course Type Name</span>
            <span>Abbreviation</span>
            <span>Active</span>
            <span aria-hidden="true" />
          </div>
          {filtered.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 5" }}>
                {live?.loading
                  ? "Loading course types…"
                  : q
                    ? `No types match “${filter.trim()}”.`
                    : "No course types yet. Use Create Course Type to add one."}
              </span>
            </div>
          ) : (
            filtered.map((type) => (
              <div
                key={type.id}
                className={`mh-teacher-table__row mh-teacher-program-types__row${dragId === type.id ? " is-dragging" : ""}`}
                draggable
                onDragStart={() => setDragId(type.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) moveType(dragId, type.id);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
              >
                <span className="mh-teacher-drag-handle" title="Drag to reorder" aria-label="Reorder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span>
                  <strong>{type.name}</strong>
                </span>
                <span>{type.abbreviation}</span>
                <span>{type.active ? "Yes" : "No"}</span>
                <span className="mh-teacher-schemes-list__actions">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    disabled={live?.busy}
                    onClick={() =>
                      router.push(`/instructor/f/t69-add-course-type?typeId=${encodeURIComponent(type.id)}`)
                    }
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--danger"
                    disabled={live?.busy}
                    onClick={() => void live?.runAction?.("Delete Course Type", type.id)}
                  >
                    DELETE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ManageTermsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.manageTerms;
  const [campus, setCampus] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!data) return null;

  const terms = data.terms ?? [];
  const filtered = campus
    ? terms.filter((t) => t.campuses.some((c) => c === campus || c.toLowerCase().includes(campus.toLowerCase())))
    : terms;

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
          <label className="mh-teacher-schemes-list__filter">
            <span className="mh-teacher-sr-only">{data.campusFilterLabel || "Filter Campus"}</span>
            <select
              className="mh-teacher-field"
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              aria-label={data.campusFilterLabel || "Filter Campus"}
            >
              {(data.campusOptions ?? [{ label: "ALL CAMPUSES", value: "" }]).map((o) => (
                <option key={`${o.value}-${o.label}`} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <PageActions config={config} />
        </div>
        <div
          className="mh-teacher-table mh-teacher-manage-terms__table"
          style={{
            gridTemplateColumns: "minmax(180px,1.2fr) minmax(180px,1.2fr) minmax(200px,1.4fr) minmax(160px,0.9fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>TERM NAME</span>
            <span>TERM DATES</span>
            <span>CAMPUSES</span>
            <span aria-hidden="true" />
          </div>
          {filtered.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 4" }}>
                {live?.loading
                  ? "Loading terms…"
                  : campus
                    ? "No terms for the selected campus."
                    : "No terms yet. Use Create Term to add one."}
              </span>
            </div>
          ) : (
            filtered.map((term) => {
              const showAll = Boolean(expanded[term.id]);
              const visibleCampuses = showAll ? term.campuses : term.campuses.slice(0, 1);
              const hasMore = term.campuses.length > 1;
              return (
                <div key={term.id} className="mh-teacher-table__row mh-teacher-manage-terms__row">
                  <span>
                    <strong>{term.name}</strong>
                    <em className="mh-teacher-manage-terms__code">Code: {term.code}</em>
                  </span>
                  <span>{term.dates}</span>
                  <span className="mh-teacher-manage-terms__campuses">
                    {visibleCampuses.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                    {hasMore ? (
                      <button
                        type="button"
                        className="mh-teacher-link"
                        onClick={() =>
                          setExpanded((prev) => ({ ...prev, [term.id]: !prev[term.id] }))
                        }
                      >
                        {showAll ? "Show Less" : "Show More"}
                      </button>
                    ) : null}
                  </span>
                  <span className="mh-teacher-schemes-list__actions">
                    <button
                      type="button"
                      className="mh-teacher-link"
                      disabled={live?.busy}
                      onClick={() =>
                        router.push(`/instructor/f/t84-review-term?termId=${encodeURIComponent(term.id)}`)
                      }
                    >
                      VIEW
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link"
                      disabled={live?.busy}
                      onClick={() =>
                        router.push(`/instructor/f/t76-add-term?termId=${encodeURIComponent(term.id)}`)
                      }
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--danger"
                      disabled={live?.busy}
                      onClick={() => void live?.runAction?.("Delete Term", term.id)}
                    >
                      DELETE
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function CourseConfigurationsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  if (config.form?.groups?.length) {
    return <FormView config={config} />;
  }
  const data = config.courseConfigurations;
  const [filter, setFilter] = useState("");
  const courses = data?.courses ?? [];
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? courses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.abbreviation.toLowerCase().includes(q) ||
          c.enrollmentPermission.toLowerCase().includes(q) ||
          c.syllabusPrivacy.toLowerCase().includes(q),
      )
    : courses;

  async function removeCourse(id: string) {
    if (!window.confirm("Delete this course configuration?")) return;
    await live?.runAction?.("Delete Course Configuration", id);
    await live?.refresh?.();
  }

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-courses-sessions__toolbar">
          <label className="mh-teacher-schemes-list__filter">
            <span className="mh-teacher-sr-only">Filter</span>
            <input
              className="mh-teacher-field"
              type="search"
              placeholder={data?.searchPlaceholder || config.searchPlaceholder || "Enter Search Filter Here"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <PageActions config={config} />
        </div>
        <div
          className="mh-teacher-table mh-teacher-course-config__table"
          style={{
            gridTemplateColumns:
              "minmax(200px,1.5fr) minmax(90px,0.7fr) minmax(140px,1fr) minmax(120px,0.8fr) minmax(130px,0.9fr) minmax(70px,0.5fr) minmax(140px,0.8fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>Course Name</span>
            <span>Abbreviation</span>
            <span>Enrollment Permission</span>
            <span>Syllabus Privacy</span>
            <span>Repository</span>
            <span>Active</span>
            <span aria-hidden="true" />
          </div>
          {live?.loading && courses.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 7" }}>
                Loading course configurations…
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 7" }}>
                {q
                  ? `No configurations match “${filter.trim()}”.`
                  : "No course configurations yet. Use Create Configuration to add one."}
              </span>
            </div>
          ) : (
            filtered.map((course) => (
              <div key={course.id} className="mh-teacher-table__row">
                <span>
                  <button
                    type="button"
                    className="mh-teacher-facprog__name"
                    onClick={() => router.push(course.href || `/instructor/f/t66-course-configurations?courseId=${encodeURIComponent(course.id)}`)}
                  >
                    {course.name}
                  </button>
                </span>
                <span>{course.abbreviation}</span>
                <span>{course.enrollmentPermission}</span>
                <span>{course.syllabusPrivacy}</span>
                <span>{course.repositorySettings}</span>
                <span className={course.active ? "mh-teacher-facprog__yes" : "mh-teacher-muted"}>
                  {course.active ? "Yes" : "No"}
                </span>
                <span className="mh-teacher-facprog__row-actions">
                  <button
                    type="button"
                    className="mh-teacher-facprog__link"
                    onClick={() =>
                      router.push(
                        course.href ||
                          `/instructor/f/t66-course-configurations?courseId=${encodeURIComponent(course.id)}`,
                      )
                    }
                  >
                    SETTINGS
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-facprog__link"
                    onClick={() => void removeCourse(course.id)}
                  >
                    DELETE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CoursesSessionsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.coursesSessions;
  const [filter, setFilter] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  if (!data) return null;

  const courses = data.courses ?? [];
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? courses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q) ||
          `${c.number} ${c.name}`.toLowerCase().includes(q),
      )
    : courses;

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-courses-sessions__toolbar">
          <label className="mh-teacher-schemes-list__filter">
            <span className="mh-teacher-sr-only">Filter Course</span>
            <input
              className="mh-teacher-field"
              type="search"
              placeholder={data.filterCoursePlaceholder || "Enter Course Name / Number Here"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            disabled={live?.busy}
            onClick={() => void live?.runAction?.("Search Courses", filter)}
          >
            {data.searchPlaceholder || "Search Courses"}
          </button>
          {config.primaryActionHref ? (
            <button type="button" className="mh-teacher-btn" onClick={() => router.push(config.primaryActionHref!)}>
              {config.primaryAction || "Create Course"}
            </button>
          ) : null}
          <button
            type="button"
            className="mh-teacher-btn mh-teacher-btn--secondary"
            onClick={() => setBulkOpen(true)}
          >
            {config.secondaryAction || "Bulk Actions"}
          </button>
        </div>
        <div
          className="mh-teacher-table mh-teacher-courses-sessions__table"
          style={{
            gridTemplateColumns:
              "minmax(220px,1.6fr) minmax(100px,0.7fr) minmax(180px,1.2fr) minmax(200px,1fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>Course Name / Number</span>
            <span>Credit Value</span>
            <span>Sessions</span>
            <span aria-hidden="true" />
          </div>
          {filtered.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 4" }}>
                {live?.loading
                  ? "Loading courses…"
                  : q
                    ? `No courses match “${filter.trim()}”.`
                    : "No courses yet. Use Create Course to add one."}
              </span>
            </div>
          ) : (
            filtered.map((course) => (
              <div key={course.id} className="mh-teacher-table__row mh-teacher-courses-sessions__row">
                <span>
                  <strong>
                    {course.number}: {course.name}
                  </strong>
                </span>
                <span>{course.creditValue}</span>
                <span className="mh-teacher-session-summary">
                  <em>Not Started: {course.notStarted}</em>
                  <em>In Progress: {course.inProgress}</em>
                  <em>Completed: {course.completed}</em>
                </span>
                <span className="mh-teacher-schemes-list__actions">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() =>
                      router.push(
                        `/instructor/f/t77-course-admin?courseId=${encodeURIComponent(course.id)}`,
                      )
                    }
                  >
                    SESSIONS
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() =>
                      router.push(
                        `/instructor/f/t55-add-course-form?courseId=${encodeURIComponent(course.id)}`,
                      )
                    }
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--danger"
                    disabled={live?.busy}
                    onClick={() => void live?.runAction?.("Delete Course", course.id)}
                  >
                    DELETE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      {bulkOpen ? (
        <BulkActionsModal
          options={COURSE_BULK_ACTIONS}
          onClose={() => setBulkOpen(false)}
          onApply={(action) => void live?.runAction?.("Bulk Course Action", action)}
        />
      ) : null}
    </div>
  );
}

function CourseAdminView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const searchParams = useSearchParams();
  const data = config.courseAdmin;
  const [tab, setTab] = useState(data?.activeTab || "Course Sessions & Offerings");
  const [status, setStatus] = useState(data?.statusFilter ?? "");
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [textbookOpen, setTextbookOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [linkedForm, setLinkedForm] = useState({ course: "", condition: "Optional Enrolment" });
  const [textbookForm, setTextbookForm] = useState({
    textbook: "",
    optOut: "System Default",
    recurring: "One Time",
  });
  const [transferForm, setTransferForm] = useState({
    institution: "",
    name: "",
    number: "",
    credits: "0.00",
  });
  if (!data) return null;

  const courseId = searchParams.get("courseId") || data.courseId;
  const knownLabels: Record<string, string> = {
    "course-dap-practicum": "0: DAP PRACTICUM",
    "course-capa-dap-105": "CAPA-DAP 105: Computerized Accounting",
    "course-capa-dap-106": "CAPA-DAP 106: Modern Office Technology",
    "course-capa-dap-110": "CAPA-DAP 110: Payroll Compliance Basics",
    "course-capa-dib-112": "CAPA-DIB 112: Business Communication Theory",
  };
  const courseLabel = knownLabels[courseId] || data.courseLabel;
  const sessions = (data.sessions ?? []).filter((s) => !status || s.status === status);
  const createHref = `${data.createSessionHref || "/instructor/f/t78-add-session-offering"}?courseId=${encodeURIComponent(courseId)}`;
  const linked = data.linkedCourses;
  const textbooks = data.textbooks;
  const transfers = data.transferCourses;

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <h2>{courseLabel}</h2>
          <p>{config.subtitle}</p>
        </div>
        {tab === "Course Sessions & Offerings" ? (
          <button type="button" className="mh-teacher-btn" onClick={() => router.push(createHref)}>
            Create Session / Offering
          </button>
        ) : null}
        {tab === "Cross-Listing / Linked Courses" ? (
          <button type="button" className="mh-teacher-btn" onClick={() => setLinkedOpen(true)}>
            Add Linked Course
          </button>
        ) : null}
        {tab === "Course Textbooks & e-Texts" || tab === "Course Textbooks & E-Texts" ? (
          <button type="button" className="mh-teacher-btn" onClick={() => setTextbookOpen(true)}>
            Add Textbook
          </button>
        ) : null}
        {tab === "Transfer Courses & Equivalence" ? (
          <button type="button" className="mh-teacher-btn" onClick={() => setTransferOpen(true)}>
            Add Transfer Course
          </button>
        ) : null}
      </div>

      <div className="mh-teacher-course-admin__tabs" role="tablist">
        {data.tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`mh-teacher-course-admin__tab${tab === t ? " is-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Course Settings" ? (
        <section className="mh-teacher-card">
          <h2>Course Settings</h2>
          <p className="mh-teacher-muted">
            Core course settings are edited from the Add / Edit Course form.
          </p>
          <button
            type="button"
            className="mh-teacher-btn"
            onClick={() =>
              router.push(`/instructor/f/t55-add-course-form?courseId=${encodeURIComponent(courseId)}`)
            }
          >
            Edit Course Settings
          </button>
        </section>
      ) : null}

      {tab === "Cross-Listing / Linked Courses" ? (
        <section className="mh-teacher-card">
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(200px,1.4fr) minmax(160px,1fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Linked Course</span>
              <span>Type / Condition</span>
            </div>
            {(linked?.rows || []).length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 2" }}>
                  {linked?.emptyMessage || "No linked courses were found."}
                </span>
              </div>
            ) : (
              (linked?.rows || []).map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>
                    <strong>{row.course}</strong>
                  </span>
                  <span>{row.type}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "Course Textbooks & e-Texts" || tab === "Course Textbooks & E-Texts" ? (
        <section className="mh-teacher-card">
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(180px,1.4fr) minmax(120px,1fr) minmax(100px,0.8fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Textbook</span>
              <span>ISBN</span>
              <span>Price</span>
            </div>
            {(textbooks?.rows || []).length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 3" }}>
                  {textbooks?.emptyMessage || "No textbooks were found."}
                </span>
              </div>
            ) : (
              (textbooks?.rows || []).map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>
                    <strong>{row.name}</strong>
                  </span>
                  <span>{row.isbn}</span>
                  <span>{row.price}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "Transfer Courses & Equivalence" ? (
        <section className="mh-teacher-card">
          <div
            className="mh-teacher-table"
            style={{ gridTemplateColumns: "minmax(180px,1.2fr) minmax(200px,1.4fr)" }}
          >
            <div className="mh-teacher-table__head">
              <span>Institution</span>
              <span>Transfer Course</span>
            </div>
            {(transfers?.rows || []).length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 2" }}>
                  {transfers?.emptyMessage || "No transfer courses were found."}
                </span>
              </div>
            ) : (
              (transfers?.rows || []).map((row) => (
                <div key={row.id} className="mh-teacher-table__row">
                  <span>
                    <strong>{row.institution}</strong>
                  </span>
                  <span>{row.course}</span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === "Course Sessions & Offerings" ? (
        <section className="mh-teacher-card">
          <div className="mh-teacher-toolbar mh-teacher-schemes-list__toolbar">
            <label className="mh-teacher-schemes-list__filter">
              <span className="mh-teacher-sr-only">Status filter</span>
              <select
                className="mh-teacher-field"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {(data.statusOptions || []).map((o) => (
                  <option key={`${o.value}-${o.label}`} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            className="mh-teacher-table"
            style={{
              gridTemplateColumns:
                "minmax(140px,1fr) minmax(120px,1fr) minmax(120px,1fr) minmax(140px,1.1fr) minmax(160px,1.2fr) minmax(160px,0.9fr)",
            }}
          >
            <div className="mh-teacher-table__head">
              <span>Course</span>
              <span>Location</span>
              <span>Instructors</span>
              <span>Schedule</span>
              <span>Enrolments</span>
              <span aria-hidden="true" />
            </div>
            {sessions.length === 0 ? (
              <div className="mh-teacher-table__row">
                <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 6" }}>
                  {live?.loading
                    ? "Loading sessions…"
                    : "No sessions for this status. Use Create Session / Offering to add one."}
                </span>
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="mh-teacher-table__row mh-teacher-course-admin__session">
                  <span>
                    <strong>{session.course}</strong>
                    <em className="mh-teacher-manage-terms__code">{session.status}</em>
                  </span>
                  <span>{session.location}</span>
                  <span>{session.instructors}</span>
                  <span>{session.schedule}</span>
                  <span className="mh-teacher-enrolment-cell">
                    <button type="button" className="mh-teacher-link">
                      Manage Wait List
                    </button>
                    <button type="button" className="mh-teacher-link">
                      Reserved Seats
                    </button>
                    <em>Enrolled: {session.enrolled}</em>
                    <em>Reserved: {session.reserved}</em>
                    <em>Wait List: {session.waitList}</em>
                  </span>
                  <span className="mh-teacher-schemes-list__actions">
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() => {
                        const liveSection = !session.id.startsWith("sess-");
                        router.push(
                          liveSection
                            ? `/instructor/sections/${encodeURIComponent(session.id)}`
                            : `${createHref}&sessionId=${encodeURIComponent(session.id)}`,
                        );
                      }}
                    >
                      {session.id.startsWith("sess-") ? "VIEW" : "OPEN COURSE"}
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link"
                      onClick={() =>
                        router.push(`${createHref}&sessionId=${encodeURIComponent(session.id)}`)
                      }
                    >
                      EDIT
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-link mh-teacher-link--danger"
                      disabled={live?.busy}
                      onClick={() => void live?.runAction?.("Delete Session", session.id)}
                    >
                      DELETE
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {linkedOpen ? (
        <div className="mh-teacher-modal" role="dialog" aria-modal="true" aria-label="Add Cross-Listed / Linked Course">
          <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={() => setLinkedOpen(false)} />
          <div className="mh-teacher-modal__panel">
            <div className="mh-teacher-modal__head">
              <h2>Add Cross-Listed / Linked Course</h2>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setLinkedOpen(false)}>
                Close
              </button>
            </div>
            <div className="mh-teacher-modal__body">
              <h3>Cross-Listed / Linked Course Details</h3>
              <div className="mh-teacher-fields">
                <label>
                  <span>Select Linked Course</span>
                  <select
                    className="mh-teacher-field"
                    value={linkedForm.course}
                    onChange={(e) => setLinkedForm((p) => ({ ...p, course: e.target.value }))}
                  >
                    <option value="">-- Select Course --</option>
                    {(linked?.courseOptions || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Linking Condition</span>
                  <select
                    className="mh-teacher-field"
                    value={linkedForm.condition}
                    onChange={(e) => setLinkedForm((p) => ({ ...p, condition: e.target.value }))}
                  >
                    {(linked?.conditionOptions || [{ label: "Optional Enrolment", value: "Optional Enrolment" }]).map(
                      (o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </div>
            <div className="mh-teacher-modal__foot">
              <button
                type="button"
                className="mh-teacher-btn"
                disabled={!linkedForm.course || live?.busy}
                onClick={() => {
                  void live?.runAction?.(
                    "Save Linked Course",
                    JSON.stringify({
                      __courseId: courseId,
                      "Select Linked Course": linkedForm.course,
                      "Linking Condition": linkedForm.condition,
                    }),
                  );
                  setLinkedOpen(false);
                }}
              >
                Save Linked Course
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {textbookOpen ? (
        <div className="mh-teacher-modal" role="dialog" aria-modal="true" aria-label="Add Textbook to Course">
          <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={() => setTextbookOpen(false)} />
          <div className="mh-teacher-modal__panel">
            <div className="mh-teacher-modal__head">
              <h2>Add Textbook to Course</h2>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setTextbookOpen(false)}>
                Close
              </button>
            </div>
            <div className="mh-teacher-modal__body">
              <h3>Select Textbook</h3>
              <div className="mh-teacher-fields">
                <label>
                  <span>Select Textbook</span>
                  <select
                    className="mh-teacher-field"
                    value={textbookForm.textbook}
                    onChange={(e) => setTextbookForm((p) => ({ ...p, textbook: e.target.value }))}
                  >
                    {(textbooks?.textbookOptions || [{ label: "-- Select Textbook --", value: "" }]).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Textbook Opt-Out</span>
                  <select
                    className="mh-teacher-field"
                    value={textbookForm.optOut}
                    onChange={(e) => setTextbookForm((p) => ({ ...p, optOut: e.target.value }))}
                  >
                    <option value="System Default">System Default</option>
                    <option value="Allow Opt-Out">Allow Opt-Out</option>
                    <option value="No Opt-Out">No Opt-Out</option>
                  </select>
                </label>
                <label>
                  <span>Recurring Textbook Fee</span>
                  <select
                    className="mh-teacher-field"
                    value={textbookForm.recurring}
                    onChange={(e) => setTextbookForm((p) => ({ ...p, recurring: e.target.value }))}
                  >
                    <option value="One Time">One Time</option>
                    <option value="Per Term">Per Term</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mh-teacher-modal__foot">
              <button
                type="button"
                className="mh-teacher-btn"
                disabled={!textbookForm.textbook || live?.busy}
                onClick={() => {
                  void live?.runAction?.(
                    "Add Textbook to Course",
                    JSON.stringify({
                      __courseId: courseId,
                      "Select Textbook": textbookForm.textbook,
                      "Textbook Opt-Out": textbookForm.optOut,
                      "Recurring Textbook Fee": textbookForm.recurring,
                    }),
                  );
                  setTextbookOpen(false);
                }}
              >
                Add Textbook
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {transferOpen ? (
        <div className="mh-teacher-modal" role="dialog" aria-modal="true" aria-label="Add Transfer Course">
          <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={() => setTransferOpen(false)} />
          <div className="mh-teacher-modal__panel">
            <div className="mh-teacher-modal__head">
              <h2>Add Transfer Course</h2>
              <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={() => setTransferOpen(false)}>
                Close
              </button>
            </div>
            <div className="mh-teacher-modal__body">
              <h3>Transfer Course Details</h3>
              <div className="mh-teacher-fields">
                <label>
                  <span>Transfer Institution</span>
                  <select
                    className="mh-teacher-field"
                    value={transferForm.institution}
                    onChange={(e) => setTransferForm((p) => ({ ...p, institution: e.target.value }))}
                  >
                    {(transfers?.institutionOptions || [{ label: "-- Select Institution --", value: "" }]).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Transfer Course Name</span>
                  <input
                    className="mh-teacher-field"
                    value={transferForm.name}
                    onChange={(e) => setTransferForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Transfer Course Number</span>
                  <input
                    className="mh-teacher-field"
                    value={transferForm.number}
                    onChange={(e) => setTransferForm((p) => ({ ...p, number: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Transfer Course Credits</span>
                  <input
                    className="mh-teacher-field"
                    value={transferForm.credits}
                    onChange={(e) => setTransferForm((p) => ({ ...p, credits: e.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="mh-teacher-modal__foot">
              <button
                type="button"
                className="mh-teacher-btn"
                disabled={!transferForm.institution || !transferForm.name || live?.busy}
                onClick={() => {
                  void live?.runAction?.(
                    "Save Transfer Course",
                    JSON.stringify({
                      __courseId: courseId,
                      "Transfer Institution": transferForm.institution,
                      "Transfer Course Name": transferForm.name,
                      "Transfer Course Number": transferForm.number,
                      "Transfer Course Credits": transferForm.credits,
                    }),
                  );
                  setTransferOpen(false);
                }}
              >
                Save Transfer Course
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingGradesView({ config }: { config: TeacherScreenConfig }) {
  const data = config.pendingGrades;
  const [activeCode, setActiveCode] = useState(data?.rows.find((r) => r.active)?.code || data?.rows[0]?.code || "");
  if (!data) return null;

  const statusClass = (status: string) => {
    if (status === "SUBMITTED") return "is-submitted";
    if (status === "UNDER REVIEW") return "is-review";
    return "is-rejected";
  };

  return (
    <div className="mh-teacher-pending" data-figma-id={config.figmaId}>
      <div className="mh-teacher-pending__alert" role="status">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 9v4M12 17h.01M10.3 4.3 2.8 17.3A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-2.7L13.7 4.3a2 2 0 0 0-3.4 0Z" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{data.alert}</span>
      </div>

      <div className="mh-teacher-pending__layout">
        <section className="mh-teacher-card mh-teacher-pending__queue">
          <div className="mh-teacher-pending__queue-head">
            <h2>{data.queueTitle}</h2>
            <span className="mh-teacher-pending__action-badge">{data.actionBadge}</span>
          </div>
          <div className="mh-teacher-pending__table">
            <div className="mh-teacher-pending__table-head">
              <span>CODE / SECT</span>
              <span>COURSE TITLE</span>
              <span>TEACHER</span>
              <span>STUDENTS</span>
              <span>MISSING GRADES</span>
              <span>STATUS</span>
            </div>
            {data.rows.map((row) => (
              <button
                key={row.code}
                type="button"
                className={`mh-teacher-pending__table-row${activeCode === row.code ? " is-active" : ""}`}
                onClick={() => setActiveCode(row.code)}
              >
                <span className="mh-teacher-pending__code">{row.code}</span>
                <span className="mh-teacher-pending__title">{row.title}</span>
                <span>{row.teacher}</span>
                <span className="mh-teacher-pending__num">{row.students}</span>
                <span className={`mh-teacher-pending__num is-${row.missingTone}`}>{row.missing}</span>
                <span>
                  <span className={`mh-teacher-pending__status ${statusClass(row.status)}`}>{row.status}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="mh-teacher-card mh-teacher-pending__audit">
          <h3>{data.audit.title}</h3>
          <div className="mh-teacher-pending__stats">
            <div>
              <span>GRADEBOOK TOTAL</span>
              <strong>{data.audit.locked}</strong>
            </div>
            <div className="is-avg">
              <span>AVERAGE GRADE</span>
              <strong>{data.audit.average}</strong>
            </div>
          </div>
          <label className="mh-teacher-assess__field">
            <span>Reviewer Audit Notes</span>
            <div className="mh-teacher-field mh-teacher-field--tall">{data.audit.notes}</div>
          </label>
          <label className="mh-teacher-assess__field">
            <span>Reason for Rejection (Mandatory if Rejecting)</span>
            <div className="mh-teacher-field mh-teacher-pending__placeholder">{data.audit.rejectPlaceholder}</div>
          </label>
          <div className="mh-teacher-pending__actions">
            <ActionBtn label="Reject Submission" tone="secondary" className="mh-teacher-pending__reject" />
            <ActionBtn label="Submit for Approval" />
          </div>
        </aside>
      </div>

      <section className="mh-teacher-card" style={{ marginTop: 16 }}>
        <h2>Student file submissions</h2>
        {(data.fileQueue ?? []).length === 0 ? (
          <p className="mh-teacher-muted">No student files uploaded for your sections yet.</p>
        ) : (
          <div className="mh-teacher-list">
            {(data.fileQueue ?? []).map((packet) => (
              <div key={packet.id} className="mh-teacher-list__item" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <strong>
                    {packet.student} · {packet.assignment}
                  </strong>
                  <span>
                    {packet.course} · {packet.studentNumber} · {packet.status} · {packet.submittedAt}
                  </span>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {packet.files.map((f) => (
                      <li key={f.id}>
                        {f.name} ({f.version}, {f.size}, {f.mimeType})
                      </li>
                    ))}
                  </ul>
                </div>
                <span className={badgeClass(packet.status === "submitted" ? "active" : "muted")}>{packet.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


function MasterSchedulingView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.masterScheduling;
  const [programFilter, setProgramFilter] = useState(data?.programFilterValue || "");
  if (!data) return null;
  const options = data.programOptions || [];
  const rows = (data.rows || []).filter((row) => {
    if (!programFilter) return true;
    const token = programFilter.toLowerCase();
    return (
      row.program.toLowerCase().includes(token) ||
      row.session.toLowerCase().includes(token) ||
      row.session.toUpperCase().startsWith(programFilter.toUpperCase() + ":") ||
      row.session.toUpperCase().startsWith(programFilter.toUpperCase() + "-")
    );
  });
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar mh-teacher-sched-list__toolbar">
          <label className="mh-teacher-sched-list__filter">
            <span>{data.programFilterLabel || "Filter Program"}</span>
            <select className="mh-teacher-field" value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}>
              {renderGroupedOptions(options)}
            </select>
          </label>
          <PageActions config={config} />
        </div>
        <div
          className="mh-teacher-table mh-teacher-sched-list__table"
          style={{ gridTemplateColumns: "minmax(220px,1.4fr) minmax(200px,1.2fr) minmax(160px,0.9fr)" }}
        >
          <div className="mh-teacher-table__head">
            <span>Program Schedule Dates</span>
            <span>Program</span>
            <span aria-hidden="true" />
          </div>
          {rows.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 3" }}>
                {live?.loading ? "Loading schedules…" : "No master schedules match this program filter."}
              </span>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="mh-teacher-table__row mh-teacher-sched-list__row">
                <span>
                  <strong>{row.dateRange}</strong>
                  <span className="mh-teacher-muted">
                    {row.session} ({row.duration})
                  </span>
                </span>
                <span>{row.program}</span>
                <span className="mh-teacher-sched-list__actions">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() =>
                      router.push(
                        `/instructor/f/t85-manage-schedule?scheduleId=${encodeURIComponent(row.id)}`,
                      )
                    }
                  >
                    Manage
                  </button>
                  <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.("Copy Master Schedule", row.id)}>
                    Copy
                  </button>
                  {row.canDelete !== false ? (
                    <button type="button" className="mh-teacher-link mh-teacher-link--danger" disabled={live?.busy} onClick={() => void live?.runAction?.("Delete Master Schedule", row.id)}>
                      Delete
                    </button>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function AcademicCalendarsView({ config }: { config: TeacherScreenConfig }) {
  const live = useOptionalTeacherLive();
  const data = config.academicCalendars;
  if (!data) return null;
  const rows = data.rows || [];
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card">
        <div className="mh-teacher-toolbar">
          <div>
            <h2 style={{ margin: 0 }}>{config.title}</h2>
          </div>
          <PageActions config={config} />
        </div>
        <div className="mh-teacher-table" style={{ gridTemplateColumns: "minmax(180px,1.2fr) minmax(200px,1.2fr) minmax(100px,0.6fr)" }}>
          <div className="mh-teacher-table__head">
            <span>Name</span>
            <span>Dates</span>
            <span>Status</span>
          </div>
          {rows.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 3" }}>
                {live?.loading ? "Loading calendars…" : data.emptyMessage || "No academic calendars were found."}
              </span>
            </div>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="mh-teacher-table__row">
                <span>
                  <strong>{row.name}</strong>
                </span>
                <span>{row.dates}</span>
                <span>{row.status}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function SchedulerView({ config }: { config: TeacherScreenConfig }) {
  const s = config.scheduler;
  if (!s) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <section className="mh-teacher-card mh-teacher-scheduler">
        <div className="mh-teacher-scheduler__head">
          {s.days.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mh-teacher-scheduler__grid">
          {s.days.map((day, dayIdx) => (
            <div key={day} className="mh-teacher-scheduler__col">
              {s.slots
                .filter((slot) => slot.day === dayIdx)
                .map((slot) => (
                  <div key={slot.label + slot.start} className={`mh-teacher-scheduler__slot is-${slot.tone || "primary"}`}>
                    <strong>{slot.label}</strong>
                    <span>
                      {slot.start}–{slot.end}
                    </span>
                    <span>{slot.room}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CalendarBoardView({ config }: { config: TeacherScreenConfig }) {
  const c = config.calendarBoard;
  if (!c) return null;
  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-hub-grid">
        {c.months.map((month) => (
          <section key={month} className="mh-teacher-card">
            <h2>{month}</h2>
            <div className="mh-teacher-list">
              {c.events.map((e, idx) => (
                <div key={`${e.date}-${e.label}-${idx}`} className="mh-teacher-list__item">
                  <div>
                    <strong>{e.date}</strong>
                    <span>{e.label}</span>
                  </div>
                  <span className={badgeClass(e.tone)}>{e.tone || "event"}</span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function statusToneAtt(status: string): string {
  return status.toLowerCase();
}

const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"] as const;

function AttendanceSessionView({ config }: { config: TeacherScreenConfig }) {
  const data = config.attendanceSession;
  const live = useOptionalTeacherLive();
  const [students, setStudents] = useState(data?.students || []);

  useEffect(() => {
    setStudents(data?.students || []);
  }, [data?.students]);

  if (!data) {
    return (
      <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
        <PageHead config={config} />
        <section className="mh-teacher-card">
          <p className="mh-teacher-muted">Loading attendance session…</p>
        </section>
      </div>
    );
  }

  function markAllPresent() {
    setStudents((prev) => prev.map((s) => ({ ...s, status: "Present" as const })));
  }

  function cycleStatus(studentNumber: string) {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentNumber) return s;
        const idx = ATTENDANCE_STATUSES.indexOf(s.status);
        const next = ATTENDANCE_STATUSES[(idx + 1) % ATTENDANCE_STATUSES.length];
        return { ...s, status: next };
      }),
    );
  }

  function rosterPayload() {
    return JSON.stringify({
      roster: students.map((s) => ({
        studentId: s.studentId,
        studentNumber: s.id,
        id: s.id,
        name: s.name,
        status: s.status,
      })),
    });
  }

  const present = students.filter((s) => s.status === "Present").length;
  const absent = students.filter((s) => s.status === "Absent").length;
  const late = students.filter((s) => s.status === "Late").length;
  const excused = students.filter((s) => s.status === "Excused").length;
  const total = students.length || 1;
  const liveStats = [
    { label: "Present", count: present, pct: `${Math.round((present / total) * 100)}%` },
    { label: "Absent", count: absent, pct: `${Math.round((absent / total) * 100)}%` },
    { label: "Late", count: late, pct: `${Math.round((late / total) * 100)}%` },
    { label: "Excused", count: excused, pct: `${Math.round((excused / total) * 100)}%` },
  ];

  return (
    <div className="mh-teacher-attendance" data-figma-id={config.figmaId}>
      <div className="mh-teacher-attendance__alert" role="status">
        {data.alert.replace(/^System Deviation Alert:\s*/i, "")}
      </div>

      <section className="mh-teacher-card mh-teacher-attendance__meta">
        <div className="mh-teacher-attendance__meta-item">
          <span className="mh-teacher-muted">CLASS</span>
          <strong>{data.classNode}</strong>
        </div>
        <div className="mh-teacher-attendance__meta-item">
          <span className="mh-teacher-muted">DATE</span>
          <strong>{data.dateLabel}</strong>
        </div>
        <button type="button" className="mh-teacher-btn mh-teacher-btn--dark" onClick={markAllPresent} disabled={!students.length}>
          Mark All Present
        </button>
      </section>

      <div className="mh-teacher-attendance__split">
        <section className="mh-teacher-card mh-teacher-attendance__roster">
          <div className="mh-teacher-card__head">
            <h2>{`Student Roster (${students.length} Total)`}</h2>
            <span className="mh-teacher-attendance__draft">{data.draftStatus}</span>
          </div>
          <div className="mh-teacher-attendance__list">
            {students.length === 0 ? (
              <p className="mh-teacher-muted">No enrolled students in this session yet. Check Students / Roster for active enrolments.</p>
            ) : (
              students.map((s) => (
                <div key={s.id} className="mh-teacher-attendance__row">
                  <img
                    src={s.avatar || "/brand/teacher/avatar.png"}
                    alt=""
                    width={40}
                    height={40}
                    className="mh-teacher-attendance__avatar"
                  />
                  <div className="mh-teacher-attendance__who">
                    <strong>{s.name}</strong>
                    <span className="mh-teacher-muted">{s.id}</span>
                  </div>
                  <button
                    type="button"
                    className={`mh-teacher-att-pill mh-teacher-att-pill--${statusToneAtt(s.status)}`}
                    onClick={() => cycleStatus(s.id)}
                    title="Tap to change status"
                  >
                    {s.status}
                  </button>
                  <p className="mh-teacher-attendance__note">{s.note}</p>
                  <div className={`mh-teacher-attendance__pct${s.atRisk ? " is-risk" : ""}`}>
                    <strong>{s.pct}</strong>
                    <span>Attendance</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className="mh-teacher-card mh-teacher-attendance__stats">
          <h2>Session Stats</h2>
          {liveStats.map((st) => (
            <div key={st.label} className="mh-teacher-attendance__stat">
              <div className="mh-teacher-card__head">
                <span>{st.label}</span>
                <strong>
                  {st.count} <span className="mh-teacher-muted">({st.pct})</span>
                </strong>
              </div>
              <div className="mh-teacher-progress__track">
                <div
                  className={`mh-teacher-progress__fill mh-teacher-attendance__bar--${st.label.toLowerCase()}`}
                  style={{ width: st.pct }}
                />
              </div>
            </div>
          ))}
          <div className="mh-teacher-attendance__actions">
            {String(data.draftStatus || "").includes("FINALIZED") ? (
              <button type="button" className="mh-teacher-btn" disabled>
                Session finalized
              </button>
            ) : (
              <button
                type="button"
                className="mh-teacher-btn mh-teacher-btn--primary"
                disabled={live?.busy || !students.length}
                onClick={() => void live?.runAction?.(config.primaryAction || "Submit & Finalize Session", rosterPayload())}
              >
                {live?.busy ? "Saving…" : config.primaryAction || "Submit & Finalize Session"}
              </button>
            )}
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--secondary"
              disabled={live?.busy || !students.length}
              onClick={() => void live?.runAction?.(config.secondaryAction || "Save Draft State", rosterPayload())}
            >
              {config.secondaryAction || "Save Draft State"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AttendanceReviewView({ config }: { config: TeacherScreenConfig }) {
  const data = config.attendanceReview;
  const [filter, setFilter] = useState(data?.filters.find((f) => f.active)?.label || data?.filters[0]?.label || "");
  const [resolved, setResolved] = useState<Record<string, "approved" | "rejected">>({});
  if (!data) return null;

  const visible = data.requests.filter((r) => {
    if (filter.startsWith("Pending")) return !resolved[r.id];
    if (filter.startsWith("Approved")) return resolved[r.id] === "approved";
    if (filter.startsWith("Rejected")) return resolved[r.id] === "rejected";
    return true;
  });

  return (
    <div className="mh-teacher-att-review" data-figma-id={config.figmaId}>
      <div className="mh-teacher-page-head">
        <div>
          <h2>Attendance Correction Requests</h2>
          <p>Process pending student attendance corrections and compliance overrides.</p>
        </div>
      </div>

      <div className="mh-teacher-att-review__layout">
        <div>
          <div className="mh-teacher-att-review__filters">
            {data.filters.map((f) => (
              <button
                key={f.label}
                type="button"
                className={`mh-teacher-att-review__filter${filter === f.label ? " is-active" : ""}`}
                onClick={() => setFilter(f.label)}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          <div className="mh-teacher-att-review__list">
            {visible.length === 0 ? (
              <p className="mh-teacher-muted">No requests in this queue.</p>
            ) : (
              visible.map((r) => (
                <article key={r.id} className="mh-teacher-card mh-teacher-att-review__card">
                  <div className="mh-teacher-card__head">
                    <div>
                      <strong>
                        {r.name} <span className="mh-teacher-muted">{r.id}</span>
                      </strong>
                      <div className="mh-teacher-muted">
                        {r.course} · {r.date}
                      </div>
                    </div>
                  </div>
                  <div className="mh-teacher-att-review__flow">
                    <div>
                      <span className="mh-teacher-muted">CURRENT STATUS</span>
                      <span className={`mh-teacher-att-pill mh-teacher-att-pill--${statusToneAtt(r.current)}`}>
                        {r.current}
                      </span>
                    </div>
                    <span className="mh-teacher-att-review__arrow" aria-hidden>
                      →
                    </span>
                    <div>
                      <span className="mh-teacher-muted">REQUESTED STATUS</span>
                      <span className={`mh-teacher-att-pill mh-teacher-att-pill--${statusToneAtt(r.requested)}`}>
                        {r.requested}
                      </span>
                    </div>
                  </div>
                  <p>{r.reason}</p>
                  <div className="mh-teacher-att-review__file">
                    <img src="/brand/icons/file-text.svg" alt="" width={14} height={14} />
                    <span>{r.attachment}</span>
                  </div>
                  <div className="mh-teacher-att-review__actions">
                    <button
                      type="button"
                      className="mh-teacher-btn mh-teacher-btn--danger-outline"
                      onClick={() => setResolved((prev) => ({ ...prev, [r.id]: "rejected" }))}
                    >
                      Reject Request
                    </button>
                    <button
                      type="button"
                      className="mh-teacher-btn mh-teacher-btn--success-outline"
                      onClick={() => setResolved((prev) => ({ ...prev, [r.id]: "approved" }))}
                    >
                      Approve Correction
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <aside className="mh-teacher-att-review__side">
          <section className="mh-teacher-card">
            <h3>Compliance Preview</h3>
            <p className="mh-teacher-muted">
              Approval of {data.compliance.student}&apos;s request will instantly restore status:
            </p>
            <div className="mh-teacher-att-review__score">
              <span className="is-risk">{data.compliance.fromPct}</span>
              <span aria-hidden>→</span>
              <span className="is-ok">{data.compliance.toPct}</span>
            </div>
            <span className={badgeClass("success")}>{data.compliance.badge}</span>
          </section>
          <section className="mh-teacher-card">
            <h3>System Overview Log</h3>
            <p className="mh-teacher-muted">{data.logNote}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AuthGateView({ config }: { config: TeacherScreenConfig }) {
  const data = config.authGate;
  if (!data) return null;
  return (
    <div className="mh-teacher-auth" data-figma-id={config.figmaId}>
      <section className="mh-teacher-card mh-teacher-auth__card">
        <h2>{data.heading}</h2>
        <p className="mh-teacher-auth__desc">{data.description}</p>
        {(data.extraFields || []).map((field) => (
          <label key={field.label} className="mh-teacher-auth__field">
            <span>{field.label}</span>
            <div className="mh-teacher-field">{field.value || "—"}</div>
          </label>
        ))}
        <label className="mh-teacher-auth__field">
          <span>{data.fieldLabel}</span>
          <div className="mh-teacher-field">{data.fieldValue || "—"}</div>
        </label>
        {data.ctaHref ? (
          <Link href={data.ctaHref} className="mh-teacher-btn mh-teacher-btn--primary mh-teacher-auth__cta">
            {data.cta}
          </Link>
        ) : (
          <button type="button" className="mh-teacher-btn mh-teacher-btn--primary mh-teacher-auth__cta">
            {data.cta}
          </button>
        )}
        {data.secondaryCta && data.secondaryHref ? (
          <Link href={data.secondaryHref} className="mh-teacher-btn mh-teacher-btn--secondary mh-teacher-auth__cta">
            {data.secondaryCta}
          </Link>
        ) : null}
        <p className="mh-teacher-auth__help">{data.help}</p>
      </section>
    </div>
  );
}

function AlertListView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const data = config.alertList;
  if (!data) return null;
  return (
    <div className="mh-teacher-alerts" data-figma-id={config.figmaId}>
      <PageHead config={config} badge={data.badge} />
      <div className="mh-teacher-alerts__list">
        {data.items.length === 0 ? (
          <section className="mh-teacher-card">
            <p className="mh-teacher-muted">No academic alerts yet. Use Create alert to add one.</p>
          </section>
        ) : null}
        {data.items.map((item, index) => (
          <article key={item.id || `${item.name}-${item.course}-${item.tag}-${index}`} className="mh-teacher-card mh-teacher-alerts__item">
            <div className="mh-teacher-alerts__avatar" aria-hidden>
              {item.avatar || item.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="mh-teacher-alerts__body">
              <div className="mh-teacher-alerts__top">
                <strong>{item.name}</strong>
                <span className="mh-teacher-muted">{item.course}</span>
                <span className={badgeClass(item.tagTone)}>{item.tag}</span>
              </div>
              <p>{item.body}</p>
              <div className="mh-teacher-actions">
                <button
                  type="button"
                  className="mh-teacher-btn mh-teacher-btn--secondary"
                  onClick={() => item.href && router.push(item.href)}
                  disabled={!item.href}
                >
                  Open profile
                </button>
                <button type="button" className="mh-teacher-btn mh-teacher-btn--primary" disabled>
                  Resolve
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function AssessmentHubView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const data = config.assessmentHub;
  const kpis = data?.kpis ?? [];
  const groups = data?.groups ?? [];
  const empty = groups.length === 0;

  return (
    <div className="mh-teacher-stack mh-teacher-assess-hub" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      {kpis.length > 0 ? (
        <div className="mh-teacher-dash__kpis mh-teacher-assess-hub__kpis">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="mh-teacher-dash__kpi">
              <div className="mh-teacher-dash__kpi-label">{kpi.label}</div>
              <div className="mh-teacher-dash__kpi-value">{kpi.value}</div>
              {kpi.hint ? <div className="mh-teacher-dash__kpi-hint">{kpi.hint}</div> : null}
            </div>
          ))}
        </div>
      ) : null}

      {empty ? (
        <section className="mh-teacher-card mh-teacher-assess-hub__empty">
          <h2>No assessments yet</h2>
          <p className="mh-teacher-muted">
            Create a weighted assessment for one of your teaching sections, then open the gradebook to score submissions.
          </p>
          <div className="mh-teacher-actions">
            <ActionBtn
              label={config.primaryAction || "Create Assessment"}
              href={config.primaryActionHref}
              tone="primary"
            />
            {config.secondaryActionHref ? (
              <ActionBtn
                label={config.secondaryAction || "Open Gradebook"}
                href={config.secondaryActionHref}
                tone="secondary"
              />
            ) : null}
          </div>
        </section>
      ) : (
        <div className="mh-teacher-assess-hub__groups">
          {groups.map((group) => (
            <section
              key={`${group.courseCode}-${group.sectionCode}`}
              className="mh-teacher-card mh-teacher-assess-hub__group"
            >
              <header className="mh-teacher-assess-hub__group-head">
                <div>
                  <p className="mh-teacher-assess-hub__eyebrow">
                    {group.courseCode} · {group.sectionCode}
                  </p>
                  <h2>{group.courseTitle}</h2>
                </div>
                <span className={badgeClass("info")}>
                  {group.count} assessment{group.count === 1 ? "" : "s"}
                </span>
              </header>
              <ul className="mh-teacher-assess-hub__list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="mh-teacher-assess-hub__item"
                      onClick={() => item.href && router.push(item.href)}
                    >
                      <div className="mh-teacher-assess-hub__item-main">
                        <strong>{item.title}</strong>
                        <span className="mh-teacher-muted">
                          Weight {item.weight} · Due {item.due}
                        </span>
                      </div>
                      <div className="mh-teacher-assess-hub__item-meta">
                        <span className={badgeClass(item.statusTone)}>{item.status}</span>
                        <span className="mh-teacher-assess-hub__chevron" aria-hidden>
                          →
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GradebookView({ config }: { config: TeacherScreenConfig }) {
  const data = config.gradebook;
  if (!data) return null;
  const colCount = data.columns.length;
  const history = data.history ?? [];
  return (
    <div className="mh-teacher-gradebook" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <p className="mh-teacher-muted mh-teacher-gradebook__course">{data.course}</p>
      <section className="mh-teacher-card">
        <div
          className="mh-teacher-table mh-teacher-gradebook__table"
          style={{ gridTemplateColumns: `minmax(140px,1.1fr) repeat(${Math.max(colCount - 1, 1)}, minmax(90px,1fr))` }}
        >
          <div className="mh-teacher-table__head">
            {data.columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {data.rows.map((row) => (
            <div key={row.id} className="mh-teacher-table__row">
              <span>
                <strong>{row.name}</strong>
                <span className="mh-teacher-muted">{row.id}</span>
              </span>
              {row.assessments.map((a, i) => (
                <span key={`${row.id}-${i}`}>{a}</span>
              ))}
              <span>
                <strong>
                  {row.total} ({row.letter})
                </strong>
                <span className={badgeClass(row.status === "Draft" ? "draft" : "active")}>{row.status}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="mh-teacher-card">
        <h2>Grade history</h2>
        {history.length === 0 ? (
          <p className="mh-teacher-muted">No grade history recorded for this section yet.</p>
        ) : (
          <div className="mh-teacher-list">
            {history.map((h, i) => (
              <div key={`${h.student}-${h.assignment}-${i}`} className="mh-teacher-list__item">
                <div>
                  <strong>{h.student}</strong>
                  <span>
                    {h.assignment} · {h.score}
                    {h.when ? ` · ${h.when}` : ""}
                  </span>
                </div>
                <span className={badgeClass(h.status === "published" ? "success" : "warning")}>{h.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {data.legend?.length ? (
        <aside className="mh-teacher-card mh-teacher-gradebook__legend">
          {data.legend.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </aside>
      ) : null}
    </div>
  );
}

function rowMatchesStatusFilter(
  row: { cells: string[]; badge?: string; badgeTone?: string },
  labelRaw: string,
) {
  const label = labelRaw.toLowerCase().trim();
  if (!label || label === "all") return true;
  const status = (row.cells[5] || "").toLowerCase();
  const lifecycle = (row.cells[4] || row.badge || "").toLowerCase();
  const badge = (row.badge || "").toLowerCase();
  const tone = (row.badgeTone || "").toLowerCase();
  if (badge === label || lifecycle === label) return true;
  if (label === "enrolled") return status === "enrolled";
  if (label === "withdrawn" || label.includes("withdrawn")) {
    return status === "withdrawn" || lifecycle.includes("withdraw") || badge.includes("withdraw");
  }
  if (label === "warning") return tone === "warning" || lifecycle === "warning";
  if (label === "at risk" || label.includes("risk") || label.includes("probation")) {
    return tone === "danger" || lifecycle === "alert" || lifecycle === "probation" || badge.includes("hold");
  }
  if (label.includes("active student") || label === "active") {
    return badge.includes("active student") || status === "enrolled";
  }
  if (label.includes("graduat")) return status === "completed" || lifecycle.includes("graduat") || badge.includes("graduat");
  if (label.includes("incomplete")) return status === "incomplete" || lifecycle.includes("incomplete");
  if (label.includes("follow")) return badge.includes("follow") || lifecycle.includes("follow");
  if (label.includes("inquiry")) return badge.includes("inquiry") || lifecycle.includes("inquiry");
  if (label.includes("cloa")) return badge.includes("cloa") || lifecycle.includes("cloa");
  return status.includes(label) || lifecycle.includes(label) || badge.includes(label);
}

function StatusFilterView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const data = config.statusFilter;
  const [activeLabel, setActiveLabel] = useState(
    () => data?.filters.find((f) => f.active)?.label || data?.filters[0]?.label || "All",
  );

  useEffect(() => {
    const next = data?.filters.find((f) => f.active)?.label || data?.filters[0]?.label || "All";
    setActiveLabel((prev) => (data?.filters.some((f) => f.label === prev) ? prev : next));
  }, [data]);

  if (!data) return null;

  const filteredRows = data.rows.filter((row) => rowMatchesStatusFilter(row, activeLabel));
  const filters = data.filters.map((f) => ({
    ...f,
    active: f.label === activeLabel,
    count:
      f.label.toLowerCase() === "all"
        ? data.rows.length
        : data.rows.filter((row) => rowMatchesStatusFilter(row, f.label)).length,
  }));

  return (
    <div className="mh-teacher-status" data-figma-id={config.figmaId}>
      <PageHead config={config} />
      <div className="mh-teacher-status__filters">
        {filters.map((f) => (
          <button
            key={f.label}
            type="button"
            className={`mh-teacher-status__chip${f.active ? " is-active" : ""}`}
            onClick={() => setActiveLabel(f.label)}
            aria-pressed={f.active}
          >
            <strong>{f.label}</strong>
            <span>{f.count}</span>
          </button>
        ))}
      </div>
      <section className="mh-teacher-card">
        <p className="mh-teacher-muted" style={{ marginTop: 0 }}>
          Showing {filteredRows.length} of {data.rows.length} student(s)
        </p>
        <div
          className="mh-teacher-table"
          style={{ gridTemplateColumns: `repeat(${data.columns.length}, minmax(100px, 1fr))` }}
        >
          <div className="mh-teacher-table__head">
            {data.columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {filteredRows.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: `1 / span ${data.columns.length}` }}>
                No students match “{activeLabel}”.
              </span>
            </div>
          ) : (
            filteredRows.map((row, i) => (
              <button
                key={`${row.cells.join("-")}-${i}`}
                type="button"
                className="mh-teacher-table__row mh-teacher-table__row--btn"
                onClick={() => row.href && router.push(row.href)}
              >
                {row.cells.map((cell, j) => (
                  <span key={j}>
                    {j === row.cells.length - 1 && row.badge ? (
                      <span className={badgeClass(row.badgeTone)}>{row.badge}</span>
                    ) : (
                      cell
                    )}
                  </span>
                ))}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function CourseTextbooksView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.courseTextbooks;
  const textbooks = data?.textbooks ?? [];
  if (!data) return null;

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <div className="mh-teacher-page-head">
        <h2 className="mh-sis-page-title">{config.title}</h2>
        <PageActions config={config} />
      </div>
      <section className="mh-teacher-card">
        <div
          className="mh-teacher-table mh-teacher-textbooks__table"
          style={{
            gridTemplateColumns: "minmax(220px,1.6fr) minmax(130px,0.8fr) minmax(140px,0.9fr) minmax(140px,0.8fr)",
          }}
        >
          <div className="mh-teacher-table__head">
            <span>Textbook</span>
            <span>ISBN</span>
            <span>Price</span>
            <span aria-hidden="true" />
          </div>
          {textbooks.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 4" }}>
                {live?.loading
                  ? "Loading textbooks…"
                  : "No textbooks yet. Use Add Textbook to create one."}
              </span>
            </div>
          ) : (
            textbooks.map((book) => (
              <div key={book.id} className="mh-teacher-table__row mh-teacher-textbooks__row">
                <span>
                  <strong>{book.name}</strong>
                  {book.detail ? <em className="mh-teacher-textbooks__detail">{book.detail}</em> : null}
                  <em className="mh-teacher-textbooks__format">{book.format}</em>
                </span>
                <span>{book.isbn}</span>
                <span className="mh-teacher-textbooks__price">
                  <em>Domestic ${book.domestic}</em>
                  <em>International ${book.international}</em>
                </span>
                <span className="mh-teacher-schemes-list__actions">
                  <button
                    type="button"
                    className="mh-teacher-link"
                    onClick={() =>
                      router.push(
                        `/instructor/f/t79-add-textbook?textbookId=${encodeURIComponent(book.id)}`,
                      )
                    }
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    className="mh-teacher-link mh-teacher-link--danger"
                    disabled={live?.busy}
                    onClick={() => void live?.runAction?.("Delete Textbook", book.id)}
                  >
                    DELETE
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ContentRepositoryView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const live = useOptionalTeacherLive();
  const data = config.contentRepository;
  const [courseFilter, setCourseFilter] = useState("");
  const [repository, setRepository] = useState(data?.repositoryFilter || "Master Repository");
  const [applied, setApplied] = useState("");
  const [perPage, setPerPage] = useState(data?.perPage || "50");
  const [page, setPage] = useState(data?.page || "1");
  if (!data) return null;

  const courses = data.courses ?? [];
  const q = applied.trim().toLowerCase();
  const filtered = q
    ? courses.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.number.toLowerCase().includes(q) ||
          `${c.number} ${c.name}`.toLowerCase().includes(q),
      )
    : courses;
  const size = Number.parseInt(perPage, 10) || 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / size));
  const pageNum = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), pageCount);
  const paged = filtered.slice((pageNum - 1) * size, pageNum * size);
  const pageOptions = Array.from({ length: pageCount }, (_, i) => String(i + 1));

  function manageHref(courseId: string) {
    return `/instructor/f/t32-resource-file-manager?courseId=${encodeURIComponent(courseId)}`;
  }
  function editHref(courseId: string) {
    return `/instructor/f/t80-create-content-course?courseId=${encodeURIComponent(courseId)}`;
  }

  return (
    <div className="mh-teacher-stack" data-figma-id={config.figmaId}>
      <SisCrumb crumbs={config.breadcrumbs} />
      <div className="mh-teacher-page-head">
        <h2 className="mh-sis-page-title">{config.title}</h2>
        <PageActions config={config} />
      </div>
      <section className="mh-teacher-card mh-teacher-active-filters">
        <div className="mh-teacher-active-filters__grid mh-teacher-repo-filters">
          <label>
            <span>Course Filter</span>
            <input
              className="mh-teacher-field"
              value={courseFilter}
              placeholder={data.courseFilterPlaceholder || "Enter Course Name / Number Here"}
              onChange={(e) => setCourseFilter(e.target.value)}
            />
          </label>
          <label>
            <span>Repository Filter</span>
            <select className="mh-teacher-field" value={repository} onChange={(e) => setRepository(e.target.value)}>
              {(data.repositoryOptions ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mh-teacher-active-filters__actions">
            <button
              type="button"
              className="mh-teacher-btn mh-teacher-btn--primary"
              disabled={live?.busy}
              onClick={() => {
                setApplied(courseFilter);
                setPage("1");
                void live?.runAction?.("Search Repository", JSON.stringify({ course: courseFilter, repository }));
              }}
            >
              {data.searchLabel || "Search Repository"}
            </button>
          </div>
        </div>
      </section>

      <div className="mh-teacher-active-results">
        <strong>Results: {filtered.length}</strong>
        <label>
          <span>Results per page</span>
          <select
            className="mh-teacher-field"
            value={perPage}
            onChange={(e) => {
              setPerPage(e.target.value);
              setPage("1");
            }}
          >
            {(data.perPageOptions ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Page</span>
          <select className="mh-teacher-field" value={String(pageNum)} onChange={(e) => setPage(e.target.value)}>
            {pageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="mh-teacher-card">
        <div className="mh-teacher-table mh-teacher-repo-table">
          <div className="mh-teacher-table__head">
            <span>Course Name / Number</span>
            <span>LMS</span>
            <span>Status</span>
            <span>Course Types</span>
            <span aria-hidden="true" />
          </div>
          {paged.length === 0 ? (
            <div className="mh-teacher-table__row">
              <span className="mh-teacher-muted" style={{ gridColumn: "1 / span 5" }}>
                {live?.loading
                  ? "Loading repository…"
                  : q
                    ? `No courses match “${applied.trim()}”.`
                    : "No content courses yet. Use Create Content Course to add one."}
              </span>
            </div>
          ) : (
            paged.map((course) => (
              <div key={course.id} className="mh-teacher-table__row mh-teacher-repo-table__row">
                <span>
                  <button
                    type="button"
                    className="mh-teacher-repo-course"
                    onClick={() => router.push(course.workspaceHref || manageHref(course.id))}
                  >
                    <strong>
                      {course.number} — {course.name}
                    </strong>
                  </button>
                </span>
                <span>{course.lms}</span>
                <span>{course.status}</span>
                <span>{course.courseTypes}</span>
                <span className="mh-teacher-schemes-list__actions mh-teacher-repo-actions">
                  {course.workspaceHref ? (
                    <button type="button" className="mh-teacher-link" onClick={() => router.push(course.workspaceHref!)}>
                      USE &amp; EDIT COPY
                    </button>
                  ) : null}
                  {data.canManageMaster ? (
                    <>
                      <button type="button" className="mh-teacher-link" onClick={() => router.push(manageHref(course.id))}>MANAGE</button>
                      <button type="button" className="mh-teacher-link" onClick={() => router.push(editHref(course.id))}>EDIT</button>
                      <button type="button" className="mh-teacher-link mh-teacher-link--danger" disabled={live?.busy} onClick={() => void live?.runAction?.("Delete Content Course", course.id)}>DELETE</button>
                      <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.(`PUSH (${course.push})`, course.id)}>PUSH ({course.push})</button>
                      <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.(`PULL (${course.pull})`, course.id)}>PULL ({course.pull})</button>
                      {typeof course.history === "number" ? (
                        <button type="button" className="mh-teacher-link" disabled={live?.busy} onClick={() => void live?.runAction?.(`HISTORY (${course.history})`, course.id)}>HISTORY ({course.history})</button>
                      ) : null}
                    </>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function renderView(config: TeacherScreenConfig) {
  switch (config.archetype) {
    case "dashboard":
      return <DashboardView config={config} />;
    case "hccMyCourses":
      return <HccMyCoursesView config={config} />;
    case "hccEvaluations":
      return <HccEvaluationsView config={config} />;
    case "hccCourseHistory":
      return <HccCourseHistoryView config={config} />;
    case "hccGradesSubmission":
      return <HccGradesSubmissionView config={config} />;
    case "hccPendingGrades":
      return <HccPendingGradesView config={config} />;
    case "hccAttendance":
      return <HccAttendanceView config={config} />;
    case "hccStudents":
      return <HccStudentsView key={config.hccStudents ? JSON.stringify(config.hccStudents.filters) + (config.hccStudents.letter || "") + String(config.hccStudents.page) : "students"} config={config} />;
    case "hccFlags":
      return <HccFlagsView config={config} />;
    case "hccEmpty":
      return <HccEmptyView config={config} />;
    case "hccRepository":
      return <HccRepositoryView config={config} />;
    case "hccPendingSchedules":
      return <HccPendingSchedulesView config={config} />;
    case "hccTranscriptPending":
      return <HccTranscriptPendingView config={config} />;
    case "hccBadges":
      return <HccBadgesView config={config} />;
    case "programSettings":
      return <ProgramSettingsView config={config} />;
    case "profileBio":
      return <ProfileBioView config={config} />;
    case "profileTopics":
      return <ProfileTopicsView config={config} />;
    case "availability":
      return <AvailabilityView config={config} />;
    case "compensation":
      return <CompensationView config={config} />;
    case "schedule":
      return <ScheduleView config={config} />;
    case "settings":
      return <SettingsView config={config} />;
    case "security":
      return <SecurityView config={config} />;
    case "accomplishments":
      return <AccomplishmentsView config={config} />;
    case "courseList":
    case "cards":
      return <CourseListView config={config} />;
    case "courseDetail":
      return <CourseDetailView config={config} />;
    case "courseMgmt":
      return <CourseMgmtView config={config} />;
    case "activeCourses":
      return <ActiveCoursesView config={config} />;
    case "modulesBoard":
      return <ModulesBoardView config={config} />;
    case "announcements":
      return <AnnouncementsView config={config} />;
    case "versionEditor":
      return <VersionEditorView config={config} />;
    case "evaluations":
      return <EvaluationsView config={config} />;
    case "repository":
      if (config.fileManager) return <FileManagerView config={config} />;
      if (config.splitPane) return <SplitPaneView config={config} />;
      return <RepositoryView config={config} />;
    case "pendingSchedules":
      return <PendingSchedulesView config={config} />;
    case "courseHistory":
      return <CourseHistoryView config={config} />;
    case "table":
      return <TableBlock config={config} />;
    case "form":
      return <FormView config={config} />;
    case "splitPane":
      if (config.fileManager && !config.splitPane) return <FileManagerView config={config} />;
      return <SplitPaneView config={config} />;
    case "lectures":
      return <LecturesView config={config} />;
    case "lectureReview":
      return <LectureReviewView config={config} />;
    case "labSession":
      return <LabSessionView config={config} />;
    case "approval":
      return <ApprovalView config={config} />;
    case "syllabusDiff":
      return <SyllabusDiffView config={config} />;
    case "workshops":
      return <WorkshopsView config={config} />;
    case "workshopDetail":
      return <WorkshopDetailView config={config} />;
    case "workshopEnrolments":
      return <WorkshopEnrolmentsView config={config} />;
    case "workshopAttendance":
      return <WorkshopAttendanceView config={config} />;
    case "studentsDirectory":
      return <StudentsDirectoryView config={config} />;
    case "studentDetail":
      return <StudentDetailView config={config} />;
    case "hub":
      return <HubView config={config} />;
    case "facultiesPrograms":
      return <FacultiesProgramsView config={config} />;
    case "courseConfigurations":
      return <CourseConfigurationsView config={config} />;
    case "grades":
      return <GradesQueueView config={config} />;
    case "assessmentBuilder":
      return <AssessmentBuilderView config={config} />;
    case "gradingSchemes":
      return <GradingSchemesView config={config} />;
    case "programTypes":
      return <ProgramTypesView config={config} />;
    case "courseTypes":
      return <CourseTypesView config={config} />;
    case "manageTerms":
      return <ManageTermsView config={config} />;
    case "reviewTerm":
      return <ReviewTermView config={config} />;
    case "scheduleManage":
      return <ScheduleManageView config={config} />;
    case "coursesSessions":
      return <CoursesSessionsView config={config} />;
    case "courseAdmin":
      return <CourseAdminView config={config} />;
    case "pendingGrades":
      return <PendingGradesView config={config} />;
    case "masterScheduling":
      return <MasterSchedulingView config={config} />;
    case "academicCalendars":
      return <AcademicCalendarsView config={config} />;
    case "courseTextbooks":
      return <CourseTextbooksView config={config} />;
    case "contentRepository":
      return <ContentRepositoryView config={config} />;
    case "scheduler":
      return <SchedulerView config={config} />;
    case "calendar":
      return <CalendarBoardView config={config} />;
    case "modal":
      return <ModalView config={config} />;
    case "aiStudio":
      return <AiStudioView config={config} />;
    case "studioGeneration":
      return <StudioGenerationView config={config} />;
    case "outcomeMapping":
      return <OutcomeMappingView config={config} />;
    case "questionGenerator":
      return <QuestionGeneratorView config={config} />;
    case "rubricGenerator":
      return <RubricGeneratorView config={config} />;
    case "messages":
      return <MessagesView config={config} />;
    case "notifications":
      return <NotificationsView config={config} />;
    case "timetable":
      return <TimetableView config={config} />;
    case "fileManager":
      return <FileManagerView config={config} />;
    case "helpSupport":
      return <HelpSupportView config={config} />;
    case "attendanceSession":
      return <AttendanceSessionView config={config} />;
    case "attendanceReview":
      return <AttendanceReviewView config={config} />;
    case "authGate":
      return <AuthGateView config={config} />;
    case "alertList":
      return <AlertListView config={config} />;
    case "gradebook":
      return <GradebookView config={config} />;
    case "statusFilter":
      return <StatusFilterView config={config} />;
    case "assessmentHub":
      return <AssessmentHubView config={config} />;
    default:
      return null;
  }
}

export function TeacherSisScreen({ path }: { path: string }) {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <TeacherSisScreenGate path={path} />
    </Suspense>
  );
}

function TeacherSisScreenGate({ path }: { path: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId");
  const livePath = teacherLivePath(path, searchParams);
  const chrome = getTeacherScreen(path);
  const [userName, setUserName] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (!s.roles.includes("instructor")) {
      if (s.roles.includes("admin") || s.roles.includes("registrar")) router.replace("/admin");
      else if (s.roles.includes("student")) router.replace("/student");
      else if (s.roles.includes("applicant")) router.replace("/applicant");
      else if (s.roles.includes("employer")) router.replace("/employer");
      else router.replace("/login");
      return;
    }
    setUserName(`${s.givenName} ${s.familyName}`.trim());
    setAllowed(true);
  }, [router]);

  if (!chrome || !allowed) return null;

  return (
    <TeacherLiveProvider path={livePath} studentId={studentId}>
      <TeacherSisScreenInner path={path} chrome={chrome} userName={userName} />
    </TeacherLiveProvider>
  );
}

function TeacherSisScreenInner({
  path,
  chrome,
  userName,
}: {
  path: string;
  chrome: TeacherScreenConfig;
  userName: string;
}) {
  const live = useTeacherLive();
  const { payload, loading } = useTeacherLivePayload();
  const config = mergeTeacherLive(chrome, payload, loading);
  const shell = config.shell || "campus";
  const isStudio = shell === "studio";
  const hideShellTitle =
    config.archetype === "dashboard" ||
    config.archetype === "profileBio" ||
    config.archetype === "profileTopics" ||
    config.archetype === "availability" ||
    config.archetype === "compensation" ||
    config.archetype === "schedule" ||
    config.archetype === "settings" ||
    config.archetype === "security" ||
    config.archetype === "accomplishments" ||
    config.archetype === "facultiesPrograms" ||
    config.archetype === "programSettings" ||
    config.archetype === "hccBadges" ||
    config.archetype === "hccMyCourses" ||
    config.archetype === "hccGradesSubmission" ||
    config.archetype === "hccPendingGrades" ||
    config.archetype === "hccStudents" ||
    config.path.includes("t81") ||
    config.path.includes("add-faculty") ||
    config.path.includes("t74-add-program");
  const displayName = live.bootstrap?.displayName || userName || "Instructor";

  return (
    <TeacherSisShell
      activeHref={config.activeHref}
      title={isStudio || hideShellTitle ? "" : config.title}
      subtitle={
        isStudio || hideShellTitle
          ? undefined
          : live.error
            ? `Live data error: ${live.error}`
            : config.subtitle
      }
      shell={shell}
      studioActive={isStudio ? path : undefined}
      userName={displayName}
      userRole="INSTRUCTOR"
      studentCount={live.bootstrap?.studentCount}
      workshopCounts={live.bootstrap?.workshopCounts}
      draftGradeCount={live.bootstrap?.draftGradeCount}
      statusCounts={live.bootstrap?.statusCounts}
      flagCount={live.bootstrap?.flagCount}
      alertCount={live.bootstrap?.alertCount}
    >
      <TeacherLiveStatusBar />
      {renderView(config)}
    </TeacherSisShell>
  );
}

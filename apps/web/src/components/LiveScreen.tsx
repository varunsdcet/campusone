"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Metric, Panel } from "@myheritage/ui";
import { ScreenScaffold, ListPanel, MobileChrome } from "@/components/ScreenScaffold";
import { StudentSisShell } from "@/components/StudentSisShell";
import { TeacherSisScreen } from "@/components/TeacherSisScreen";
import { getTeacherScreen } from "@/lib/teacherCatalog";
import { api, loadSession } from "@/lib/api";
import type { ShellRole } from "@/lib/nav";

export type PortalAction = {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, unknown>;
  variant?: "primary" | "secondary" | "ai";
};

export type PortalView = {
  path: string;
  title: string;
  subtitle: string;
  role: ShellRole;
  active: string;
  breadcrumb: string[];
  metrics: Array<{ label: string; value: string; hint?: string }>;
  sections: Array<{
    title: string;
    rows: Array<{ primary: string; secondary?: string; meta?: string; href?: string }>;
  }>;
  actions: PortalAction[];
  live: true;
};

const STUDENT_ROUTE_META: Record<string, { title: string; subtitle: string }> = {
  "/student/continue": { title: "Continue learning", subtitle: "Resume lectures, labs, and assigned course work." },
  "/student/modules": { title: "Course modules", subtitle: "Learning content from your active courses." },
  "/student/assessments": { title: "Assessments", subtitle: "Upcoming and published assessments for your courses." },
  "/student/f/st-06-assessments": { title: "Assessments", subtitle: "Upcoming and published assessments for your courses." },
  "/student/lectures": { title: "Lectures", subtitle: "Lecture schedule, recordings, and course materials." },
  "/student/f/st-11-lecture-detail": { title: "Lecture detail", subtitle: "Lecture access, recording, and supporting materials." },
  "/student/labs": { title: "Labs", subtitle: "Your scheduled labs, locations, and practical work." },
  "/student/f/st-13-lab-detail": { title: "Lab detail", subtitle: "Lab schedule, location, safety notes, and practical work." },
  "/student/attendance": { title: "Attendance", subtitle: "Attendance records for your enrolled courses." },
  "/student/announcements": { title: "Announcements", subtitle: "Course and campus updates relevant to you." },
  "/student/messages": { title: "Messages", subtitle: "Conversations with instructors and campus teams." },
  "/student/library": { title: "Library", subtitle: "Loans, resources, and library services." },
  "/student/f/st-16-services": { title: "Campus services", subtitle: "Student support, workshops, and service requests." },
  "/student/f/st-17-practicum": { title: "Practicum", subtitle: "Placement, hours, agreements, and evaluations." },
  "/student/f/st-19-credentials": { title: "Credentials", subtitle: "Official credentials and completion records." },
  "/student/f/st-20-career": { title: "Career services", subtitle: "Career coaching, opportunities, and application support." },
  "/student/career": { title: "Career services", subtitle: "Coaching, co-op roles, and work-integrated learning for your program." },
  "/student/holds": { title: "Holds", subtitle: "Registration and account holds affecting your studies." },
  "/student/success": { title: "Student success", subtitle: "Academic support, coaching, and success planning." },
};

function mimeForFile(file: File) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return (
    (
      {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      } as Record<string, string>
    )[extension ?? ""] ?? ""
  );
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function LiveScreen({
  path,
  mobile = false,
  mobileTitle = "CampusOne",
  mobileActive = "Home",
}: {
  path: string;
  mobile?: boolean;
  mobileTitle?: string;
  mobileActive?: "Home" | "Courses" | "Schedule" | "Grades" | "More";
}) {
  if (!mobile && path.startsWith("/instructor") && getTeacherScreen(path)) {
    return <TeacherSisScreen path={path} />;
  }
  if (!mobile && path.startsWith("/student")) {
    return <GenericLiveScreen path={path} chrome="student" />;
  }
  return (
    <GenericLiveScreen path={path} mobile={mobile} mobileTitle={mobileTitle} mobileActive={mobileActive} />
  );
}

function GenericLiveScreen({
  path,
  mobile = false,
  mobileTitle = "CampusOne",
  mobileActive = "Home",
  chrome = "appshell",
}: {
  path: string;
  mobile?: boolean;
  mobileTitle?: string;
  mobileActive?: "Home" | "Courses" | "Schedule" | "Grades" | "More";
  chrome?: "appshell" | "student";
}) {
  const router = useRouter();
  const [view, setView] = useState<PortalView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadRef = useRef<PortalAction | null>(null);

  const openHref = useCallback((href: string) => {
    if (/^https:\/\//i.test(href)) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  }, [router]);

  const load = useCallback(() => {
    const s = loadSession();
    if (!s) {
      router.replace(mobile ? "/m/login" : "/login");
      return;
    }
    api<PortalView>(`/portal/view?path=${encodeURIComponent(path)}`, {}, s.accessToken)
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [path, router, mobile]);

  useEffect(() => {
    load();
  }, [load]);

  async function postAction(a: PortalAction, payload?: Record<string, unknown>) {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    const endpoint = path.startsWith("/employer") ? "/employer/action" : path.startsWith("/applicant") ? "/applicant/action" : null;
    if (!endpoint) {
      if (a.href) router.push(a.href);
      return;
    }
    setBusyAction(a.label);
    setError(null);
    try {
      const res = await api<{ view?: PortalView }>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({ action: a.action, payload: payload ?? a.payload, path }),
        },
        s.accessToken,
      );
      if (res.view) setView(res.view);
      else load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function runAction(a: PortalAction) {
    if (a.href && !a.action) {
      openHref(a.href);
      return;
    }
    if (!a.action) return;
    if (a.action === "upload_document") {
      pendingUploadRef.current = a;
      fileInputRef.current?.click();
      return;
    }
    if (a.action === "submit_evaluation") {
      const rawScore = window.prompt("Evaluation score (1–5)", "4");
      if (rawScore === null) return;
      const score = Number(rawScore);
      const notes = window.prompt("Evaluation notes", "Meets practicum expectations")?.trim() ?? "";
      if (!Number.isInteger(score) || score < 1 || score > 5 || notes.length < 3) {
        setError("Enter a score from 1 to 5 and evaluation notes.");
        return;
      }
      await postAction(a, { ...(a.payload ?? {}), score, notes });
      return;
    }
    await postAction(a);
  }

  async function onUploadFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const pending = pendingUploadRef.current;
    event.target.value = "";
    pendingUploadRef.current = null;
    if (!file || !pending?.action) return;
    if (file.size === 0) {
      setError("The selected file is empty (0 bytes). Choose a file that has content.");
      return;
    }
    const mimeType = mimeForFile(file);
    let contentBase64: string;
    try {
      contentBase64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    } catch {
      setError("The selected file could not be read. Choose another file.");
      return;
    }
    await postAction(pending, {
      ...(pending.payload ?? {}),
      filename: file.name,
      mimeType,
      sizeBytes: file.size,
      contentBase64,
    });
  }

  if (error && !view) {
    const body = (
      <div style={{ color: "var(--mh-danger)", padding: "1rem 0" }}>
        {error}
        <div style={{ marginTop: 12 }}>
          <Button type="button" variant="secondary" onClick={() => router.push(mobile ? "/m/login" : "/login")}>
            Sign in again
          </Button>
        </div>
      </div>
    );
    if (mobile) return <MobileChrome title={mobileTitle}>{body}</MobileChrome>;
    if (chrome === "student") {
      return (
        <StudentSisShell title="Student portal" activeHref={path}>
          <div className="mh-teacher-card">{body}</div>
        </StudentSisShell>
      );
    }
    return body;
  }

  if (!view) {
    const loading = <p style={{ color: "var(--mh-text-muted)" }}>Loading live data…</p>;
    if (mobile) return <MobileChrome title={mobileTitle}>{loading}</MobileChrome>;
    if (chrome === "student") {
      return (
        <StudentSisShell title="Student portal" activeHref={path}>
          <div className="mh-teacher-card">{loading}</div>
        </StudentSisShell>
      );
    }
    return loading;
  }

  const studentMeta = chrome === "student" ? STUDENT_ROUTE_META[path] : undefined;
  const visibleActions = view.actions;
  const content = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        style={{ display: "none" }}
        onChange={(event) => void onUploadFileSelected(event)}
      />
      {error ? <p style={{ color: "var(--mh-danger)", marginBottom: 12 }}>{error}</p> : null}
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        {view.metrics.map((m) => (
          <Metric key={m.label} label={m.label} value={m.value} hint={m.hint} />
        ))}
      </div>

      {visibleActions.length ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {visibleActions.map((a) => (
            <Button
              key={(a.action ?? a.href ?? "") + a.label}
              type="button"
              variant={a.variant ?? "primary"}
              disabled={busyAction === a.label}
              onClick={() => runAction(a)}
            >
              {busyAction === a.label ? "Working…" : a.label}
            </Button>
          ))}
        </div>
      ) : null}

      {view.sections.map((section) => (
        <Panel
          key={section.title}
          title={studentMeta && /records$/i.test(section.title) ? `${studentMeta.title} overview` : section.title}
        >
          {!section.rows.length ? (
            <p style={{ margin: 0, color: "var(--mh-text-muted)" }}>No records yet for your account.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.65rem" }}>
              {section.rows.map((row, i) => (
                <li
                  key={`${section.title}-${row.primary}-${row.secondary ?? ""}-${row.meta ?? ""}-${i}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                    paddingBottom: "0.65rem",
                    borderBottom: "1px solid var(--mh-border)",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{row.primary}</div>
                    {row.secondary ? (
                      <div style={{ color: "var(--mh-text-muted)", fontSize: "var(--mh-body-compact)" }}>{row.secondary}</div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {row.meta ? (
                      <span style={{ color: "var(--mh-text-muted)", fontSize: "var(--mh-body-compact)" }}>{row.meta}</span>
                    ) : null}
                    {row.href ? (
                      <Button
                        type="button"
                        variant="secondary"
                        style={{ padding: "6px 10px", fontSize: 13 }}
                        onClick={() => openHref(row.href!)}
                      >
                        Open
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
    </>
  );

  if (mobile) {
    return (
      <MobileChrome title={mobileTitle} active={mobileActive}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>{view.title}</h1>
        <p style={{ margin: "0 0 16px", color: "var(--mh-text-muted)", fontSize: 13 }}>{view.subtitle}</p>
        {content}
      </MobileChrome>
    );
  }

  if (chrome === "student") {
    return (
      <StudentSisShell
        title={studentMeta?.title ?? view.title}
        subtitle={studentMeta?.subtitle ?? view.subtitle}
        activeHref={path}
      >
        <div className="mh-student-stack mh-student-live">{content}</div>
      </StudentSisShell>
    );
  }

  return (
    <ScreenScaffold
      role={view.role}
      title={view.title}
      subtitle={view.subtitle}
      breadcrumb={view.breadcrumb}
      active={view.active}
    >
      {content}
    </ScreenScaffold>
  );
}

export { ListPanel };

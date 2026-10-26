"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StudentLabNotebook, StudentLecturesResponse } from "@myheritage/contracts";
import { Banner, Button, EmptyState, StatusPill } from "@myheritage/ui";
import { StudentFrame } from "@/components/StudentSisShell";
import { ApiError, api, loadSession, type Session } from "@/lib/api";

type LabSession = StudentLecturesResponse["lectures"][number];
type LabAccess = {
  accessStatus: string;
  canLaunchVirtualLabs: boolean;
  eligibility: Array<{ id: string; status: string; clearedOn: string | null; expiresOn: string | null; training: string | null; equipment: string | null; notes: string | null }>;
  virtualLabs: Array<{ id: string; name: string; course: string; provider: string | null; seats: number; canLaunch: boolean }>;
};
type LoadState = "loading" | "ready" | "offline" | "forbidden" | "error";

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

function labStatus(lab: LabSession) {
  const started = new Date(lab.startsAt).getTime() <= Date.now();
  const ended = lab.endsAt ? new Date(lab.endsAt).getTime() < Date.now() : false;
  if (ended) return { tone: "neutral" as const, label: "Completed" };
  if (started) return { tone: "success" as const, label: "In session" };
  return { tone: "warning" as const, label: "Scheduled" };
}

export default function StudentLabsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading labs…</div>}>
      <StudentLabsInner />
    </Suspense>
  );
}

function StudentLabsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get("sessionId");

  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentLecturesResponse | null>(null);
  const [access, setAccess] = useState<LabAccess | null>(null);
  const [notebook, setNotebook] = useState<StudentLabNotebook | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(urlSessionId);
  const [busy, setBusy] = useState(false);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    setSelectedId(urlSessionId);
  }, [urlSessionId]);

  const refresh = useCallback(async (active: Session, opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoadState("loading");
      setError(null);
    }
    try {
      const [labs, labAccess] = await Promise.all([
        api<StudentLecturesResponse>("/student/labs", {}, active.accessToken),
        api<LabAccess>("/student/labs/access", {}, active.accessToken),
      ]);
      setData(labs);
      setAccess(labAccess);
      setLoadState("ready");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        router.replace("/login");
        return;
      }
      if (caught instanceof ApiError && caught.status === 403) {
        setLoadState("forbidden");
        return;
      }
      if ((typeof navigator !== "undefined" && !navigator.onLine) || caught instanceof TypeError) {
        setLoadState("offline");
        return;
      }
      setError(caught instanceof Error ? caught.message : "Could not load labs.");
      setLoadState("error");
    }
  }, [router]);

  useEffect(() => {
    const active = loadSession();
    if (!active) {
      router.replace("/login");
      return;
    }
    if (!active.roles.includes("student")) {
      setLoadState("forbidden");
      return;
    }
    setSession(active);
    void refresh(active);
  }, [refresh, router]);

  const labs = data?.lectures ?? [];
  const selected = useMemo(
    () => labs.find((row) => row.id === selectedId) ?? null,
    [labs, selectedId],
  );

  useEffect(() => {
    if (!session || !selectedId) {
      setNotebook(null);
      setTitle("");
      setBody("");
      return;
    }
    let cancelled = false;
    setNotebookLoading(true);
    setActionError(null);
    api<StudentLabNotebook>(`/student/labs/${selectedId}/notebook`, {}, session.accessToken)
      .then((nb) => {
        if (cancelled) return;
        setNotebook(nb);
        setTitle(nb.title);
        setBody(nb.body);
      })
      .catch((caught) => {
        if (cancelled) return;
        setActionError(caught instanceof Error ? caught.message : "Could not open notebook");
        setNotebook(null);
      })
      .finally(() => {
        if (!cancelled) setNotebookLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, session]);

  function openLab(id: string) {
    setNotice(null);
    setActionError(null);
    setSelectedId(id);
    router.replace(`/student/labs?sessionId=${encodeURIComponent(id)}`, { scroll: false });
  }

  function backToList() {
    setNotice(null);
    setActionError(null);
    setSelectedId(null);
    setNotebook(null);
    router.replace("/student/labs", { scroll: false });
  }

  async function saveNotebook(event: FormEvent) {
    event.preventDefault();
    if (!session || !notebook) return;
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      const saved = await api<StudentLabNotebook>(
        `/student/labs/${notebook.classSessionId}/notebook`,
        {
          method: "PUT",
          body: JSON.stringify({ title, body, rowVersion: notebook.rowVersion }),
        },
        session.accessToken,
      );
      setNotebook(saved);
      setTitle(saved.title);
      setBody(saved.body);
      setNotice("Lab notebook saved.");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function launchVirtualLab(id: string) {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      const result = await api<{ url: string }>(`/student/labs/virtual/${encodeURIComponent(id)}/launch`, { method: "POST" }, session.accessToken);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Virtual lab could not be opened");
    } finally {
      setBusy(false);
    }
  }

  if (!session && loadState === "loading") return null;

  return (
    <StudentFrame
      role="student"
      title="Labs"
      subtitle="Scheduled lab sessions and your practical notebooks"
      breadcrumb={["Student", "Labs"]}
      activeHref="/student/labs"
    >
      {actionError ? <Banner tone="danger">{actionError}</Banner> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {loadState !== "ready" && !data ? (
        <section className="mh-teacher-card">
          <EmptyState
            title={
              loadState === "loading"
                ? "Loading"
                : loadState === "offline"
                  ? "You're offline"
                  : loadState === "forbidden"
                    ? "Permission denied"
                    : "Something went wrong"
            }
            body={
              loadState === "loading"
                ? "Fetching your scheduled labs."
                : loadState === "offline"
                  ? "Reconnect and try again."
                  : loadState === "forbidden"
                    ? "This page is available only to the signed-in student."
                    : (error ?? "The page could not be loaded.")
            }
          />
          {loadState === "offline" || loadState === "error" ? (
            <Button type="button" onClick={() => session && void refresh(session)}>
              Try again
            </Button>
          ) : null}
        </section>
      ) : selected ? (
        <LabNotebookView
          lab={selected}
          notebook={notebook}
          title={title}
          body={body}
          busy={busy}
          notebookLoading={notebookLoading}
          onTitle={setTitle}
          onBody={setBody}
          onBack={backToList}
          onSave={saveNotebook}
        />
      ) : (
        <>
          <LabAccessPanel access={access} busy={busy} onLaunch={launchVirtualLab} />
          <LabList labs={labs} onOpen={openLab} />
        </>
      )}
    </StudentFrame>
  );
}

function LabAccessPanel({ access, busy, onLaunch }: { access: LabAccess | null; busy: boolean; onLaunch: (id: string) => void }) {
  if (!access) return null;
  const cleared = access.accessStatus === "Cleared";
  return <>
    <section className="mh-teacher-card" style={{ marginBottom: 18 }}>
      <div className="mh-teacher-card__head"><h2>Lab eligibility</h2><StatusPill tone={cleared ? "success" : "warning"}>{access.accessStatus}</StatusPill></div>
      {access.eligibility.length ? <div className="mh-teacher-list">{access.eligibility.map((item) => <div className="mh-teacher-list__item" key={item.id}>
        <div><strong>{item.training || item.equipment || "General lab access"}</strong><span>{[item.equipment, item.clearedOn ? `Cleared ${item.clearedOn}` : null, item.expiresOn ? `Expires ${item.expiresOn}` : null].filter(Boolean).join(" · ")}</span></div>
        <StatusPill tone={item.status === "Cleared" ? "success" : "warning"}>{item.status}</StatusPill>
      </div>)}</div> : <p className="mh-teacher-muted">No lab eligibility record has been assigned yet.</p>}
    </section>
    {access.virtualLabs.length ? <section className="mh-teacher-card" style={{ marginBottom: 18 }}>
      <div className="mh-teacher-card__head"><h2>Virtual labs</h2><StatusPill tone="neutral">{access.virtualLabs.length}</StatusPill></div>
      <div className="mh-teacher-list">{access.virtualLabs.map((lab) => <div className="mh-teacher-list__item" key={lab.id}>
        <div><strong>{lab.name}</strong><span>{lab.course}{lab.provider ? ` · ${lab.provider}` : ""}{lab.seats ? ` · ${lab.seats} seats` : ""}</span></div>
        <Button type="button" disabled={busy || !lab.canLaunch} onClick={() => onLaunch(lab.id)}>{lab.canLaunch ? "Launch" : "Eligibility required"}</Button>
      </div>)}</div>
    </section> : null}
  </>;
}

function LabList({ labs, onOpen }: { labs: LabSession[]; onOpen: (id: string) => void }) {
  if (!labs.length) {
    return (
      <section className="mh-teacher-card">
        <EmptyState
          title="No labs scheduled"
          body="When a lab session is scheduled for one of your enrolled courses, it will appear here."
        />
      </section>
    );
  }

  const upcoming = labs.filter((lab) => new Date(lab.startsAt).getTime() >= Date.now() - 2 * 60 * 60 * 1000).length;

  return (
    <>
      <div className="mh-teacher-dash__kpis">
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Total labs</div>
          <div className="mh-teacher-dash__kpi-value">{labs.length}</div>
          <div className="mh-teacher-dash__kpi-hint">Enrolled sections</div>
        </div>
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Upcoming</div>
          <div className="mh-teacher-dash__kpi-value">{upcoming}</div>
          <div className="mh-teacher-dash__kpi-hint">Including today</div>
        </div>
        <div className="mh-teacher-dash__kpi">
          <div className="mh-teacher-dash__kpi-label">Notebooks</div>
          <div className="mh-teacher-dash__kpi-value">{labs.length}</div>
          <div className="mh-teacher-dash__kpi-hint">One per session</div>
        </div>
      </div>

      <section className="mh-teacher-card">
        <div className="mh-teacher-card__head">
          <h2>Lab sessions</h2>
          <StatusPill tone="neutral">{labs.length}</StatusPill>
        </div>
        <div className="mh-teacher-list">
          {labs.map((lab) => {
            const status = labStatus(lab);
            return (
              <button
                key={lab.id}
                type="button"
                className="mh-teacher-list__item mh-teacher-list__item--btn mh-student-assess-row"
                onClick={() => onOpen(lab.id)}
              >
                <div>
                  <strong>{lab.title}</strong>
                  <span>
                    {lab.courseCode} · {lab.location ?? "Lab"} · {formatDate(lab.startsAt)}
                  </span>
                </div>
                <div className="mh-student-assess-row__meta">
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  <span className="mh-student-assess-row__open">Notebook →</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function LabNotebookView({
  lab,
  notebook,
  title,
  body,
  busy,
  notebookLoading,
  onTitle,
  onBody,
  onBack,
  onSave,
}: {
  lab: LabSession;
  notebook: StudentLabNotebook | null;
  title: string;
  body: string;
  busy: boolean;
  notebookLoading: boolean;
  onTitle: (value: string) => void;
  onBody: (value: string) => void;
  onBack: () => void;
  onSave: (event: FormEvent) => void;
}) {
  const locked = Boolean(notebook?.lockedAt);
  const status = labStatus(lab);
  const dirty = notebook ? title !== notebook.title || body !== notebook.body : false;

  return (
    <div className="mh-student-lab">
      <div className="mh-student-lab__toolbar">
        <button type="button" className="mh-teacher-link" onClick={onBack}>
          ← All labs
        </button>
        <div className="mh-student-lab__toolbar-meta">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {notebook ? (
            <StatusPill tone={locked ? "warning" : dirty ? "warning" : "success"}>
              {locked ? "Locked" : dirty ? "Unsaved changes" : `Saved · v${notebook.version}`}
            </StatusPill>
          ) : null}
        </div>
      </div>

      <div className="mh-student-lab__layout">
        <aside className="mh-teacher-card mh-student-lab__aside">
          <div className="mh-teacher-card__head">
            <h2>Session</h2>
            <StatusPill tone="neutral">{lab.courseCode}</StatusPill>
          </div>
          <div className="mh-student-lab__facts">
            <div>
              <span>Lab</span>
              <strong>{lab.title}</strong>
            </div>
            <div>
              <span>When</span>
              <strong>{formatDate(lab.startsAt)}</strong>
            </div>
            <div>
              <span>Where</span>
              <strong>{lab.location ?? "Lab room TBD"}</strong>
            </div>
            <div>
              <span>Mode</span>
              <strong style={{ textTransform: "capitalize" }}>{lab.deliveryMode.replace("_", " ")}</strong>
            </div>
            {lab.endsAt ? (
              <div>
                <span>Ends</span>
                <strong>{formatDate(lab.endsAt)}</strong>
              </div>
            ) : null}
          </div>
          {locked ? (
            <div
              className="mh-teacher-banner"
              style={{ background: "#fff8e6", borderColor: "rgba(180,130,20,0.28)", color: "#8a6a10", marginTop: 12 }}
            >
              Instructor locked this notebook. Editing is closed.
            </div>
          ) : (
            <p className="mh-teacher-muted" style={{ marginBottom: 0 }}>
              Record observations and conclusions for this practical session. Changes save as a new notebook version.
            </p>
          )}
        </aside>

        <section className="mh-teacher-card mh-student-lab__editor">
          <div className="mh-teacher-card__head">
            <h2>Lab notebook</h2>
            {notebook ? (
              <StatusPill tone={locked ? "warning" : "success"}>
                v{notebook.version}
                {locked ? " · locked" : ""}
              </StatusPill>
            ) : (
              <StatusPill tone="neutral">{notebookLoading ? "Opening…" : "—"}</StatusPill>
            )}
          </div>

          {notebookLoading && !notebook ? (
            <p className="mh-teacher-muted" style={{ margin: 0 }}>
              Opening notebook…
            </p>
          ) : !notebook ? (
            <EmptyState title="Notebook unavailable" body="This lab session does not have a notebook yet." />
          ) : (
            <form className="mh-student-lab__form" onSubmit={onSave}>
              <label className="mh-student-lab__title-field">
                <span>Entry title</span>
                <input
                  className="mh-teacher-field"
                  value={title}
                  onChange={(event) => onTitle(event.target.value)}
                  disabled={locked || busy}
                  placeholder="e.g. Graph coding observations"
                />
              </label>

              <label className="mh-student-lab__notes-field">
                <span>Notes</span>
                <textarea
                  className="mh-student-lab__paper"
                  value={body}
                  onChange={(event) => onBody(event.target.value)}
                  disabled={locked || busy}
                  rows={16}
                  placeholder="Procedure, measurements, observations, and conclusions…"
                />
              </label>

              <div className="mh-student-lab__actions">
                <div className="mh-student-lab__hint">
                  {locked
                    ? "Read-only"
                    : dirty
                      ? "You have unsaved edits"
                      : `Last saved as version ${notebook.version}`}
                </div>
                {!locked ? (
                  <button type="submit" className="mh-teacher-btn mh-teacher-btn--primary" disabled={busy || !dirty}>
                    {busy ? "Saving…" : "Save notebook"}
                  </button>
                ) : null}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

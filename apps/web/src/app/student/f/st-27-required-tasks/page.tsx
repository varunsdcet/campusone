"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";
import { formatHccDate } from "@/lib/hccCourseFormat";

type Task = {
  id: string;
  title: string;
  detail: string | null;
  dueAt: string | null;
  requestedAt: string;
  status: string;
  href: string | null;
  completedAt: string | null;
};

type Tab = "pending" | "completed";

export default function RequiredTasksPage() {
  const router = useRouter();
  const [pending, setPending] = useState<Task[]>([]);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");
  const [tab, setTab] = useState<Tab>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    const data = await api<{ pending: Task[]; completed: Task[] }>("/student/required-tasks", {}, session.accessToken);
    setPending(data.pending);
    setCompleted(data.completed);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function complete(id: string) {
    const session = loadSession();
    if (!session) return;
    setBusyId(id);
    try {
      const data = await api<{ pending: Task[]; completed: Task[] }>(
        `/student/required-tasks/${id}/complete`,
        { method: "POST", body: "{}" },
        session.accessToken,
      );
      setPending(data.pending);
      setCompleted(data.completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete task");
    } finally {
      setBusyId(null);
    }
  }

  const rows = tab === "pending" ? pending : completed;

  return (
    <StudentSisShell title="" activeHref="/student/f/st-27-required-tasks" userName={name}>
      <div className="mh-hcc-page mh-hcc-page--campus" data-stu="STU-20">
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Pending Required Tasks
        </p>
        <h1>PENDING REQUIRED TASKS</h1>

        <div className="mh-hcc-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={tab === "pending" ? "is-active" : undefined}
            onClick={() => setTab("pending")}
          >
            Pending Tasks ({pending.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "completed"}
            className={tab === "completed" ? "is-active" : undefined}
            onClick={() => setTab("completed")}
          >
            Completed Tasks ({completed.length})
          </button>
        </div>

        {error ? <p className="mh-teacher-muted" style={{ color: "#b42318" }}>{error}</p> : null}

        <table className="mh-hcc-table mh-hcc-table--campus">
          <thead>
            <tr>
              <th>TASK NAME</th>
              <th>DATE REQUESTED</th>
              <th>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3}>
                  {tab === "pending" ? "There are currently no pending required tasks." : "No completed tasks yet."}
                </td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    {t.detail ? <div className="mh-hcc-course-title">{t.detail}</div> : null}
                  </td>
                  <td>{formatHccDate(t.requestedAt) || "—"}</td>
                  <td>
                    {tab === "pending" ? (
                      <div className="mh-hcc-task-actions">
                        {t.href ? (
                          <button
                            type="button"
                            className="mh-hcc-link"
                            onClick={() => router.push(t.href!)}
                          >
                            Open
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mh-hcc-btn ghost"
                          disabled={busyId === t.id}
                          onClick={() => void complete(t.id)}
                        >
                          {busyId === t.id ? "Saving…" : "Mark done"}
                        </button>
                      </div>
                    ) : (
                      <span className="mh-hcc-status mh-hcc-status--done">Completed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </StudentSisShell>
  );
}

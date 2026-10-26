"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button } from "@myheritage/ui";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { api, loadSession } from "@/lib/api";
import "./studentSuccess.css";

type Task = { id: string; title: string; status: string; dueAt: string | null; completedAt: string | null };
type SuccessCase = {
  id: string;
  studentName: string;
  studentNumber: string;
  level: string;
  status: string;
  summary: string;
  signals: string[];
  tasks: Task[];
  updatedAt: string;
};
type Appointment = {
  id: string;
  studentName: string;
  studentNumber: string;
  topic: string;
  startsAt: string;
  status: string;
  notes: string | null;
};

const CASE_ACTIONS: Record<string, Array<{ label: string; status: string }>> = {
  open: [{ label: "Start case", status: "in_progress" }, { label: "Monitor", status: "monitoring" }, { label: "Resolve", status: "resolved" }],
  in_progress: [{ label: "Monitor", status: "monitoring" }, { label: "Resolve", status: "resolved" }],
  monitoring: [{ label: "Resume", status: "in_progress" }, { label: "Resolve", status: "resolved" }],
  resolved: [{ label: "Close", status: "closed" }, { label: "Reopen", status: "open" }],
  closed: [{ label: "Reopen", status: "open" }],
};

const APPOINTMENT_ACTIONS: Record<string, Array<{ label: string; status: string }>> = {
  requested: [{ label: "Confirm", status: "confirmed" }, { label: "Cancel", status: "cancelled" }],
  confirmed: [{ label: "Complete", status: "completed" }, { label: "No show", status: "no_show" }, { label: "Cancel", status: "cancelled" }],
};

function pretty(value: string) {
  return value.replaceAll("_", " ");
}

function when(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function InstructorSuccessWorkspace({ view }: { view: "cases" | "appointments" }) {
  const router = useRouter();
  const [cases, setCases] = useState<SuccessCase[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (view === "cases") {
        const result = await api<{ items: SuccessCase[] }>("/instructor/success/cases", {}, session.accessToken);
        setCases(result.items);
      } else {
        const result = await api<{ items: Appointment[] }>("/instructor/success/appointments", {}, session.accessToken);
        setAppointments(result.items);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load assigned student-success work");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [view]);

  async function changeStatus(kind: "cases" | "appointments", id: string, status: string) {
    const session = loadSession();
    if (!session) return;
    setBusy(id);
    setError(null);
    try {
      await api(`/instructor/success/${kind}/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, session.accessToken);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status");
    } finally {
      setBusy(null);
    }
  }

  const stats = useMemo(() => {
    if (view === "cases") {
      return [
        { label: "Assigned cases", value: cases.length },
        { label: "Active", value: cases.filter((item) => ["open", "in_progress", "monitoring"].includes(item.status)).length },
        { label: "Pending tasks", value: cases.flatMap((item) => item.tasks).filter((task) => ["pending", "in_progress"].includes(task.status)).length },
      ];
    }
    return [
      { label: "Appointments", value: appointments.length },
      { label: "Awaiting confirmation", value: appointments.filter((item) => item.status === "requested").length },
      { label: "Confirmed", value: appointments.filter((item) => item.status === "confirmed").length },
    ];
  }, [appointments, cases, view]);

  return (
    <TeacherSisShell
      title="Student Success"
      subtitle="Your assigned support cases and advising appointments"
      activeHref={`/instructor/student-success/${view}`}
    >
      <div className="mh-success-page">
        <nav className="mh-success-tabs" aria-label="Student success views">
          <Link className={view === "cases" ? "is-active" : ""} href="/instructor/student-success/cases">My Assigned Cases</Link>
          <Link className={view === "appointments" ? "is-active" : ""} href="/instructor/student-success/appointments">My Appointments</Link>
        </nav>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <section className="mh-success-summary">
          {stats.map((stat) => <article className="mh-success-metric" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}
        </section>
        {loading ? <div className="mh-success-empty">Loading assigned work…</div> : null}

        {!loading && view === "cases" ? (
          <section className="mh-success-list">
            {cases.length === 0 ? <div className="mh-success-empty">No student-success cases are assigned to you.</div> : null}
            {cases.map((item) => (
              <article className="mh-success-card" key={item.id}>
                <div className="mh-success-card__top">
                  <h2>{item.studentName}</h2>
                  <div className="mh-success-card__top">
                    <span className="mh-success-chip is-risk">{pretty(item.level)}</span>
                    <span className="mh-success-chip">{pretty(item.status)}</span>
                  </div>
                </div>
                <div className="mh-success-card__person">Student #{item.studentNumber}</div>
                <p className="mh-success-card__body">{item.summary}</p>
                {item.signals.length ? <div className="mh-success-card__person">Signals: {item.signals.join(" · ")}</div> : null}
                {item.tasks.length ? (
                  <ul className="mh-success-tasks">
                    {item.tasks.map((task) => (
                      <li key={task.id}>
                        <span>{task.title}</span>
                        <span className="mh-success-chip">{pretty(task.status)}{task.dueAt ? ` · ${when(task.dueAt)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mh-success-actions">
                  {(CASE_ACTIONS[item.status] ?? []).map((action) => (
                    <Button key={action.status} disabled={busy === item.id} onClick={() => void changeStatus("cases", item.id, action.status)}>
                      {busy === item.id ? "Saving…" : action.label}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}

        {!loading && view === "appointments" ? (
          <section className="mh-success-list">
            {appointments.length === 0 ? <div className="mh-success-empty">No advising appointments are assigned to you.</div> : null}
            {appointments.map((item) => (
              <article className="mh-success-card" key={item.id}>
                <div className="mh-success-card__top">
                  <div><h2>{item.topic}</h2><div className="mh-success-card__person">{item.studentName} · #{item.studentNumber}</div></div>
                  <span className="mh-success-chip">{pretty(item.status)}</span>
                </div>
                <p className="mh-success-card__body"><strong>{when(item.startsAt)}</strong></p>
                {item.notes ? <p className="mh-success-card__body">{item.notes}</p> : null}
                <div className="mh-success-actions">
                  {(APPOINTMENT_ACTIONS[item.status] ?? []).map((action) => (
                    <Button key={action.status} disabled={busy === item.id} onClick={() => void changeStatus("appointments", item.id, action.status)}>
                      {busy === item.id ? "Saving…" : action.label}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ) : null}
      </div>
    </TeacherSisShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession } from "@/lib/api";

type Workshop = {
  id: string;
  code: string;
  title: string;
  description: string;
  creditsCeu: number;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  capacity: number;
  registeredCount: number;
  status: string;
  registrationStatus: string | null;
  instructorName?: string | null;
  lengthLabel?: string | null;
  scheduleText?: string | null;
};

type Payload = { available: Workshop[]; mine: Workshop[]; completed: Workshop[] };

type Tab = "mine" | "available" | "completed";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function WorkshopsInner() {
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get("tab") as Tab) || "mine";
  const selectedId = search.get("id");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Student");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    const payload = await api<Payload>("/student/workshops", {}, session.accessToken);
    setData(payload);
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function register(workshopId: string) {
    const session = loadSession();
    if (!session) return;
    setBusyId(workshopId);
    setError(null);
    try {
      const payload = await api<Payload>(
        "/student/workshops/register",
        { method: "POST", body: JSON.stringify({ workshopId }) },
        session.accessToken,
      );
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(workshopId: string) {
    const session = loadSession();
    if (!session) return;
    setBusyId(workshopId); setError(null);
    try { setData(await api<Payload>(`/student/workshops/${workshopId}/cancel`, { method: "POST", body: "{}" }, session.accessToken)); }
    catch (err) { setError(err instanceof Error ? err.message : "Cancellation failed"); }
    finally { setBusyId(null); }
  }

  function setTab(next: Tab) {
    const params = new URLSearchParams();
    if (next !== "mine") params.set("tab", next);
    const qs = params.toString();
    router.push(qs ? `/student/workshops?${qs}` : "/student/workshops");
  }

  function openWorkshop(id: string) {
    const params = new URLSearchParams();
    if (tab !== "mine") params.set("tab", tab);
    params.set("id", id);
    router.push(`/student/workshops?${params.toString()}`);
  }

  function closeWorkshop() {
    const params = new URLSearchParams();
    if (tab !== "mine") params.set("tab", tab);
    const qs = params.toString();
    router.push(qs ? `/student/workshops?${qs}` : "/student/workshops");
  }

  const rows = useMemo(() => {
    if (!data) return [];
    if (tab === "available") return data.available;
    if (tab === "completed") return data.completed;
    return data.mine;
  }, [data, tab]);

  const selected = useMemo(() => {
    if (!data || !selectedId) return null;
    return (
      data.mine.find((w) => w.id === selectedId) ||
      data.available.find((w) => w.id === selectedId) ||
      data.completed.find((w) => w.id === selectedId) ||
      null
    );
  }, [data, selectedId]);

  const titles: Record<Tab, string> = {
    mine: "MY WORKSHOPS",
    available: "AVAILABLE WORKSHOPS",
    completed: "COMPLETED WORKSHOPS",
  };

  return (
    <StudentSisShell title="" activeHref="/student/workshops" userName={name}>
      <div className="mh-hcc-page" data-stu={tab === "mine" ? "STU-13" : tab === "available" ? "STU-14" : "STU-15"}>
        <p className="mh-hcc-profile__crumb">
          Home <span>›</span> Workshops
        </p>
        <h1>{titles[tab]}</h1>
        <div className="mh-hcc-profile__tabs">
          <button type="button" className={tab === "mine" ? "is-active" : ""} onClick={() => setTab("mine")}>
            My Workshops
          </button>
          <button type="button" className={tab === "available" ? "is-active" : ""} onClick={() => setTab("available")}>
            Available
          </button>
          <button type="button" className={tab === "completed" ? "is-active" : ""} onClick={() => setTab("completed")}>
            Completed
          </button>
        </div>
        {error ? (
          <p className="mh-teacher-muted" style={{ color: "#b42318" }}>
            {error}
          </p>
        ) : null}
        {!data && !error ? <p className="mh-teacher-muted">Loading workshops…</p> : null}
        {data ? (
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>WORKSHOP</th>
                <th>INSTRUCTOR(S)</th>
                <th>STATUS</th>
                <th>LENGTH</th>
                <th>DATES</th>
                <th>SCHEDULE</th>
                {tab !== "completed" ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={tab !== "completed" ? 7 : 6}>
                    {tab === "available"
                      ? "No available workshops."
                      : tab === "completed"
                        ? "No completed workshops."
                        : "No active or upcoming workshops."}
                  </td>
                </tr>
              ) : (
                rows.map((w) => (
                  <tr
                    key={w.id}
                    className="is-click"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open ${w.code} ${w.title}`}
                    onClick={() => openWorkshop(w.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openWorkshop(w.id);
                      }
                    }}
                  >
                    <td>
                      <strong>
                        {w.code} · {w.title}
                      </strong>
                      {w.description ? <em>{w.description}</em> : null}
                    </td>
                    <td>{w.instructorName || "—"}</td>
                    <td>
                      <span className="mh-hcc-pill">
                        {w.registrationStatus && w.registrationStatus !== "none" ? w.registrationStatus : w.status}
                      </span>
                    </td>
                    <td>{w.lengthLabel || `${w.creditsCeu} CEU`}</td>
                    <td>
                      {fmtDate(w.startsAt)}
                      {w.endsAt ? ` – ${fmtDate(w.endsAt)}` : ""}
                    </td>
                    <td className="mh-hcc-pre">{w.scheduleText || w.location || "—"}</td>
                    {tab !== "completed" ? (
                      <td
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {tab === "available" && w.registrationStatus === "none" ? (
                          <button
                            type="button"
                            className="mh-hcc-btn"
                            disabled={busyId === w.id}
                            onClick={() => void register(w.id)}
                          >
                            {busyId === w.id ? "Saving…" : "Register"}
                          </button>
                        ) : tab === "mine" ? (
                          <button type="button" className="mh-hcc-btn ghost" disabled={busyId === w.id} onClick={() => void cancel(w.id)}>{busyId === w.id ? "Saving…" : "Cancel"}</button>
                        ) : (
                          <span className="mh-hcc-pill">{w.registrationStatus}</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : null}

        {selected ? (
          <div className="mh-hcc-modal" role="dialog" aria-modal="true" aria-label="Workshop details">
            <button type="button" className="mh-hcc-modal__backdrop" aria-label="Close" onClick={closeWorkshop} />
            <div className="mh-hcc-modal__panel">
              <header className="mh-hcc-modal__head">
                <div>
                  <p className="mh-teacher-muted">{selected.code}</p>
                  <h2>{selected.title}</h2>
                </div>
                <button type="button" className="mh-hcc-modal__x" onClick={closeWorkshop} aria-label="Close">
                  ×
                </button>
              </header>
              <div className="mh-hcc-modal__body">
                <dl className="mh-student-course-premium__meta">
                  <div>
                    <dt>Instructor(s)</dt>
                    <dd>{selected.instructorName || "—"}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {selected.registrationStatus && selected.registrationStatus !== "none"
                        ? selected.registrationStatus
                        : selected.status}
                    </dd>
                  </div>
                  <div>
                    <dt>Length</dt>
                    <dd>{selected.lengthLabel || `${selected.creditsCeu} CEU`}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {fmtDate(selected.startsAt)}
                      {selected.endsAt ? ` – ${fmtDate(selected.endsAt)}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Schedule / location</dt>
                    <dd>{selected.scheduleText || selected.location || "—"}</dd>
                  </div>
                  <div>
                    <dt>Seats</dt>
                    <dd>
                      {selected.registeredCount} / {selected.capacity} registered
                    </dd>
                  </div>
                </dl>
                {selected.description ? <p>{selected.description}</p> : null}
                {tab === "available" && selected.registrationStatus === "none" ? (
                  <button
                    type="button"
                    className="mh-hcc-btn"
                    disabled={busyId === selected.id}
                    onClick={() => void register(selected.id)}
                  >
                    {busyId === selected.id ? "Saving…" : "Register for this workshop"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </StudentSisShell>
  );
}

export default function WorkshopsPage() {
  return (
    <Suspense fallback={null}>
      <WorkshopsInner />
    </Suspense>
  );
}

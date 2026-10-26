"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentServiceRequestsResponse } from "@myheritage/contracts";
import { Button, Panel, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession, type Session } from "@/lib/api";

export default function StudentServicesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentServiceRequestsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [type, setType] = useState<
    | "general_inquiry"
    | "official_transcript"
    | "enrollment_verification"
    | "advising_referral"
    | "course_withdrawal"
    | "course_change"
    | "transcript_request"
    | "academic_appeal"
    | "leave_of_absence"
  >("general_inquiry");

  async function refresh(s: Session) {
    setData(await api<StudentServiceRequestsResponse>("/student/services", {}, s.accessToken));
  }

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    refresh(s).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    try {
      await api(
        "/student/services",
        { method: "POST", body: JSON.stringify({ type, subject, details, ...(type === "course_withdrawal" ? { sectionId } : {}) }) },
        session.accessToken,
      );
      setSubject("");
      setDetails("");
      setSectionId("");
      await refresh(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function cancel(id: string) {
    if (!session) return;
    setError(null);
    try {
      setData(await api<StudentServiceRequestsResponse>(`/student/services/${id}/cancel`, { method: "POST", body: "{}" }, session.accessToken));
    } catch (err) { setError(err instanceof Error ? err.message : "Cancellation failed"); }
  }

  if (!session) return null;

  return (
    <StudentSisShell title="Student services" activeHref="/student/f/st-16-services">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <h1 style={{ marginTop: 0 }}>Student services</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>
          Create and track service requests. Official record changes require approval.
        </p>
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        <Panel title="New request">
          <form onSubmit={onCreate} style={{ display: "grid", gap: 10 }}>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="general_inquiry">General inquiry</option>
              <option value="advising_referral">Advising referral</option>
              <option value="official_transcript">Official transcript (approval)</option>
              <option value="enrollment_verification">Enrollment verification (approval)</option>
              <option value="transcript_request">Transcript request (approval)</option>
              <option value="course_withdrawal">Course withdrawal (approval)</option>
              <option value="course_change">Course change (approval)</option>
              <option value="academic_appeal">Academic appeal (approval)</option>
              <option value="leave_of_absence">Leave of absence (approval)</option>
            </select>
            {type === "course_withdrawal" ? (
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                <option value="">Select enrolled course section</option>
                {(data?.withdrawalOptions ?? []).map((option) => (
                  <option key={option.sectionId} value={option.sectionId}>{option.label}</option>
                ))}
              </select>
            ) : null}
            <input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required minLength={3} />
            <textarea placeholder="Details" value={details} onChange={(e) => setDetails(e.target.value)} required minLength={10} rows={4} />
            <Button type="submit">Submit request</Button>
          </form>
        </Panel>
        <Panel title="Your requests">
          {(data?.requests.length ?? 0) === 0 ? (
            <p style={{ color: "var(--mh-text-muted)" }}>No requests yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {data!.requests.map((r) => (
                <li key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong>{r.subject}</strong>
                    <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>{r.type} · {r.createdAt.slice(0, 10)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <StatusPill tone={r.status === "resolved" ? "success" : "warning"}>{r.status}</StatusPill>
                    {r.status === "open" || r.status === "pending_approval" ? <Button type="button" onClick={() => void cancel(r.id)}>Cancel</Button> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </StudentSisShell>
  );
}

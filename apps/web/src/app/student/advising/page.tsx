"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdvisingAppointmentRecord } from "@myheritage/contracts";
import { Banner, Button, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { StudentSisShell } from "@/components/StudentSisShell";
import { readAdvisingPrefill } from "@/lib/careerFlow";

type StudentAppointment = AdvisingAppointmentRecord & { advisorName?: string };

export default function StudentAdvisingPage() {
  const router = useRouter();
  const [items, setItems] = useState<StudentAppointment[]>([]);
  const [topic, setTopic] = useState("Degree plan review");
  const [startsAt, setStartsAt] = useState(() => {
    const date = new Date(Date.now() + 3 * 86_400_000);
    date.setMinutes(0, 0, 0);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("Booked from Advising");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userName, setUserName] = useState("Student");

  async function load() {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setUserName(`${session.givenName} ${session.familyName}`.trim() || "Student");
    const data = await api<{ items: StudentAppointment[] }>(
      "/student/advising/appointments",
      {},
      session.accessToken,
    );
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load advising"));
  }, [router]);

  useEffect(() => {
    const prefill = readAdvisingPrefill(window.location.search);
    if (prefill.topic) setTopic(prefill.topic);
    if (prefill.sourceNote) setNotes(prefill.sourceNote);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const session = loadSession();
    if (!session) return;
    setSaving(true);
    setError(null);
    try {
      await api(
        "/student/advising/appointments",
        {
          method: "POST",
          body: JSON.stringify({
            topic,
            startsAt: new Date(startsAt).toISOString(),
            notes,
          }),
        },
        session.accessToken,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to book advisor");
    } finally {
      setSaving(false);
    }
  }

  return (
    <StudentSisShell
      title="Advising"
      subtitle="Book and track advisor appointments"
      activeHref="/student/advising"
      userName={userName}
    >
      <div className="mh-student-stack">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <section className="mh-sis-dash__card">
          <h2>Book advisor</h2>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 480 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Topic</span>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Preferred date and time</span>
              <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Notes</span>
              <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <Button type="submit" disabled={saving}>
              {saving ? "Requesting…" : "Request appointment"}
            </Button>
            <Button
              type="button"
              variant="ai"
              onClick={() =>
                router.push("/student/ask?q=" + encodeURIComponent("Book my advisor to review my degree plan"))
              }
            >
              Ask CampusOne to book
            </Button>
          </form>
        </section>
        <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
          <h2>Your appointments</h2>
          {items.length === 0 ? <p>No appointments yet.</p> : null}
          <ul>
            {items.map((item) => (
              <li key={item.id} style={{ marginBottom: 12 }}>
                <strong>{item.topic}</strong>{" "}
                <StatusPill tone={item.status === "requested" ? "warning" : "success"}>{item.status}</StatusPill>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>{item.startsAt}</div>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>Advisor: {item.advisorName ?? "Awaiting advisor assignment"}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StudentSisShell>
  );
}

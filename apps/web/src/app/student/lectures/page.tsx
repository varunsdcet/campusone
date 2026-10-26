"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentLecturesResponse } from "@myheritage/contracts";
import { Button, Panel, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession, type Session } from "@/lib/api";

export default function StudentLecturesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentLecturesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    api<StudentLecturesResponse>("/student/lectures", {}, s.accessToken)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  if (!session) return null;

  return (
    <StudentSisShell title="Lectures" activeHref="/student/lectures">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <h1 style={{ marginTop: 0 }}>Lectures</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>Lecture sessions for your enrolled sections.</p>
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        <Panel title="Schedule">
          {(data?.lectures.length ?? 0) === 0 ? (
            <p style={{ color: "var(--mh-text-muted)" }}>No lectures scheduled.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {data!.lectures.map((l) => (
                <li key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong>{l.title}</strong>
                    <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>
                      {l.courseCode} · {l.startsAt.slice(0, 16).replace("T", " ")} · {l.location ?? l.deliveryMode}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <StatusPill tone="neutral">{l.deliveryMode}</StatusPill>
                    {l.joinUrl ? (
                      <Button
                        type="button"
                        onClick={() => {
                          void api(`/compliance/sessions/${l.id}/join`, { method: "POST", body: "{}" }, session.accessToken)
                            .catch(() => undefined)
                            .finally(() => window.open(l.joinUrl!, "_blank", "noopener,noreferrer"));
                        }}
                      >
                        Join
                      </Button>
                    ) : (
                      <Button type="button" variant="secondary" onClick={() => router.push(`/student/f/st-11-lecture-detail?sessionId=${l.id}`)}>
                        Detail
                      </Button>
                    )}
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

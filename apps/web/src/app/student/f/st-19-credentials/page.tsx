"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentCredentialsResponse } from "@myheritage/contracts";
import { Panel, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession, type Session } from "@/lib/api";

export default function StudentCredentialsPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StudentCredentialsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    api<StudentCredentialsResponse>("/student/credentials", {}, s.accessToken)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  if (!session) return null;

  return (
    <StudentSisShell title="Credentials" activeHref="/student/f/st-19-credentials">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <h1 style={{ marginTop: 0 }}>Credentials</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>
          Earned and pending credentials. Issuance and revocation are registrar-only.
        </p>
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        <StatusPill tone="neutral">Issuance disabled in student portal</StatusPill>
        <Panel title="Your credentials">
          {(data?.credentials.length ?? 0) === 0 ? (
            <p style={{ color: "var(--mh-text-muted)" }}>No credential records yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {data!.credentials.map((c) => (
                <li key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <strong>{c.title}</strong>
                    <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>{c.detail ?? "—"}</div>
                  </div>
                  <StatusPill tone={c.status === "earned" ? "success" : "warning"}>{c.status}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </StudentSisShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { StudentLectureSummary } from "@myheritage/contracts";
import { Button, Panel, StatusPill } from "@myheritage/ui";
import { StudentSisShell } from "@/components/StudentSisShell";
import { api, loadSession, type Session } from "@/lib/api";

function LectureDetailInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId");
  const [session, setSession] = useState<Session | null>(null);
  const [lecture, setLecture] = useState<StudentLectureSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    setSession(s);
    if (!sessionId) {
      setError("Missing sessionId");
      return;
    }
    api<{ lecture: StudentLectureSummary }>(`/student/lectures/${sessionId}`, {}, s.accessToken)
      .then((res) => setLecture(res.lecture))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router, sessionId]);

  if (!session) return null;

  return (
    <StudentSisShell title="Lecture detail" activeHref="/student/lectures">
      <div style={{ padding: 24, maxWidth: 960 }}>
        <h1 style={{ marginTop: 0 }}>Lecture detail</h1>
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        {lecture ? (
          <Panel title={lecture.title}>
            <div style={{ display: "grid", gap: 8 }}>
              <StatusPill tone="neutral">{lecture.courseCode}</StatusPill>
              <div>{lecture.startsAt.slice(0, 16).replace("T", " ")}{lecture.endsAt ? ` – ${lecture.endsAt.slice(11, 16)}` : ""}</div>
              <div>{lecture.location ?? lecture.deliveryMode}</div>
              {lecture.joinUrl ? (
                <Button type="button" onClick={() => window.open(lecture.joinUrl!, "_blank", "noopener,noreferrer")}>
                  Join class
                </Button>
              ) : (
                <StatusPill tone="neutral">In-person session</StatusPill>
              )}
              <Button type="button" variant="secondary" onClick={() => router.push("/student/lectures")}>
                Back to lectures
              </Button>
            </div>
          </Panel>
        ) : !error ? (
          <p>Loading…</p>
        ) : null}
      </div>
    </StudentSisShell>
  );
}

export default function StudentLectureDetailPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <LectureDetailInner />
    </Suspense>
  );
}

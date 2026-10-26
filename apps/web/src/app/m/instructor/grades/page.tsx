"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GradebookResponse } from "@myheritage/contracts";
import { MobileChrome } from "@/components/ScreenScaffold";
import { StatusPill } from "@myheritage/ui";
import { api, loadSession, type Session } from "@/lib/api";

export default function MobileInstructorGradesPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [book, setBook] = useState<GradebookResponse | null>(null);
  const [sections, setSections] = useState<Array<{ sectionId: string; code?: string; title?: string }>>([]);
  const [sectionId, setSectionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/m/login");
      return;
    }
    setSession(s);
    api<{ items: Array<{ sectionId: string; sectionCode?: string; courseCode?: string; title?: string }> }>("/courses/me", {}, s.accessToken)
      .then(async (res) => {
        const available = res.items.map((item) => ({ sectionId: item.sectionId, code: [item.courseCode, item.sectionCode].filter(Boolean).join(" "), title: item.title }));
        setSections(available);
        const sid = available[0]?.sectionId;
        if (!sid) {
          setError("No sections assigned.");
          return;
        }
        setSectionId(sid);
        const data = await api<GradebookResponse>(`/gradebooks/${sid}`, {}, s.accessToken);
        setBook(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [router]);

  async function chooseSection(next: string) {
    if (!session || !next) return;
    setSectionId(next);
    setBook(null);
    setError(null);
    try { setBook(await api<GradebookResponse>(`/gradebooks/${next}`, {}, session.accessToken)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
  }

  return (
    <MobileChrome title="Gradebook">
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 20, marginTop: 0 }}>Grades (read-only)</h1>
        <p style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>Mobile view is read-only. Edit scores on desktop gradebook.</p>
        {sections.length > 1 ? (
          <label style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13 }}>Course section</span>
            <select value={sectionId} onChange={(event) => void chooseSection(event.target.value)}>
              {sections.map((section) => <option key={section.sectionId} value={section.sectionId}>{section.code || section.title || section.sectionId}</option>)}
            </select>
          </label>
        ) : null}
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
        {!book && !error ? <p>Loading…</p> : null}
        {book ? (
          <div style={{ display: "grid", gap: 12 }}>
            <StatusPill tone="neutral">
              {book.courseCode} · {book.courseTitle}
            </StatusPill>
            {book.rows.map((row) => (
              <div key={row.studentId} style={{ border: "1px solid var(--mh-border)", borderRadius: 10, padding: 12 }}>
                <strong>{row.name}</strong>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 12 }}>{row.studentNumber}</div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
                  {row.cells.map((cell) => {
                    const assignment = book.assignments.find((a) => a.id === cell.assignmentId);
                    return (
                      <li key={`${row.studentId}-${cell.assignmentId}`}>
                        {assignment?.title ?? "Item"}: {cell.score != null ? `${cell.score}/${cell.maxScore}` : "—"} ({cell.status})
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        {session ? (
          <button
            type="button"
            style={{ marginTop: 16 }}
            onClick={() => router.push("/instructor/gradebook")}
          >
            Open desktop gradebook
          </button>
        ) : null}
      </div>
    </MobileChrome>
  );
}

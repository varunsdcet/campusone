"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Panel, StatusPill } from "@myheritage/ui";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { api, loadSession } from "@/lib/api";

type SectionRow = {
  sectionId: string;
  code: string;
  courseCode: string;
  courseTitle: string;
  instructorName: string;
  enrolmentCount: number;
};

export default function CreateSectionPage() {
  const router = useRouter();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState({
    courseCode: "",
    courseTitle: "",
    sectionCode: "",
    instructorEmail: "",
    credits: 3,
    termCode: "2026F",
  });

  async function refresh(token: string) {
    const res = await api<{ items: SectionRow[] }>("/admin/sections", {}, token);
    setSections(res.items);
  }

  useEffect(() => {
    const s = loadSession();
    if (!s) {
      router.replace("/login");
      return;
    }
    if (!s.roles.includes("admin") && !s.roles.includes("registrar")) {
      router.replace("/login");
      return;
    }
    refresh(s.accessToken).catch((err) => setError(err instanceof Error ? err.message : "Failed"));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const s = loadSession();
    if (!s) return;
    setError(null);
    setNote(null);
    const courseCode = form.courseCode.trim();
    const courseTitle = form.courseTitle.trim();
    const sectionCode = form.sectionCode.trim();
    const instructorEmail = form.instructorEmail.trim();
    if (!courseCode || !courseTitle || !sectionCode || !instructorEmail) {
      setError("Course code, title, section code, and instructor email are required.");
      return;
    }
    try {
      const created = await api<{ sectionId: string; code: string; instructorEmail: string }>(
        "/admin/sections",
        {
          method: "POST",
          body: JSON.stringify({
            ...form,
            courseCode,
            courseTitle,
            sectionCode,
            instructorEmail,
          }),
        },
        s.accessToken,
      );
      setNote(`Section ${created.code} assigned to ${created.instructorEmail}`);
      setForm({
        courseCode: "",
        courseTitle: "",
        sectionCode: "",
        instructorEmail: "",
        credits: 3,
        termCode: form.termCode || "2026F",
      });
      await refresh(s.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function onDelete(section: SectionRow) {
    const s = loadSession();
    if (!s) return;
    if (
      !window.confirm(
        `Delete section ${section.code}? This permanently removes the section with its assignments, grade items, submissions, files and class sessions. This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    setNote(null);
    setBusyId(section.sectionId);
    try {
      await api<{ ok: boolean }>(`/admin/sections/${section.sectionId}`, { method: "DELETE" }, s.accessToken);
      setNote(`Deleted section ${section.code}`);
      await refresh(s.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScreenScaffold
      role="admin"
      title="Create section"
      subtitle="Assign a course section to a teacher"
      breadcrumb={["Administration", "Sections", "Create"]}
      active="Users"
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/users/create")}>
          Create teacher/student
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/admin/enrolments")}>
          Enrol student
        </Button>
      </div>
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {note ? <StatusPill tone="success">{note}</StatusPill> : null}

      <Panel title="New section">
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Course code</span>
            <Input
              value={form.courseCode}
              onChange={(e) => setForm({ ...form, courseCode: e.target.value })}
              required
              placeholder="e.g. CS301"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Course title</span>
            <Input
              value={form.courseTitle}
              onChange={(e) => setForm({ ...form, courseTitle: e.target.value })}
              required
              placeholder="e.g. Algorithms"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Section code</span>
            <Input
              value={form.sectionCode}
              onChange={(e) => setForm({ ...form, sectionCode: e.target.value })}
              required
              placeholder="e.g. CS301-01"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Instructor email</span>
            <Input
              type="email"
              value={form.instructorEmail}
              onChange={(e) => setForm({ ...form, instructorEmail: e.target.value })}
              required
              placeholder="teacher@heritage.edu"
            />
          </label>
          <Button type="submit">Create & assign</Button>
        </form>
      </Panel>

      <Panel title="Live sections">
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
          {sections.map((s) => (
            <li
              key={s.sectionId}
              style={{
                borderBottom: "1px solid var(--mh-border)",
                paddingBottom: 8,
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <strong>
                  {s.code} · {s.courseCode} {s.courseTitle}
                </strong>
                <div style={{ color: "var(--mh-text-muted)", fontSize: 13 }}>
                  {s.instructorName} · {s.enrolmentCount} enrolled
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={busyId === s.sectionId || s.enrolmentCount > 0}
                onClick={() => void onDelete(s)}
                title={s.enrolmentCount > 0 ? "Withdraw enrolments before deleting" : "Delete section"}
              >
                {busyId === s.sectionId ? "Deleting…" : s.enrolmentCount > 0 ? "Has enrolments" : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </ScreenScaffold>
  );
}

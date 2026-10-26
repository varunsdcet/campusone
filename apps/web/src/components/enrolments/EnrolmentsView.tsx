"use client";

import "./enrolments.css";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SaCard, SaField, SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { api, loadSession } from "@/lib/api";

type SectionRow = {
  sectionId: string;
  code: string;
  courseCode: string;
  courseTitle: string;
  termName?: string;
  enrolmentCount?: number;
  waitlistCount?: number;
  capacity?: number | null;
  waitlistEnabled?: boolean;
};
type StudentRow = { id: string; studentNumber: string; email: string; givenName: string; familyName: string; programName: string };
type Quote = {
  label: string;
  termName: string;
  amount: number;
  included: boolean;
  source: "session" | "course" | "none";
  rateCategory: string | null;
  seats: { capacity: number | null; waitlist: boolean; waitlistSize: number | null; enrolled: number; waitlisted: number };
};
type EnrolOut = { courseCode: string; status: "enrolled" | "waitlisted"; fee: { number: number; amount: number } | null; feeNote: string | null };
type BulkOut = {
  results: Array<EnrolOut & { studentId: string; studentName: string; studentNumber: string; status: "enrolled" | "waitlisted" | "existing" }>;
  failures: Array<{ studentId: string; studentName?: string; studentNumber?: string; code: string; message: string }>;
  summary: { requested: number; enrolled: number; waitlisted: number; existing: number; failed: number };
};
type RosterStatus = "all" | "enrolled" | "waitlisted";
type SectionRoster = {
  section: { id: string; code: string; courseCode: string; courseTitle: string };
  counts: { enrolled: number; waitlisted: number; total: number };
  items: Array<{
    enrolmentId: string;
    studentId: string;
    studentNumber: string;
    givenName: string;
    familyName: string;
    email: string;
    programName: string;
    status: "enrolled" | "waitlisted";
    enrolledAt: string;
  }>;
};

const money = (n: number) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

function feeText(q: Quote) {
  if (q.included) return "Tuition is included in the program cost, so no course fee will be posted.";
  if (q.amount <= 0) return "This course has no cost set, so no course fee will be posted.";
  return `${money(q.amount)}${q.rateCategory ? ` (${q.rateCategory})` : ""}, charged to ${q.termName}.`;
}

function Seats({ enrolled, capacity, waitlisted, waitlistEnabled }: { enrolled: number; capacity: number | null | undefined; waitlisted?: number; waitlistEnabled?: boolean }) {
  if (capacity === undefined) return <span className="en-seats__text">—</span>;
  if (capacity === null) return <span className="en-seats__text">{enrolled} enrolled · no limit</span>;
  const ratio = capacity > 0 ? Math.min(1, enrolled / capacity) : 1;
  const tone = ratio >= 1 ? " is-full" : ratio >= 0.8 ? " is-warn" : "";
  return (
    <div className="en-seats">
      <div className="en-seats__bar" aria-hidden>
        <div className={`en-seats__fill${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      <span className="en-seats__text">
        {enrolled}/{capacity} seats
        {ratio >= 1 ? (waitlistEnabled ? ` · waitlist${waitlisted ? ` (${waitlisted})` : ""}` : " · full") : ""}
      </span>
    </div>
  );
}

export function EnrolmentsView() {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentFilter, setStudentFilter] = useState("");
  const [postFee, setPostFee] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [roster, setRoster] = useState<SectionRoster | null>(null);
  const [rosterSectionId, setRosterSectionId] = useState("");
  const [rosterStatus, setRosterStatus] = useState<RosterStatus>("all");
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);

  const loadSections = (token: string) =>
    api<{ items: SectionRow[] }>("/admin/sections", {}, token).then((sec) => {
      setSections(sec.items);
      setSectionId((cur) => cur || sec.items[0]?.sectionId || "");
    });

  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    Promise.all([loadSections(s.accessToken), api<{ items: StudentRow[] }>("/admin/enrolments/students", {}, s.accessToken)])
      .then(([, students]) => setStudents(students.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sections and students"))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const s = loadSession();
    if (!s || !sectionId) return;
    const params = new URLSearchParams({ sectionId, ...(selectedStudentIds[0] ? { studentId: selectedStudentIds[0] } : {}) });
    let live = true;
    const t = setTimeout(() => {
      api<Quote>(`/admin/enrolments/quote?${params.toString()}`, {}, s.accessToken)
        .then((q) => live && setQuote(q))
        .catch(() => live && setQuote(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [sectionId, selectedStudentIds]);

  const picked = sections.find((s) => s.sectionId === sectionId);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((s) => `${s.code} ${s.courseCode} ${s.courseTitle} ${s.termName ?? ""}`.toLowerCase().includes(q));
  }, [sections, filter]);
  const shownStudents = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      `${student.givenName} ${student.familyName} ${student.email} ${student.studentNumber} ${student.programName}`.toLowerCase().includes(q),
    );
  }, [students, studentFilter]);
  const selectedStudents = useMemo(() => {
    const ids = new Set(selectedStudentIds);
    return students.filter((student) => ids.has(student.id));
  }, [students, selectedStudentIds]);

  function toggleStudent(id: string) {
    setSelectedStudentIds((current) => {
      if (current.includes(id)) return current.filter((studentId) => studentId !== id);
      if (current.length >= 100) {
        setError("You can enrol up to 100 students at a time.");
        return current;
      }
      return [...current, id];
    });
  }

  async function loadRoster(id: string) {
    const s = loadSession();
    if (!s) return;
    setRosterSectionId(id);
    setRosterStatus("all");
    setRoster(null);
    setRosterError(null);
    setRosterBusy(true);
    try {
      setRoster(await api<SectionRoster>(`/admin/enrolments/section/${encodeURIComponent(id)}`, {}, s.accessToken));
    } catch (err) {
      setRosterError(err instanceof Error ? err.message : "Could not load section students");
    } finally {
      setRosterBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const s = loadSession();
    if (!s || busy) return;
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await api<BulkOut>("/admin/enrolments/bulk", { method: "POST", body: JSON.stringify({ studentIds: selectedStudentIds, sectionId, postFee }) }, s.accessToken);
      const parts = [`Processed ${res.summary.requested} student${res.summary.requested === 1 ? "" : "s"}: ${res.summary.enrolled} enrolled`];
      if (res.summary.waitlisted) parts.push(`${res.summary.waitlisted} waitlisted`);
      if (res.summary.existing) parts.push(`${res.summary.existing} already enrolled`);
      if (res.summary.failed) parts.push(`${res.summary.failed} failed — ${res.failures.map((failure) => `${failure.studentName || failure.studentNumber || "Student"}: ${failure.message}`).join("; ")}`);
      setNote(parts.join(" · "));
      setSelectedStudentIds([]);
      setStudentFilter("");
      await loadSections(s.accessToken);
      if (rosterSectionId === sectionId) await loadRoster(sectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrol failed");
    } finally {
      setBusy(false);
    }
  }

  const full = quote && quote.seats.capacity !== null && quote.seats.enrolled >= quote.seats.capacity;
  const blocked = Boolean(full && !quote?.seats.waitlist);

  return (
    <SuperFrame
      title="Enrolments"
      breadcrumbs={["Registrar", "Enrolments"]}
      breadcrumbHrefs={["/admin/ops/registrar"]}
      activeHref="/admin/enrolments"
      actions={
        <>
          <Link href="/admin/users/create" className="mh-sa__btn">
            Create user
          </Link>
          <Link href="/admin/sections/create" className="mh-sa__btn">
            Create section
          </Link>
          <Link href="/admin/approvals" className="mh-sa__btn">
            Approvals
          </Link>
        </>
      }
    >
      <p className="mh-sa__muted" style={{ margin: "-6px 0 16px" }}>
        Put one or more students into a live section. Seats, waitlist and each student&apos;s course fee are checked before every enrolment is saved.
      </p>
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {note ? (
        <SaNotice tone="success" onClose={() => setNote(null)}>
          {note}
        </SaNotice>
      ) : null}

      <div className="en-layout">
        <SaCard title="Enrol students">
          <form onSubmit={onSubmit} className="mh-sa__form">
            <SaField label={`Students (${selectedStudentIds.length} selected)`}>
              <input
                className="mh-sa__input"
                value={studentFilter}
                placeholder="Search name, student number, email or program"
                onChange={(e) => setStudentFilter(e.target.value)}
              />
              <div className="en-student-actions">
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setSelectedStudentIds((ids) => [...new Set([...ids, ...shownStudents.map((student) => student.id)])].slice(0, 100))} disabled={!shownStudents.length}>
                  Select shown
                </button>
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setSelectedStudentIds([])} disabled={!selectedStudentIds.length}>
                  Clear
                </button>
              </div>
              {selectedStudents.length ? (
                <div className="en-student-chips">
                  {selectedStudents.map((student) => (
                    <button type="button" key={student.id} className="en-student-chip" onClick={() => toggleStudent(student.id)} title="Remove student">
                      {student.givenName} {student.familyName} · {student.studentNumber} ×
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="en-student-list" role="group" aria-label="Select students">
                {shownStudents.length ? shownStudents.map((student) => (
                  <label key={student.id} className="en-student-option">
                    <input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => toggleStudent(student.id)} />
                    <span>
                      <strong>{student.givenName} {student.familyName}</strong>
                      <small>{student.studentNumber} · {student.email}{student.programName ? ` · ${student.programName}` : ""}</small>
                    </span>
                  </label>
                )) : <span className="mh-sa__muted">No students match this search.</span>}
              </div>
            </SaField>

            <SaField label="Section">
              <select className="mh-sa__input" value={sectionId} onChange={(e) => setSectionId(e.target.value)} required>
                {sections.map((s) => (
                  <option key={s.sectionId} value={s.sectionId}>
                    {s.code} · {s.courseCode} {s.courseTitle}
                  </option>
                ))}
              </select>
            </SaField>

            {picked ? (
              <div className="en-picked">
                <span className="en-picked__title">
                  {picked.courseCode} — {picked.courseTitle}
                </span>
                <div className="en-picked__row">
                  <span>Section</span>
                  <strong>{picked.code}</strong>
                </div>
                <div className="en-picked__row">
                  <span>Term</span>
                  <strong>{picked.termName || "—"}</strong>
                </div>
                <div className="en-picked__row">
                  <span>Seats</span>
                  <Seats enrolled={picked.enrolmentCount ?? 0} capacity={picked.capacity} waitlisted={picked.waitlistCount} waitlistEnabled={picked.waitlistEnabled} />
                </div>
                {full ? (
                  <span className={quote?.seats.waitlist ? "mh-sa__pill mh-sa__pill--warn" : "mh-sa__pill"} style={quote?.seats.waitlist ? undefined : { color: "var(--mh-danger)" }}>
                    {quote?.seats.waitlist ? "Section full — selected students will be waitlisted" : "Section full and waitlist is disabled"}
                  </span>
                ) : null}
              </div>
            ) : null}

            <label className="mh-sa__check" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" checked={postFee} onChange={(e) => setPostFee(e.target.checked)} style={{ marginTop: 3 }} />
              <span>
                <strong>Post course fee</strong>
                {quote ? <span className="mh-sa__sub" style={{ display: "block" }}>{selectedStudentIds.length > 1 ? "The correct domestic/international fee is calculated separately for each selected student." : feeText(quote)}</span> : null}
              </span>
            </label>

            <div className="mh-sa__actions">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !sectionId || !selectedStudentIds.length || blocked}>
                {busy ? "Enrolling…" : full && quote?.seats.waitlist ? `Add ${selectedStudentIds.length} to waitlist` : `Enrol ${selectedStudentIds.length || ""} student${selectedStudentIds.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </form>
        </SaCard>

        <SaCard title={`Sections (${sections.length})`}>
          <div className="en-toolbar">
            <input className="mh-sa__input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search section, course or term" aria-label="Search sections" />
          </div>
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table en-table">
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Course</th>
                  <th>Term</th>
                  <th>Seats</th>
                  <th className="mh-sa__col-action" />
                </tr>
              </thead>
              <tbody>
                {shown.length ? (
                  shown.map((s) => (
                    <tr key={s.sectionId} className={s.sectionId === sectionId ? "is-picked" : undefined}>
                      <td>
                        <strong>{s.code}</strong>
                      </td>
                      <td>
                        {s.courseCode}
                        <div className="mh-sa__sub">{s.courseTitle}</div>
                      </td>
                      <td>{s.termName || "—"}</td>
                      <td>
                        <Seats enrolled={s.enrolmentCount ?? 0} capacity={s.capacity} waitlisted={s.waitlistCount} waitlistEnabled={s.waitlistEnabled} />
                      </td>
                      <td className="mh-sa__col-action">
                        <div className="en-row-actions">
                          {s.sectionId === sectionId ? (
                            <span className="mh-sa__pill mh-sa__pill--ok">Selected</span>
                          ) : (
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setSectionId(s.sectionId)}>
                              Select
                            </button>
                          )}
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => void loadRoster(s.sectionId)}>
                            View Students
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="mh-sa__empty-cell">
                      <p className="mh-sa__empty">{loaded ? (filter ? "No sections match your search." : "No sections yet.") : "Loading sections…"}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SaCard>
      </div>
      {rosterSectionId ? (
        <SaModal
          wide
          title={roster ? `${roster.section.courseCode} ${roster.section.code} — Students` : "Section Students"}
          onClose={() => {
            setRosterSectionId("");
            setRoster(null);
            setRosterError(null);
          }}
          footer={<button type="button" className="mh-sa__btn" onClick={() => setRosterSectionId("")}>Close</button>}
        >
          {rosterError ? <SaNotice tone="error">{rosterError}</SaNotice> : null}
          {rosterBusy ? <p className="mh-sa__muted">Loading enrolled and waitlisted students…</p> : null}
          {roster ? (
            <>
              <p className="mh-sa__muted en-roster-course">{roster.section.courseTitle}</p>
              <div className="en-roster-tabs" role="group" aria-label="Filter section students">
                {([
                  ["all", `All (${roster.counts.total})`],
                  ["enrolled", `Enrolled (${roster.counts.enrolled})`],
                  ["waitlisted", `Waitlisted (${roster.counts.waitlisted})`],
                ] as Array<[RosterStatus, string]>).map(([status, label]) => (
                  <button key={status} type="button" className={`mh-sa__btn mh-sa__btn--sm${rosterStatus === status ? " mh-sa__btn--primary" : ""}`} onClick={() => setRosterStatus(status)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table en-roster-table">
                  <thead>
                    <tr><th>Student</th><th>Student Number</th><th>Program</th><th>Status</th><th>Added</th></tr>
                  </thead>
                  <tbody>
                    {roster.items.filter((item) => rosterStatus === "all" || item.status === rosterStatus).map((item) => (
                      <tr key={item.enrolmentId}>
                        <td><strong>{item.givenName} {item.familyName}</strong><div className="mh-sa__sub">{item.email}</div></td>
                        <td>{item.studentNumber}</td>
                        <td>{item.programName || "—"}</td>
                        <td><span className={`mh-sa__pill ${item.status === "enrolled" ? "mh-sa__pill--ok" : "mh-sa__pill--warn"}`}>{item.status === "enrolled" ? "Enrolled" : "Waitlisted"}</span></td>
                        <td>{new Date(item.enrolledAt).toLocaleDateString("en-CA")}</td>
                      </tr>
                    ))}
                    {!roster.items.some((item) => rosterStatus === "all" || item.status === rosterStatus) ? (
                      <tr><td colSpan={5} className="mh-sa__empty-cell"><p className="mh-sa__empty">No {rosterStatus === "all" ? "enrolled or waitlisted" : rosterStatus} students in this section.</p></td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

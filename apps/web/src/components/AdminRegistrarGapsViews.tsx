"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, StatusPill } from "@myheritage/ui";
import { AdminSisShell } from "@/components/AdminSisShell";
import { profileHref } from "@/components/students/kit";
import { api, loadSession, openAuthenticatedPdf, type Session } from "@/lib/api";

type StudentLite = { id: string; studentNumber: string; name: string; programName: string; cohortId: string | null };
type ProgramLite = { id: string; code: string; name: string };
type SectionLite = { id: string; code: string; courseCode: string; courseTitle: string };
type TermLite = { id: string; code: string; name: string };

function useAdminSession() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
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
    setSession(s);
  }, [router]);
  return session;
}

function Frame({
  title,
  subtitle,
  activeHref,
  children,
}: {
  title: string;
  subtitle: string;
  activeHref: string;
  children: React.ReactNode;
}) {
  const session = useAdminSession();
  if (!session) return null;
  return (
    <AdminSisShell
      activeHref={activeHref}
      breadcrumbs={["Home", "Registrar", title]}
      userName={`${session.givenName} ${session.familyName}`}
    >
      <div style={{ display: "grid", gap: 16, padding: "0 4px 24px" }}>
        <header>
          <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{title}</h1>
          <p style={{ margin: 0, color: "var(--mh-text-muted)", fontSize: 14 }}>{subtitle}</p>
        </header>
        {children}
      </div>
    </AdminSisShell>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--mh-border)",
        borderRadius: 12,
        padding: 16,
        background: "var(--mh-surface)",
        display: "grid",
        gap: 12,
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 13, minWidth: 0 }}>
      <span style={{ color: "var(--mh-text-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  border: "1px solid var(--mh-border)",
  borderRadius: 8,
  padding: "8px 10px",
  background: "var(--mh-bg)",
  color: "inherit",
};

function useLites(session: Session | null) {
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [programs, setPrograms] = useState<ProgramLite[]>([]);
  const [sections, setSections] = useState<SectionLite[]>([]);
  const [terms, setTerms] = useState<TermLite[]>([]);
  useEffect(() => {
    if (!session) return;
    void Promise.allSettled([
      api<{ items: StudentLite[] }>("/admin/students-lite", {}, session.accessToken),
      api<{ items: ProgramLite[] }>("/admin/programs-lite", {}, session.accessToken),
      api<{ items: SectionLite[] }>("/admin/sections-lite", {}, session.accessToken),
      api<{ items: TermLite[] }>("/admin/financial-terms", {}, session.accessToken),
    ]).then(([s, p, sec, t]) => {
      if (s.status === "fulfilled") setStudents(s.value.items);
      if (p.status === "fulfilled") setPrograms(p.value.items);
      if (sec.status === "fulfilled") setSections(sec.value.items);
      if (t.status === "fulfilled") setTerms(t.value.items);
    });
  }, [session]);
  return { students, programs, sections, terms };
}

export function AdminCohortsView() {
  const router = useRouter();
  const session = useAdminSession();
  const { students, programs } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    programId: "",
    code: "",
    label: "",
    intakeYear: new Date().getFullYear(),
    intakeMonth: 9,
    sectionLabel: "A",
    campus: "",
    startDate: "",
    endDate: "",
  });
  const [gen, setGen] = useState({ studentId: "", cohortId: "" });
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [generated, setGenerated] = useState<{
    studentId: string;
    studentLabel: string;
    cohortLabel: string;
    planId: string;
    itemCount: number;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/cohorts", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load cohorts"));
  }, [refresh]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/cohorts", { method: "POST", body: JSON.stringify({
        ...form,
        campus: form.campus || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      }) }, session.accessToken);
      setNotice("Cohort saved.");
      setForm((f) => ({ ...f, code: "", label: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!session || generatingRef.current) return;
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    setNotice(null);
    setGenerated(null);
    try {
      const res = await api<{ planId: string; itemCount: number }>("/admin/cohorts/generate-plan", {
        method: "POST",
        body: JSON.stringify(gen),
      }, session.accessToken);
      const student = students.find((item) => item.id === gen.studentId);
      const cohort = items.find((item) => String(item.id) === gen.cohortId);
      setGenerated({
        studentId: gen.studentId,
        studentLabel: student ? `${student.studentNumber} — ${student.name}` : "Selected student",
        cohortLabel: cohort ? `${String(cohort.code)} — ${String(cohort.label)}` : "Selected cohort",
        planId: res.planId,
        itemCount: res.itemCount,
      });
      setNotice(`Program plan generated (${res.itemCount} courses).`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  }

  return (
    <Frame title="Cohort management" subtitle="GAP-ADM-04 — create cohorts and generate program plans." activeHref="/admin/cohorts">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Create / update cohort">
        <form onSubmit={onSave} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <Field label="Program">
            <select style={inputStyle} required value={form.programId} onChange={(e) => setForm({ ...form, programId: e.target.value })}>
              <option value="">Select…</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cohort code"><input style={inputStyle} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Label"><input style={inputStyle} required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Intake year"><input style={inputStyle} type="number" value={form.intakeYear} onChange={(e) => setForm({ ...form, intakeYear: Number(e.target.value) })} /></Field>
          <Field label="Intake month"><input style={inputStyle} type="number" min={1} max={12} value={form.intakeMonth} onChange={(e) => setForm({ ...form, intakeMonth: Number(e.target.value) })} /></Field>
          <Field label="Section"><input style={inputStyle} value={form.sectionLabel} onChange={(e) => setForm({ ...form, sectionLabel: e.target.value })} /></Field>
          <Field label="Campus"><input style={inputStyle} value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })} /></Field>
          <Field label="Start date"><input style={inputStyle} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="End date"><input style={inputStyle} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          <div style={{ alignSelf: "end" }}><Button type="submit">Save cohort</Button></div>
        </form>
      </Card>
      <Card title="Generate program plan">
        <form onSubmit={onGenerate} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
          <Field label="Student">
            <select style={inputStyle} required value={gen.studentId} onChange={(e) => setGen({ ...gen, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cohort">
            <select style={inputStyle} required value={gen.cohortId} onChange={(e) => setGen({ ...gen, cohortId: e.target.value })}>
              <option value="">Select…</option>
              {items.map((c) => (
                <option key={String(c.id)} value={String(c.id)}>{String(c.code)} — {String(c.label)}</option>
              ))}
            </select>
          </Field>
          <Button type="submit" disabled={generating || !gen.studentId || !gen.cohortId}>
            {generating ? "Generating…" : "Generate plan"}
          </Button>
        </form>
        <div aria-live="polite">
          {generating ? <p style={{ margin: 0, color: "var(--mh-text-muted)" }}>Generating the student program plan…</p> : null}
          {generated ? (
            <div style={{ border: "1px solid var(--mh-border)", borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <strong>Plan ready: {generated.studentLabel}</strong>
                <div style={{ marginTop: 3, color: "var(--mh-text-muted)", fontSize: 13 }}>
                  {generated.cohortLabel} · {generated.itemCount} courses
                </div>
              </div>
              <Button type="button" onClick={() => router.push(profileHref(generated.studentId, "plan", "overview"))}>
                Open program plan
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
      <Card title={`Cohorts (${items.length})`}>
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((c) => (
            <div key={String(c.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--mh-border)" }}>
              <div>
                <strong>{String(c.code)}</strong> · {String(c.label)}
                <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>
                  {String(c.programName)} · {String(c.intakeYear)}-{String(c.intakeMonth)} · Sec {String(c.sectionLabel)}
                  {c.campus ? ` · ${String(c.campus)}` : ""}
                </div>
              </div>
              <StatusPill tone="neutral">{String(c.studentCount)} students · {String(c.planCount)} plans</StatusPill>
            </div>
          ))}
          {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No cohorts yet.</p> : null}
        </div>
      </Card>
    </Frame>
  );
}

export function AdminFinancePostingView() {
  const session = useAdminSession();
  const { students, terms } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    label: "",
    amountCad: 0,
    kind: "charge" as "charge" | "credit" | "payment",
    financialTermId: "",
    source: "manual_post",
    note: "",
  });

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/finance/ledger", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load ledger"));
  }, [refresh]);

  async function onPost(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/finance/ledger", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          financialTermId: form.financialTermId || null,
          note: form.note || null,
        }),
      }, session.accessToken);
      setNotice("Ledger entry posted.");
      setForm((f) => ({ ...f, label: "", amountCad: 0, note: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post failed");
    }
  }

  async function adjust(row: Record<string, unknown>, action: "reverse" | "waive") {
    if (!session) return;
    const isCharge = row.kind === "charge";
    const amount = `CAD ${String(row.amountCad)}`;
    const question = isCharge
      ? `${action === "waive" ? "Waive" : "Reverse"} the ${amount} charge "${String(row.label)}" for ${String(row.studentName)}?\n\nThis creates a Financial Adjustment that another user must approve before the balance changes.`
      : `Reverse the ${amount} ${String(row.kind)} "${String(row.label)}" for ${String(row.studentName)}? The student's balance goes up by this amount.`;
    if (!window.confirm(question)) return;
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ message?: string }>("/admin/finance/ledger/adjust", {
        method: "POST",
        body: JSON.stringify({ entryId: String(row.id), action }),
      }, session.accessToken);
      setNotice(res?.message ?? "Entry reversed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    }
  }

  return (
    <Frame title="AR / payment posting" subtitle="GAP-ADM-02 — post charges, payments, reversals to the student ledger." activeHref="/admin/finance/posting">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Post ledger entry">
        <form onSubmit={onPost} className="mh-finance-posting__form">
          <Field label="Student">
            <select style={inputStyle} required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <select style={inputStyle} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
              <option value="charge">Charge</option>
              <option value="payment">Payment</option>
              <option value="credit">Credit</option>
            </select>
          </Field>
          <Field label="Amount (CAD)"><input style={inputStyle} type="number" step="0.01" min="0.01" max="1000000" required value={form.amountCad} onChange={(e) => setForm({ ...form, amountCad: Number(e.target.value) })} /></Field>
          <Field label="Description"><input style={inputStyle} required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Financial term">
            <select style={inputStyle} value={form.financialTermId} onChange={(e) => setForm({ ...form, financialTermId: e.target.value })}>
              <option value="">None</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Source"><input style={inputStyle} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
          <Field label="Note"><input style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div style={{ alignSelf: "end" }}><Button type="submit">Post</Button></div>
        </form>
      </Card>
      <Card title={`Ledger (${items.length})`}>
        {items.map((row) => (
          <div key={String(row.id)} className="mh-finance-posting__row">
            <div className="mh-finance-posting__entry">
              <strong>{String(row.studentName)}</strong> · {String(row.label)}
              <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>
                {String(row.kind)} · CAD {String(row.amountCad)} · {String(row.status)}
                {row.source ? ` · ${String(row.source)}` : ""}
              </div>
            </div>
            <div className="mh-finance-posting__actions">
              {row.kind === "charge" && row.status === "open" ? (
                <Button type="button" variant="secondary" onClick={() => void adjust(row, "waive")}>Waive</Button>
              ) : null}
              {row.status !== "waived" && row.status !== "void" && row.source !== "reversal" && !row.reversedFromId ? (
                <Button type="button" variant="secondary" onClick={() => void adjust(row, "reverse")}>Reverse</Button>
              ) : null}
            </div>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No ledger entries.</p> : null}
      </Card>
    </Frame>
  );
}

export function AdminTaxDocumentsView() {
  const session = useAdminSession();
  const { students } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ studentId: "", taxYear: new Date().getFullYear() - 1, regenerate: false });
  const [openingId, setOpeningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/tax-documents", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  async function onGenerate(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    const preview = window.open("about:blank", "_blank");
    try {
      const row = await api<{ id: string; taxYear: number; docType?: string }>(
        "/admin/tax-documents/generate",
        { method: "POST", body: JSON.stringify(form) },
        session.accessToken,
      );
      setNotice("T2202 generated.");
      await refresh();
      try {
        await openAuthenticatedPdf(
          `/admin/tax-documents/${row.id}/pdf`,
          session.accessToken,
          `${row.docType || "T2202"}-${row.taxYear}.pdf`,
          preview,
        );
      } catch {
        preview?.close();
        setNotice("T2202 generated. Use Open to view the certificate.");
      }
    } catch (err) {
      preview?.close();
      setError(err instanceof Error ? err.message : "Generate failed");
    }
  }

  return (
    <Frame title="T2202 tax documents" subtitle="GAP-ADM-03 — generate tuition tax certificates from ledger charges." activeHref="/admin/tax-documents">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Generate T2202">
        <form onSubmit={onGenerate} style={{ display: "grid", gap: 10, gridTemplateColumns: "2fr 1fr auto auto", alignItems: "end" }}>
          <Field label="Student">
            <select style={inputStyle} required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Tax year"><input style={inputStyle} type="number" value={form.taxYear} onChange={(e) => setForm({ ...form, taxYear: Number(e.target.value) })} /></Field>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={form.regenerate} onChange={(e) => setForm({ ...form, regenerate: e.target.checked })} />
            Regenerate
          </label>
          <Button type="submit">Generate</Button>
        </form>
      </Card>
      <Card title={`Tax documents (${items.length})`}>
        {items.map((row) => (
          <div key={String(row.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--mh-border)" }}>
            <div>
              <strong>{String(row.studentName)}</strong> · {String(row.title)}
              <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>
                Year {String(row.taxYear)} · Tuition CAD {String(row.eligibleTuitionCad ?? "—")} · Months {String(row.enrolmentMonths ?? "—")} · CRA {String(row.craStatus)}
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={openingId === String(row.id)}
              onClick={() => {
                if (!session) return;
                setError(null);
                setOpeningId(String(row.id));
                void openAuthenticatedPdf(
                  `/admin/tax-documents/${row.id}/pdf`,
                  session.accessToken,
                  `${String(row.docType || "T2202")}-${String(row.taxYear)}.pdf`,
                )
                  .catch((err) => setError(err instanceof Error ? err.message : "Unable to open tax document"))
                  .finally(() => setOpeningId(null));
              }}
            >
              {openingId === String(row.id) ? "Opening…" : "Open"}
            </Button>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No tax documents.</p> : null}
      </Card>
    </Frame>
  );
}

export function AdminRetakesView() {
  const session = useAdminSession();
  const { students, sections } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    sectionId: "",
    countsTowardCgpa: true,
    creditAwarded: false,
    continuous: false,
    addMakeupPlanItem: true,
    feeCad: 250,
  });

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/retakes", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/retakes", { method: "POST", body: JSON.stringify(form) }, session.accessToken);
      setNotice("Retake / make-up enrolment created.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <Frame title="Retake / make-up sections" subtitle="GAP-ADM-05 — attempt pairing, CGPA flags, makeup plan items." activeHref="/admin/retakes">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Create retake enrolment">
        <form onSubmit={onCreate} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <Field label="Student">
            <select style={inputStyle} required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Section">
            <select style={inputStyle} required value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })}>
              <option value="">Select…</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.courseCode} · {s.code} — {s.courseTitle}</option>
              ))}
            </select>
          </Field>
          <Field label="Retake fee (CAD)"><input style={inputStyle} type="number" min="0.01" step="0.01" required value={form.feeCad} onChange={(e) => setForm({ ...form, feeCad: Number(e.target.value) })} /></Field>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={form.countsTowardCgpa} onChange={(e) => setForm({ ...form, countsTowardCgpa: e.target.checked })} /> Counts toward CGPA</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={form.creditAwarded} onChange={(e) => setForm({ ...form, creditAwarded: e.target.checked })} /> Credit awarded</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={form.continuous} onChange={(e) => setForm({ ...form, continuous: e.target.checked })} /> Continuous</label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={form.addMakeupPlanItem} onChange={(e) => setForm({ ...form, addMakeupPlanItem: e.target.checked })} /> Add makeup plan item</label>
          <div style={{ alignSelf: "end" }}><Button type="submit">Create retake</Button></div>
        </form>
      </Card>
      <Card title={`Retakes (${items.length})`}>
        {items.map((row) => (
          <div key={String(row.id)} style={{ padding: "8px 0", borderBottom: "1px solid var(--mh-border)" }}>
            <strong>{String(row.studentName)}</strong> · {String(row.courseCode)} · Attempt {String(row.attemptNumber)}
            <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>
              Section {String(row.sectionCode)} · CGPA {row.countsTowardCgpa ? "yes" : "no"} · Credit {row.creditAwarded ? "yes" : "no"} · {String(row.status)}
            </div>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No retake enrolments.</p> : null}
      </Card>
    </Frame>
  );
}

export function AdminStudentDocumentsView() {
  const session = useAdminSession();
  const { students } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    recordName: "",
    recordDate: "",
    docLabel: "",
    downloadUrl: "",
    note: "",
  });

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/student-documents", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/student-documents", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          recordDate: form.recordDate || null,
          docLabel: form.docLabel || null,
          downloadUrl: form.downloadUrl || null,
          note: form.note || null,
        }),
      }, session.accessToken);
      setNotice("Document assigned.");
      setForm((f) => ({ ...f, recordName: "", docLabel: "", downloadUrl: "", note: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onDelete(id: string) {
    if (!session) return;
    if (!window.confirm("Remove this document from the student's record? This cannot be undone.")) return;
    setError(null);
    try {
      await api(`/admin/student-documents/${id}`, { method: "DELETE" }, session.accessToken);
      setNotice("Document removed.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <Frame title="Student documents" subtitle="GAP-ADM-06 — registrar document repository for enrolled students." activeHref="/admin/student-documents">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Assign document">
        <form onSubmit={onSave} className="mh-student-documents__form">
          <Field label="Student">
            <select style={inputStyle} required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Record name"><input style={inputStyle} required value={form.recordName} onChange={(e) => setForm({ ...form, recordName: e.target.value })} /></Field>
          <Field label="Record date"><input style={inputStyle} type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} /></Field>
          <Field label="Document label"><input style={inputStyle} value={form.docLabel} onChange={(e) => setForm({ ...form, docLabel: e.target.value })} /></Field>
          <Field label="Download URL"><input style={inputStyle} value={form.downloadUrl} onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })} /></Field>
          <Field label="Note"><input style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div style={{ alignSelf: "end" }}><Button type="submit">Save</Button></div>
        </form>
      </Card>
      <Card title={`Documents (${items.length})`}>
        {items.map((row) => (
          <div key={String(row.id)} className="mh-student-documents__row">
            <div className="mh-student-documents__entry">
              <strong>{String(row.recordName)}</strong> · {String(row.studentName)}
              <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>{String(row.recordDate ?? "—")} · {String(row.docLabel ?? "—")}</div>
            </div>
            <div className="mh-student-documents__actions">
              <Button type="button" variant="secondary" onClick={() => void onDelete(String(row.id))}>Delete</Button>
            </div>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No documents.</p> : null}
      </Card>
    </Frame>
  );
}

export function AdminExtracurricularView() {
  const session = useAdminSession();
  const { students } = useLites(session);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    termCode: "",
    category: "Athletics",
    title: "",
    detail: "",
  });

  const refresh = useCallback(async () => {
    if (!session) return;
    const data = await api<{ items: Array<Record<string, unknown>> }>("/admin/extracurricular", {}, session.accessToken);
    setItems(data.items);
  }, [session]);

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [refresh]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/extracurricular", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          termCode: form.termCode || null,
          detail: form.detail || null,
        }),
      }, session.accessToken);
      setNotice("Extracurricular record saved.");
      setForm((f) => ({ ...f, title: "", detail: "" }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onDelete(id: string) {
    if (!session) return;
    if (!window.confirm("Delete this extracurricular record? This cannot be undone.")) return;
    setError(null);
    try {
      await api(`/admin/extracurricular/${id}`, { method: "DELETE" }, session.accessToken);
      setNotice("Record deleted.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <Frame title="Extracurricular records" subtitle="GAP-ADM-07 — create and maintain student extracurricular records." activeHref="/admin/extracurricular">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Add record">
        <form onSubmit={onSave} style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <Field label="Student">
            <select style={inputStyle} required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentNumber} — {s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Term"><input style={inputStyle} value={form.termCode} onChange={(e) => setForm({ ...form, termCode: e.target.value })} /></Field>
          <Field label="Category"><input style={inputStyle} required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="Title"><input style={inputStyle} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Detail"><input style={inputStyle} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></Field>
          <div style={{ alignSelf: "end" }}><Button type="submit">Save</Button></div>
        </form>
      </Card>
      <Card title={`Records (${items.length})`}>
        {items.map((row) => (
          <div key={String(row.id)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--mh-border)" }}>
            <div>
              <strong>{String(row.title)}</strong> · {String(row.studentName)}
              <div style={{ fontSize: 12, color: "var(--mh-text-muted)" }}>{String(row.category)} · {String(row.termCode ?? "—")}</div>
            </div>
            <Button type="button" variant="secondary" onClick={() => void onDelete(String(row.id))}>Delete</Button>
          </div>
        ))}
        {!items.length ? <p style={{ color: "var(--mh-text-muted)" }}>No records.</p> : null}
      </Card>
    </Frame>
  );
}

export function AdminMailPolicyView() {
  const session = useAdminSession();
  const [form, setForm] = useState({
    allowStudentForwarding: true,
    allowSmsForwarding: false,
    requireRegistrarAudit: true,
    maxForwardAddressLength: 200,
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    api<typeof form>("/admin/mail-policy", {}, session.accessToken)
      .then((data) => setForm({
        allowStudentForwarding: data.allowStudentForwarding,
        allowSmsForwarding: data.allowSmsForwarding,
        requireRegistrarAudit: data.requireRegistrarAudit,
        maxForwardAddressLength: data.maxForwardAddressLength,
        note: data.note ?? "",
      }))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [session]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setError(null);
    try {
      await api("/admin/mail-policy", {
        method: "PUT",
        body: JSON.stringify({ ...form, note: form.note || null }),
      }, session.accessToken);
      setNotice("Mail policy saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <Frame title="Mail forwarding policy" subtitle="GAP-ADM-08 — institution policy for student mail forwarding." activeHref="/admin/mail-policy">
      {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--mh-success, #0f766e)" }}>{notice}</p> : null}
      <Card title="Policy settings">
        <form onSubmit={onSave} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={form.allowStudentForwarding} onChange={(e) => setForm({ ...form, allowStudentForwarding: e.target.checked })} />
            Allow student e-mail forwarding
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={form.allowSmsForwarding} onChange={(e) => setForm({ ...form, allowSmsForwarding: e.target.checked })} />
            Allow SMS / text forwarding
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={form.requireRegistrarAudit} onChange={(e) => setForm({ ...form, requireRegistrarAudit: e.target.checked })} />
            Require registrar audit on forwarding changes
          </label>
          <Field label="Max forward address length">
            <input style={inputStyle} type="number" value={form.maxForwardAddressLength} onChange={(e) => setForm({ ...form, maxForwardAddressLength: Number(e.target.value) })} />
          </Field>
          <Field label="Policy note">
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
          <Button type="submit">Save policy</Button>
        </form>
      </Card>
    </Frame>
  );
}

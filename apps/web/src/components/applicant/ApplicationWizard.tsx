"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Metric, Panel } from "@myheritage/ui";
import { ScreenScaffold } from "@/components/ScreenScaffold";
import { api, loadSession } from "@/lib/api";

type Section = "personal" | "academic" | "program";
type Field = {
  key: string;
  label: string;
  section: Section;
  required: boolean;
  kind: "text" | "email" | "date" | "year" | "tel" | "select";
  max?: number;
  options?: string[];
  dynamic?: "programs" | "intakes";
};
type FormState = {
  applicationId: string;
  status: string;
  editable: boolean;
  progressPct: number;
  values: Record<string, string>;
  fields: Field[];
  options: { programs: string[]; intakes: string[] };
  completeness: {
    sections: Record<Section, { done: boolean; missing: string[] }>;
    documentsMissing: string[];
    missing: string[];
    pct: number;
  };
  documents: Array<{ id: string; label: string; status: string; fileName: string | null }>;
  savedAt?: string;
};

const SECTIONS: Array<{ id: Section; title: string; hint: string }> = [
  { id: "personal", title: "Personal details", hint: "Your legal name, contact details and residency." },
  { id: "academic", title: "Academic history", hint: "The highest level of education you have completed." },
  { id: "program", title: "Program choice", hint: "The program and intake you are applying for." },
];

const control: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--mh-font-sans)",
  fontSize: 15,
  padding: "0.65rem 0.8rem",
  borderRadius: "var(--mh-radius-md)",
  border: "1px solid var(--mh-border)",
  background: "var(--mh-surface)",
  color: "var(--mh-text)",
};

function token(router: ReturnType<typeof useRouter>) {
  const s = loadSession();
  if (!s) router.replace("/login?next=/applicant/application");
  return s?.accessToken;
}

export function ApplicationWizard() {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  const accept = useCallback((next: FormState) => {
    setForm(next);
    setValues(next.values);
    setDirty(false);
  }, []);

  useEffect(() => {
    const t = token(router);
    if (!t) return;
    api<FormState>("/applicant/application/form", {}, t)
      .then(accept)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your application"));
  }, [router, accept]);

  const set = (key: string, v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setDirty(true);
    setNotice(null);
  };

  async function save() {
    const t = token(router);
    if (!t || inFlight.current) return null;
    inFlight.current = true;
    setBusy("save");
    setError(null);
    try {
      const out = await api<FormState>("/applicant/application/form", { method: "PUT", body: JSON.stringify(values) }, t);
      accept(out);
      setNotice(`Saved at ${new Date(out.savedAt ?? Date.now()).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
      return out;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your application");
      return null;
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function submit() {
    const saved = dirty ? await save() : form;
    if (!saved) return;
    if (saved.completeness.missing.length) {
      setError(`Complete these before submitting: ${saved.completeness.missing.join("; ")}`);
      return;
    }
    const t = token(router);
    if (!t || inFlight.current) return;
    inFlight.current = true;
    setBusy("submit");
    setError(null);
    try {
      await api("/applicant/action", { method: "POST", body: JSON.stringify({ action: "submit_application", path: "/applicant/application" }) }, t);
      accept(await api<FormState>("/applicant/application/form", {}, t));
      setNotice("Application submitted. Admissions will be in touch.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your application");
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  const optionsOf = (f: Field) => (f.dynamic === "programs" ? form?.options.programs : f.dynamic === "intakes" ? form?.options.intakes : f.options) ?? [];

  const renderField = (f: Field) => {
    const v = values[f.key] ?? "";
    const disabled = !form?.editable || busy !== null;
    const id = `app-${f.key}`;
    const opts = optionsOf(f);
    return (
      <label key={f.key} htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          {f.label}
          {f.required ? <span aria-hidden style={{ color: "var(--mh-danger)" }}> *</span> : null}
        </span>
        {f.kind === "select" && (opts.length || !f.dynamic) ? (
          <select id={id} style={control} value={v} disabled={disabled} required={f.required} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Select…</option>
            {v && !opts.includes(v) ? <option value={v}>{v}</option> : null}
            {opts.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            style={control}
            value={v}
            disabled={disabled}
            required={f.required}
            maxLength={f.max}
            type={f.kind === "date" ? "date" : f.kind === "tel" ? "tel" : f.kind === "email" ? "email" : "text"}
            inputMode={f.kind === "year" ? "numeric" : undefined}
            placeholder={f.kind === "year" ? "YYYY" : undefined}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
      </label>
    );
  };

  const title = "Application";
  if (!form) {
    return (
      <ScreenScaffold role="applicant" title={title} subtitle="Admissions portal" breadcrumb={["Applicant", "Application"]} active="Application">
        {error ? <p style={{ color: "var(--mh-danger)" }}>{error}</p> : <p style={{ color: "var(--mh-text-muted)" }}>Loading your application…</p>}
      </ScreenScaffold>
    );
  }

  const c = form.completeness;
  const docsReady = form.documents.length - c.documentsMissing.length;
  return (
    <ScreenScaffold
      role="applicant"
      title={title}
      subtitle={values.programName ? `${values.programName}${values.intakeTerm ? ` · ${values.intakeTerm}` : ""}` : "Admissions portal"}
      breadcrumb={["Applicant", "Application"]}
      active="Application"
    >
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        <Metric label="Status" value={form.status.replace(/_/g, " ")} />
        <Metric label="Progress" value={`${c.pct}%`} hint={c.missing.length ? `${c.missing.length} item${c.missing.length === 1 ? "" : "s"} left` : "Ready to submit"} />
        <Metric label="Documents" value={`${docsReady}/${form.documents.length}`} hint="uploaded" />
      </div>
      <div role="progressbar" aria-label="Application progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.pct} style={{ height: 8, borderRadius: 999, background: "var(--mh-border)", marginBottom: 16, overflow: "hidden" }}>
        <div style={{ width: `${c.pct}%`, height: "100%", background: "var(--mh-brand)", transition: "width 200ms ease" }} />
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--mh-danger)", margin: "0 0 12px" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" style={{ color: "var(--mh-success, #1e7a46)", margin: "0 0 12px", fontWeight: 600 }}>
          {notice}
        </p>
      ) : null}
      {!form.editable ? (
        <p style={{ color: "var(--mh-text-muted)", margin: "0 0 12px" }}>
          This application was submitted and can no longer be edited. <Link href="/applicant/timeline">View the timeline</Link>.
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {SECTIONS.map((s) => {
          const state = c.sections[s.id];
          return (
            <Panel key={s.id} title={`${s.title} · ${state.done ? "Complete" : `${state.missing.length} to complete`}`}>
              <p style={{ margin: "0 0 12px", color: "var(--mh-text-muted)" }}>{s.hint}</p>
              {s.id === "program" && !form.options.programs.length ? (
                <p style={{ margin: "0 0 12px", color: "var(--mh-text-muted)" }}>No programs are open for applications yet. Enter the program name you are interested in.</p>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{form.fields.filter((f) => f.section === s.id).map(renderField)}</div>
            </Panel>
          );
        })}

        <Panel title={`Documents · ${c.documentsMissing.length ? `${c.documentsMissing.length} missing` : "Complete"}`}>
          <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, display: "grid", gap: 8 }}>
            {form.documents.map((d) => (
              <li key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontWeight: 600 }}>{d.label}</span>
                <span style={{ color: "var(--mh-text-muted)" }}>{d.status === "missing" ? "Not uploaded" : `${d.fileName ?? "File"} · ${d.status.replace(/_/g, " ")}`}</span>
              </li>
            ))}
          </ul>
          <Link href="/applicant/documents">Upload documents</Link>
        </Panel>

        {form.editable ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            <Button type="submit" variant="secondary" disabled={busy !== null || !dirty}>
              {busy === "save" ? "Saving…" : dirty ? "Save progress" : "Saved"}
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void submit()}>
              {busy === "submit" ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        ) : null}
      </form>
    </ScreenScaffold>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminSisShell } from "@/components/AdminSisShell";
import { api, loadSession } from "@/lib/api";
import "./curriculum.css";

type Course = { id: string; code: string; title: string };
type Program = { id: string; code: string; name: string };
type Version = { id: string; programId: string; label: string; effectiveOn: string; totalCredits: number; status: string; program: Program };
type Item = { id: string; [key: string]: unknown };
type Catalog = { programs: Program[]; versions: Version[]; courses: Course[]; requirements: Item[]; prerequisites: Item[]; corequisites: Item[]; offerings: Item[] };
type Kind = "version" | "requirement" | "prerequisite" | "corequisite" | "offering";

const blank: Catalog = { programs: [], versions: [], courses: [], requirements: [], prerequisites: [], corequisites: [], offerings: [] };

export default function CurriculumPage() {
  const [catalog, setCatalog] = useState<Catalog>(blank);
  const [kind, setKind] = useState<Kind>("requirement");
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const token = loadSession()?.accessToken;
  const refresh = async () => { if (token) setCatalog(await api<Catalog>("/admin/curriculum", {}, token)); };
  useEffect(() => { void refresh().catch((e) => setError(e instanceof Error ? e.message : "Could not load curriculum")); }, [token]);
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const courseOptions = useMemo(() => catalog.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>), [catalog.courses]);

  async function create() {
    if (!token) return;
    setBusy(true); setError("");
    const number = (key: string) => Number(form[key] || 0);
    let body: Record<string, unknown> = { kind };
    if (kind === "version") body = { ...body, programId: form.programId, label: form.label, effectiveOn: form.effectiveOn, totalCredits: number("totalCredits"), status: "active" };
    if (kind === "requirement") body = { ...body, programVersionId: form.programVersionId, courseId: form.courseId || null, courseCode: form.courseCode, title: form.title, credits: number("credits"), requirementKind: form.requirementKind || "required", sortOrder: number("sortOrder") };
    if (kind === "prerequisite" || kind === "corequisite") body = { ...body, courseId: form.courseId, requiredCourseId: form.requiredCourseId };
    if (kind === "offering") body = { ...body, courseId: form.courseId, termCode: form.termCode, termName: form.termName, seatsOpen: number("seatsOpen"), seatsTotal: number("seatsTotal"), status: "published" };
    try { await api("/admin/curriculum", { method: "POST", body: JSON.stringify(body) }, token); setForm({}); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setBusy(false); }
  }

  async function remove(removeKind: Kind, id: string) {
    if (!token || !window.confirm("Delete this curriculum record? Existing dependent records may prevent deletion.")) return;
    try { await api(`/admin/curriculum/${removeKind}/${id}`, { method: "DELETE" }, token); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
  }

  const input = (key: string, label: string, type = "text") => <label className="curriculum-field"><span>{label}</span><input type={type} placeholder={label} value={form[key] || ""} onChange={set(key)} /></label>;
  const course = (key: string, label: string) => <label className="curriculum-field"><span>{label}</span><select value={form[key] || ""} onChange={set(key)}><option value="">Select course</option>{courseOptions}</select></label>;
  const rows: Array<{ kind: Kind; id: string; label: string; detail: string }> = [
    ...catalog.versions.map((x) => ({ kind: "version" as const, id: x.id, label: `${x.program.code} · ${x.label}`, detail: `${x.effectiveOn} · ${x.totalCredits} credits` })),
    ...catalog.requirements.map((x) => ({ kind: "requirement" as const, id: x.id, label: `${String(x.courseCode)} · ${String(x.title)}`, detail: `${String(x.kind)} · ${String(x.credits)} credits` })),
    ...catalog.prerequisites.map((x) => ({ kind: "prerequisite" as const, id: x.id, label: `${String((x.course as Course)?.code)} requires ${String((x.prerequisiteCourse as Course)?.code)}`, detail: "Prerequisite" })),
    ...catalog.corequisites.map((x) => ({ kind: "corequisite" as const, id: x.id, label: `${String((x.course as Course)?.code)} with ${String((x.corequisiteCourse as Course)?.code)}`, detail: "Corequisite" })),
    ...catalog.offerings.map((x) => ({ kind: "offering" as const, id: x.id, label: `${String((x.course as Course)?.code)} · ${String(x.termName)}`, detail: `${String(x.seatsOpen)}/${String(x.seatsTotal)} seats open` })),
  ];

  return <AdminSisShell activeHref="/admin/curriculum" breadcrumbs={["Home", "Academics", "Curriculum Catalogue"]}>
    <div className="mh-hcc-page curriculum-page"><div className="curriculum-heading"><div><span>ACADEMIC CATALOGUE</span><h1>Curriculum catalogue</h1><p>Maintain programme versions, degree requirements, prerequisites, corequisites and term offerings.</p></div></div>
      {error ? <p className="curriculum-error" role="alert">{error}</p> : null}
      <section className="mh-card curriculum-card"><div className="curriculum-card__head"><div><span>NEW RECORD</span><h2>Add curriculum record</h2></div><p>Choose a record type, then complete the required academic details.</p></div>
        <div className="curriculum-form-grid">
          <label className="curriculum-field curriculum-field--kind"><span>Record type</span><select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setForm({}); }}><option value="version">Programme version</option><option value="requirement">Degree requirement</option><option value="prerequisite">Prerequisite</option><option value="corequisite">Corequisite</option><option value="offering">Course offering</option></select></label>
          {kind === "version" ? <><label className="curriculum-field"><span>Programme</span><select value={form.programId || ""} onChange={set("programId")}><option value="">Select programme</option>{catalog.programs.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label>{input("label", "Version label")}{input("effectiveOn", "Effective date", "date")}{input("totalCredits", "Total credits", "number")}</> : null}
          {kind === "requirement" ? <><label className="curriculum-field"><span>Programme version</span><select value={form.programVersionId || ""} onChange={set("programVersionId")}><option value="">Select version</option>{catalog.versions.map((v) => <option key={v.id} value={v.id}>{v.program.code} — {v.label}</option>)}</select></label>{course("courseId", "Linked course")}{input("courseCode", "Course/elective code")}{input("title", "Requirement title")}{input("credits", "Credits", "number")}<label className="curriculum-field"><span>Requirement type</span><select value={form.requirementKind || "required"} onChange={set("requirementKind")}><option value="required">Required</option><option value="elective">Elective</option><option value="capstone">Capstone</option></select></label>{input("sortOrder", "Display order", "number")}</> : null}
          {kind === "prerequisite" || kind === "corequisite" ? <>{course("courseId", "Course")}{course("requiredCourseId", kind === "prerequisite" ? "Required prerequisite" : "Required corequisite")}</> : null}
          {kind === "offering" ? <>{course("courseId", "Course")}{input("termCode", "Term code")}{input("termName", "Term name")}{input("seatsOpen", "Open seats", "number")}{input("seatsTotal", "Total seats", "number")}</> : null}
        </div><div className="curriculum-actions"><button className="curriculum-primary" disabled={busy} onClick={() => void create()}>{busy ? "Saving…" : "Add record"}</button></div>
      </section>
      <div className="curriculum-table-wrap"><table className="mh-hcc-table curriculum-table"><thead><tr><th>Type</th><th>Record</th><th>Details</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.kind}:${row.id}`}><td><span className="curriculum-kind">{row.kind}</span></td><td>{row.label}</td><td>{row.detail}</td><td><button className="curriculum-delete" onClick={() => void remove(row.kind, row.id)}>Delete</button></td></tr>)}{!rows.length ? <tr><td className="curriculum-empty" colSpan={4}>No curriculum records.</td></tr> : null}</tbody></table></div>
    </div>
  </AdminSisShell>;
}

"use client";

import "./selfpaced-admin.css";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaField, SaModal, SuperFrame } from "@/components/superadmin/shared";
import { ONLINE_ADMIN_GROUPS, ONLINE_ADMIN_SCREENS, onlineAdminScreen, type OnlineAdminScreen } from "@/lib/selfpacedAdminCatalog";
import { SELFPACED_PROGRAMS, formatCad } from "@/lib/selfpacedPrograms";
import { api, loadSession } from "@/lib/api";
import { adminRowsCsv, applicationsCsv, filterAdminRows, filterApplications, type SelfpacedApplication } from "@/lib/selfpacedAdminTools";

const BASE = "/admin/self-paced";
type CreationMode = "manual" | "ai";
type AdminSelfpacedProgram = Omit<(typeof SELFPACED_PROGRAMS)[number], "curriculum"> & {
  status?: "draft" | "review" | "published";
  assignedSectionId?: string;
  curriculum?: Array<{ id: string; title: string; description?: string; activities?: Array<{ id: string; type: string; title: string; minutes?: number }> }>;
};

function Status({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "info" }) {
  return <span className={`spa-status spa-status--${tone}`}>{children}</span>;
}

function SectionNav({ active }: { active: string }) {
  return (
    <nav className="spa-tabs" aria-label="Self-paced admin sections">
      {ONLINE_ADMIN_GROUPS.map((group) => (
        <div className="spa-tabs__group" key={group}>
          <span>{group}</span>
          <div>
            {ONLINE_ADMIN_SCREENS.filter((screen) => screen.group === group).map((screen) => (
              <Link className={active === screen.slug ? "is-active" : ""} href={`${BASE}/${screen.slug}`} key={screen.slug}>
                {screen.label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Shell({ screen, actions, children }: { screen: OnlineAdminScreen; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <SuperFrame title={screen.label} breadcrumbs={["Home", "Course Management", "Self-Paced Learning", screen.label]} activeHref={`${BASE}/${screen.slug}`} actions={actions}>
      <div className="mh-sa spa">
        <SectionNav active={screen.slug} />
        {children}
      </div>
    </SuperFrame>
  );
}

function Overview({ screen }: { screen: OnlineAdminScreen }) {
  return (
    <Shell
      screen={screen}
      actions={
        <>
          <Link href={`${BASE}/catalogue?create=manual`} className="mh-sa__btn">Create manually</Link>
          <Link href={`${BASE}/content?create=ai`} className="mh-sa__btn mh-sa__btn--primary">✦ Create with AI</Link>
        </>
      }
    >
      <section className="spa-hero">
        <div>
          <span className="spa-eyebrow">HCC Online · Admin workspace</span>
          <h2>Manage every self-paced learning operation from CampusOne.</h2>
          <p>CampusOne remains the system of record. Content, activity and attempts stay linked to the correct student, academic item and enrolment.</p>
        </div>
        <div className="spa-hero__health"><span>●</span><strong>Integration healthy</strong><small>Last refresh 5 minutes ago</small></div>
      </section>

      <div className="spa-kpis">
        {[["Online-enabled students", "1,284", "+38 this month"], ["Active enrolments", "1,517", "93% access active"], ["Published programs", "6", "2 drafts in review"], ["Pending grading", "27", "8 due today"], ["Integrity cases", "4", "Human review required"], ["Sync failures", "2", "Safe to retry"]].map(([label, value, hint], i) => (
          <article key={label}><span>{label}</span><strong>{value}</strong><small className={i > 3 ? "is-warn" : ""}>{hint}</small></article>
        ))}
      </div>

      <div className="spa-overview-grid">
        <SaCard title="Recent online activity">
          <DataTable screen={screen} compact />
        </SaCard>
        <SaCard title="Queues needing attention">
          <div className="spa-queues">
            {[["Pending applications", "12", "applications"], ["Content awaiting review", "2", "content"], ["Assignment grading", "27", "grading"], ["Integrity review", "4", "integrity"], ["Failed sync records", "2", "integration"]].map(([label, count, href]) => (
              <Link key={label} href={`${BASE}/${href}`}><span>{label}</span><strong>{count}</strong><b>Open →</b></Link>
            ))}
          </div>
        </SaCard>
      </div>

      <SaCard title="Admin coverage">
        <div className="spa-module-grid">
          {ONLINE_ADMIN_SCREENS.filter((s) => s.slug !== "overview").map((s) => (
            <Link key={s.slug} href={`${BASE}/${s.slug}`}><span>{s.group}</span><strong>{s.label}</strong><small>{s.fields.length} data points · {s.actions.length} actions</small></Link>
          ))}
        </div>
      </SaCard>
    </Shell>
  );
}

function DataTable({ screen, compact }: { screen: OnlineAdminScreen; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterColumn, setFilterColumn] = useState(-1);
  const [filterValue, setFilterValue] = useState("");
  const [opened, setOpened] = useState<string[] | null>(null);
  const rows = useMemo(() => filterAdminRows(screen.rows, { query, column: filterColumn, value: filterValue }), [screen.rows, query, filterColumn, filterValue]);
  const filterOptions = useMemo(
    () => filterColumn < 0 ? [] : [...new Set(screen.rows.map((row) => row[filterColumn]).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [screen.rows, filterColumn],
  );
  const exportRows = (items: string[][], scope: "all" | "filtered") => {
    const url = URL.createObjectURL(new Blob([adminRowsCsv(screen.columns, items)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `self-paced-${screen.slug}-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const clearFilters = () => { setQuery(""); setFilterColumn(-1); setFilterValue(""); };
  return (
    <>
      {!compact ? <><div className="spa-toolbar"><label><span className="sr-only">Search</span><input className="mh-sa__input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${screen.label.toLowerCase()}…`} /></label><button className="mh-sa__btn" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((open) => !open)}>Filters{filterValue ? " (1)" : ""}</button><button className="mh-sa__btn" type="button" disabled={!rows.length} onClick={() => exportRows(rows, "filtered")}>Export filtered CSV</button><button className="mh-sa__btn" type="button" disabled={!screen.rows.length} onClick={() => exportRows(screen.rows, "all")}>Export all CSV</button></div>{filtersOpen ? <div className="spa-data-filters"><label><span>Filter column</span><select className="mh-sa__input" value={filterColumn} onChange={(event) => { setFilterColumn(Number(event.target.value)); setFilterValue(""); }}><option value={-1}>Choose a column</option>{screen.columns.map((column, index) => <option key={column} value={index}>{column}</option>)}</select></label><label><span>Exact value</span><select className="mh-sa__input" value={filterValue} disabled={filterColumn < 0} onChange={(event) => setFilterValue(event.target.value)}><option value="">All values</option>{filterOptions.map((value) => <option key={value}>{value}</option>)}</select></label><button className="mh-sa__btn" type="button" onClick={clearFilters}>Clear filters</button><Status tone="info">{rows.length} of {screen.rows.length} records</Status></div> : null}</> : null}
      {!rows.length ? <p>No records match the selected filters.</p> : <div className="mh-sa__table-wrap"><table className="mh-sa__table spa-table"><thead><tr>{screen.columns.map((col) => <th key={col}>{col}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map((row, r) => <tr key={`${screen.slug}-${r}`}>{row.map((cell, c) => <td key={c}>{c === row.length - 2 ? <Status tone={/active|published|healthy|clear|complete|satisfied|matched|synced|present/i.test(cell) ? "good" : /pending|review|flag|blocked|conflict|below/i.test(cell) ? "warn" : "info"}>{cell}</Status> : cell}</td>)}<td><button type="button" className="mh-sa__link" onClick={() => setOpened(row)}>Open</button></td></tr>)}</tbody></table></div>}
      {opened ? <SaModal title={`${screen.label} · ${opened[0] ?? "Record"}`} onClose={() => setOpened(null)} wide footer={<button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setOpened(null)}>Close</button>}><div className="mh-sa__grid">{screen.columns.map((col, c) => <SaField key={col} label={col}><div className="mh-sa__input">{opened[c] || "—"}</div></SaField>)}</div></SaModal> : null}
    </>
  );
}

function Catalogue({ screen }: { screen: OnlineAdminScreen }) {
  const router = useRouter();
  const [programs, setPrograms] = useState<Array<(typeof SELFPACED_PROGRAMS)[number] & { status?: "draft" | "review" | "published" }>>([]);
  const [creator, setCreator] = useState<CreationMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = loadSession()?.accessToken;
  const refresh = () => {
    if (!token) return;
    api<{ items: typeof programs }>("/selfpaced/admin/programs", {}, token)
      .then((out) => setPrograms(out.items))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load the live catalogue."));
  };
  useEffect(refresh, [token]);
  const changeStatus = async (slug: string, status: "draft" | "review" | "published") => {
    if (!token) return;
    setError(null);
    try {
      await api(`/selfpaced/admin/programs/${encodeURIComponent(slug)}/status`, { method: "POST", body: JSON.stringify({ status }) }, token);
      refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update publication status.");
    }
  };
  const counts = programs.reduce((out, item) => ({ ...out, [item.status || "published"]: out[item.status || "published"] + 1 }), { draft: 0, review: 0, published: 0 });
  return (
    <Shell screen={screen} actions={<><button className="mh-sa__btn" onClick={() => setCreator("manual")}>Create program</button><button className="mh-sa__btn mh-sa__btn--primary" onClick={() => setCreator("ai")}>✦ AI-assisted setup</button></>}>
      <div className="spa-catalogue-summary"><div><strong>{programs.length}</strong><span>Catalogue items</span></div><div><strong>{counts.published}</strong><span>Published</span></div><div><strong>{counts.review}</strong><span>In review</span></div><div><strong>{counts.draft}</strong><span>Draft</span></div><p>Only published programs appear on the public self-paced landing page.</p></div>
      {error ? <p className="sp-error" role="alert">{error}</p> : null}
      <SaCard title="Online catalogue">
        <div className="spa-cards">
          {programs.map((program) => (
            <article className="spa-course-card" key={program.id}>
              <img src={program.image} alt="" />
              <div><span className="spa-course-card__meta">{program.subject} · {program.level}</span><h3>{program.title}</h3><p>{program.chapters} chapters · {program.hours} hours</p><div className="spa-course-card__prices"><span>Domestic <strong>{program.priceCad === 0 ? "FREE TEST" : formatCad(program.priceCad)}</strong></span><span>International <strong>{program.internationalCad !== undefined ? formatCad(program.internationalCad) : "Uses approved rate"}</strong></span></div><div className="spa-course-card__foot"><Status tone={(program.status || "published") === "published" ? "good" : program.status === "review" ? "warn" : "neutral"}>{program.status || "published"}</Status><div className="spa-actions-list"><button className="mh-sa__link" onClick={() => router.push(`${BASE}/content?course=${program.slug}`)}>Content →</button>{(program.status || "published") === "published" ? <button className="mh-sa__link" onClick={() => void changeStatus(program.slug, "draft")}>Unpublish</button> : <button className="mh-sa__link" onClick={() => void changeStatus(program.slug, "published")}>Publish</button>}</div></div></div>
            </article>
          ))}
          {!programs.length && !error ? <p>Loading the live catalogue…</p> : null}
        </div>
      </SaCard>
      <Coverage screen={screen} />
      {creator ? <CourseCreator mode={creator} onClose={() => setCreator(null)} onCreated={() => { setCreator(null); refresh(); }} /> : null}
    </Shell>
  );
}

function CourseCreator({ mode, onClose, onCreated }: { mode: CreationMode; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", subject: "Professional Studies", level: "Beginner", description: "", hours: "120", priceCad: "0", internationalCad: "", image: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=85", chapterTitles: "Foundations\nApplied skills\nWorkplace practice\nFinal assessment" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    const token = loadSession()?.accessToken;
    if (!token) return setError("Sign in again to create a program.");
    setBusy(true); setError(null);
    try {
      await api("/selfpaced/admin/programs", { method: "POST", body: JSON.stringify({
        title: form.title, subject: form.subject, level: form.level, description: form.description,
        hours: Number(form.hours), priceCad: Number(form.priceCad), internationalCad: form.internationalCad ? Number(form.internationalCad) : undefined,
        image: form.image, chapterTitles: form.chapterTitles.split("\n").map((value) => value.trim()).filter(Boolean),
      }) }, token);
      onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create the program."); setBusy(false); }
  };
  return (
    <SaModal title={mode === "ai" ? "AI-assisted self-paced program setup" : "Create a self-paced program"} onClose={onClose} wide footer={<><button className="mh-sa__btn" onClick={onClose}>Cancel</button><button disabled={busy} className="mh-sa__btn mh-sa__btn--primary" onClick={() => void save()}>{busy ? "Creating…" : "Create reviewable draft"}</button></>}>
      <div className="mh-sa__grid">
        <SaField label="Online title"><input className="mh-sa__input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Course or program title" /></SaField>
        <SaField label="Subject"><input className="mh-sa__input" value={form.subject} onChange={(e) => set("subject", e.target.value)} /></SaField>
        <SaField label="Level"><select className="mh-sa__input" value={form.level} onChange={(e) => set("level", e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></SaField>
        <SaField label="Required hours"><input className="mh-sa__input" type="number" value={form.hours} onChange={(e) => set("hours", e.target.value)} /></SaField>
        <SaField label="Domestic tuition (CAD)" hint="Use 0 for a free course"><input className="mh-sa__input" type="number" min="0" value={form.priceCad} onChange={(e) => set("priceCad", e.target.value)} /></SaField>
        <SaField label="International tuition (CAD)" hint="Optional"><input className="mh-sa__input" type="number" min="0" value={form.internationalCad} onChange={(e) => set("internationalCad", e.target.value)} /></SaField>
        <SaField label="Image URL" wide><input className="mh-sa__input" value={form.image} onChange={(e) => set("image", e.target.value)} /></SaField>
        <SaField label="Description" wide><textarea className="mh-sa__input" rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Learner outcomes, audience and career relevance" /></SaField>
        <SaField label={mode === "ai" ? "AI source outline · one chapter per line" : "Curriculum chapters · one per line"} wide><textarea className="mh-sa__input" rows={7} value={form.chapterTitles} onChange={(e) => set("chapterTitles", e.target.value)} /></SaField>
      </div>
      {mode === "ai" ? <div className="spa-ai-rule">✦ This creates the program shell. Open Content after saving to use the real assigned-section AI builder, review generated lessons/video storyboards, approve, and publish.</div> : null}
      {error ? <p className="sp-error" role="alert">{error}</p> : null}
    </SaModal>
  );
}

function ContentWorkspace({ screen }: { screen: OnlineAdminScreen }) {
  const searchParams = useSearchParams();
  const selectedSlug = searchParams?.get("course") || "";
  const [programs, setPrograms] = useState<AdminSelfpacedProgram[]>([]);
  const [sections, setSections] = useState<Array<{ id: string; code: string; offering: string; title: string; delivery: string; status: string }>>([]);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [programsError, setProgramsError] = useState<string | null>(null);
  useEffect(() => {
    const token = loadSession()?.accessToken;
    if (!token) return;
    api<{ items: typeof programs }>("/selfpaced/admin/programs", {}, token)
      .then((out) => setPrograms(out.items))
      .catch((err) => setProgramsError(err instanceof Error ? err.message : "Could not load catalogue content."));
    api<{ rows: Array<{ id: string; code: string; offering: string; title: string; delivery: string; status: string }> }>(
      "/admin/heritage/my-courses/schedule",
      {},
      token,
    )
      .then((out) => setSections(out.rows))
      .catch((err) => setSectionsError(err instanceof Error ? err.message : "Could not load course sections."));
  }, []);
  const selectedProgram = selectedSlug ? programs.find((program) => program.slug === selectedSlug) : undefined;
  const assignedSection = selectedProgram?.assignedSectionId ? sections.find((section) => section.id === selectedProgram.assignedSectionId) : undefined;
  return (
    <Shell screen={screen} actions={<Link className="mh-sa__btn" href="/admin/my-courses">All course sections</Link>}>
      {selectedSlug ? (
        <SaCard title="Selected catalogue content">
          {programsError ? <p className="sp-error">{programsError}</p> : !programs.length ? <p>Loading selected program…</p> : !selectedProgram ? <p className="sp-error">The selected catalogue program was not found.</p> : (
            <div className="spa-content-detail">
              <div className="spa-content-detail__head">
                <div>
                  <span className="spa-eyebrow">{selectedProgram.subject} · {selectedProgram.level}</span>
                  <h2>{selectedProgram.title}</h2>
                  <p>{selectedProgram.description || selectedProgram.blurb}</p>
                </div>
                <div className="spa-content-detail__facts">
                  <Status tone={(selectedProgram.status || "published") === "published" ? "good" : "warn"}>{selectedProgram.status || "published"}</Status>
                  <strong>{selectedProgram.chapters} chapters</strong>
                  <span>{selectedProgram.hours} learning hours</span>
                </div>
              </div>
              {selectedProgram.curriculum?.length ? (
                <div className="spa-curriculum">
                  {selectedProgram.curriculum.map((chapter, index) => (
                    <article key={chapter.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{chapter.title}</strong>{chapter.description ? <p>{chapter.description}</p> : null}</div>
                      <small>{chapter.activities?.length || 0} activities · {chapter.activities?.reduce((sum, item) => sum + (item.minutes || 0), 0) || 0} min</small>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="spa-empty-content"><strong>Program overview is available.</strong><span>Chapter-level authoring has not been saved for this migrated catalogue item yet.</span></div>
              )}
              <div className="spa-actions-list">
                {assignedSection ? <><Link className="mh-sa__btn mh-sa__btn--sm" href={`/admin/course-management/active/view?id=${encodeURIComponent(assignedSection.id)}&tab=Course`}>Open manual editor</Link><Link className="mh-sa__btn mh-sa__btn--primary mh-sa__btn--sm" href={`/admin/course-management/active/view?id=${encodeURIComponent(assignedSection.id)}&tab=Course&aiCourse=1&delivery=self_paced`}>✦ Open AI builder</Link></> : <Link className="mh-sa__btn mh-sa__btn--primary mh-sa__btn--sm" href="/admin/my-courses">Assign / choose a course section</Link>}
                <Link className="mh-sa__btn mh-sa__btn--sm" href={`${BASE}/catalogue`}>Back to catalogue</Link>
              </div>
            </div>
          )}
        </SaCard>
      ) : null}
      <section className="spa-intro"><div><span className="spa-eyebrow">LIVE AUTHORING</span><h2>Choose the exact section before creating or publishing content.</h2><p>Admin, registrar and assigned instructors use one CampusOne course workspace. Manual and AI content publish to the same student section.</p></div><Status tone="good">Production workflow</Status></section>
      <SaCard title="Live course authoring workspaces">
        <p>Select the exact CampusOne section. The manual editor supports topics, pages, resources, quizzes and assignments. The AI builder creates a CAP-101-depth blueprint, narrated self-paced lesson videos, quizzes, assignments and hidden instructor guides; review checks must pass before Publish is enabled.</p>
        {sectionsError ? <p className="sp-error">{sectionsError}</p> : null}
        <div className="spa-cards">
          {sections.map((section) => (
            <article className="spa-course-card" key={section.id}><div><span className="spa-course-card__meta">{section.delivery} · {section.status}</span><h3>{section.code} ({section.offering})</h3><p>{section.title}</p><div className="spa-actions-list"><Link className="mh-sa__btn mh-sa__btn--sm" href={`/admin/course-management/active/view?id=${encodeURIComponent(section.id)}&tab=Course`}>Manual editor</Link><Link className="mh-sa__btn mh-sa__btn--primary mh-sa__btn--sm" href={`/admin/course-management/active/view?id=${encodeURIComponent(section.id)}&tab=Course&aiCourse=1&delivery=self_paced`}>✦ AI builder</Link></div></div></article>
          ))}
          {!sections.length && !sectionsError ? <span>Loading assigned course sections…</span> : null}
        </div>
      </SaCard>
      <SaCard title="Publish flow"><ol><li>Create or edit the course section manually, or open the AI builder in self-paced mode.</li><li>Review the blueprint, learning outcomes, module hours and assessment weights.</li><li>Generate all lesson content; each self-paced lesson must contain a valid narrated video storyboard.</li><li>Resolve validation failures, preview learner content and approve the version.</li><li>Publish once. Student pages, quizzes and gradebook assignments update idempotently; instructor answer guides stay hidden.</li></ol></SaCard>
      <Coverage screen={screen} />
    </Shell>
  );
}

function ApplicationsWorkspace({ screen }: { screen: OnlineAdminScreen }) {
  const [items, setItems] = useState<SelfpacedApplication[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [program, setProgram] = useState("");
  const [intake, setIntake] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = loadSession()?.accessToken;
    if (!token) {
      setError("Sign in as an admin or registrar to load applications.");
      setLoading(false);
      return;
    }
    api<{ items: SelfpacedApplication[] }>("/admin/heritage/ops/e/applications", {}, token)
      .then((out) => setItems(out.items))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load applications."))
      .finally(() => setLoading(false));
  }, []);
  const shown = useMemo(() => filterApplications(items, { query, status, program, intake }), [items, query, status, program, intake]);
  const statuses = useMemo(() => [...new Set(items.map((item) => item.status).filter(Boolean))].sort(), [items]);
  const programs = useMemo(() => [...new Set(items.map((item) => item.programName).filter(Boolean))].sort(), [items]);
  const intakes = useMemo(() => [...new Set(items.map((item) => item.intakeTerm).filter(Boolean))].sort(), [items]);
  const exportRows = () => {
    const url = URL.createObjectURL(new Blob([applicationsCsv(shown)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `self-paced-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => { setQuery(""); setStatus(""); setProgram(""); setIntake(""); };
  return (
    <Shell screen={screen} actions={<><Link className="mh-sa__btn" href="/admin/ops/admissions/applications">Full admissions workspace</Link><button className="mh-sa__btn mh-sa__btn--primary" type="button" disabled={!shown.length} onClick={exportRows}>Export CSV</button></>}>
      <section className="spa-intro"><div><span className="spa-eyebrow">LIVE ADMISSIONS DATA</span><h2>Search, filter and export the current application review queue.</h2></div><Status tone="info">{shown.length} of {items.length}</Status></section>
      <SaCard title="Applications & pending review">
        <div className="spa-application-filters">
          <label><span>Search</span><input className="mh-sa__input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Applicant, e-mail, program or application ID" /></label>
          <label><span>Stage</span><select className="mh-sa__input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All stages</option>{statuses.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}</select></label>
          <label><span>Program</span><select className="mh-sa__input" value={program} onChange={(event) => setProgram(event.target.value)}><option value="">All programs</option>{programs.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Intake</span><select className="mh-sa__input" value={intake} onChange={(event) => setIntake(event.target.value)}><option value="">All intakes</option>{intakes.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button className="mh-sa__btn" type="button" onClick={reset}>Clear filters</button>
        </div>
        {loading ? <p>Loading live applications…</p> : error ? <p className="sp-error">{error}</p> : !shown.length ? <p>No applications match the selected filters.</p> : (
          <div className="mh-sa__table-wrap"><table className="mh-sa__table spa-table"><thead><tr><th>Application</th><th>Applicant</th><th>Program / intake</th><th>Documents</th><th>Progress</th><th>Review</th><th>Action</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td>{item.id.slice(0, 8).toUpperCase()}</td><td>{item._name || [item.givenName, item.familyName].filter(Boolean).join(" ") || "—"}<br /><small>{item.email || "—"}</small></td><td>{item.programName || "—"}<br /><small>{item.intakeTerm || "—"}</small></td><td>{item._docs || "—"}</td><td>{item.progressPct ?? 0}%</td><td><Status tone={/approved|accepted|enrolled|cloa/i.test(item.status) ? "good" : /declined|blocked|refused/i.test(item.status) ? "warn" : "info"}>{item.status.replace(/_/g, " ")}</Status></td><td><Link className="mh-sa__link" href={`/admin/ops/admissions/applications?id=${encodeURIComponent(item.id)}`}>Open</Link></td></tr>)}</tbody></table></div>
        )}
      </SaCard>
    </Shell>
  );
}

function AiDraftModal({ onClose }: { onClose: () => void }) {
  const [stage, setStage] = useState(1);
  return <SaModal title="AI course draft" onClose={onClose} wide footer={<><button className="mh-sa__btn" onClick={onClose}>Cancel</button>{stage > 1 ? <button className="mh-sa__btn" onClick={() => setStage(stage - 1)}>Back</button> : null}<button className="mh-sa__btn mh-sa__btn--primary" onClick={() => stage < 3 ? setStage(stage + 1) : onClose()}>{stage === 1 ? "Design blueprint" : stage === 2 ? "Generate content" : "Save AI draft"}</button></>}><ol className="spa-stepper">{["Course brief", "Review blueprint", "Generated draft"].map((x, i) => <li key={x} className={stage === i + 1 ? "is-active" : stage > i + 1 ? "is-done" : ""}>{i + 1}<span>{x}</span></li>)}</ol>{stage === 1 ? <div className="mh-sa__grid"><SaField label="Approved outline" wide><textarea className="mh-sa__input" rows={7} placeholder="Paste authoritative outcomes, topic requirements and assessment rules…" /></SaField><SaField label="Total hours"><input className="mh-sa__input" type="number" defaultValue="120" /></SaField><SaField label="Chapters"><input className="mh-sa__input" type="number" defaultValue="8" /></SaField><SaField label="Lessons per chapter"><input className="mh-sa__input" type="number" defaultValue="5" /></SaField><SaField label="Questions per quiz"><input className="mh-sa__input" type="number" defaultValue="10" /></SaField><SaField label="Audience" wide><input className="mh-sa__input" defaultValue="Adult learners preparing for Canadian trade certification" /></SaField></div> : null}{stage === 2 ? <div className="spa-blueprint"><h3>Proposed blueprint</h3>{["Foundations & diagnostic", "Codes, safety and terminology", "Applied calculations", "Workplace scenarios", "Timed exam strategy", "Final readiness assessment"].map((x, i) => <article key={x}><span>M{i + 1}</span><input className="mh-sa__input" defaultValue={x} /><small>{i === 5 ? "Final assessment · 40 questions" : "5 lessons · reading, example, practice and quiz"}</small></article>)}<p>Assessment total: <strong>100%</strong> · chapter quizzes 40% · practice tasks 20% · final 40%</p></div> : null}{stage === 3 ? <div className="spa-generation"><div className="spa-generation__ring">100%</div><div><h3>Draft generated and validated</h3><p>6 chapters · 30 lessons · 5 quizzes · 1 final assessment · instructor-only answer guidance</p><ul><li>Learning outcomes are mapped to every chapter</li><li>Assessment weights total 100%</li><li>No content has been published to learners</li></ul></div></div> : null}<div className="spa-ai-rule">AI content stays marked as generated until a named faculty/SME reviewer approves the version.</div></SaModal>;
}

function Coverage({ screen }: { screen: OnlineAdminScreen }) {
  return <div className="spa-coverage"><SaCard title="Data captured"><div className="spa-chips">{screen.fields.map((field) => <span key={field}>{field}</span>)}</div></SaCard><SaCard title="Available admin actions"><div className="spa-actions-list">{screen.actions.map((action) => <button className="mh-sa__btn mh-sa__btn--sm" key={action}>{action}</button>)}</div></SaCard><SaCard title="Controlled workflow"><p>{screen.workflow}</p><div className="spa-safeguard"><strong>Control</strong>{screen.safeguard}</div></SaCard></div>;
}

function GenericWorkspace({ screen }: { screen: OnlineAdminScreen }) {
  return <Shell screen={screen}><section className="spa-intro"><div><span className="spa-eyebrow">{screen.group}</span><h2>{screen.description}</h2></div><Status tone="info">CampusOne linked</Status></section><SaCard title={`${screen.label} records`}><DataTable screen={screen} /></SaCard><Coverage screen={screen} /></Shell>;
}

type EnglishTestRegistration = {
  registrationId: string;
  reference: string;
  status: string;
  submittedAt: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  mobilePhone: string;
  studentId?: string;
  city: string;
  province: string;
  institutionName: string;
  resultInstitutions?: string[];
  [key: string]: unknown;
};

function EnglishTestWorkspace({ screen }: { screen: OnlineAdminScreen }) {
  const [items, setItems] = useState<EnglishTestRegistration[]>([]);
  const [selected, setSelected] = useState<EnglishTestRegistration | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = loadSession()?.accessToken;
    if (!token) {
      setError("Sign in as an admin or registrar to load registrations.");
      setLoading(false);
      return;
    }
    api<{ items: EnglishTestRegistration[] }>("/selfpaced/admin/english-test-registrations", {}, token)
      .then((out) => setItems(out.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load registrations."))
      .finally(() => setLoading(false));
  }, []);
  return (
    <Shell screen={screen} actions={<button className="mh-sa__btn">Export</button>}>
      <section className="spa-intro"><div><span className="spa-eyebrow">Academic delivery</span><h2>Live English Test registration review queue</h2></div><Status tone="info">CampusOne linked</Status></section>
      <SaCard title="Received registrations">
        {loading ? <p>Loading registrations…</p> : error ? <p className="sp-error">{error}</p> : items.length === 0 ? <p>No registrations received yet.</p> : (
          <div className="mh-sa__table-wrap"><table className="mh-sa__table spa-table"><thead><tr><th>Reference</th><th>Applicant</th><th>Contact</th><th>Student ID</th><th>Received</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.registrationId}><td>{item.reference}</td><td>{[item.firstName, item.middleName, item.lastName].filter(Boolean).join(" ")}<br /><small>{item.city}, {item.province}</small></td><td>{item.email}<br /><small>{item.mobilePhone}</small></td><td>{item.studentId || "Not supplied"}</td><td>{new Date(item.submittedAt).toLocaleString()}</td><td><Status tone="warn">{item.status}</Status></td><td><button className="mh-sa__link" onClick={() => setSelected(item)}>View profile</button></td></tr>)}</tbody></table></div>
        )}
      </SaCard>
      <Coverage screen={screen} />
      {selected ? <SaModal title={`${selected.reference} · Test profile`} onClose={() => setSelected(null)} wide footer={<button className="mh-sa__btn mh-sa__btn--primary" onClick={() => setSelected(null)}>Close</button>}><div className="mh-sa__grid">{Object.entries(selected).filter(([key]) => !["registrationId", "rowVersion"].includes(key)).map(([key, value]) => <SaField key={key} label={key.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase())}><div className="mh-sa__input">{Array.isArray(value) ? value.join(", ") || "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value || "—")}</div></SaField>)}</div></SaModal> : null}
    </Shell>
  );
}

export function SelfpacedAdmin() {
  const params = useParams<{ slug?: string[] }>();
  const slug = params?.slug?.[0] || "overview";
  const screen = useMemo(() => onlineAdminScreen(slug) || onlineAdminScreen("overview")!, [slug]);
  if (screen.slug === "overview") return <Overview screen={screen} />;
  if (screen.slug === "catalogue") return <Catalogue screen={screen} />;
  if (screen.slug === "content") return <ContentWorkspace screen={screen} />;
  if (screen.slug === "applications") return <ApplicationsWorkspace screen={screen} />;
  if (screen.slug === "english-test") return <EnglishTestWorkspace screen={screen} />;
  return <GenericWorkspace screen={screen} />;
}

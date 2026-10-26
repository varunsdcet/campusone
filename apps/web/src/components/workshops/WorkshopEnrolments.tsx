"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaField, SaModal, SuperFrame } from "@/components/superadmin/shared";
import { refreshNavCounts } from "@/lib/navCounts";
import { workshopEnrolmentsHref } from "@/lib/heritageNav";
import {
  Notices,
  Req,
  StatusPill,
  StudentCell,
  WorkshopCell,
  dateRange,
  errMsg,
  json,
  money,
  stamp,
  useMeta,
  ws,
  type StudentRef,
  type WorkshopSummary,
} from "./common";

/* ------------------------------------------------------------------ */
/* Screens 1–3 — WORKSHOP ENROLMENTS (Pending / Approved / Declined)    */
/* ------------------------------------------------------------------ */

type Enrolment = {
  id: string;
  student: StudentRef;
  workshop: { id: string; title: string; code: string };
  role: string;
  status: "Pending" | "Approved" | "Declined" | "Dropped";
  note: string;
  enrolledAt: string;
};
type EnrolmentList = { total: number; page: number; pages: number; perPage: number; items: Enrolment[] };

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const PER_PAGE = [10, 25, 50, 100];

function readFilters(sp: URLSearchParams) {
  return {
    student: sp.get("student") ?? "",
    workshop: sp.get("workshop") ?? "",
    status: sp.get("f.status") ?? "Pending",
    letter: sp.get("letter") ?? "",
  };
}
type Filters = ReturnType<typeof readFilters>;

function listUrl(f: Filters, page = 1, perPage = 50) {
  const sp = new URLSearchParams();
  sp.set("f.status", f.status || "all");
  if (f.student.trim()) sp.set("student", f.student.trim());
  if (f.workshop) sp.set("workshop", f.workshop);
  if (f.letter) sp.set("letter", f.letter);
  if (page > 1) sp.set("page", String(page));
  if (perPage !== 50) sp.set("perPage", String(perPage));
  return `/admin/workshops/enrolments?${sp.toString()}`;
}

type PendingAction = { row: Enrolment; status: "declined" | "dropped" } | { row: Enrolment; status: "delete" };

export function WorkshopEnrolmentsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const key = sp?.toString() ?? "";
  const params = new URLSearchParams(key);
  const applied = readFilters(params);
  const page = Number(params.get("page")) || 1;
  const perPage = Number(params.get("perPage")) || 50;
  const meta = useMeta();
  const [filters, setFilters] = useState<Filters>(applied);
  const [data, setData] = useState<EnrolmentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("notice"));
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<PendingAction | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    const f = readFilters(new URLSearchParams(key));
    const q = new URLSearchParams({ status: f.status || "all", page: String(page), perPage: String(perPage) });
    if (f.student) q.set("student", f.student);
    if (f.workshop) q.set("workshop", f.workshop);
    if (f.letter) q.set("letter", f.letter);
    setBusy(true);
    ws<EnrolmentList>(`/enrolments?${q.toString()}`)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load workshop enrolments")))
      .finally(() => setBusy(false));
  }, [key, page, perPage]);

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(key)));
    load();
  }, [key, load]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const url = listUrl({ ...filters, letter: applied.letter }, 1, perPage);
    if (url === listUrl(applied, page, perPage)) load();
    else router.push(url);
  }

  async function change(row: Enrolment, status: "approved" | "declined" | "dropped" | "pending", withNote?: string) {
    setError(null);
    try {
      const r = await ws<{ message: string }>(`/enrolments/${row.id}/status`, json("POST", { status, ...(withNote ? { note: withNote } : {}) }));
      setNotice(r.message);
      refreshNavCounts();
      load();
    } catch (e) {
      setError(errMsg(e, "Could not update the enrolment"));
    }
  }

  async function confirmAction() {
    if (!action) return;
    const a = action;
    setAction(null);
    if (a.status === "delete") {
      try {
        const r = await ws<{ message: string }>(`/enrolments/${a.row.id}`, { method: "DELETE" });
        setNotice(r.message);
        refreshNavCounts();
        load();
      } catch (e) {
        setError(errMsg(e, "Could not delete the enrolment"));
      }
      return;
    }
    await change(a.row, a.status, note.trim());
  }

  const statusSearch = new URLSearchParams({ "f.status": applied.status || "all" }).toString();

  return (
    <SuperFrame title="WORKSHOP ENROLMENTS" breadcrumbs={["Home", "Workshop Enrolments"]} breadcrumbHrefs={["/admin"]} activeHref="/admin/workshops/enrolments" activeSearch={statusSearch}>
      <div className="ur">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />

        <form className="mh-sa__card" onSubmit={onSearch}>
          <div className="wk-filters">
            <SaField label="Student Filter">
              <input className="mh-sa__input" placeholder="Student #, login or last name" value={filters.student} onChange={(e) => set("student", e.target.value)} />
            </SaField>
            <SaField label="Workshop Filter">
              <select className="mh-sa__input" value={filters.workshop} onChange={(e) => set("workshop", e.target.value)}>
                <option value="">All Workshops</option>
                {(meta?.workshops ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </SaField>
            <SaField label="Status Filter">
              <select className="mh-sa__input" value={filters.status} onChange={(e) => set("status", e.target.value)}>
                <option value="all">All Statuses</option>
                {(meta?.options.enrolmentStatuses ?? ["Pending", "Approved", "Declined", "Dropped"]).map((st) => (
                  <option key={st}>{st}</option>
                ))}
              </select>
            </SaField>
            <div className="mh-sa__field mh-sa__field--end">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                {busy ? "Searching…" : "Search Workshops"}
              </button>
            </div>
          </div>
          <nav className="wk-alpha" aria-label="Filter by last name">
            <Link className={!applied.letter ? "is-active" : ""} href={listUrl({ ...applied, letter: "" }, 1, perPage)}>
              ALL
            </Link>
            {LETTERS.map((l) => (
              <Link key={l} className={applied.letter === l ? "is-active" : ""} href={listUrl({ ...applied, letter: l }, 1, perPage)}>
                {l}
              </Link>
            ))}
          </nav>
        </form>

        {!data ? (
          error ? null : <p className="mh-sa__muted">Loading workshop enrolments…</p>
        ) : data.total === 0 ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No workshop enrolments were found.</p>
          </section>
        ) : (
          <section className="mh-sa__card">
            <div className="mh-sa-results">
              <span>
                Results: <strong>{data.total}</strong>
              </span>
              <label>
                Results per page:{" "}
                <select value={data.perPage} onChange={(e) => router.push(listUrl(applied, 1, Number(e.target.value)))}>
                  {PER_PAGE.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Page:{" "}
                <select value={data.page} onChange={(e) => router.push(listUrl(applied, Number(e.target.value), perPage))}>
                  {Array.from({ length: data.pages }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Workshop</th>
                    <th>Status</th>
                    <th>Enrolment Date</th>
                    <th>Note</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <StudentCell student={r.student} />
                      </td>
                      <td>
                        <WorkshopCell w={r.workshop} />
                        {r.role ? <div className="mh-sa__sub">Role: {r.role}</div> : null}
                      </td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td className="ur-nowrap">{stamp(r.enrolledAt)}</td>
                      <td className="wk-note">{r.note || <span className="mh-sa__muted">—</span>}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          {r.status === "Pending" ? (
                            <>
                              <button type="button" className="wk-act wk-act--ok" onClick={() => void change(r, "approved")}>
                                APPROVE
                              </button>
                              <span aria-hidden>|</span>
                              <button
                                type="button"
                                className="ur-delete"
                                onClick={() => {
                                  setNote("");
                                  setAction({ row: r, status: "declined" });
                                }}
                              >
                                DECLINE
                              </button>
                            </>
                          ) : r.status === "Approved" ? (
                            <button
                              type="button"
                              className="wk-act"
                              onClick={() => {
                                setNote("");
                                setAction({ row: r, status: "dropped" });
                              }}
                            >
                              DROP
                            </button>
                          ) : (
                            <button type="button" className="wk-act" onClick={() => void change(r, "pending")}>
                              REINSTATE
                            </button>
                          )}
                          <span aria-hidden>|</span>
                          <button type="button" className="ur-delete" onClick={() => setAction({ row: r, status: "delete" })}>
                            DELETE
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {action ? (
        <SaModal
          title={action.status === "delete" ? "Delete Workshop Enrolment" : action.status === "declined" ? "Decline Workshop Enrolment" : "Drop Workshop Enrolment"}
          onClose={() => setAction(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setAction(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={() => void confirmAction()}>
                {action.status === "delete" ? "Delete" : action.status === "declined" ? "Decline Enrolment" : "Drop Enrolment"}
              </button>
            </>
          }
        >
          <p>
            {action.status === "delete" ? "Delete" : action.status === "declined" ? "Decline" : "Drop"} the enrolment of <strong>{action.row.student.name}</strong> in{" "}
            <strong>{action.row.workshop.title}</strong>? Any unpaid workshop fee will be waived.
          </p>
          {action.status !== "delete" ? (
            <SaField label="Reason / Note" hint="optional">
              <textarea className="mh-sa__input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </SaField>
          ) : null}
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 8 — NEW WORKSHOP ENROLMENT                                    */
/* ------------------------------------------------------------------ */

type Detail = WorkshopSummary & { settings: { rolesMode: string; roleIds: string[]; feeCollection: string; defaultFee: number; domesticFee: number; internationalFee: number } };

export function NewWorkshopEnrolment() {
  const sp = useSearchParams();
  const meta = useMeta();
  const [available, setAvailable] = useState<WorkshopSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentRef[]>([]);
  const [searchedFor, setSearchedFor] = useState("");
  const [picked, setPicked] = useState<StudentRef[]>([]);
  const [workshopId, setWorkshopId] = useState(sp?.get("workshop") ?? "");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [roleId, setRoleId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const loadAvailable = useCallback(() => {
    ws<{ items: WorkshopSummary[] }>("/available")
      .then((r) => setAvailable(r.items))
      .catch((e) => setError(errMsg(e, "Could not load available workshops")));
  }, []);
  useEffect(loadAvailable, [loadAvailable]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const n = ++seq.current;
    const t = setTimeout(() => {
      ws<{ items: StudentRef[] }>(`/students?q=${encodeURIComponent(q)}`)
        .then((r) => n === seq.current && setResults(r.items))
        .catch(() => n === seq.current && setResults([]))
        .finally(() => n === seq.current && setSearchedFor(q));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setDetail(null);
    setRoleId("");
    if (!workshopId) return;
    ws<Detail>(`/catalog/${workshopId}`)
      .then(setDetail)
      .catch((e) => setError(errMsg(e, "Could not load the workshop")));
  }, [workshopId]);

  const roleChoices = detail?.settings.rolesMode === "Enabled" ? (meta?.roles ?? []).filter((r) => detail.settings.roleIds.includes(r.id)) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!picked.length) return setError("Search for and select at least one student");
    if (!workshopId) return setError("Please select a workshop");
    setBusy(true);
    try {
      const r = await ws<{ message: string; status: string; failed: Array<{ studentId: string; message: string }> }>("/enrolments/bulk", json("POST", { studentIds: picked.map((student) => student.id), workshopId, roleId: roleId || undefined, note: note.trim() || undefined }));
      if (r.failed.length) setError(r.failed.map((failure) => failure.message).join("; "));
      setNotice({ text: r.message, status: r.status });
      setPicked([]);
      setQuery("");
      setWorkshopId("");
      setNote("");
      refreshNavCounts();
      loadAvailable();
    } catch (err) {
      setError(errMsg(err, "Could not create the enrolment"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperFrame title="NEW WORKSHOP ENROLMENT" breadcrumbs={["Home", "New Workshop Enrolment"]} breadcrumbHrefs={["/admin"]} activeHref="/admin/workshops/enrol">
      <div className="ur">
        {notice ? (
          <div className="mh-sa__notice mh-sa__notice--success" role="status">
            <span>
              {notice.text}.{" "}
              <Link className="mh-sa__link" href={workshopEnrolmentsHref(notice.status)}>
                View {notice.status.toLowerCase()} enrolments
              </Link>
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              ×
            </button>
          </div>
        ) : null}
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />

        <form onSubmit={(e) => void submit(e)}>
          <SaCard title="Workshop Enrolment Details">
            <div className="mh-sa__grid">
              <div className="mh-sa__field wk-user">
                <span className="mh-sa__label">
                  <Req label="User" />
                </span>
                <>
                    {picked.length ? (
                      <div className="wk-picked" aria-label="Selected students">
                        <span><strong>{picked.length} student{picked.length === 1 ? "" : "s"} selected</strong></span>
                        {picked.map((student) => (
                          <button key={student.id} type="button" className="mh-sa__link" onClick={() => setPicked((current) => current.filter((item) => item.id !== student.id))}>
                            {student.name} · {student.studentNumber} ×
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      className="mh-sa__input"
                      role="combobox"
                      aria-expanded={results.length > 0}
                      aria-controls="wk-user-results"
                      aria-autocomplete="list"
                      placeholder="Student #, login or last name"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query.trim().length >= 2 ? (
                      <ul className="wk-results" id="wk-user-results" role="listbox">
                        {searchedFor !== query.trim() && !results.length ? <li className="mh-sa__muted">Searching…</li> : null}
                        {searchedFor === query.trim() && !results.length ? <li className="mh-sa__muted">No users matched “{query.trim()}”.</li> : null}
                        {results.filter((u) => !picked.some((student) => student.id === u.id)).map((u) => (
                          <li key={u.id} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => {
                                setPicked((current) => [...current, u]);
                                setQuery("");
                                setResults([]);
                              }}
                            >
                              <strong>{u.name}</strong> · {u.studentNumber}
                              {u.programCode ? ` · ${u.programCode}` : ""}
                              <span className="mh-sa__sub">{u.login}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
              </div>
              <label className="mh-sa__field">
                <span className="mh-sa__label">
                  <Req label="Workshop" />
                </span>
                <select className="mh-sa__input" value={workshopId} onChange={(e) => setWorkshopId(e.target.value)}>
                  <option value="">--- Please Select Workshop ---</option>
                  <optgroup label="Available Workshops">
                    {(available ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.title} ({w.code})
                      </option>
                    ))}
                    {workshopId && detail && !(available ?? []).some((w) => w.id === workshopId) ? <option value={workshopId}>{detail.title}</option> : null}
                  </optgroup>
                </select>
                {available && !available.length ? <span className="mh-sa__sub">No workshops are currently open for enrolment.</span> : null}
              </label>
            </div>

            {detail ? (
              <dl className="ur-dl wk-summary">
                <dt>Dates</dt>
                <dd>{dateRange(detail)}</dd>
                <dt>Schedule</dt>
                <dd>{detail.schedule}</dd>
                <dt>Instructor(s)</dt>
                <dd>{detail.instructors.join(", ") || "—"}</dd>
                <dt>Seats</dt>
                <dd>
                  {detail.seatsLeft} of {detail.capacity} remaining
                </dd>
                <dt>Enrolment Approval</dt>
                <dd>{detail.approval === "Automatic Approval" ? "Automatic — enrolment is approved immediately" : "Manual Decision — enrolment will be Pending"}</dd>
                <dt>Workshop Fee</dt>
                <dd>
                  {detail.settings.feeCollection === "Do Not Collect" || !(detail.settings.defaultFee || detail.settings.domesticFee || detail.settings.internationalFee)
                    ? "No fee"
                    : `${money(detail.settings.defaultFee)} default · ${money(detail.settings.domesticFee)} domestic · ${money(detail.settings.internationalFee)} international (collected ${detail.settings.feeCollection.toLowerCase()})`}
                </dd>
              </dl>
            ) : null}

            {roleChoices.length ? (
              <div className="mh-sa__grid">
                <label className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Workshop Role" />
                  </span>
                  <select className="mh-sa__input" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                    <option value="">--- Please Select Role ---</option>
                    {roleChoices.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {detail ? (
              <SaField label="Note" hint="optional">
                <textarea className="mh-sa__input" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              </SaField>
            ) : null}

            <div className="mh-sa__actions">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !picked || !workshopId}>
                {busy ? "Enrolling…" : "Enrol User"}
              </button>
            </div>
          </SaCard>
        </form>
      </div>
    </SuperFrame>
  );
}

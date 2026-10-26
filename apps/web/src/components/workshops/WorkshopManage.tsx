"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaField, SaModal, SafeHtml, SuperFrame } from "@/components/superadmin/shared";
import { refreshNavCounts } from "@/lib/navCounts";
import { workshopEnrolmentsHref } from "@/lib/heritageNav";
import { Notices, Req, StatusPill, StudentCell, WorkshopCell, dateRange, errMsg, fmtDate, invalidateMeta, json, money, stamp, useMeta, ws, type StudentRef, type WorkshopSummary } from "./common";

/* ------------------------------------------------------------------ */
/* Screen 9 — WORKSHOPS (Course Management listing)                     */
/* ------------------------------------------------------------------ */

function readFilters(sp: URLSearchParams) {
  return { status: sp.get("status") ?? "all", completion: sp.get("completion") ?? "Upcoming / In Progress", q: sp.get("q") ?? "" };
}

export function WorkshopsManage() {
  const router = useRouter();
  const sp = useSearchParams();
  const key = sp?.toString() ?? "";
  const meta = useMeta();
  const applied = readFilters(new URLSearchParams(key));
  const [filters, setFilters] = useState(applied);
  const [items, setItems] = useState<WorkshopSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(new URLSearchParams(key).get("notice"));
  const [confirm, setConfirm] = useState<WorkshopSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const f = readFilters(new URLSearchParams(key));
    const q = new URLSearchParams({ status: f.status, completion: f.completion === "all" ? "all" : f.completion, q: f.q });
    setBusy(true);
    ws<{ items: WorkshopSummary[] }>(`/catalog?${q.toString()}`)
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load workshops")))
      .finally(() => setBusy(false));
  }, [key]);

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(key)));
    load();
  }, [key, load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ status: filters.status, completion: filters.completion });
    if (filters.q.trim()) q.set("q", filters.q.trim());
    const url = `/admin/workshops/manage?${q.toString()}`;
    if (q.toString() === new URLSearchParams({ status: applied.status, completion: applied.completion, ...(applied.q ? { q: applied.q } : {}) }).toString()) load();
    else router.push(url);
  }

  async function remove(w: WorkshopSummary) {
    setConfirm(null);
    try {
      const r = await ws<{ message: string }>(`/catalog/${w.id}`, { method: "DELETE" });
      setNotice(r.message);
      invalidateMeta();
      refreshNavCounts();
      load();
    } catch (e) {
      setError(errMsg(e, "Could not delete the workshop"));
    }
  }

  return (
    <SuperFrame
      title="WORKSHOPS"
      breadcrumbs={["Home", "Workshops"]}
      breadcrumbHrefs={["/admin"]}
      activeHref="/admin/workshops/manage"
      actions={
        <>
          <Link className="mh-sa__btn" href="/admin/workshops/manage/categories/new">
            Create Category
          </Link>
          <Link className="mh-sa__btn mh-sa__btn--primary" href="/admin/workshops/manage/new">
            Create Workshop
          </Link>
        </>
      }
    >
      <div className="ur">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />
        <form className="mh-sa__card" onSubmit={onSearch}>
          <div className="wk-filters">
            <SaField label="Status">
              <select className="mh-sa__input" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                <option value="all">All Statuses</option>
                {(meta?.options.statuses ?? ["Active", "Inactive"]).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Completion">
              <select className="mh-sa__input" value={filters.completion} onChange={(e) => setFilters((f) => ({ ...f, completion: e.target.value }))}>
                <option value="all">All Workshops</option>
                {(meta?.options.completion ?? ["Upcoming / In Progress", "Completed"]).map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Workshop">
              <input className="mh-sa__input" placeholder="Workshop name or code" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
            </SaField>
            <div className="mh-sa__field mh-sa__field--end">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                {busy ? "Searching…" : "Search Workshops"}
              </button>
            </div>
          </div>
        </form>

        {!items ? (
          error ? null : <p className="mh-sa__muted">Loading workshops…</p>
        ) : !items.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No workshops were found.</p>
          </section>
        ) : (
          <section className="mh-sa__card">
            <div className="mh-sa-results">
              <span>
                Results: <strong>{items.length}</strong>
              </span>
            </div>
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Workshop</th>
                    <th>Category</th>
                    <th>Instructor(s)</th>
                    <th>Dates</th>
                    <th>Enrolments</th>
                    <th>Status</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <WorkshopCell w={w} />
                      </td>
                      <td>{w.category || <span className="mh-sa__muted">Not Set</span>}</td>
                      <td>{w.instructors.join(", ") || "—"}</td>
                      <td className="ur-nowrap">
                        {dateRange(w)}
                        <div className="mh-sa__sub">{w.schedule}</div>
                      </td>
                      <td className="ur-nowrap">
                        {w.counts.approved} / {w.capacity}
                        {w.counts.pending ? <div className="mh-sa__sub">{w.counts.pending} pending</div> : null}
                      </td>
                      <td>
                        <StatusPill status={w.adminStatus === "Inactive" ? "Inactive" : w.status} />
                      </td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/workshops/manage/${w.id}`}>VIEW</Link>
                          <span aria-hidden>|</span>
                          <Link href={`/admin/workshops/manage/${w.id}/edit`}>EDIT</Link>
                          <span aria-hidden>|</span>
                          <button type="button" className="ur-delete" onClick={() => setConfirm(w)}>
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
      {confirm ? (
        <SaModal
          title="Delete Workshop"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={() => void remove(confirm)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete <strong>{confirm.title}</strong> ({confirm.code})? Workshops with enrolments or attendance cannot be deleted; set them to Inactive instead.
          </p>
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Workshop detail (opened from VIEW / workshop name)                   */
/* ------------------------------------------------------------------ */

type Detail = WorkshopSummary & {
  settings: {
    introduction: string;
    descriptionHtml: string;
    enrolmentCutoff: string;
    feeCollection: string;
    defaultFee: number;
    domesticFee: number;
    internationalFee: number;
    gradingScheme: string;
    lms: string;
    campusAccess: string;
    accessLevels: string;
    studentStatuses: string;
    programOfStudy: string;
    grades: string;
    badges: string;
    hours: number;
    rolesMode: string;
    roleIds: string[];
  };
};
type Enrolment = { id: string; student: StudentRef; role: string; status: string; enrolledAt: string; note: string };

export function WorkshopView({ id }: { id: string }) {
  const sp = useSearchParams();
  const meta = useMeta();
  const [w, setW] = useState<Detail | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [enrolments, setEnrolments] = useState<Enrolment[] | null>(null);
  const [notice, setNotice] = useState<string | null>(sp?.get("notice") ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ws<Detail>(`/catalog/${id}`)
      .then((d) => {
        setW(d);
        if (d.hasImage) ws<{ dataUrl: string }>(`/catalog/${id}/image`).then((i) => setImage(i.dataUrl)).catch(() => undefined);
        else setImage(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load the workshop")));
    ws<{ items: Enrolment[] }>(`/enrolments?workshop=${id}&status=all&perPage=500`)
      .then((r) => setEnrolments(r.items))
      .catch(() => setEnrolments([]));
  }, [id]);
  useEffect(load, [load]);

  async function change(e: Enrolment, status: string) {
    setError(null);
    try {
      const r = await ws<{ message: string }>(`/enrolments/${e.id}/status`, json("POST", { status }));
      setNotice(r.message);
      refreshNavCounts();
      load();
    } catch (err) {
      setError(errMsg(err, "Could not update the enrolment"));
    }
  }

  const roleNames = w ? (meta?.roles ?? []).filter((r) => w.settings.roleIds.includes(r.id)).map((r) => r.name) : [];
  const open = w && (w.phase === "upcoming" || w.phase === "active");

  return (
    <SuperFrame
      title={w ? w.title.toUpperCase() : "WORKSHOP"}
      breadcrumbs={["Home", "Workshops", w?.title ?? "Workshop"]}
      breadcrumbHrefs={["/admin", "/admin/workshops/manage"]}
      activeHref="/admin/workshops/manage"
      actions={
        w ? (
          <>
            <Link className="mh-sa__btn" href={`/admin/workshops/attendance?workshop=${w.id}&date=${w.startDate}`}>
              Attendance
            </Link>
            {open ? (
              <Link className="mh-sa__btn" href={`/admin/workshops/enrol?workshop=${w.id}`}>
                Enrol User
              </Link>
            ) : null}
            <Link className="mh-sa__btn mh-sa__btn--primary" href={`/admin/workshops/manage/${w.id}/edit`}>
              Edit Workshop
            </Link>
          </>
        ) : null
      }
    >
      <div className="ur">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />
        {!w ? (
          error ? null : <p className="mh-sa__muted">Loading workshop…</p>
        ) : (
          <>
            <SaCard title="Workshop Details">
              <div className="wk-detail">
                {image ? <img className="wk-detail-img" src={image} alt="" /> : null}
                <dl className="ur-dl">
                  <dt>Workshop Number</dt>
                  <dd>{w.code}</dd>
                  <dt>Category</dt>
                  <dd>{w.category || "Not Set"}</dd>
                  <dt>Status</dt>
                  <dd>
                    <StatusPill status={w.adminStatus === "Inactive" ? "Inactive" : w.status} />
                  </dd>
                  <dt>Dates</dt>
                  <dd>{dateRange(w)}</dd>
                  <dt>Schedule</dt>
                  <dd>{w.schedule}</dd>
                  <dt>Length</dt>
                  <dd>{w.length}</dd>
                  <dt>Campus / Location</dt>
                  <dd>{[w.campus, w.classroom].filter(Boolean).join(" · ") || "—"}</dd>
                  <dt>Instructor(s)</dt>
                  <dd>{w.instructors.join(", ") || "—"}</dd>
                </dl>
              </div>
              {w.settings.introduction ? <p className="mh-sa__pre">{w.settings.introduction}</p> : null}
              <SafeHtml html={w.settings.descriptionHtml} empty="No description provided." />
            </SaCard>

            <SaCard title="Enrolment & Fees">
              <dl className="ur-dl">
                <dt>Seats</dt>
                <dd>
                  {w.capacity - w.seatsLeft} taken · {w.seatsLeft} of {w.capacity} remaining
                </dd>
                <dt>Enrolment Cut-off</dt>
                <dd>{w.enrolmentCutoff ? `${fmtDate(w.enrolmentCutoff)} ${w.enrolmentCutoff.slice(11)}${w.cutoffPassed ? " (passed)" : ""}` : "None"}</dd>
                <dt>Workshop Privacy</dt>
                <dd>{w.privacy}</dd>
                <dt>Enrolment Approval</dt>
                <dd>{w.approval}</dd>
                <dt>Workshop Roles</dt>
                <dd>{w.settings.rolesMode === "Enabled" ? roleNames.join(", ") || "Enabled" : "Disabled"}</dd>
                <dt>Fees</dt>
                <dd>
                  {w.settings.feeCollection === "Do Not Collect"
                    ? "Not collected"
                    : `${money(w.settings.defaultFee)} default · ${money(w.settings.domesticFee)} domestic · ${money(w.settings.internationalFee)} international — collected ${w.settings.feeCollection.toLowerCase()}`}
                </dd>
                <dt>Available To</dt>
                <dd>{[w.settings.campusAccess, w.settings.accessLevels, w.settings.studentStatuses, w.settings.programOfStudy].join(" · ")}</dd>
                <dt>Grading / LMS</dt>
                <dd>
                  {w.settings.gradingScheme} · LMS {w.settings.lms.toLowerCase()} · Grades {w.settings.grades.toLowerCase()} · Badges {w.settings.badges.toLowerCase()}
                </dd>
              </dl>
            </SaCard>

            <SaCard
              title={`Enrolments (${w.counts.approved} approved · ${w.counts.pending} pending)`}
              actions={
                <Link className="mh-sa__link" href={`${workshopEnrolmentsHref("all")}&workshop=${w.id}`}>
                  Open in Workshop Enrolments
                </Link>
              }
            >
              {!enrolments ? (
                <p className="mh-sa__muted">Loading enrolments…</p>
              ) : !enrolments.length ? (
                <p className="mh-sa__empty">No workshop enrolments were found.</p>
              ) : (
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Enrolment Date</th>
                        <th className="ur-col-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {enrolments.map((e) => (
                        <tr key={e.id}>
                          <td>
                            <StudentCell student={e.student} />
                            {e.role ? <div className="mh-sa__sub">Role: {e.role}</div> : null}
                          </td>
                          <td>
                            <StatusPill status={e.status} />
                          </td>
                          <td className="ur-nowrap">{stamp(e.enrolledAt)}</td>
                          <td className="ur-col-actions">
                            <span className="ur-actions">
                              {e.status === "Pending" ? (
                                <>
                                  <button type="button" className="wk-act wk-act--ok" onClick={() => void change(e, "approved")}>
                                    APPROVE
                                  </button>
                                  <span aria-hidden>|</span>
                                  <button type="button" className="ur-delete" onClick={() => void change(e, "declined")}>
                                    DECLINE
                                  </button>
                                </>
                              ) : e.status === "Approved" ? (
                                <button type="button" className="wk-act" onClick={() => void change(e, "dropped")}>
                                  DROP
                                </button>
                              ) : (
                                <button type="button" className="wk-act" onClick={() => void change(e, "pending")}>
                                  REINSTATE
                                </button>
                              )}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SaCard>
          </>
        )}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 10 — CREATE WORKSHOP CATEGORY                                 */
/* ------------------------------------------------------------------ */

type Category = { id: string; name: string; abbreviation: string; workshops: number };

export function WorkshopCategoryForm({ id }: { id?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [list, setList] = useState<Category[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Category | null>(null);

  const load = useCallback(() => {
    ws<{ items: Category[] }>("/categories")
      .then((r) => {
        setList(r.items);
        if (id) {
          const c = r.items.find((x) => x.id === id);
          if (!c) setError("Workshop category not found");
          else {
            setName(c.name);
            setAbbreviation(c.abbreviation);
          }
        }
      })
      .catch((e) => setError(errMsg(e, "Could not load workshop categories")));
  }, [id]);
  useEffect(load, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = id ? await ws<{ message: string }>(`/categories/${id}`, json("PUT", { name, abbreviation })) : await ws<{ message: string }>("/categories", json("POST", { name, abbreviation }));
      invalidateMeta();
      if (id) router.push(`/admin/workshops/manage/categories/new?notice=${encodeURIComponent(r.message)}`);
      else {
        setNotice(r.message);
        setName("");
        setAbbreviation("");
        load();
      }
    } catch (err) {
      setError(errMsg(err, "Could not save the category"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Category) {
    setConfirm(null);
    try {
      const r = await ws<{ message: string }>(`/categories/${c.id}`, { method: "DELETE" });
      invalidateMeta();
      setNotice(r.message);
      if (c.id === id) router.push("/admin/workshops/manage/categories/new");
      else load();
    } catch (err) {
      setError(errMsg(err, "Could not delete the category"));
    }
  }

  const sp = useSearchParams();
  useEffect(() => {
    const n = sp?.get("notice");
    if (n) setNotice(n);
  }, [sp]);

  return (
    <SuperFrame
      title={id ? "EDIT WORKSHOP CATEGORY" : "CREATE WORKSHOP CATEGORY"}
      breadcrumbs={["Home", "Workshops", id ? "Edit Workshop Category" : "Add Workshop Category"]}
      breadcrumbHrefs={["/admin", "/admin/workshops/manage"]}
      activeHref="/admin/workshops/manage"
    >
      <div className="ur">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />
        <form onSubmit={(e) => void save(e)}>
          <SaCard title="Category Details">
            <div className="mh-sa__grid">
              <label className="mh-sa__field">
                <span className="mh-sa__label">
                  <Req label="Name" />
                </span>
                <input className="mh-sa__input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                <span className="mh-sa__sub">English</span>
              </label>
              <label className="mh-sa__field">
                <span className="mh-sa__label">Abbreviation</span>
                <input className="mh-sa__input" maxLength={20} value={abbreviation} onChange={(e) => setAbbreviation(e.target.value.toUpperCase())} />
                <span className="mh-sa__sub">English</span>
              </label>
            </div>
            <div className="mh-sa__actions">
              {id ? (
                <Link className="mh-sa__btn" href="/admin/workshops/manage/categories/new">
                  Cancel
                </Link>
              ) : null}
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                {busy ? "Saving…" : "Save Category"}
              </button>
            </div>
          </SaCard>
        </form>

        <SaCard title="Workshop Categories">
          {!list ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : !list.length ? (
            <p className="mh-sa__empty">No workshop categories have been created yet.</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Abbreviation</th>
                    <th>Workshops</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td className="ur-name">{c.name}</td>
                      <td>{c.abbreviation || "—"}</td>
                      <td>{c.workshops}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/workshops/manage/categories/${c.id}`}>EDIT</Link>
                          <span aria-hidden>|</span>
                          <button type="button" className="ur-delete" onClick={() => setConfirm(c)}>
                            DELETE
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SaCard>
      </div>
      {confirm ? (
        <SaModal
          title="Delete Workshop Category"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={() => void remove(confirm)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete the workshop category <strong>{confirm.name}</strong>?
          </p>
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

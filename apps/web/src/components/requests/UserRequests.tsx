"use client";

import "../superadmin/superadmin.css";
import "./requests.css";
import { Fragment, useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaField, SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ApiError, api, loadSession } from "@/lib/api";
import { heritageHref, requestsHref } from "@/lib/heritageNav";
import { refreshNavCounts } from "@/lib/navCounts";

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

type Status = "Pending" | "Approved" | "Declined";
type Kind = "loa" | "profile" | "service";
type Meta = { types: string[]; statuses: Status[]; forms: string[]; loaTypes: string[]; enrolmentActions: string[]; studentStatuses: string[] };
type StudentRef = { id: string; name: string; preferredName: string; studentNumber: string; programCode: string } | null;
type Summary = { number: number; kind: Kind; form: string; type: string; status: Status; requestedAt: string; student: StudentRef };
type ListResponse = { total: number; page: number; pages: number; perPage: number; items: Summary[] };
type LoaSettings = { type: string; absenceStart: string; returning: string; programProfile: string; enrolmentsAction: string; changeStatus: string; returningStatus: string };
type ProfileFields = {
  familyName: string;
  givenName: string;
  middleName: string;
  preferredName: string;
  phone: string;
  primaryEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};
type Detail = Summary & {
  comments: string;
  decidedAt: string | null;
  decidedBy: string | null;
  loa?: { reason: string; startsOn: string; endsOn: string };
  settings?: LoaSettings;
  programProfiles?: Array<{ value: string; label: string }>;
  profile?: { requested: ProfileFields; current: ProfileFields; reason: string };
  service?: { subject: string; details: string };
};

const rq = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/requests${path}`, init ?? {}, loadSession()?.accessToken);
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);
const PER_PAGE = [10, 25, 50, 100];

let metaCache: Promise<Meta> | null = null;
function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => {
    metaCache ??= rq<Meta>("/meta");
    metaCache.then(setMeta).catch(() => {
      metaCache = null;
    });
  }, []);
  return meta;
}

const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const fmtDay = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" }) : iso || "—";
const studentHref = (id: string) => heritageHref("S03", { ctx: `student:${id}` });
const typeSearch = (type: string) => new URLSearchParams({ "f.type": type }).toString();

function StatusPill({ status }: { status: Status }) {
  return <span className={`mh-sa__pill${status === "Approved" ? " mh-sa__pill--ok" : status === "Pending" ? " mh-sa__pill--warn" : " ur-pill--declined"}`}>{status}</span>;
}

function StudentCell({ student }: { student: StudentRef }) {
  if (!student) return <span className="mh-sa__muted">Unknown student</span>;
  return (
    <>
      <div className="ur-name">
        {student.name}
        {student.preferredName ? <span className="mh-sa__muted"> ({student.preferredName})</span> : null}
      </div>
      <div className="ur-sub">
        <Link href={studentHref(student.id)}>{student.studentNumber}</Link>
        {student.programCode ? <span className="ur-code">{student.programCode}</span> : null}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 1, 4, 5, 6, 9 — USER REQUESTS listing                        */
/* ------------------------------------------------------------------ */

const ALL = "all";

function readFilters(sp: URLSearchParams | null) {
  return {
    request: sp?.get("request") ?? "",
    user: sp?.get("user") ?? "",
    form: sp?.get("form") ?? "",
    status: sp?.get("status") ?? "Pending",
    type: sp?.get("f.type") ?? "",
  };
}
type Filters = ReturnType<typeof readFilters>;

function listUrl(f: Filters, page?: number, perPage?: number) {
  const sp = new URLSearchParams();
  if (f.type) sp.set("f.type", f.type);
  if (f.request.trim()) sp.set("request", f.request.trim());
  if (f.user.trim()) sp.set("user", f.user.trim());
  if (f.form) sp.set("form", f.form);
  if (f.status !== "Pending") sp.set("status", f.status || ALL);
  if (page && page > 1) sp.set("page", String(page));
  if (perPage && perPage !== 50) sp.set("perPage", String(perPage));
  const s = sp.toString();
  return `/admin/requests${s ? `?${s}` : ""}`;
}

export function UserRequestsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const meta = useMeta();
  const applied = readFilters(sp);
  const page = Number(sp?.get("page")) || 1;
  const perPage = Number(sp?.get("perPage")) || 50;
  const key = sp?.toString() ?? "";
  const [filters, setFilters] = useState<Filters>(applied);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(sp?.get("notice") ?? null);
  const [confirm, setConfirm] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    const f = readFilters(new URLSearchParams(key));
    const p = new URLSearchParams();
    if (f.request) p.set("request", f.request);
    if (f.user) p.set("user", f.user);
    if (f.form) p.set("form", f.form);
    if (f.status && f.status !== ALL) p.set("status", f.status);
    if (f.type) p.set("type", f.type);
    p.set("page", String(page));
    p.set("perPage", String(perPage));
    setBusy(true);
    rq<ListResponse>(`?${p.toString()}`)
      .then((r) => {
        setData(r);
        setError(null);
      })
      .catch((e) => setError(errMsg(e, "Could not load user requests")))
      .finally(() => setBusy(false));
  }, [key, page, perPage]);

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(key)));
    load();
  }, [key, load]);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const url = listUrl(filters, 1, perPage);
    if (url === listUrl(applied, page, perPage)) load();
    else router.push(url);
  }

  async function onDelete(row: Summary) {
    setConfirm(null);
    try {
      const r = await rq<{ message: string }>(`/${row.number}`, { method: "DELETE" });
      setNotice(r.message);
      refreshNavCounts();
      load();
    } catch (e) {
      setError(errMsg(e, "Could not delete the request"));
    }
  }

  return (
    <SuperFrame
      title="USER REQUESTS"
      breadcrumbs={["Home", "User Requests"]}
      breadcrumbHrefs={["/admin"]}
      activeHref="/admin/requests"
      activeSearch={applied.type ? typeSearch(applied.type) : ""}
    >
      <div className="ur">
        {notice ? (
          <SaNotice tone="success" onClose={() => setNotice(null)}>
            {notice}
          </SaNotice>
        ) : null}
        {error ? (
          <SaNotice tone="error" onClose={() => setError(null)}>
            {error}
          </SaNotice>
        ) : null}

        <form className="mh-sa__card" onSubmit={onSearch}>
          <div className="ur-filters">
            <SaField label="Request #">
              <input className="mh-sa__input" inputMode="numeric" value={filters.request} onChange={(e) => set("request", e.target.value)} />
            </SaField>
            <SaField label="User Filter">
              <input className="mh-sa__input" placeholder="User login, Student # or last name" value={filters.user} onChange={(e) => set("user", e.target.value)} />
            </SaField>
            <SaField label="Form Filter">
              <select className="mh-sa__input" value={filters.form} onChange={(e) => set("form", e.target.value)}>
                <option value="">All Forms</option>
                {(meta?.forms ?? []).map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Status Filter">
              <select className="mh-sa__input" value={filters.status} onChange={(e) => set("status", e.target.value)}>
                <option value={ALL}>All Statuses</option>
                {(meta?.statuses ?? ["Pending", "Approved", "Declined"]).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Type Filter">
              <select className="mh-sa__input" value={filters.type} onChange={(e) => set("type", e.target.value)}>
                <option value="">All Types</option>
                {(meta?.types ?? []).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </SaField>
          </div>
          <div className="mh-sa__actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              {busy ? "Searching…" : "Search Requests"}
            </button>
          </div>
        </form>

        {!data ? (
          error ? null : <p className="mh-sa__muted">Loading user requests…</p>
        ) : data.total === 0 ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No user requests were found.</p>
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
                    <th>#</th>
                    <th>Name</th>
                    <th>Request Form</th>
                    <th>Status</th>
                    <th>Request Date</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.number}>
                      <td className="ur-num">{r.number}</td>
                      <td>
                        <StudentCell student={r.student} />
                      </td>
                      <td>{r.form}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td className="ur-nowrap">{stamp(r.requestedAt)}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/requests/${r.number}`}>REVIEW</Link>
                          <span aria-hidden>|</span>
                          <Link href={`/admin/requests/${r.number}/edit`}>EDIT</Link>
                          <span aria-hidden>|</span>
                          <button type="button" className="ur-delete" onClick={() => setConfirm(r)}>
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
          title="Delete User Request"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={() => void onDelete(confirm)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete user request <strong>#{confirm.number}</strong> ({confirm.form}
            {confirm.student ? ` — ${confirm.student.name}` : ""})?
            {confirm.status === "Pending" ? " The pending request will be withdrawn for the student." : ""}
          </p>
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Shared frame for a single request                                    */
/* ------------------------------------------------------------------ */

const isRequestNumber = (n: number) => Number.isSafeInteger(n) && n > 0;

function useRequest(number: number) {
  const valid = isRequestNumber(number);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(!valid);
  const reload = useCallback(async () => {
    if (!valid) return;
    try {
      setDetail(await rq<Detail>(`/${number}`));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setNotFound(true);
      else setError(errMsg(e, "Could not load the request"));
    }
  }, [number, valid]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { detail, error, setError, reload, notFound };
}

function RequestFrame({
  number,
  detail,
  edit,
  notFound,
  children,
}: {
  number: number;
  detail: Detail | null;
  edit?: boolean;
  notFound?: boolean;
  children: ReactNode;
}) {
  const form = detail?.form ?? "";
  const listing = detail ? requestsHref(detail.type) : "/admin/requests";
  if (notFound) {
    return (
      <SuperFrame title="User request not found" breadcrumbs={["Home", "User Requests", "Not found"]} breadcrumbHrefs={["/admin", "/admin/requests"]} activeHref="/admin/requests">
        <div className="ur">
          <SaCard title="Not found">
            <p>There is no user request with this number. It may have been deleted, or the link may be mistyped.</p>
            <p>
              <Link className="mh-sa__btn mh-sa__btn--primary" href="/admin/requests">
                Back to User Requests
              </Link>
            </p>
          </SaCard>
        </div>
      </SuperFrame>
    );
  }
  const title = `${edit ? "EDIT " : ""}USER REQUEST #${number}${form ? `: ${form.toUpperCase()}` : ""}`;
  return (
    <SuperFrame
      title={title}
      breadcrumbs={["Home", "User Requests", form ? `${edit ? "Edit User Request" : "Review"}: ${form}` : edit ? "Edit User Request" : "Review"]}
      breadcrumbHrefs={["/admin", listing]}
      activeHref="/admin/requests"
      activeSearch={detail ? typeSearch(detail.type) : ""}
    >
      <div className="ur">
        {detail?.student ? (
          <p className="ur-headline">
            <strong>{detail.student.name}</strong>
            {detail.student.preferredName ? ` (${detail.student.preferredName})` : ""} · Student #{" "}
            <Link className="mh-sa__link" href={studentHref(detail.student.id)}>
              {detail.student.studentNumber}
            </Link>
            {detail.student.programCode ? <span className="ur-code">{detail.student.programCode}</span> : null}
          </p>
        ) : null}
        {children}
      </div>
    </SuperFrame>
  );
}

function Dl({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="ur-dl">
      {rows.map(([k, v]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v === "" || v === null || v === undefined ? <span className="mh-sa__muted">—</span> : v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 2, 3, 7 — Review                                             */
/* ------------------------------------------------------------------ */

export function UserRequestReview({ number }: { number: number }) {
  const meta = useMeta();
  const { detail, error, setError, reload, notFound } = useRequest(number);
  const [settings, setSettings] = useState<LoaSettings | null>(null);
  const [comments, setComments] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    setSettings(detail.settings ?? null);
    setComments(detail.comments);
  }, [detail]);

  const pending = detail?.status === "Pending";
  const setS = <K extends keyof LoaSettings>(k: K, v: string) => setSettings((s) => (s ? { ...s, [k]: v } : s));

  async function decide(decision: "approve" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const r = await rq<{ message: string }>(`/${number}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ comments, ...(detail?.kind === "loa" && decision === "approve" && settings ? { settings } : {}) }),
      });
      setConfirming(false);
      setNotice(r.message);
      refreshNavCounts();
      await reload();
    } catch (e) {
      setError(errMsg(e, `Could not ${decision} the request`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RequestFrame number={number} detail={detail} notFound={notFound}>
      {notice ? (
        <SaNotice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </SaNotice>
      ) : null}
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {!detail ? (
        error ? null : <p className="mh-sa__muted">Loading request…</p>
      ) : (
        <>
          <SaCard title="Request Status">
            <Dl
              rows={[
                ["Request Date", stamp(detail.requestedAt)],
                ["Current Status", <StatusPill key="s" status={detail.status} />],
                ...(detail.decidedAt ? ([[detail.status === "Declined" ? "Declined" : "Approved", `${stamp(detail.decidedAt)}${detail.decidedBy ? ` by ${detail.decidedBy}` : ""}`]] as Array<[string, ReactNode]>) : []),
              ]}
            />
          </SaCard>

          {detail.kind === "loa" && detail.loa ? (
            <>
              <SaCard title={detail.form}>
                <Dl
                  rows={[
                    ["Reason for absence", <span key="r" className="mh-sa__pre">{detail.loa.reason}</span>],
                    ["Start Date", fmtDay(detail.loa.startsOn)],
                    ["End Date", fmtDay(detail.loa.endsOn)],
                  ]}
                />
              </SaCard>
              {settings ? (
                <fieldset className="ur-fieldset" disabled={!pending || busy}>
                  <SaCard title="Leave of Absence Settings">
                    <h3 className="ur-subhead">Timeframe</h3>
                    <div className="mh-sa__grid">
                      <SaField label="Leave of Absence Type">
                        <select className="mh-sa__input" value={settings.type} onChange={(e) => setS("type", e.target.value)}>
                          {(meta?.loaTypes ?? [settings.type]).map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </SaField>
                      <SaField label="Absence Start Date">
                        <input className="mh-sa__input" type="date" value={settings.absenceStart} onChange={(e) => setS("absenceStart", e.target.value)} />
                      </SaField>
                      <SaField label="Returning Date" hint={settings.type === "By dates" ? undefined : "optional"}>
                        <input className="mh-sa__input" type="date" value={settings.returning} onChange={(e) => setS("returning", e.target.value)} />
                      </SaField>
                    </div>
                  </SaCard>
                  <SaCard title="Profile Actions">
                    <div className="mh-sa__grid">
                      <SaField label="Program Profile" wide>
                        <select className="mh-sa__input" value={settings.programProfile} onChange={(e) => setS("programProfile", e.target.value)}>
                          {(detail.programProfiles ?? []).map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </SaField>
                      <SaField label="Enrolments Action">
                        <select className="mh-sa__input" value={settings.enrolmentsAction} onChange={(e) => setS("enrolmentsAction", e.target.value)}>
                          {(meta?.enrolmentActions ?? [settings.enrolmentsAction]).map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </SaField>
                      <SaField label="Change Student Status">
                        <select className="mh-sa__input" value={settings.changeStatus} onChange={(e) => setS("changeStatus", e.target.value)}>
                          {(meta?.studentStatuses ?? [settings.changeStatus]).map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </SaField>
                      <SaField label="Returning Student Status">
                        <select className="mh-sa__input" value={settings.returningStatus} onChange={(e) => setS("returningStatus", e.target.value)}>
                          {(meta?.studentStatuses ?? [settings.returningStatus]).map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </SaField>
                    </div>
                  </SaCard>
                </fieldset>
              ) : null}
            </>
          ) : null}

          {detail.kind === "profile" && detail.profile ? (
            <>
              {detail.student ? (
                <p>
                  <Link className="ur-profile-link" href={studentHref(detail.student.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                    </svg>
                    Current Profile Details
                  </Link>
                </p>
              ) : null}
              <SaCard title="Contact Information">
                <Dl
                  rows={(
                    [
                      ["Last Name", "familyName"],
                      ["First Name", "givenName"],
                      ["Phone Number", "phone"],
                      ["E-mail Address", "primaryEmail"],
                    ] as Array<[string, keyof ProfileFields]>
                  ).map(([label, k]) => [label, <Changed key={k} field={k} profile={detail.profile!} />])}
                />
              </SaCard>
              <SaCard title="Emergency Contact">
                <Dl
                  rows={(
                    [
                      ["Emergency Contact Name", "emergencyContactName"],
                      ["Emergency Contact Phone Number", "emergencyContactPhone"],
                    ] as Array<[string, keyof ProfileFields]>
                  ).map(([label, k]) => [label, <Changed key={k} field={k} profile={detail.profile!} />])}
                />
              </SaCard>
            </>
          ) : null}

          {detail.kind === "service" && detail.service ? (
            <SaCard title={detail.form}>
              <Dl
                rows={[
                  ["Request Form", detail.form],
                  ["Subject", detail.service.subject],
                  ["Details", <span key="d" className="mh-sa__pre">{detail.service.details}</span>],
                ]}
              />
            </SaCard>
          ) : null}

          <SaCard title="Request Comments / Notes">
            <SaField label="Comments / Note">
              <textarea className="mh-sa__input" rows={4} value={comments} maxLength={4000} disabled={!pending || busy} onChange={(e) => setComments(e.target.value)} />
            </SaField>
          </SaCard>

          {pending ? (
            confirming ? (
              <div className="ur-decision ur-decision--confirm" role="alertdialog" aria-label="Confirm approval">
                <p>Are you sure you want to approve this request?</p>
                <div className="mh-sa__actions">
                  <button type="button" className="mh-sa__btn" disabled={busy} onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={() => void decide("approve")}>
                    {busy ? "Approving…" : "Confirm Approval"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="ur-decision">
                <p>Please select an option below to approve/decline this request.</p>
                <div className="mh-sa__actions">
                  <button type="button" className="mh-sa__btn mh-sa__btn--danger" disabled={busy} onClick={() => void decide("decline")}>
                    {busy ? "Working…" : "Decline Request"}
                  </button>
                  <button
                    type="button"
                    className="mh-sa__btn mh-sa__btn--primary"
                    disabled={busy}
                    onClick={() => (detail.kind === "loa" ? setConfirming(true) : void decide("approve"))}
                  >
                    Approve Request
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="mh-sa__muted">
              This request has been {detail.status.toLowerCase()}.{" "}
              <Link className="mh-sa__link" href={requestsHref(detail.type)}>
                Back to User Requests
              </Link>
            </p>
          )}
        </>
      )}
    </RequestFrame>
  );
}

function Changed({ field, profile }: { field: keyof ProfileFields; profile: NonNullable<Detail["profile"]> }) {
  const value = profile.requested[field];
  const was = profile.current[field];
  const shown = field === "primaryEmail" && value ? <a href={`mailto:${value}`}>{value}</a> : value || <span className="mh-sa__muted">—</span>;
  return (
    <>
      {shown}
      {value !== was ? <span className="ur-was">Current: {was || "—"}</span> : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 8 — Edit User Request                                         */
/* ------------------------------------------------------------------ */

const PROFILE_FIELDS: Array<{ key: keyof ProfileFields; label: string; required: boolean; type?: string; group: "contact" | "emergency" }> = [
  { key: "familyName", label: "Last Name", required: true, group: "contact" },
  { key: "givenName", label: "First Name", required: true, group: "contact" },
  { key: "middleName", label: "Middle Name", required: false, group: "contact" },
  { key: "preferredName", label: "Preferred Name", required: false, group: "contact" },
  { key: "phone", label: "Phone Number", required: true, type: "tel", group: "contact" },
  { key: "primaryEmail", label: "E-mail Address", required: true, type: "email", group: "contact" },
  { key: "emergencyContactName", label: "Emergency Contact Name", required: true, group: "emergency" },
  { key: "emergencyContactPhone", label: "Emergency Contact Phone Number", required: true, type: "tel", group: "emergency" },
];

function Req({ label, required }: { label: string; required: boolean }) {
  return required ? (
    <>
      <span className="ur-star">*</span> {label}
    </>
  ) : (
    <>{label}</>
  );
}

export function UserRequestEdit({ number }: { number: number }) {
  const { detail, error, setError, reload, notFound } = useRequest(number);
  const [profile, setProfile] = useState<ProfileFields | null>(null);
  const [loa, setLoa] = useState<{ reason: string; startsOn: string; endsOn: string } | null>(null);
  const [service, setService] = useState<{ subject: string; details: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    setProfile(detail.profile ? { ...detail.profile.requested } : null);
    setLoa(detail.loa ? { ...detail.loa } : null);
    setService(detail.service ? { ...detail.service } : null);
  }, [detail]);

  const locked = Boolean(detail && detail.status !== "Pending");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const body = detail.kind === "profile" ? { profile } : detail.kind === "loa" ? { loa } : { service };
      const r = await rq<{ message: string }>(`/${number}`, { method: "PATCH", body: JSON.stringify(body) });
      setNotice(r.message);
      await reload();
    } catch (err) {
      setError(errMsg(err, "Could not update the request"));
    } finally {
      setBusy(false);
    }
  }

  const field = (f: (typeof PROFILE_FIELDS)[number]) => (
    <label key={f.key} className="mh-sa__field">
      <span className="mh-sa__label">
        <Req label={f.label} required={f.required} />
      </span>
      <input
        className="mh-sa__input"
        type={f.type ?? "text"}
        required={f.required}
        value={profile?.[f.key] ?? ""}
        onChange={(e) => setProfile((p) => (p ? { ...p, [f.key]: e.target.value } : p))}
      />
    </label>
  );

  return (
    <RequestFrame number={number} detail={detail} edit notFound={notFound}>
      {notice ? (
        <SaNotice tone="success" onClose={() => setNotice(null)}>
          {notice}.{" "}
          <Link className="mh-sa__link" href={detail ? requestsHref(detail.type) : "/admin/requests"}>
            Back to User Requests
          </Link>
        </SaNotice>
      ) : null}
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {locked ? <SaNotice tone="error">This request has already been {detail!.status.toLowerCase()} and can no longer be edited.</SaNotice> : null}
      {!detail ? (
        error ? null : <p className="mh-sa__muted">Loading request…</p>
      ) : (
        <form onSubmit={(e) => void save(e)}>
          <fieldset className="ur-fieldset" disabled={locked || busy}>
            {detail.kind === "profile" && profile ? (
              <>
                <SaCard title="Contact Information">
                  <div className="mh-sa__grid">{PROFILE_FIELDS.filter((f) => f.group === "contact").map(field)}</div>
                </SaCard>
                <SaCard title="Emergency Contact">
                  <div className="mh-sa__grid">{PROFILE_FIELDS.filter((f) => f.group === "emergency").map(field)}</div>
                </SaCard>
              </>
            ) : null}

            {detail.kind === "loa" && loa ? (
              <SaCard title={detail.form}>
                <div className="mh-sa__grid">
                  <label className="mh-sa__field mh-sa__field--wide">
                    <span className="mh-sa__label">
                      <Req label="Reason for absence" required />
                    </span>
                    <textarea className="mh-sa__input" rows={4} required maxLength={2000} value={loa.reason} onChange={(e) => setLoa({ ...loa, reason: e.target.value })} />
                  </label>
                  <label className="mh-sa__field">
                    <span className="mh-sa__label">
                      <Req label="Start Date" required />
                    </span>
                    <input className="mh-sa__input" type="date" required value={loa.startsOn} onChange={(e) => setLoa({ ...loa, startsOn: e.target.value })} />
                  </label>
                  <label className="mh-sa__field">
                    <span className="mh-sa__label">
                      <Req label="End Date" required />
                    </span>
                    <input className="mh-sa__input" type="date" required min={loa.startsOn} value={loa.endsOn} onChange={(e) => setLoa({ ...loa, endsOn: e.target.value })} />
                  </label>
                </div>
              </SaCard>
            ) : null}

            {detail.kind === "service" && service ? (
              <SaCard title={detail.form}>
                <div className="mh-sa__grid">
                  <label className="mh-sa__field mh-sa__field--wide">
                    <span className="mh-sa__label">
                      <Req label="Subject" required />
                    </span>
                    <input className="mh-sa__input" required maxLength={200} value={service.subject} onChange={(e) => setService({ ...service, subject: e.target.value })} />
                  </label>
                  <label className="mh-sa__field mh-sa__field--wide">
                    <span className="mh-sa__label">
                      <Req label="Details" required />
                    </span>
                    <textarea className="mh-sa__input" rows={5} required maxLength={4000} value={service.details} onChange={(e) => setService({ ...service, details: e.target.value })} />
                  </label>
                </div>
              </SaCard>
            ) : null}

            <div className="mh-sa__actions ur-save">
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
                {busy ? "Updating…" : "Update Request"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
    </RequestFrame>
  );
}

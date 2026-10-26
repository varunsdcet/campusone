"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { EntitySections, useEntityForm, useLeaveGuard } from "./forms";
import { ConfirmDelete, FieldGrid, FilterBar, Pager, errMsg, lx, str, useNotice, type Listing, type Row } from "./shared";

const BASE = "/admin/location/institutions";
const CRUMB = ["Home", "Location Management", "External & Transfer Institutions"];

/* ------------------------------------------------------------------ */
/* Screen 22 — Manage Institutions                                      */
/* ------------------------------------------------------------------ */

export function ManageInstitutions() {
  const router = useRouter();
  const notice = useNotice();
  const { fail, ok } = notice;
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const currentRequest = ++requestId.current;
    const qs = new URLSearchParams({ name: applied, page: String(page), perPage: String(perPage) }).toString();
    lx<Listing>(`/institutions?${qs}`, { cache: "no-store" })
      .then((next) => {
        if (currentRequest === requestId.current) setData(next);
      })
      .catch((e) => {
        if (currentRequest === requestId.current) fail(errMsg(e, "Could not load institutions"));
      });
  }, [applied, page, perPage, fail]);
  useEffect(load, [load]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setApplied(q.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  return (
    <SuperFrame
      title="Manage Institutions"
      breadcrumbs={CRUMB}
      activeHref={BASE}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${BASE}/new`}>
          Add Institution
        </Link>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          <FilterBar
            label="Name Filter"
            value={q}
            onChange={setQ}
            submitLabel="Search Institutions"
            onSubmit={() => {
              setPage(1);
              setApplied(q.trim());
            }}
          />
        </section>
        <section className="mh-sa__card">
          {!data ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <>
              <Pager total={data.total} page={data.page} pages={data.pages} perPage={perPage} onPage={setPage} onPerPage={(n) => (setPerPage(n), setPage(1))} />
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table lx-table">
                  <thead>
                    <tr>
                      <th>Institutions</th>
                      <th>Active</th>
                      <th className="lx-actions" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{str(r.name)}</strong>
                          <div className="mh-sa__muted lx-sub">{str(r._addressLine) || "No address on file"}</div>
                        </td>
                        <td>{r.active === "Inactive" ? "No" : "Yes"}</td>
                        <td className="lx-actions">
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${BASE}/manage?id=${r.id}&tab=courses`)}>
                            Courses ({str(r._coursesCount) || "0"})
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${BASE}/manage?id=${r.id}`)}>
                            Manage
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="mh-sa__empty-cell">
                          {applied ? "No institutions match this filter." : "No institutions were found."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        {confirm ? (
          <ConfirmDelete
            title="Delete institution"
            body={`Delete "${str(confirm.name)}"? Its agreements, bridge / qualifying programs and ${str(confirm._coursesCount) || "0"} transfer course(s) will also be deleted.`}
            okLabel="Delete Institution"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              lx<{ message: string }>(`/institutions/${r.id}`, { method: "DELETE" })
                .then((out) => {
                  ok(out.message);
                  load();
                })
                .catch((e) => fail(errMsg(e, "Delete failed")));
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 23 — Add Institution                                          */
/* ------------------------------------------------------------------ */

export function AddInstitution() {
  const router = useRouter();
  const notice = useNotice();
  const form = useEntityForm("institutions", null);
  useLeaveGuard(form.dirty && !form.busy);
  return (
    <SuperFrame title="Add Institution" breadcrumbs={[...CRUMB, "Add Institution"]} activeHref={BASE}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${BASE}/manage?id=${out.id}&notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError ? <SaNotice tone="error">{form.metaError}</SaNotice> : null}
        {notice.node}
        {!form.values ? <p className="mh-sa__muted">Loading…</p> : <EntitySections form={form} title="Institution Details" />}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={BASE}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Institution
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 24–30 — Manage Institution (four tabs)                       */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "profile", label: "Institution Profile" },
  { key: "agreements", label: "Agreements & Contracts" },
  { key: "bridge", label: "Bridge & Qualifying Programs" },
  { key: "courses", label: "Courses Equivalencies" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function ManageInstitution() {
  const router = useRouter();
  const sp = useSearchParams();
  const notice = useNotice();
  const { fail, ok, clear } = notice;
  const [id, setId] = useState<string | null>(sp?.get("id") ?? null);
  const [name, setName] = useState("");
  const tabParam = (sp?.get("tab") ?? "profile") as Tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? tabParam : "profile";
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (id) return;
    lx<Listing>("/institutions")
      .then((r) => {
        if (r.items[0]) setId(r.items[0].id);
        else fail("Add an institution first.");
      })
      .catch((e) => fail(errMsg(e, "Could not load institutions")));
  }, [id, fail]);
  useEffect(() => {
    if (!id) return;
    lx<Row>(`/institutions/${id}`)
      .then((r) => setName(str(r.name)))
      .catch((e) => fail(errMsg(e, "Could not load institution")));
  }, [id, fail]);

  const go = (t: Tab) => {
    if (t === tab) return;
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    setDirty(false);
    clear();
    router.replace(`${BASE}/manage?id=${id}&tab=${t}`);
  };

  return (
    <SuperFrame title={`Manage Institution${name ? `: ${name}` : ""}`} breadcrumbs={[...CRUMB, "Manage Institution"]} activeHref={BASE}>
      <div className="lx">
        {notice.node}
        <nav className="lx-tabs" role="tablist" aria-label="Institution sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`lx-tab${tab === t.key ? " is-active" : ""}`} onClick={() => go(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        {!id ? null : tab === "profile" ? (
          <ProfileTab
            key={id}
            id={id}
            onDirty={setDirty}
            onSaved={(n, m) => {
              setName(n);
              ok(m);
            }}
            onError={fail}
          />
        ) : tab === "agreements" ? (
          <AgreementsTab key={id} institutionId={id} onOk={ok} onError={fail} onDirty={setDirty} />
        ) : tab === "bridge" ? (
          <BridgeTab key={id} institutionId={id} onOk={ok} onError={fail} onDirty={setDirty} />
        ) : (
          <CoursesTab key={id} institutionId={id} autoAdd={sp?.get("add") === "1"} onOk={ok} onError={fail} />
        )}
        <div className="lx-back">
          <Link className="mh-sa__link" href={BASE}>
            « Back to Manage Institutions
          </Link>
        </div>
      </div>
    </SuperFrame>
  );
}

/* Screen 24 — Institution Profile */

function ProfileTab({ id, onDirty, onSaved, onError }: { id: string; onDirty: (d: boolean) => void; onSaved: (name: string, m: string) => void; onError: (m: string) => void }) {
  const form = useEntityForm("institutions", id);
  useLeaveGuard(form.dirty);
  useEffect(() => onDirty(form.dirty), [form.dirty, onDirty]);
  if (form.loadError) return <SaNotice tone="error">{form.loadError}</SaNotice>;
  if (!form.values) return <p className="mh-sa__muted">Loading…</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => onSaved(str(form.values?.name), out.message))
          .catch((err) => onError(errMsg(err, "Save failed")));
      }}
    >
      <EntitySections form={form} title="Institution Profile" />
      <div className="mh-sa__actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Save Institution
        </button>
      </div>
    </form>
  );
}

/* Screens 25 / 26 — Agreements & Contracts */

function AgreementsTab({ institutionId, onOk, onError, onDirty }: { institutionId: string; onOk: (m: string) => void; onError: (m: string) => void; onDirty: (d: boolean) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    lx<Listing>(`/agreements?parentId=${institutionId}`)
      .then((r) => setRows(r.items))
      .catch((e) => onError(errMsg(e, "Could not load agreements")));
  }, [institutionId, onError]);
  useEffect(load, [load]);

  if (editing)
    return (
      <AgreementForm
        institutionId={institutionId}
        id={editing === "new" ? null : editing}
        onDirty={onDirty}
        onCancel={() => (onDirty(false), setEditing(null))}
        onSaved={(m) => {
          onDirty(false);
          setEditing(null);
          onOk(m);
          load();
        }}
        onError={onError}
      />
    );

  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Agreements & Contracts</h2>
        <button type="button" className="mh-sa__btn mh-sa__btn--primary mh-sa__btn--sm" onClick={() => setEditing("new")}>
          New Agreement
        </button>
      </div>
      {!rows ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Agreement Status</th>
                <th>Programs</th>
                <th>Agreement Dates</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className={`mh-sa__pill${r.status === "Active" ? " mh-sa__pill--ok" : ""}`}>{str(r.status)}</span>
                  </td>
                  <td>{Array.isArray(r.programs) && r.programs.length ? (r.programs as string[]).join(", ") : "All Programs"}</td>
                  <td>
                    {str(r.startDate)} – {r.openEnded ? "Open-ended" : str(r.endDate)}
                    {Array.isArray(r.documents) && r.documents.length ? <div className="mh-sa__muted lx-sub">{r.documents.length} document(s)</div> : null}
                  </td>
                  <td className="lx-actions">
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setEditing(r.id)}>
                      Edit
                    </button>
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="mh-sa__empty-cell">
                    No agreements were found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {confirm ? (
        <ConfirmDelete
          title="Delete agreement"
          body={`Delete the agreement starting ${str(confirm.startDate)}?`}
          okLabel="Delete Agreement"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            lx<{ message: string }>(`/agreements/${r.id}`, { method: "DELETE" })
              .then((out) => {
                onOk(out.message);
                load();
              })
              .catch((e) => onError(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </section>
  );
}

function AgreementForm({
  institutionId,
  id,
  onDirty,
  onCancel,
  onSaved,
  onError,
}: {
  institutionId: string;
  id: string | null;
  onDirty: (d: boolean) => void;
  onCancel: () => void;
  onSaved: (m: string) => void;
  onError: (m: string) => void;
}) {
  const form = useEntityForm("agreements", id, { parentId: institutionId });
  useLeaveGuard(form.dirty);
  useEffect(() => onDirty(form.dirty), [form.dirty, onDirty]);
  if (!form.values || !form.meta) return <p className="mh-sa__muted">Loading…</p>;
  const details = form.fields.filter((f) => f.key !== "documents");
  const docs = form.fields.filter((f) => f.key === "documents");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => onSaved(out.message))
          .catch((err) => onError(errMsg(err, "Save failed")));
      }}
    >
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>{id ? "Edit Agreement" : "New Agreement"}</h2>
        </div>
        <FieldGrid fields={details} values={form.values} setValue={form.setValue} meta={form.meta} />
      </section>
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>Agreement Documents / Supporting Files</h2>
        </div>
        <FieldGrid fields={docs.map((f) => ({ ...f, label: "Files" }))} values={form.values} setValue={form.setValue} meta={form.meta} />
      </section>
      <div className="mh-sa__actions">
        <button type="button" className="mh-sa__btn" onClick={onCancel}>
          « Back to Agreements
        </button>
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Save Agreement
        </button>
      </div>
    </form>
  );
}

/* Screens 27 / 28 — Bridge & Qualifying Programs */

function BridgeTab({ institutionId, onOk, onError, onDirty }: { institutionId: string; onOk: (m: string) => void; onError: (m: string) => void; onDirty: (d: boolean) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    lx<Listing>(`/bridge-programs?parentId=${institutionId}&q=${encodeURIComponent(applied)}`)
      .then((r) => setRows(r.items))
      .catch((e) => onError(errMsg(e, "Could not load programs")));
  }, [institutionId, applied, onError]);
  useEffect(load, [load]);

  if (editing)
    return (
      <BridgeForm
        institutionId={institutionId}
        id={editing === "new" ? null : editing}
        onDirty={onDirty}
        onCancel={() => (onDirty(false), setEditing(null))}
        onSaved={(m) => {
          onDirty(false);
          setEditing(null);
          onOk(m);
          load();
        }}
        onError={onError}
      />
    );

  return (
    <>
      <section className="mh-sa__card">
        <div className="lx-toolbar">
          <FilterBar label="Program Name" placeholder="Enter bridge/qualifying program name" value={q} onChange={setQ} submitLabel="Search Programs" onSubmit={() => setApplied(q.trim())} />
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setEditing("new")}>
            New Bridge / Qualifying Program
          </button>
        </div>
      </section>
      <section className="mh-sa__card">
        {!rows ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Bridged Program</th>
                  <th>Institution&rsquo;s Program</th>
                  <th>Status</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {str(r.equivalentProgram)}
                      {r.equivalentPathway ? <div className="mh-sa__muted lx-sub">Pathway: {str(r.equivalentPathway)}</div> : null}
                    </td>
                    <td>
                      {str(r.name)}
                      {r.credits !== null && r.credits !== undefined && r.credits !== "" ? <div className="mh-sa__muted lx-sub">{str(r.credits)} credits</div> : null}
                    </td>
                    <td>{str(r.status)}</td>
                    <td className="lx-actions">
                      <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setEditing(r.id)}>
                        Edit
                      </button>
                      <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="mh-sa__empty-cell">
                      No bridge / qualifying programs were found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {confirm ? (
        <ConfirmDelete
          title="Delete bridge / qualifying program"
          body={`Delete "${str(confirm.name)}"?`}
          okLabel="Delete Program"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            lx<{ message: string }>(`/bridge-programs/${r.id}`, { method: "DELETE" })
              .then((out) => {
                onOk(out.message);
                load();
              })
              .catch((e) => onError(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </>
  );
}

function BridgeForm({
  institutionId,
  id,
  onDirty,
  onCancel,
  onSaved,
  onError,
}: {
  institutionId: string;
  id: string | null;
  onDirty: (d: boolean) => void;
  onCancel: () => void;
  onSaved: (m: string) => void;
  onError: (m: string) => void;
}) {
  const form = useEntityForm("bridgePrograms", id, { parentId: institutionId });
  useLeaveGuard(form.dirty);
  useEffect(() => onDirty(form.dirty), [form.dirty, onDirty]);
  if (!form.values) return <p className="mh-sa__muted">Loading…</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => onSaved(out.message))
          .catch((err) => onError(errMsg(err, "Save failed")));
      }}
    >
      <h2 className="lx-subtitle">{id ? "Edit Bridge / Qualifying Program" : "New Bridge / Qualifying Program"}</h2>
      <EntitySections form={form} />
      <div className="mh-sa__actions">
        <button type="button" className="mh-sa__btn" onClick={onCancel}>
          « Back to Bridge & Qualifying Programs
        </button>
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Save Bridge / Qualifying Program
        </button>
      </div>
    </form>
  );
}

/* Screens 29 / 30 — Courses Equivalencies + Add Transfer Course popup */

function CoursesTab({ institutionId, autoAdd, onOk, onError }: { institutionId: string; autoAdd: boolean; onOk: (m: string) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [data, setData] = useState<Listing | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(autoAdd ? "new" : null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    const qs = new URLSearchParams({ parentId: institutionId, q: applied, page: String(page), perPage: String(perPage) }).toString();
    lx<Listing>(`/transfer-courses?${qs}`)
      .then(setData)
      .catch((e) => onError(errMsg(e, "Could not load transfer courses")));
  }, [institutionId, applied, page, perPage, onError]);
  useEffect(load, [load]);

  return (
    <>
      <section className="mh-sa__card">
        <div className="lx-toolbar">
          <FilterBar
            label="Name Filter"
            value={q}
            onChange={setQ}
            submitLabel="Search Transfer Courses"
            onSubmit={() => {
              setPage(1);
              setApplied(q.trim());
            }}
          />
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setEditing("new")}>
            Add Transfer Course
          </button>
        </div>
      </section>
      <section className="mh-sa__card">
        {!data ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <Pager total={data.total} page={data.page} pages={data.pages} perPage={perPage} onPage={setPage} onPerPage={(n) => (setPerPage(n), setPage(1))} />
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Equivalent Course</th>
                    <th>Transfer Course</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>{str(r._equivalentLabel)}</td>
                      <td>
                        <strong>{str(r.number)}</strong> {str(r.name)}
                        <div className="mh-sa__muted lx-sub">
                          {[r.credits !== null && r.credits !== "" && r.credits !== undefined ? `${str(r.credits)} credits` : "", r.lengthValue ? `${str(r.lengthValue)} ${str(r.lengthUnit)}` : "", str(r.countCredits)]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      </td>
                      <td className="lx-actions">
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setEditing(r.id)}>
                          Edit
                        </button>
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="mh-sa__empty-cell">
                        No transfer courses were found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      {editing ? (
        <TransferCourseModal
          institutionId={institutionId}
          id={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            onOk(m);
            load();
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmDelete
          title="Delete transfer course"
          body={`Delete the transfer course "${str(confirm.number)} ${str(confirm.name)}"?`}
          okLabel="Delete Transfer Course"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            lx<{ message: string }>(`/transfer-courses/${r.id}`, { method: "DELETE" })
              .then((out) => {
                onOk(out.message);
                load();
              })
              .catch((e) => onError(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </>
  );
}

function TransferCourseModal({ institutionId, id, onClose, onSaved }: { institutionId: string; id: string | null; onClose: () => void; onSaved: (m: string) => void }) {
  const form = useEntityForm("transferCourses", id, { parentId: institutionId });
  const [error, setError] = useState<string | null>(null);
  const details = form.fields.filter((f) => f.section === "Transfer Course Details");
  const settings = form.fields.filter((f) => f.section === "Transfer Course Settings");
  return (
    <SaModal
      title={id ? "Edit Transfer Course" : "Add Transfer Course"}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={form.busy || !form.values}
          onClick={() =>
            form
              .save()
              .then((out) => onSaved(out.message))
              .catch((e) => setError(errMsg(e, "Save failed")))
          }
        >
          Save Transfer Course
        </button>
      }
    >
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {form.loadError ? <SaNotice tone="error">{form.loadError}</SaNotice> : null}
      {!form.meta || !form.values ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <>
          <h3 className="lx-modal-sub">Transfer Course Details</h3>
          <FieldGrid fields={details} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} />
          <h3 className="lx-modal-sub">Transfer Course Settings</h3>
          <FieldGrid fields={settings} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} />
        </>
      )}
    </SaModal>
  );
}

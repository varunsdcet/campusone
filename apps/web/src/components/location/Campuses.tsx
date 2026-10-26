"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { EntitySections, useEntityForm, useLeaveGuard } from "./forms";
import { ConfirmDelete, FieldGrid, errMsg, lx, str, useNotice, type Listing, type Row } from "./shared";

const BASE = "/admin/location/campuses";
const CRUMB = ["Home", "Location Management", "Campuses & Classrooms"];

type Directory = {
  brands: Array<{ id: string; name: string }>;
  regions: Array<{ id: string; name: string }>;
  classroomTypes: Array<{ id: string; name: string; abbreviation: string }>;
  campuses: Array<{
    id: string;
    name: string;
    display: string;
    active: string;
    address: string;
    classrooms: Array<{ id: string; name: string; type: string; seats: unknown; active: string }>;
  }>;
};

/* ------------------------------------------------------------------ */
/* Screen 14 — Manage Campuses & Classrooms                             */
/* ------------------------------------------------------------------ */

export function ManageCampuses() {
  const router = useRouter();
  const sp = useSearchParams();
  const notice = useNotice();
  const { fail, ok } = notice;
  const [brand, setBrand] = useState("");
  const [region, setRegion] = useState("");
  const [data, setData] = useState<Directory | null>(null);
  const [types, setTypes] = useState(sp?.get("types") === "1");
  const [confirm, setConfirm] = useState<{ kind: "campus" | "classroom"; id: string; name: string; rooms?: number } | null>(null);

  const summary = useMemo(() => {
    const campuses = data?.campuses ?? [];
    const classrooms = campuses.flatMap((campus) => campus.classrooms);
    return {
      campuses: campuses.length,
      activeCampuses: campuses.filter((campus) => campus.active === "Active").length,
      classrooms: classrooms.length,
      seats: classrooms.reduce((total, classroom) => total + (Number(classroom.seats) || 0), 0),
    };
  }, [data]);

  const filtered = Boolean(brand || region);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ ...(brand ? { brand } : {}), ...(region ? { region } : {}) }).toString();
    lx<Directory>(`/campus-directory${qs ? `?${qs}` : ""}`)
      .then(setData)
      .catch((e) => fail(errMsg(e, "Could not load campuses")));
  }, [brand, region, fail]);
  useEffect(load, [load]);

  return (
    <SuperFrame
      title="Manage Campuses & Classrooms"
      breadcrumbs={CRUMB}
      activeHref={BASE}
      actions={
        <>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${BASE}/new`}>
            Create Campus
          </Link>
          <Link className="mh-sa__btn" href="/admin/location/classrooms/new">
            Create Classroom
          </Link>
          <button type="button" className="mh-sa__btn" onClick={() => setTypes(true)}>
            Classroom Types
          </button>
        </>
      }
    >
      <div className="lx lx-campus-directory">
        {notice.node}
        <section className="lx-campus-hero" aria-label="Campus directory overview">
          <div className="lx-campus-hero__copy">
            <span className="lx-campus-hero__eyebrow">Location network</span>
            <h2>Every campus and learning space, in one place.</h2>
            <p>Manage campus identity, capacity and classrooms without losing sight of the wider institution.</p>
          </div>
          <div className="lx-campus-stats">
            <div className="lx-campus-stat"><span>Campuses</span><strong>{data ? summary.campuses : "—"}</strong><small>{data ? `${summary.activeCampuses} active` : "Loading directory"}</small></div>
            <div className="lx-campus-stat"><span>Classrooms</span><strong>{data ? summary.classrooms : "—"}</strong><small>Across visible campuses</small></div>
            <div className="lx-campus-stat"><span>Total seats</span><strong>{data ? summary.seats.toLocaleString("en-CA") : "—"}</strong><small>Configured capacity</small></div>
          </div>
        </section>

        <section className="mh-sa__card lx-campus-filter-card">
          <div className="lx-campus-filter-card__head">
            <div>
              <span className="lx-campus-section-label">Directory filters</span>
              <p>{data ? `${summary.campuses} campus${summary.campuses === 1 ? "" : "es"} shown` : "Loading campuses…"}</p>
            </div>
            {filtered ? (
              <button type="button" className="lx-campus-clear" onClick={() => { setBrand(""); setRegion(""); }}>
                Clear filters
              </button>
            ) : null}
          </div>
          <div className="lx-filters lx-campus-filters">
            <label className="mh-sa__field">
              <span className="mh-sa__label">Filter Brands</span>
              <select className="mh-sa__input" value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="">All Brands</option>
                {data?.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mh-sa__field">
              <span className="mh-sa__label">Filter Regions</span>
              <select className="mh-sa__input" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="">All Regions</option>
                {data?.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {!data ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : data.campuses.length === 0 ? (
          <section className="mh-sa__card">
            <p className="mh-sa__muted">{brand || region ? "No campuses match these filters." : "No campuses have been created yet."}</p>
          </section>
        ) : (
          data.campuses.map((c) => (
            <section key={c.id} className="mh-sa__card lx-campus">
              <div className="lx-campus__head">
                <div className="lx-campus__identity">
                  <span className="lx-campus__mark" aria-hidden>{c.name.trim().charAt(0).toUpperCase() || "C"}</span>
                  <div>
                  <span className="lx-campus-section-label">Campus location</span>
                  <h2>{c.display}</h2>
                  <div className="lx-campus__meta">
                    <span className={`lx-campus-status${c.active === "Active" ? " is-active" : ""}`}><i aria-hidden />{c.active}</span>
                    <span className="lx-campus__address">{c.address || "Address not added"}</span>
                  </div>
                  </div>
                </div>
                <div className="lx-actions">
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${BASE}/edit?id=${c.id}`)}>
                    Edit
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ kind: "campus", id: c.id, name: c.display, rooms: c.classrooms.length })}>
                    Delete
                  </button>
                </div>
              </div>
              <div className="lx-campus__summary">
                <div><span>Classrooms</span><strong>{c.classrooms.length}</strong></div>
                <div><span>Active rooms</span><strong>{c.classrooms.filter((room) => room.active !== "Inactive").length}</strong></div>
                <div><span>Seat capacity</span><strong>{c.classrooms.reduce((total, room) => total + (Number(room.seats) || 0), 0).toLocaleString("en-CA")}</strong></div>
              </div>
              {c.classrooms.length === 0 ? (
                <p className="mh-sa__muted lx-campus__empty">
                  No classrooms have been assigned to this campus.{" "}
                  <Link className="mh-sa__link" href={`/admin/location/classrooms/new?campus=${c.id}`}>
                    Create Classroom
                  </Link>
                </p>
              ) : (
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table lx-table">
                    <thead>
                      <tr>
                        <th>Room Name / Number</th>
                        <th>Type</th>
                        <th>Seats</th>
                        <th>Active</th>
                        <th className="lx-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {c.classrooms.map((r) => (
                        <tr key={r.id}>
                          <td data-label="Room"><span className="lx-room-name">{r.name}</span></td>
                          <td data-label="Type">{r.type || "—"}</td>
                          <td data-label="Seats"><span className="lx-room-capacity">{str(r.seats) || "—"}</span></td>
                          <td data-label="Status"><span className={`lx-room-status${r.active === "Inactive" ? " is-inactive" : ""}`}><i aria-hidden />{r.active === "Inactive" ? "Inactive" : "Active"}</span></td>
                          <td className="lx-actions" data-label="Actions">
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`/admin/location/classrooms/edit?id=${r.id}`)}>
                              Edit
                            </button>
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ kind: "classroom", id: r.id, name: `${r.name} (${c.display})` })}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))
        )}

        {types ? (
          <ClassroomTypesModal
            onClose={() => setTypes(false)}
            onChanged={(m) => {
              ok(m);
              load();
            }}
          />
        ) : null}
        {confirm ? (
          <ConfirmDelete
            title={confirm.kind === "campus" ? "Delete campus" : "Delete classroom"}
            body={
              confirm.kind === "campus"
                ? `Delete the campus "${confirm.name}"?${confirm.rooms ? ` Its ${confirm.rooms} classroom(s) will also be deleted.` : ""}`
                : `Delete the classroom "${confirm.name}"?`
            }
            okLabel={confirm.kind === "campus" ? "Delete Campus" : "Delete Classroom"}
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const c = confirm;
              setConfirm(null);
              lx<{ message: string }>(`/${c.kind === "campus" ? "campuses" : "classrooms"}/${c.id}`, { method: "DELETE" })
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
/* Screens 18 / 19 — Classroom Types popup (list → create / edit)       */
/* ------------------------------------------------------------------ */

function ClassroomTypesModal({ onClose, onChanged }: { onClose: () => void; onChanged: (m: string) => void }) {
  const [view, setView] = useState<"list" | "new" | string>("list");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    lx<Listing>("/classroom-types")
      .then((r) => setRows(r.items))
      .catch((e) => setError(errMsg(e, "Could not load classroom types")));
  }, []);
  useEffect(load, [load]);

  if (view !== "list")
    return (
      <ClassroomTypeForm
        id={view === "new" ? null : view}
        onClose={onClose}
        onBack={() => setView("list")}
        onSaved={(m) => {
          onChanged(m);
          load();
          setView("list");
        }}
      />
    );

  return (
    <SaModal
      title="Classroom Types"
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setView("new")}>
          New Classroom Type
        </button>
      }
    >
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {!rows ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="lx-empty-msg">No classroom types were found.</p>
      ) : (
        <table className="mh-sa__table lx-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Abbreviation</th>
              <th className="lx-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{str(r.name)}</td>
                <td>{str(r.abbreviation)}</td>
                <td className="lx-actions">
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setView(r.id)}>
                    Edit
                  </button>
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {confirm ? (
        <div className="lx-inline-confirm" role="alertdialog" aria-label="Delete classroom type">
          <span>Delete the classroom type “{str(confirm.name)}”?</span>
          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger"
            onClick={() => {
              const r = confirm;
              setConfirm(null);
              lx<{ message: string }>(`/classroom-types/${r.id}`, { method: "DELETE" })
                .then((out) => {
                  onChanged(out.message);
                  load();
                })
                .catch((e) => setError(errMsg(e, "Delete failed")));
            }}
          >
            Delete Type
          </button>
        </div>
      ) : null}
    </SaModal>
  );
}

function ClassroomTypeForm({ id, onClose, onBack, onSaved }: { id: string | null; onClose: () => void; onBack: () => void; onSaved: (m: string) => void }) {
  const form = useEntityForm("classroomTypes", id);
  const [error, setError] = useState<string | null>(null);
  return (
    <SaModal
      title={id ? "Edit Classroom Type" : "Create Classroom Type"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="mh-sa__link lx-back-link" onClick={onBack}>
            « Back to Classroom Types
          </button>
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
            Save Classroom Type
          </button>
        </>
      }
    >
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {!form.meta || !form.values ? <p className="mh-sa__muted">Loading…</p> : <FieldGrid fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} />}
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 15 — Add / Edit Campus                                        */
/* ------------------------------------------------------------------ */

export function CampusForm({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm("campuses", id, { firstRef: "brand" });
  useLeaveGuard(form.dirty && !form.busy);

  const title = mode === "create" ? "Add Campus" : `Edit Campus${form.record ? `: ${str(form.record._display || form.record.name)}` : ""}`;
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, mode === "create" ? "Add Campus" : "Edit Campus"]} activeHref={BASE}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${BASE}?notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError ? <SaNotice tone="error">{form.metaError}</SaNotice> : null}
        {form.loadError ? <SaNotice tone="error">{form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values ? <p className="mh-sa__muted">Loading…</p> : <EntitySections form={form} accept={{ logo: "image/*" }} />}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={BASE}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Campus
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 16 / 17 — Add / Edit Classroom                               */
/* ------------------------------------------------------------------ */

export function ClassroomForm({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm("classrooms", id, { defaults: sp?.get("campus") ? { campus: sp.get("campus") } : undefined });
  useLeaveGuard(form.dirty && !form.busy);
  const hasTypes = (form.refs.classroomTypes?.length ?? 0) > 0 || Boolean(form.values?.type);
  const fields = form.fields.filter((f) => f.key !== "type" || hasTypes);

  return (
    <SuperFrame title={mode === "create" ? "Add Classroom" : "Edit Classroom"} breadcrumbs={[...CRUMB, mode === "create" ? "Add Classroom" : "Edit Classroom"]} activeHref={BASE}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${BASE}?notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError ? <SaNotice tone="error">{form.metaError}</SaNotice> : null}
        {form.loadError ? <SaNotice tone="error">{form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Classroom Details</h2>
              </div>
              <FieldGrid fields={fields} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} />
            </section>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Resources</h2>
              </div>
              <p className="mh-sa__muted">No resource types have been created in the system yet.</p>
            </section>
          </>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={BASE}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Classroom
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

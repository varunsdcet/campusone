"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { FilterBar, useNotice } from "@/components/location/shared";
import {
  Actions,
  BASE,
  Btn,
  Confirm,
  Empty,
  RowModal,
  Sections,
  Tabs,
  errMsg,
  pm,
  send,
  str,
  useDragOrder,
  useEntityForm,
  useLeaveGuard,
  type Data,
  type Field,
  type Listing,
  type Meta,
  type Row,
} from "./kit";
import { AuditTab, CommissionsTab, DeadlinesTab, FeesPanel, PathwayTab } from "./ProgramTabs";

const FAC = `${BASE}/faculties`;
const TYPES = `${BASE}/program-types`;
const CRUMB = ["Home", "Program Management"];

/* ------------------------------------------------------------------ */
/* Manage Faculties & Programs                                          */
/* ------------------------------------------------------------------ */

type Dir = { faculties: Array<{ id: string; name: string; abbreviation: string; active: string; programs: Array<{ id: string; name: string; abbreviation: string; active: string }> }> };

export function FacultiesDirectory() {
  const notice = useNotice();
  const { ok, fail } = notice;
  const [dir, setDir] = useState<Dir | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "faculty" | "program"; id: string; name: string }>(null);
  const load = useCallback(() => {
    pm<Dir>("/directory")
      .then(setDir)
      .catch((e) => fail(errMsg(e, "Could not load faculties")));
  }, [fail]);
  useEffect(load, [load]);

  const remove = (kind: "faculties" | "programs", id: string) =>
    send(`/e/${kind}/${id}`, "DELETE")
      .then((out) => {
        ok(out.message);
        load();
      })
      .catch((e) => (kind === "faculties" ? setBlocked(errMsg(e, "Delete failed")) : fail(errMsg(e, "Delete failed"))));

  return (
    <SuperFrame
      title="Manage Faculties & Programs"
      breadcrumbs={[...CRUMB, "Faculties & Programs"]}
      activeHref={FAC}
      actions={
        <>
          <Link className="mh-sa__btn" href={`${FAC}/faculty-new`}>
            Create Faculty
          </Link>
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${FAC}/program-new`}>
            Create Program
          </Link>
        </>
      }
    >
      <div className="lx">
        {notice.node}
        {!dir ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : dir.faculties.length === 0 ? (
          <section className="mh-sa__card">
            <Empty>No faculties have been created yet.</Empty>
          </section>
        ) : (
          dir.faculties.map((f) => (
            <section key={f.id} className="mh-sa__card pm-faculty">
              <div className="mh-sa__card-head">
                <h2>
                  {f.name}
                  {f.abbreviation ? <span className="mh-sa__muted"> ({f.abbreviation})</span> : null}{" "}
                  <span className={`pm-status pm-status--${f.active === "Active" ? "on" : "off"}`}>{f.active}</span>
                </h2>
                <Actions>
                  <Link className="mh-sa__btn mh-sa__btn--sm" href={`${FAC}/faculty-edit?id=${f.id}`}>
                    Edit
                  </Link>
                  <Btn
                    tone="danger"
                    onClick={() =>
                      f.programs.length
                        ? setBlocked(`The faculty "${f.name}" cannot be deleted while programs, categories and/or students are assigned to it (${f.programs.length} program${f.programs.length === 1 ? "" : "s"}).`)
                        : setConfirm({ kind: "faculty", id: f.id, name: f.name })
                    }
                  >
                    Delete
                  </Btn>
                </Actions>
              </div>
              {f.programs.length ? (
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table lx-table">
                    <thead>
                      <tr>
                        <th>Program Name</th>
                        <th>Abbreviation</th>
                        <th>Active</th>
                        <th className="lx-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {f.programs.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <Link className="mh-sa__link" href={`${FAC}/program?id=${p.id}`}>
                              {p.name}
                            </Link>
                          </td>
                          <td>{p.abbreviation}</td>
                          <td>{p.active === "Active" ? "Yes" : "No"}</td>
                          <td className="lx-actions">
                            <Link className="mh-sa__btn mh-sa__btn--sm" href={`${FAC}/program?id=${p.id}`}>
                              Settings
                            </Link>
                            <Btn tone="danger" onClick={() => setConfirm({ kind: "program", id: p.id, name: p.name })}>
                              Delete
                            </Btn>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No programs are assigned to this faculty.</Empty>
              )}
            </section>
          ))
        )}
        {blocked ? (
          <SaModal title="Delete Faculty" onClose={() => setBlocked(null)}>
            <p className="pm-warn">{blocked}</p>
          </SaModal>
        ) : null}
        {confirm ? (
          <Confirm
            title={`Delete ${confirm.kind === "faculty" ? "Faculty" : "Program"}: ${confirm.name}`}
            body={confirm.kind === "program" ? `Delete the program "${confirm.name}" with its pathways, fees, deadlines and commission rates? Programs with student or schedule records cannot be deleted.` : `Delete the faculty "${confirm.name}"?`}
            okLabel={confirm.kind === "faculty" ? "Delete Faculty" : "Delete Program"}
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const c = confirm;
              setConfirm(null);
              void remove(c.kind === "faculty" ? "faculties" : "programs", c.id);
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Add / Edit Faculty and Program Type (same simple page pattern)        */
/* ------------------------------------------------------------------ */

function SimplePage({ entity, mode, base, crumb, addTitle, editTitle, saveLabel, list, refreshAfterCreate = false }: { entity: string; mode: "create" | "edit"; base: string; crumb: string; addTitle: string; editTitle: string; saveLabel: string; list: string; refreshAfterCreate?: boolean }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm(entity, id);
  useLeaveGuard(form.dirty && !form.busy);
  const name = str(form.record?.name);
  return (
    <SuperFrame title={mode === "create" ? addTitle : `${editTitle}: ${name}`} breadcrumbs={[...CRUMB, crumb, mode === "create" ? addTitle : editTitle]} breadcrumbHrefs={[null, null, list]} activeHref={base}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => {
              if (mode === "create" && refreshAfterCreate) {
                const cleanUrl = `${window.location.pathname}?notice=${encodeURIComponent(out.message)}`;
                window.location.assign(cleanUrl);
                return;
              }
              router.push(`${list}?notice=${encodeURIComponent(out.message)}`);
            })
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError || form.loadError ? <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <div className="lx-narrow">
            <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} />
          </div>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={list}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            {saveLabel}
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

export function FacultyForm({ mode }: { mode: "create" | "edit" }) {
  return <SimplePage entity="faculties" mode={mode} base={FAC} list={FAC} crumb="Faculties & Programs" addTitle="Add Faculty" editTitle="Edit Faculty" saveLabel="Save Faculty" refreshAfterCreate />;
}

export function ProgramTypeForm({ mode }: { mode: "create" | "edit" }) {
  return <SimplePage entity="programTypes" mode={mode} base={TYPES} list={TYPES} crumb="Program Types" addTitle="Add Program Type" editTitle="Edit Program Type" saveLabel="Save Program Type" />;
}

/* ------------------------------------------------------------------ */
/* Manage Program Types                                                 */
/* ------------------------------------------------------------------ */

export function ProgramTypes() {
  const router = useRouter();
  const notice = useNotice();
  const { ok, fail } = notice;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    pm<Listing>("/e/programTypes")
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load program types")));
  }, [fail]);
  useEffect(load, [load]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !n || [r.name, r.abbreviation].some((v) => str(v).toLowerCase().includes(n)));
  }, [rows, q]);
  const drag = useDragOrder(rows ?? [], (ids) => {
    setRows((rs) => (rs ? ids.map((id) => rs.find((r) => r.id === id)!) : rs));
    send("/e/programTypes/order", "PUT", { ids })
      .then((out) => ok(out.message))
      .catch((e) => {
        fail(errMsg(e, "Could not save the order"));
        load();
      });
  });
  return (
    <SuperFrame
      title="Manage Program Types"
      breadcrumbs={[...CRUMB, "Program Types"]}
      activeHref={TYPES}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${TYPES}/new`}>
          Create Program Type
        </Link>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          <FilterBar value={q} onChange={setQ} />
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th className="pm-handle-col" aria-label="Order" />
                    <th>Program Type Name</th>
                    <th>Abbreviation</th>
                    <th>Active</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} {...(q ? {} : drag.rowProps(r))}>
                      <td>{q ? null : drag.handle(r, str(r.name))}</td>
                      <td>{str(r.name)}</td>
                      <td>{str(r.abbreviation)}</td>
                      <td>{r.active === "Active" ? "Yes" : "No"}</td>
                      <td className="lx-actions">
                        <Btn onClick={() => router.push(`${TYPES}/edit?id=${r.id}`)}>Edit</Btn>
                        <Btn tone="danger" onClick={() => setConfirm(r)}>
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="mh-sa__empty-cell">
                        {q ? "No program types match this filter." : "No program types have been created yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
          {q && rows?.length ? <p className="mh-sa__muted pm-note">Clear the filter to reorder program types.</p> : null}
        </section>
        {confirm ? (
          <Confirm
            title={`Delete Program Type: ${str(confirm.name)}`}
            body={`Delete the program type "${str(confirm.name)}"?`}
            okLabel="Delete Program Type"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              send(`/e/programTypes/${r.id}`, "DELETE")
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
/* Program: Add Program / Program Settings + 6 tabs                     */
/* ------------------------------------------------------------------ */

const PROGRAM_TABS: Array<[string, string]> = [
  ["settings", "Program Settings"],
  ["pathway", "Program Pathway"],
  ["fees", "Fees & Tuition Price List"],
  ["deadlines", "Deadlines & Penalties"],
  ["commissions", "Commission Rates"],
  ["audit", "Audit Changes"],
];

export function ProgramPage({ mode }: { mode: "create" | "edit" }) {
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const tab = (mode === "edit" && sp?.get("tab")) || "settings";
  const [name, setName] = useState("");
  useEffect(() => {
    if (id) pm<Row>(`/e/programs/${id}`).then((r) => setName(str(r.name)), () => undefined);
  }, [id, tab]);
  const title = mode === "create" ? "Add Program" : `${PROGRAM_TABS.find(([k]) => k === tab)?.[1] ?? "Program Settings"}: ${name}`;
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, "Faculties & Programs", mode === "create" ? "Add Program" : name || "Program"]} breadcrumbHrefs={[null, null, FAC]} activeHref={FAC}>
      <div className="lx">
        <Tabs tabs={PROGRAM_TABS} active={tab} hrefOf={(k) => (id ? `${FAC}/program?id=${id}&tab=${k}` : `${FAC}/program-new`)} disabled={!id} />
        {tab === "settings" ? <ProgramSettings id={id} onName={setName} /> : null}
        {id && tab === "pathway" ? <PathwayTab programId={id} /> : null}
        {id && tab === "fees" ? <FeesPanel parentId={id} termEntity="feeTerms" feeEntity="fees" amountLabel="Default Fees" empty="No ledger or tuition types currently exist for this program." /> : null}
        {id && tab === "deadlines" ? <DeadlinesTab programId={id} /> : null}
        {id && tab === "commissions" ? <CommissionsTab programId={id} /> : null}
        {id && tab === "audit" ? <AuditTab programId={id} /> : null}
      </div>
    </SuperFrame>
  );
}

function designationCondition(d: Data) {
  const bits = [d.averageCondition ? str(d.averageCondition) : "", d.failingGrades && d.failingGrades !== "Ignore Fails" ? `${str(d.failingGrades)} failing grade(s)` : ""].filter(Boolean);
  return bits.join("; ") || "—";
}
function designationRequirement(d: Data) {
  const bits = [
    d.requiredAverage !== null && d.requiredAverage !== undefined && d.requiredAverage !== "" ? `Average ${str(d.requiredAverage)}` : "",
    Number(d.coursesCompleted) ? `${str(d.coursesCompleted)} course(s) completed` : "",
    Number(d.termsCompleted) ? `${str(d.termsCompleted)} term(s) completed` : "",
  ].filter(Boolean);
  return bits.join(", ") || "—";
}

function ProgramSettings({ id, onName }: { id: string | null; onName: (n: string) => void }) {
  const sp = useSearchParams();
  const notice = useNotice();
  const facultyId = sp?.get("faculty") ?? "";
  const form = useEntityForm("programs", id, { defaults: facultyId ? { faculty: facultyId } : undefined });
  useLeaveGuard(form.dirty && !form.busy);
  const [editing, setEditing] = useState<Data | null | "new">(null);
  const [deleting, setDeleting] = useState<Data | null>(null);
  useEffect(() => {
    if (form.record) onName(str(form.record.name));
  }, [form.record, onName]);
  if (form.metaError || form.loadError) return <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice>;
  if (!form.values || !form.meta) return <p className="mh-sa__muted">Loading…</p>;
  const meta = form.meta;
  const designations = (Array.isArray(form.values.designations) ? form.values.designations : []) as Data[];
  const rowFields = form.fields.find((f) => f.key === "designations")?.rowFields ?? [];
  const rowMeta = (current: Data | null): Meta => ({
    ...meta,
    lists: { ...meta.lists, designationLabels: designations.filter((d) => d.id !== current?.id).map((d) => str(d.label)).filter(Boolean) },
  });
  const setDesignations = (next: Data[]) => form.setValue("designations", next);
  return (
    <form
      className="lx"
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => {
            if (!id) {
              const cleanUrl = `${window.location.pathname}?notice=${encodeURIComponent(out.message)}`;
              window.location.assign(cleanUrl);
              return;
            }
            notice.ok(out.message);
          })
          .catch((err) => notice.fail(errMsg(err, "Save failed")));
      }}
    >
      {notice.node}
      <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={meta} />
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>Designations</h2>
          <Btn onClick={() => setEditing("new")}>Add Designation</Btn>
        </div>
        {designations.length ? (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Condition</th>
                  <th>Requirement</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {designations.map((d) => (
                  <tr key={str(d.id)}>
                    <td>
                      {str(d.label)} <span className="mh-sa__muted">({str(d.designationType)})</span>
                    </td>
                    <td>{designationCondition(d)}</td>
                    <td>{designationRequirement(d)}</td>
                    <td className="lx-actions">
                      <Btn onClick={() => setEditing(d)}>Edit</Btn>
                      <Btn tone="danger" onClick={() => setDeleting(d)}>
                        Delete
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No designations exist for this program.</Empty>
        )}
        {designations.length || form.dirty ? <p className="mh-sa__muted pm-note">Designation changes are stored when you click Save Program.</p> : null}
      </section>
      <div className="mh-sa__actions">
        <Link className="mh-sa__btn" href={FAC}>
          Cancel
        </Link>
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Save Program
        </button>
      </div>
      {editing ? (
        <RowModal
          title={editing === "new" ? "Add Designation" : `Edit Designation: ${str(editing.label)}`}
          fields={rowFields as Field[]}
          initial={editing === "new" ? null : editing}
          saveLabel="Save Designation"
          meta={rowMeta(editing === "new" ? null : editing)}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            const label = str(row.label).trim().toLowerCase();
            if (designations.some((d) => d.id !== row.id && str(d.label).trim().toLowerCase() === label)) {
              notice.fail(`A designation named "${str(row.label)}" already exists for this program`);
              return;
            }
            setDesignations(editing === "new" ? [...designations, row] : designations.map((d) => (d.id === row.id ? row : d)));
            setEditing(null);
          }}
        />
      ) : null}
      {deleting ? (
        <Confirm
          title={`Delete Designation: ${str(deleting.label)}`}
          body={`Delete the designation "${str(deleting.label)}"? Other designations that refer to it as a Previous Designation will be reset to None.`}
          okLabel="Confirm Delete"
          onCancel={() => setDeleting(null)}
          onOk={() => {
            const label = str(deleting.label);
            setDesignations(
              designations
                .filter((d) => d.id !== deleting.id)
                .map((d) => ({ ...d, averagePrevious: d.averagePrevious === label ? "None" : d.averagePrevious, failingPrevious: d.failingPrevious === label ? "None" : d.failingPrevious })),
            );
            setDeleting(null);
          }}
        />
      ) : null}
    </form>
  );
}

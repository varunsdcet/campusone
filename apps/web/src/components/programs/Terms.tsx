"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { useNotice } from "@/components/location/shared";
import {
  Actions,
  BASE,
  Btn,
  Confirm,
  Empty,
  RowModal,
  Sections,
  errMsg,
  fmtDate,
  fmtRange,
  pm,
  send,
  str,
  useEntityForm,
  useLeaveGuard,
  useMeta,
  type Data,
  type Field,
  type Listing,
  type Meta,
  type Row,
} from "./kit";
import { DeadlineTable } from "./ProgramTabs";

const TERMS = `${BASE}/terms`;
const CALS = `${BASE}/calendars`;
const CRUMB = ["Home", "Program Management"];

/* ------------------------------------------------------------------ */
/* Manage Terms                                                         */
/* ------------------------------------------------------------------ */

function Campuses({ list }: { list: string[] }) {
  const [more, setMore] = useState(false);
  if (!list.length) return <span className="mh-sa__muted">None</span>;
  const shown = more ? list : list.slice(0, 2);
  return (
    <span>
      {shown.join(", ")}
      {list.length > 2 ? (
        <>
          {" "}
          <button type="button" className="mh-sa__link" onClick={() => setMore((m) => !m)}>
            {more ? "Show Less" : `Show More (${list.length - 2})`}
          </button>
        </>
      ) : null}
    </span>
  );
}

export function TermsList() {
  const router = useRouter();
  const notice = useNotice();
  const { ok, fail } = notice;
  const { meta } = useMeta();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [campus, setCampus] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    pm<Listing>("/e/terms")
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load terms")));
  }, [fail]);
  useEffect(load, [load]);
  const shown = (rows ?? []).filter((r) => !campus || (Array.isArray(r.campuses) && (r.campuses as string[]).includes(campus)));
  return (
    <SuperFrame
      title="Manage Terms"
      breadcrumbs={[...CRUMB, "Manage Terms"]}
      activeHref={TERMS}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${TERMS}/new`}>
          Create Term
        </Link>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          <label className="mh-sa__field pm-inline-field">
            <span className="mh-sa__label">Filter Campus</span>
            <select className="mh-sa__input" value={campus} onChange={(e) => setCampus(e.target.value)}>
              <option value="">All Campuses</option>
              {(meta?.lists.campuses ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Term Name</th>
                    <th>Term Dates</th>
                    <th>Campuses</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {str(r.name)} <span className="mh-sa__muted">({str(r.abbreviation)})</span>
                      </td>
                      <td>{fmtRange(str(r.startDate), str(r.endDate))}</td>
                      <td>
                        <Campuses list={Array.isArray(r.campuses) ? (r.campuses as string[]) : []} />
                      </td>
                      <td className="lx-actions">
                        <Btn onClick={() => router.push(`${TERMS}/review?id=${r.id}`)}>View</Btn>
                        <Btn onClick={() => router.push(`${TERMS}/edit?id=${r.id}`)}>Edit</Btn>
                        <Btn tone="danger" onClick={() => setConfirm(r)}>
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                  {!shown.length ? (
                    <tr>
                      <td colSpan={4} className="mh-sa__empty-cell">
                        {campus ? `No terms are offered at ${campus}.` : "No terms have been created yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {confirm ? (
          <Confirm
            title={`Delete Term: ${str(confirm.name)}`}
            body={`Delete the term "${str(confirm.name)} (${str(confirm.abbreviation)})"? Terms used by a term schedule or by scheduled course sections cannot be deleted.`}
            okLabel="Delete Term"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              send(`/e/terms/${r.id}`, "DELETE")
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
/* Add / Edit Term                                                      */
/* ------------------------------------------------------------------ */

const dt = (v: unknown) => (str(v) ? new Date(str(v)).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

function conditionCells(c: Data, meta: Meta) {
  const programs = c.programScope === "Select Program(s)" ? (Array.isArray(c.programs) ? (c.programs as string[]) : []).map((id) => meta.programs.find((p) => p.id === id)?.abbreviation || "(deleted)").join(", ") : "All Programs";
  const dates = `${dt(c.enrolStart)} – ${c.customEnd ? dt(c.enrolEnd) : "Term end"}${c.useCohorts ? ` · ${str(c.cohorts)} cohorts every ${str(c.interval)}` : ""}`;
  const completion = [c.coursesCompleted && c.coursesCompleted !== "Any" ? `${str(c.coursesCompleted)} course(s)${c.includeCoursesInProgress ? " incl. in progress" : ""}` : "", c.termsCompleted && c.termsCompleted !== "Any" ? `${str(c.termsCompleted)} term(s)${c.includeTermsInProgress ? " incl. in progress" : ""}` : ""].filter(Boolean).join(", ") || "Any";
  const standing = [c.creditsRequired !== null && c.creditsRequired !== undefined && c.creditsRequired !== "" ? `${str(c.creditsRequired)} credits` : "", c.gpaRequired !== null && c.gpaRequired !== undefined && c.gpaRequired !== "" ? `GPA ${str(c.gpaRequired)}` : ""].filter(Boolean).join(", ") || "None";
  return { dates, programs, completion, standing };
}

type RowEdit = { key: "eventDates" | "enrolmentConditions" | "deadlines"; row: Data | null };

export function TermForm({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm("terms", id);
  useLeaveGuard(form.dirty && !form.busy);
  const [editing, setEditing] = useState<RowEdit | null>(null);
  const [deleting, setDeleting] = useState<RowEdit | null>(null);
  const title = mode === "create" ? "Add Term" : `Edit Term: ${str(form.record?.name)}`;
  const rowsOf = (key: RowEdit["key"]) => (Array.isArray(form.values?.[key]) ? (form.values![key] as Data[]) : []);
  const rowFields = (key: RowEdit["key"]) => (form.fields.find((f) => f.key === key)?.rowFields ?? []) as Field[];
  const MODAL: Record<RowEdit["key"], { add: string; edit: string; save: string }> = {
    eventDates: { add: "Add Event Date", edit: "Edit Event Date", save: "Save Event Date" },
    enrolmentConditions: { add: "Add Enrolment Condition", edit: "Edit Enrolment Condition", save: "Save Condition" },
    deadlines: { add: "Add Term Deadline", edit: "Edit Term Deadline", save: "Save Deadline" },
  };
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, "Manage Terms", mode === "create" ? "Add Term" : "Edit Term"]} breadcrumbHrefs={[null, null, TERMS]} activeHref={TERMS}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${TERMS}?notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError || form.loadError ? <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} />
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Custom Event Dates</h2>
                <Btn onClick={() => setEditing({ key: "eventDates", row: null })}>+ Add Event Date</Btn>
              </div>
              {rowsOf("eventDates").length ? (
                <ul className="pm-events">
                  {rowsOf("eventDates").map((r) => (
                    <li key={str(r.id)}>
                      <strong>{str(r.name)}</strong> <span>{fmtDate(str(r.date))}</span>
                      <Actions>
                        <Btn onClick={() => setEditing({ key: "eventDates", row: r })}>Edit</Btn>
                        <Btn tone="danger" onClick={() => setDeleting({ key: "eventDates", row: r })}>
                          Delete
                        </Btn>
                      </Actions>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>No custom event dates have been added.</Empty>
              )}
            </section>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Enrolment Conditions</h2>
                <Btn onClick={() => setEditing({ key: "enrolmentConditions", row: null })}>Add Enrolment Condition</Btn>
              </div>
              {rowsOf("enrolmentConditions").length ? (
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table lx-table">
                    <thead>
                      <tr>
                        <th>Enrolment Dates</th>
                        <th>Programs</th>
                        <th>Completion Conditions</th>
                        <th>Standing Conditions</th>
                        <th className="lx-actions" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {rowsOf("enrolmentConditions").map((c) => {
                        const cells = conditionCells(c, form.meta!);
                        return (
                          <tr key={str(c.id)}>
                            <td>{cells.dates}</td>
                            <td>{cells.programs}</td>
                            <td>{cells.completion}</td>
                            <td>{cells.standing}</td>
                            <td className="lx-actions">
                              <Btn onClick={() => setEditing({ key: "enrolmentConditions", row: c })}>Edit</Btn>
                              <Btn tone="danger" onClick={() => setDeleting({ key: "enrolmentConditions", row: c })}>
                                Delete
                              </Btn>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty>No enrolment conditions exist for this term. Self-enrolment is currently disabled.</Empty>
              )}
            </section>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Deadlines</h2>
                <Btn onClick={() => setEditing({ key: "deadlines", row: null })}>Add Deadline</Btn>
              </div>
              <DeadlineTable rows={rowsOf("deadlines")} onEdit={(d) => setEditing({ key: "deadlines", row: d })} onDelete={(d) => setDeleting({ key: "deadlines", row: d })} empty="No deadlines exist for this term." />
            </section>
            <p className="mh-sa__muted pm-note">Event dates, enrolment conditions and deadlines are stored when you click Save Term.</p>
          </>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={TERMS}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Term
          </button>
        </div>
      </form>
      {editing && form.meta ? (
        <RowModal
          title={editing.row ? MODAL[editing.key].edit : MODAL[editing.key].add}
          fields={rowFields(editing.key)}
          initial={editing.row}
          saveLabel={MODAL[editing.key].save}
          meta={form.meta}
          onClose={() => setEditing(null)}
          onSave={(row) => {
            const list = rowsOf(editing.key);
            form.setValue(editing.key, editing.row ? list.map((r) => (r.id === row.id ? row : r)) : [...list, row]);
            setEditing(null);
          }}
        />
      ) : null}
      {deleting?.row ? (
        <Confirm
          title="Confirm Delete"
          body="Remove this entry from the term? The change is stored when you click Save Term."
          okLabel="Confirm Delete"
          onCancel={() => setDeleting(null)}
          onOk={() => {
            form.setValue(
              deleting.key,
              rowsOf(deleting.key).filter((r) => r.id !== deleting.row!.id),
            );
            setDeleting(null);
          }}
        />
      ) : null}
    </SuperFrame>
  );
}

export function TermReview() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const [term, setTerm] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    pm<Row>(`/e/terms/${id}`)
      .then(setTerm)
      .catch((e) => setError(errMsg(e, "Could not load the term")));
  }, [id]);
  const title = term ? `Review Term: ${str(term.name)} (${str(term.abbreviation)})` : "Review Term";
  return (
    <SuperFrame
      title={title}
      breadcrumbs={[...CRUMB, "Manage Terms", "Review Term"]}
      breadcrumbHrefs={[null, null, TERMS]}
      activeHref={TERMS}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${TERMS}/edit?id=${id}`}>
          Edit Term
        </Link>
      }
    >
      <div className="lx">
        {error ? <SaNotice tone="error">{error}</SaNotice> : null}
        {term ? (
          <section className="mh-sa__card lx-narrow">
            <dl className="pm-dl">
              <dt>Start Date</dt>
              <dd>{fmtDate(str(term.startDate))}</dd>
              <dt>End Date</dt>
              <dd>{fmtDate(str(term.endDate))}</dd>
              <dt>Campuses</dt>
              <dd>{Array.isArray(term.campuses) && term.campuses.length ? (term.campuses as string[]).join(", ") : "None"}</dd>
            </dl>
          </section>
        ) : !error ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : null}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={TERMS}>
            Back to Manage Terms
          </Link>
        </div>
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Academic Calendars                                                   */
/* ------------------------------------------------------------------ */

export function CalendarsList() {
  const router = useRouter();
  const notice = useNotice();
  const { ok, fail } = notice;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    pm<Listing>("/e/calendars")
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load academic calendars")));
  }, [fail]);
  useEffect(load, [load]);
  return (
    <SuperFrame
      title="Manage Academic Calendars"
      breadcrumbs={[...CRUMB, "Academic Calendars"]}
      activeHref={CALS}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${CALS}/new`}>
          Create Academic Calendar
        </Link>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : !rows.length ? (
            <Empty>No academic calendars were found</Empty>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {str(r.name)} <span className="mh-sa__muted">· {str(r.access)}</span>
                      </td>
                      <td>{fmtRange(str(r.startDate), str(r.endDate))}</td>
                      <td>
                        <span className={`pm-status pm-status--${r.status === "Active" ? "on" : "off"}`}>{str(r.status)}</span>
                      </td>
                      <td className="lx-actions">
                        <Btn onClick={() => router.push(`${CALS}/edit?id=${r.id}`)}>Edit</Btn>
                        <Btn tone="danger" onClick={() => setConfirm(r)}>
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {confirm ? (
          <Confirm
            title={`Delete Academic Calendar: ${str(confirm.name)}`}
            body={`Delete the academic calendar "${str(confirm.name)}"?`}
            okLabel="Delete Academic Calendar"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              send(`/e/calendars/${r.id}`, "DELETE")
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

export function CalendarForm({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm("calendars", id);
  useLeaveGuard(form.dirty && !form.busy);
  const title = useMemo(() => (mode === "create" ? "Create Academic Calendar" : `Edit Academic Calendar: ${str(form.record?.name)}`), [mode, form.record]);
  return (
    <SuperFrame title={title} breadcrumbs={[...CRUMB, "Academic Calendars", mode === "create" ? "Create" : "Edit"]} breadcrumbHrefs={[null, null, CALS]} activeHref={CALS}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${CALS}?notice=${encodeURIComponent(mode === "create" ? "Academic calendar created successfully" : out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError || form.loadError ? <SaNotice tone="error">{form.metaError ?? form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? <p className="mh-sa__muted">Loading…</p> : <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} />}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={CALS}>
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Academic Calendar
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

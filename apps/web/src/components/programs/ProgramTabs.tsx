"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { SaModal } from "@/components/superadmin/shared";
import { useNotice } from "@/components/location/shared";
import {
  Actions,
  BASE,
  Btn,
  Confirm,
  Empty,
  EntityModal,
  ModalSections,
  WeeklyEditor,
  errMsg,
  fmtStamp,
  money,
  pm,
  send,
  str,
  useDragOrder,
  useEntityForm,
  useMeta,
  weeklyText,
  type Data,
  type Field,
  type Listing,
  type Opt,
  type Row,
  type Saved,
} from "./kit";

type Notice = ReturnType<typeof useNotice>;

function useList(path: string | null, fail: (m: string) => void) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => {
    if (!path) return;
    pm<Listing>(path)
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load records")));
  }, [path, fail]);
  useEffect(load, [load]);
  return { rows, setRows, load };
}

const never = { key: "__hidden", equals: "__never" };

/* ------------------------------------------------------------------ */
/* Program Pathway                                                      */
/* ------------------------------------------------------------------ */

type CourseRow = { id: string; courseId: string; code: string; title: string; credits: number; prerequisites: string; weekly: Data; hours?: number | null; tier?: string; group?: string };
type Outline = {
  pathway: Row;
  program: { id: string; name: string; abbreviation: string; scheduleType: string };
  courses: CourseRow[];
  tiers: Row[];
  groups: Row[];
  electives: CourseRow[];
};
type Modal =
  | { kind: "pathway"; id: string | null }
  | { kind: "copy" }
  | { kind: "deletePathway" }
  | { kind: "addCourses" }
  | { kind: "schedule"; course: CourseRow }
  | { kind: "tier"; id: string | null }
  | { kind: "group"; id: string | null }
  | { kind: "electives" }
  | { kind: "delete"; entity: string; id: string; title: string; body: string; ok: string };

export function PathwayTab({ programId }: { programId: string }) {
  const notice = useNotice();
  const { ok, fail } = notice;
  const pathways = useList(`/e/pathways?parentId=${programId}`, fail);
  const [selected, setSelected] = useState("");
  const [outline, setOutline] = useState<Outline | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);

  useEffect(() => {
    if (!pathways.rows) return;
    if (!pathways.rows.some((p) => p.id === selected)) setSelected((pathways.rows.find((p) => p.defaultOutline) ?? pathways.rows[0])?.id ?? "");
  }, [pathways.rows, selected]);
  const loadOutline = useCallback(() => {
    if (!selected) return setOutline(null);
    pm<Outline>(`/pathways/${selected}/outline`)
      .then(setOutline)
      .catch((e) => fail(errMsg(e, "Could not load the pathway")));
  }, [selected, fail]);
  useEffect(loadOutline, [loadOutline]);

  const done = (out: Saved, newId?: string) => {
    setModal(null);
    ok(out.message);
    if (newId) setSelected(newId);
    pathways.load();
    loadOutline();
  };
  const sequential = outline?.program.scheduleType === "Sequential";
  const tiered = outline?.program.scheduleType === "Tiers" || Boolean(outline?.tiers.length);
  const courses = outline?.courses ?? [];
  const drag = useDragOrder(courses, (ids) => {
    setOutline((o) => (o ? { ...o, courses: ids.map((id) => o.courses.find((c) => c.id === id)!) } : o));
    send("/e/pathwayCourses/order", "PUT", { ids })
      .then((out) => ok(out.message))
      .catch((e) => {
        fail(errMsg(e, "Could not save the order"));
        loadOutline();
      });
  });
  const saveHours = (c: CourseRow, raw: string) => {
    const hours = raw === "" ? null : Number(raw);
    if ((c.hours ?? null) === hours) return;
    send(`/e/pathwayCourses/${c.id}`, "PATCH", { hours })
      .then(() => {
        ok(`Hours for ${c.code} saved`);
        loadOutline();
      })
      .catch((e) => fail(errMsg(e, "Could not save hours")));
  };

  const courseTable = (list: CourseRow[]) => (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            <th className="pm-handle-col" aria-label="Order" />
            <th>Course</th>
            {sequential ? (
              <>
                <th>Hours</th>
                <th>Schedule</th>
              </>
            ) : (
              <>
                <th>Credits</th>
                <th>Prerequisites</th>
              </>
            )}
            <th className="lx-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} {...drag.rowProps(c)}>
              <td>{drag.handle(c, c.code)}</td>
              <td>
                <strong>{c.code}</strong> {c.title}
              </td>
              {sequential ? (
                <>
                  <td>
                    <input
                      className="mh-sa__input pm-hours"
                      type="number"
                      min={0}
                      step="any"
                      aria-label={`Hours for ${c.code}`}
                      defaultValue={c.hours ?? ""}
                      onBlur={(e) => saveHours(c, e.target.value)}
                    />
                  </td>
                  <td className="pm-weekly-text">{weeklyText(c.weekly)}</td>
                </>
              ) : (
                <>
                  <td>{c.credits}</td>
                  <td>{c.prerequisites || "None"}</td>
                </>
              )}
              <td className="lx-actions">
                {sequential ? <Btn onClick={() => setModal({ kind: "schedule", course: c })}>Edit</Btn> : null}
                <Btn
                  tone="danger"
                  onClick={() => setModal({ kind: "delete", entity: "pathwayCourses", id: c.id, title: `Remove Course: ${c.code}`, body: `Remove ${c.code} ${c.title} from this program pathway?`, ok: "Remove Course" })}
                >
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="lx">
      {notice.node}
      <section className="mh-sa__card">
        <div className="pm-toolbar">
          <label className="mh-sa__field pm-inline-field">
            <span className="mh-sa__label">Pathways</span>
            <select className="mh-sa__input" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!pathways.rows?.length}>
              {!pathways.rows?.length ? <option value="">No pathways yet</option> : null}
              {pathways.rows?.map((p) => (
                <option key={p.id} value={p.id}>
                  {str(p.abbreviation)} — {str(p.name)}
                  {p.defaultOutline ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </label>
          <Btn tone="primary" small={false} onClick={() => setModal({ kind: "pathway", id: null })}>
            New Pathway
          </Btn>
        </div>
        {!pathways.rows ? <p className="mh-sa__muted">Loading…</p> : !pathways.rows.length ? <Empty>No program pathways exist for this program. Click New Pathway to create one.</Empty> : null}
      </section>

      {outline ? (
        <>
          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>
                {str(outline.pathway.abbreviation)}: {str(outline.pathway.name)} <span className={`pm-status pm-status--${outline.pathway.status === "Active" ? "on" : "off"}`}>{str(outline.pathway.status)}</span>
                <span className="mh-sa__muted pm-sub"> {str(outline.pathway.type)}</span>
              </h2>
              <Actions>
                <Btn onClick={() => setModal({ kind: "addCourses" })}>Add Courses</Btn>
                {outline.program.scheduleType === "Tiers" ? <Btn onClick={() => setModal({ kind: "tier", id: null })}>Create Tier</Btn> : null}
                <Btn onClick={() => setModal({ kind: "pathway", id: outline.pathway.id })}>Edit</Btn>
                <Btn onClick={() => setModal({ kind: "copy" })}>Copy</Btn>
                <Btn tone="danger" onClick={() => setModal({ kind: "deletePathway" })}>
                  Delete
                </Btn>
              </Actions>
            </div>
            {!courses.length ? (
              <Empty>No courses have been added to this program pathway.</Empty>
            ) : tiered ? (
              <>
                {outline.tiers.map((t) => {
                  const list = courses.filter((c) => c.tier === t.id);
                  return (
                    <div key={t.id} className="pm-tier">
                      <div className="pm-tier__head">
                        <h3>
                          {str(t.name)}
                          <span className="mh-sa__muted pm-sub">
                            {" "}
                            Required: {str(t.requiredCourses)} · Open electives: {str(t.openElectives)}
                            {t.subTier === "Yes" ? " · Sub-tier" : ""}
                          </span>
                        </h3>
                        <Actions>
                          <Btn onClick={() => setModal({ kind: "tier", id: t.id })}>Edit</Btn>
                          <Btn
                            tone="danger"
                            onClick={() =>
                              setModal({ kind: "delete", entity: "tiers", id: t.id, title: `Delete Tier: ${str(t.name)}`, body: `Delete the tier "${str(t.name)}"? Its courses stay in the pathway without a tier.`, ok: "Delete Tier" })
                            }
                          >
                            Delete
                          </Btn>
                        </Actions>
                      </div>
                      {list.length ? courseTable(list) : <Empty>No courses in this tier.</Empty>}
                    </div>
                  );
                })}
                {courses.some((c) => !c.tier || !outline.tiers.some((t) => t.id === c.tier)) ? (
                  <div className="pm-tier">
                    <div className="pm-tier__head">
                      <h3>Courses not in a tier</h3>
                    </div>
                    {courseTable(courses.filter((c) => !c.tier || !outline.tiers.some((t) => t.id === c.tier)))}
                  </div>
                ) : null}
              </>
            ) : (
              courseTable(courses)
            )}
          </section>

          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>Electives</h2>
              <Actions>
                <Btn onClick={() => setModal({ kind: "group", id: null })}>Create Elective Group</Btn>
                <Btn onClick={() => setModal({ kind: "electives" })}>Add Electives</Btn>
              </Actions>
            </div>
            {!outline.electives.length && !outline.groups.length ? (
              <Empty>No electives have been assigned to this program outline.</Empty>
            ) : (
              <>
                {[...outline.groups.map((g) => ({ g, list: outline.electives.filter((e) => e.group === g.id) })), { g: null, list: outline.electives.filter((e) => !e.group || !outline.groups.some((g) => g.id === e.group)) }]
                  .filter((x) => x.g || x.list.length)
                  .map(({ g, list }) => (
                    <div key={g?.id ?? "none"} className="pm-tier">
                      <div className="pm-tier__head">
                        <h3>{g ? str(g.name) : "No Group"}</h3>
                        {g ? (
                          <Actions>
                            <Btn onClick={() => setModal({ kind: "group", id: g.id })}>Edit</Btn>
                            <Btn
                              tone="danger"
                              onClick={() =>
                                setModal({ kind: "delete", entity: "electiveGroups", id: g.id, title: `Delete Elective Group: ${str(g.name)}`, body: `Delete the elective group "${str(g.name)}"? Its electives stay in the outline under No Group.`, ok: "Delete Group" })
                              }
                            >
                              Delete
                            </Btn>
                          </Actions>
                        ) : null}
                      </div>
                      {list.length ? (
                        <div className="mh-sa__table-wrap">
                          <table className="mh-sa__table lx-table">
                            <thead>
                              <tr>
                                <th>Elective Course</th>
                                <th>Prerequisites</th>
                                <th className="lx-actions" aria-label="Actions" />
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((e) => (
                                <tr key={e.id}>
                                  <td>
                                    <strong>{e.code}</strong> {e.title}
                                  </td>
                                  <td>{e.prerequisites || "None"}</td>
                                  <td className="lx-actions">
                                    <Btn
                                      tone="danger"
                                      onClick={() => setModal({ kind: "delete", entity: "electives", id: e.id, title: `Delete Elective: ${e.code}`, body: `Remove the elective ${e.code} ${e.title}?`, ok: "Confirm Delete" })}
                                    >
                                      Delete
                                    </Btn>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty>No electives in this group yet.</Empty>
                      )}
                    </div>
                  ))}
              </>
            )}
          </section>
        </>
      ) : null}

      {modal?.kind === "pathway" ? (
        <EntityModal
          entity="pathways"
          id={modal.id}
          parentId={programId}
          title={modal.id ? `Edit Program Pathway: ${str(outline?.pathway.name)}` : "Create Program Pathway"}
          saveLabel="Save Program Pathway"
          onClose={() => setModal(null)}
          onSaved={(out) => done(out, modal.id ? undefined : out.id)}
        />
      ) : null}
      {modal?.kind === "copy" && outline ? <CopyPathway outline={outline} onClose={() => setModal(null)} onDone={(out) => done(out, out.id)} /> : null}
      {modal?.kind === "deletePathway" && outline ? (
        <Confirm
          title={`Delete Outline Template: ${str(outline.pathway.name)}`}
          body={`Delete the program pathway "${str(outline.pathway.name)}" with its course list, tiers and electives?`}
          okLabel="Delete Outline"
          onCancel={() => setModal(null)}
          onOk={() =>
            send(`/e/pathways/${outline.pathway.id}`, "DELETE")
              .then((out) => {
                setSelected("");
                done(out);
              })
              .catch((e) => {
                setModal(null);
                fail(errMsg(e, "Delete failed"));
              })
          }
        />
      ) : null}
      {modal?.kind === "addCourses" && outline ? <AddCourses outline={outline} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.kind === "schedule" ? <CourseSchedule course={modal.course} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.kind === "tier" && outline ? (
        <EntityModal
          entity="tiers"
          id={modal.id}
          parentId={outline.pathway.id}
          title={modal.id ? "Edit Tier" : "Create Tier"}
          saveLabel="Save Tier"
          onClose={() => setModal(null)}
          onSaved={(out) => done(out)}
        />
      ) : null}
      {modal?.kind === "group" && outline ? (
        <EntityModal
          entity="electiveGroups"
          id={modal.id}
          parentId={outline.pathway.id}
          title={modal.id ? "Edit Elective Group" : "Create Elective Group"}
          saveLabel="Save Elective Group"
          onClose={() => setModal(null)}
          onSaved={(out) => done(out)}
        />
      ) : null}
      {modal?.kind === "electives" && outline ? <AddElectives outline={outline} onClose={() => setModal(null)} onDone={done} /> : null}
      {modal?.kind === "delete" ? (
        <Confirm
          title={modal.title}
          body={modal.body}
          okLabel={modal.ok}
          onCancel={() => setModal(null)}
          onOk={() =>
            send(`/e/${modal.entity}/${modal.id}`, "DELETE")
              .then((out) => done(out))
              .catch((e) => {
                setModal(null);
                fail(errMsg(e, "Delete failed"));
              })
          }
        />
      ) : null}
    </div>
  );
}

function CopyPathway({ outline, onClose, onDone }: { outline: Outline; onClose: () => void; onDone: (out: Saved) => void }) {
  const p = outline.pathway;
  const form = useEntityForm("pathways", null, { defaults: { ...p, name: `${str(p.name)} (Copy)`, abbreviation: `${str(p.abbreviation)}-COPY`, defaultOutline: false } });
  const [copyElectives, setCopyElectives] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (!form.values) return;
    setBusy(true);
    send(`/pathways/${p.id}/copy`, "POST", { ...form.values, copyElectives })
      .then(onDone)
      .catch((e) => setError(errMsg(e, "Copy failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title={`Copy Program Pathway: ${str(p.name)}`}
      onClose={onClose}
      wide
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !form.values} onClick={submit}>
          Copy Program Pathway
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      {form.values && form.meta ? (
        <form
          className="pm-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <ModalSections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} />
          <div className="pm-modal-section">
            <h3>Copy Options</h3>
            <label className="mh-sa__check">
              <input type="checkbox" checked={copyElectives} onChange={(e) => setCopyElectives(e.target.checked)} /> Copy electives
            </label>
          </div>
        </form>
      ) : (
        <p className="mh-sa__muted">Loading…</p>
      )}
    </SaModal>
  );
}

function AddCourses({ outline, onClose, onDone }: { outline: Outline; onClose: () => void; onDone: (out: Saved) => void }) {
  const { meta } = useMeta();
  const [q, setQ] = useState("");
  const [pickAvail, setPickAvail] = useState<string[]>([]);
  const [pickSel, setPickSel] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [useGroup, setUseGroup] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(outline.tiers.length ? "existing" : "new");
  const [tier, setTier] = useState(outline.tiers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inPathway = new Set(outline.courses.map((c) => c.courseId));
  const available = (meta?.courses ?? []).filter((c) => !inPathway.has(c.id) && !selected.includes(c.id) && (!q.trim() || c.label.toLowerCase().includes(q.trim().toLowerCase())));
  const label = (id: string) => meta?.courses.find((c) => c.id === id)?.label ?? id;
  const submit = () => {
    if (!selected.length) return setError("Select at least one course and click Add before saving");
    setBusy(true);
    send(`/pathways/${outline.pathway.id}/courses`, "POST", { courseIds: selected, group: useGroup ? { mode, tier, name } : { mode: "none" } })
      .then(onDone)
      .catch((e) => setError(errMsg(e, "Save failed")))
      .finally(() => setBusy(false));
  };
  return (
    <SaModal
      title="Add Courses to Program Pathway"
      onClose={onClose}
      wide
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={submit}>
          Save Courses
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <label className="mh-sa__field">
        <span className="mh-sa__label">Filter</span>
        <input className="mh-sa__input" placeholder="Enter Course Name / Num" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="pm-transfer">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Available Courses ({available.length})</span>
          <select multiple size={12} className="mh-sa__input" value={pickAvail} onChange={(e) => setPickAvail(Array.from(e.target.selectedOptions, (o) => o.value))}>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="pm-transfer__btns">
          <Btn
            onClick={() => {
              setSelected((s) => [...s, ...pickAvail.filter((x) => !s.includes(x))]);
              setPickAvail([]);
            }}
            disabled={!pickAvail.length}
          >
            Add →
          </Btn>
          <Btn
            onClick={() => {
              setSelected((s) => s.filter((x) => !pickSel.includes(x)));
              setPickSel([]);
            }}
            disabled={!pickSel.length}
          >
            ← Remove
          </Btn>
        </div>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Selected Courses ({selected.length})</span>
          <select multiple size={12} className="mh-sa__input" value={pickSel} onChange={(e) => setPickSel(Array.from(e.target.selectedOptions, (o) => o.value))}>
            {selected.map((id) => (
              <option key={id} value={id}>
                {label(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {outline.program.scheduleType === "Tiers" ? (
        <div className="pm-modal-section">
          <label className="mh-sa__check">
            <input type="checkbox" checked={useGroup} onChange={(e) => setUseGroup(e.target.checked)} /> Create or add the above courses in a new or existing group.
          </label>
          {useGroup ? (
            <div className="pm-group-pick">
              {outline.tiers.length ? (
                <label className="mh-sa__check">
                  <input type="radio" name="grp" checked={mode === "existing"} onChange={() => setMode("existing")} /> Existing group
                  <select className="mh-sa__input" value={tier} onChange={(e) => setTier(e.target.value)} disabled={mode !== "existing"}>
                    {outline.tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {str(t.name)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="mh-sa__check">
                <input type="radio" name="grp" checked={mode === "new"} onChange={() => setMode("new")} /> New group
                <input className="mh-sa__input" placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} disabled={mode !== "new"} />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </SaModal>
  );
}

function CourseSchedule({ course, onClose, onDone }: { course: CourseRow; onClose: () => void; onDone: (out: Saved) => void }) {
  const { meta } = useMeta();
  const [weekly, setWeekly] = useState<Data>(course.weekly ?? {});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <SaModal
      title={`Edit Course Schedule: ${course.code} ${course.title}`}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            send(`/course-schedules/${course.courseId}`, "PUT", { weekly })
              .then(onDone)
              .catch((e) => setError(errMsg(e, "Save failed")))
              .finally(() => setBusy(false));
          }}
        >
          Save Course
        </button>
      }
    >
      <p className="pm-warn">Updating this schedule updates every instance of {course.code} in all program pathways, not only the pathway you are viewing.</p>
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      <div className="mh-sa__field mh-sa__field--wide">
        <span className="mh-sa__label">Weekly Schedule</span>
        {meta ? <WeeklyEditor value={weekly} onChange={setWeekly} weekdays={meta.weekdays} /> : null}
      </div>
    </SaModal>
  );
}

function AddElectives({ outline, onClose, onDone }: { outline: Outline; onClose: () => void; onDone: (out: Saved) => void }) {
  const { meta } = useMeta();
  const [group, setGroup] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taken = new Set(outline.electives.map((e) => e.courseId));
  return (
    <SaModal
      title="Add Electives"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            send(`/pathways/${outline.pathway.id}/electives`, "POST", { group, courseIds: ids })
              .then(onDone)
              .catch((e) => setError(errMsg(e, "Save failed")))
              .finally(() => setBusy(false));
          }}
        >
          Save Electives
        </button>
      }
    >
      {error ? <p className="pm-error" role="alert">{error}</p> : null}
      {outline.groups.length ? (
        <label className="mh-sa__field">
          <span className="mh-sa__label">Elective Group</span>
          <select className="mh-sa__input" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">No Group</option>
            {outline.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {str(g.name)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="mh-sa__field">
        <span className="mh-sa__label">Elective Courses</span>
        <select multiple size={14} className="mh-sa__input" value={ids} onChange={(e) => setIds(Array.from(e.target.selectedOptions, (o) => o.value))}>
          {(meta?.courses ?? [])
            .filter((c) => !taken.has(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
        </select>
        <span className="lx-hint">CTRL + CLICK to select multiple courses.</span>
      </label>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Fees & Tuition Price List (program defaults and schedule-level fees)  */
/* ------------------------------------------------------------------ */

function termCondition(t: Row) {
  const c = str(t.condition);
  const n = c === "Courses Completed" ? t.requiredCourses : c === "Hours Completed" ? t.requiredHours : t.requiredDays;
  return `${c}: ${str(n)}`;
}

export function FeesPanel({ parentId, termEntity, feeEntity, amountLabel, empty }: { parentId: string; termEntity: "feeTerms" | "scheduleFeeTerms"; feeEntity: "fees" | "scheduleFees"; amountLabel: string; empty: string }) {
  const notice = useNotice();
  const { ok, fail } = notice;
  const terms = useList(`/e/${termEntity}?parentId=${parentId}`, fail);
  const fees = useList(`/e/${feeEntity}?parentId=${parentId}`, fail);
  const [modal, setModal] = useState<null | { kind: "term" | "fee"; id: string | null } | { kind: "delete"; entity: string; id: string; name: string; noun: string }>(null);
  const [position, setPosition] = useState("bottom");
  const reload = () => {
    terms.load();
    fees.load();
  };
  const done = (out: Saved) => {
    setModal(null);
    ok(out.message);
    reload();
  };
  const termOpts: Opt[] = (terms.rows ?? []).map((t) => ({ id: t.id, label: str(t.name) }));
  const all = fees.rows ?? [];
  const drag = useDragOrder(all, (ids) => {
    fees.setRows((rs) => (rs ? ids.map((id) => rs.find((r) => r.id === id)!) : rs));
    send(`/e/${feeEntity}/order`, "PUT", { ids })
      .then((out) => ok(out.message))
      .catch((e) => {
        fail(errMsg(e, "Could not save the order"));
        fees.load();
      });
  });
  const groups: Array<{ term: Row | null; list: Row[] }> = [
    { term: null, list: all.filter((f) => !f.feeTerm || !(terms.rows ?? []).some((t) => t.id === f.feeTerm)) },
    ...(terms.rows ?? []).map((t) => ({ term: t, list: all.filter((f) => f.feeTerm === t.id) })),
  ].filter((g) => g.term || g.list.length);

  const table = (list: Row[]) => (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            <th className="pm-handle-col" aria-label="Order" />
            <th>Ledger / Tuition Type</th>
            <th>{amountLabel}</th>
            <th className="lx-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {list.map((f) => (
            <tr key={f.id} {...drag.rowProps(f)}>
              <td>{drag.handle(f, str(f.ledgerType))}</td>
              <td>{str(f.ledgerType)}</td>
              <td>
                Domestic {money(f.domestic)} · International {money(f.international)}
              </td>
              <td className="lx-actions">
                <Btn onClick={() => setModal({ kind: "fee", id: f.id })}>Edit</Btn>
                <Btn tone="danger" onClick={() => setModal({ kind: "delete", entity: feeEntity, id: f.id, name: str(f.ledgerType), noun: "Ledger / Tuition Type" })}>
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
          {!list.length ? (
            <tr>
              <td colSpan={4} className="mh-sa__empty-cell">
                No ledger or tuition types are assigned to this term.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="lx">
      {notice.node}
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>Fees & Tuition Price List</h2>
          <Actions>
            <Btn
              onClick={() => {
                setPosition("bottom");
                setModal({ kind: "term", id: null });
              }}
            >
              Add Term
            </Btn>
            <Btn tone="primary" onClick={() => setModal({ kind: "fee", id: null })}>
              Add Ledger / Tuition Type
            </Btn>
          </Actions>
        </div>
        {!fees.rows || !terms.rows ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : !all.length && !terms.rows.length ? (
          <Empty>{empty}</Empty>
        ) : (
          groups.map(({ term, list }) => (
            <div key={term?.id ?? "none"} className="pm-tier">
              {term ? (
                <div className="pm-tier__head">
                  <h3>
                    {str(term.name)} <span className="mh-sa__muted pm-sub">{termCondition(term)}</span>
                  </h3>
                  <Actions>
                    <Btn
                      onClick={() => {
                        setPosition("");
                        setModal({ kind: "term", id: term.id });
                      }}
                    >
                      Edit
                    </Btn>
                    <Btn tone="danger" onClick={() => setModal({ kind: "delete", entity: termEntity, id: term.id, name: str(term.name), noun: "Term" })}>
                      Delete
                    </Btn>
                  </Actions>
                </div>
              ) : null}
              {table(list)}
            </div>
          ))
        )}
      </section>
      {modal?.kind === "term" ? (
        <EntityModal
          entity={termEntity}
          id={modal.id}
          parentId={parentId}
          title={modal.id ? "Edit Term" : "Add Term"}
          saveLabel="Save Term"
          extra={position ? { position } : undefined}
          onClose={() => setModal(null)}
          onSaved={done}
        >
          {() => (
            <label className="mh-sa__field">
              <span className="mh-sa__label">Term Order</span>
              <select className="mh-sa__input" value={position} onChange={(e) => setPosition(e.target.value)}>
                {modal.id ? <option value="">Keep current position</option> : null}
                <option value="top">Top</option>
                {(terms.rows ?? [])
                  .filter((t) => t.id !== modal.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      After {str(t.name)}
                    </option>
                  ))}
                <option value="bottom">Bottom</option>
              </select>
            </label>
          )}
        </EntityModal>
      ) : null}
      {modal?.kind === "fee" ? (
        <EntityModal
          entity={feeEntity}
          id={modal.id}
          parentId={parentId}
          title={modal.id ? "Edit Ledger / Tuition Type" : "Add Ledger / Tuition Type"}
          saveLabel="Save Ledger / Tuition Type"
          refs={{ [termEntity]: termOpts }}
          fieldMap={(f) => (f.key === "feeTerm" && !termOpts.length ? { ...f, when: never } : f)}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      ) : null}
      {modal?.kind === "delete" ? (
        <Confirm
          title={`Delete ${modal.noun}: ${modal.name}`}
          body={modal.noun === "Term" ? `Delete the term "${modal.name}"? Ledger / tuition types assigned to it move to No Term.` : `Delete "${modal.name}" from this price list?`}
          okLabel="Confirm Delete"
          onCancel={() => setModal(null)}
          onOk={() =>
            send(`/e/${modal.entity}/${modal.id}`, "DELETE")
              .then(done)
              .catch((e) => {
                setModal(null);
                fail(errMsg(e, "Delete failed"));
              })
          }
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deadlines & Penalties                                                */
/* ------------------------------------------------------------------ */

export function deadlineCondition(d: Data) {
  const n = Number(d.days) || 0;
  const base = str(d.baseDate) || "base date";
  return n === 0 ? `On the ${base}` : `${Math.abs(n)} day${Math.abs(n) === 1 ? "" : "s"} ${n < 0 ? "before" : "after"} the ${base}`;
}

export function deadlinePenalty(d: Data) {
  switch (d.type) {
    case "Due Deadline":
      return d.lateFee && d.lateFee !== "None" ? `Late fee: ${d.lateFee === "Percentage" ? `${str(d.lateFeeAmount)}%` : money(d.lateFeeAmount)}` : "None";
    case "Penalty Deadline": {
      const bits = [d.academicPenalty && d.academicPenalty !== "None" ? str(d.academicPenalty) : "", d.financialPenalty === "Percentage" ? `${str(d.penaltyRate)}% financial penalty` : ""].filter(Boolean);
      return bits.join(" · ") || "None";
    }
    case "Aging Deadline":
      return `${str(d.collectionStatus)}${d.sendToCollections === "Yes" ? " · Send to collections" : ""}`;
    default:
      return "None";
  }
}

export function DeadlineTable({ rows, onEdit, onDelete, empty }: { rows: Data[]; onEdit: (d: Data) => void; onDelete: (d: Data) => void; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            <th>Condition</th>
            <th>Type</th>
            <th>Penalty</th>
            <th className="lx-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={str(d.id)}>
              <td>
                {deadlineCondition(d)}
                {d.note ? <div className="mh-sa__muted lx-sub">{str(d.note)}</div> : null}
              </td>
              <td>{str(d.type)}</td>
              <td>{deadlinePenalty(d)}</td>
              <td className="lx-actions">
                <Btn onClick={() => onEdit(d)}>Edit</Btn>
                <Btn tone="danger" onClick={() => onDelete(d)}>
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleTab({
  programId,
  entity,
  title,
  addLabel,
  modalNoun,
  saveLabel,
  successMessage,
  render,
  fieldMap,
}: {
  programId: string;
  entity: string;
  title: string;
  addLabel: string;
  modalNoun: string;
  saveLabel: string;
  successMessage: string;
  render: (rows: Row[], edit: (r: Row) => void, del: (r: Row) => void) => ReactNode;
  fieldMap?: (f: Field, v: Data) => Field;
}) {
  const notice: Notice = useNotice();
  const { ok, fail } = notice;
  const list = useList(`/e/${entity}?parentId=${programId}`, fail);
  const [modal, setModal] = useState<null | { id: string | null } | { del: Row }>(null);
  const done = (out: Saved) => {
    setModal(null);
    ok(out.message);
    list.load();
  };
  return (
    <div className="lx">
      {notice.node}
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>{title}</h2>
          <Btn tone="primary" onClick={() => setModal({ id: null })}>
            {addLabel}
          </Btn>
        </div>
        {!list.rows ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          render(
            list.rows,
            (r) => setModal({ id: r.id }),
            (r) => setModal({ del: r }),
          )
        )}
      </section>
      {modal && "id" in modal ? (
        <EntityModal
          entity={entity}
          id={modal.id}
          parentId={programId}
          title={`${modal.id ? "Edit" : "Add"} ${modalNoun}`}
          saveLabel={saveLabel}
          successMessage={successMessage}
          fieldMap={fieldMap}
          onClose={() => setModal(null)}
          onSaved={done}
        />
      ) : null}
      {modal && "del" in modal ? (
        <Confirm
          title={`Delete ${modalNoun}`}
          body={`Delete this ${modalNoun.toLowerCase()}?`}
          okLabel="Confirm Delete"
          onCancel={() => setModal(null)}
          onOk={() =>
            send(`/e/${entity}/${modal.del.id}`, "DELETE")
              .then(done)
              .catch((e) => {
                setModal(null);
                fail(errMsg(e, "Delete failed"));
              })
          }
        />
      ) : null}
    </div>
  );
}

export function DeadlinesTab({ programId }: { programId: string }) {
  return (
    <SimpleTab
      programId={programId}
      entity="deadlines"
      title="Deadlines & Penalties"
      addLabel="Add Deadline"
      modalNoun="Program Deadline"
      saveLabel="Save Deadline"
      successMessage="Program deadline added successfully."
      render={(rows, edit, del) => <DeadlineTable rows={rows} onEdit={(d) => edit(d as Row)} onDelete={(d) => del(d as Row)} empty="No deadlines exist for this program." />}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Commission Rates                                                     */
/* ------------------------------------------------------------------ */

const rate = (r: Data, v: unknown) => (r.calculation === "Percentage" ? `${str(v)}%` : money(v));

export function CommissionsTab({ programId }: { programId: string }) {
  return (
    <SimpleTab
      programId={programId}
      entity="commissions"
      title="Commission Rates"
      addLabel="Create Commission Rate"
      modalNoun="Agent Commission Rate"
      saveLabel="Save Commission Rate"
      successMessage="Commission rate created successfully."
      fieldMap={(f, v) => (f.key === "domestic" || f.key === "international" ? { ...f, suffix: v.calculation === "Percentage" ? "%" : "$" } : f)}
      render={(rows, edit, del) =>
        rows.length ? (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Calculation</th>
                  <th>Condition</th>
                  <th>Rates</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{str(r.calculation)}</td>
                    <td>
                      {r.condition === "Number of Courses" ? `Number of Courses: ${str(r.courseFrom)}–${str(r.courseTo)}` : r.condition === "Calendar Year" ? `Calendar Year: ${str(r.calendarYear)}` : str(r.condition)}
                    </td>
                    <td>
                      Domestic {rate(r, r.domestic)} · International {rate(r, r.international)}
                    </td>
                    <td className="lx-actions">
                      <Btn onClick={() => edit(r)}>Edit</Btn>
                      <Btn tone="danger" onClick={() => del(r)}>
                        Delete
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No agent commission rates currently exist for this program.</Empty>
        )
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Audit Changes                                                        */
/* ------------------------------------------------------------------ */

type AuditRow = { id: string; date: string; current: boolean; changedBy: string; changes: string; canRestore: boolean };
type Review = { date: string; changedBy: string; note: string; rows: Array<{ field: string; former: string; updated: string }> };

export function AuditTab({ programId }: { programId: string }) {
  const notice = useNotice();
  const { ok, fail } = notice;
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [records, setRecords] = useState<{ students: number; schedules: number; program: string } | null>(null);
  const [restore, setRestore] = useState<AuditRow | null>(null);
  const load = useCallback(() => {
    pm<{ rows: AuditRow[] }>(`/programs/${programId}/audit`)
      .then((r) => setRows(r.rows))
      .catch((e) => fail(errMsg(e, "Could not load audit changes")));
  }, [programId, fail]);
  useEffect(load, [load]);
  const recordsLink = useMemo(() => `${BASE}/scheduling?program=${programId}`, [programId]);
  return (
    <div className="lx">
      {notice.node}
      <section className="mh-sa__card">
        <div className="mh-sa__card-head">
          <h2>Audit Changes</h2>
        </div>
        {!rows ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : !rows.length ? (
          <Empty>No changes have been recorded for this program.</Empty>
        ) : (
          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Changed By</th>
                  <th>Changes Made</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {fmtStamp(r.date)} {r.current ? <span className="pm-status pm-status--on">Current</span> : null}
                    </td>
                    <td>{r.changedBy}</td>
                    <td>{r.changes}</td>
                    <td className="lx-actions">
                      <Btn
                        onClick={() =>
                          pm<Review>(`/programs/${programId}/audit/${r.id}`)
                            .then(setReview)
                            .catch((e) => fail(errMsg(e, "Could not load this change")))
                        }
                      >
                        Review
                      </Btn>
                      <Btn
                        onClick={() =>
                          pm<{ students: number; schedules: number; program: string }>(`/programs/${programId}/audit/records`)
                            .then(setRecords)
                            .catch((e) => fail(errMsg(e, "Could not load assigned records")))
                        }
                      >
                        Records
                      </Btn>
                      {r.canRestore ? <Btn onClick={() => setRestore(r)}>Restore</Btn> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {review ? (
        <SaModal title="Review Changes" onClose={() => setReview(null)} wide>
          <p>
            <strong>{fmtStamp(review.date)}</strong> · Changed by {review.changedBy}
            {review.note ? <span className="mh-sa__muted"> · {review.note}</span> : null}
          </p>
          {review.rows.length ? (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Former Values</th>
                    <th>Updated Values</th>
                  </tr>
                </thead>
                <tbody>
                  {review.rows.map((x) => (
                    <tr key={x.field}>
                      <td>{x.field}</td>
                      <td>{x.former}</td>
                      <td>{x.updated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>This entry did not change any program fields.</Empty>
          )}
        </SaModal>
      ) : null}
      {records ? (
        <SaModal title="Assigned Records" onClose={() => setRecords(null)}>
          <p className="mh-sa__muted">Click a statistic to manage the related records.</p>
          <div className="pm-counters">
            <Link className="pm-counter pm-counter--link" href="/admin/student-search">
              <strong>{records.students}</strong>
              <span>Student Records</span>
            </Link>
            <Link className="pm-counter pm-counter--link" href={recordsLink}>
              <strong>{records.schedules}</strong>
              <span>Schedule Records</span>
            </Link>
          </div>
        </SaModal>
      ) : null}
      {restore ? (
        <Confirm
          title="Restore Record"
          danger={false}
          body={
            <>
              Restore the program settings to the version saved on <strong>{fmtStamp(restore.date)}</strong> by {restore.changedBy}? The current settings will be replaced; pathways, fees and schedules are not changed.
            </>
          }
          okLabel="Confirm Restore"
          onCancel={() => setRestore(null)}
          onOk={() => {
            const r = restore;
            setRestore(null);
            send(`/programs/${programId}/audit/${r.id}/restore`, "POST")
              .then((out) => {
                ok(out.message);
                load();
              })
              .catch((e) => fail(errMsg(e, "Restore failed")));
          }}
        />
      ) : null}
    </div>
  );
}

export { Fragment };

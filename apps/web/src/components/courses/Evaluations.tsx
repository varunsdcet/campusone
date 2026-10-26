"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal } from "@/components/superadmin/shared";
import { EntityList, EntityPage, stamp } from "./Entities";
import { Confirm, Frame, HREF, LinkBtn, Loading, Pager, RefSelect, RowActions, arr, errMsg, fmtStamp, qs, send, str, useLoad, useMeta, useNotice, type Data, type Meta, type Paged } from "./kit";

/* ------------------------------------------------------------------ */
/* Manage Evaluations                                                   */
/* ------------------------------------------------------------------ */

export function EvaluationList() {
  return (
    <EntityList
      entity="evaluations"
      label="Evaluation"
      title="Manage Evaluations"
      crumb="Manage Evaluations"
      active={HREF.evaluations}
      createLabel="Create Evaluation"
      formHref={HREF.evaluations}
      filterPlaceholder="Enter Evaluation Name"
      empty="No evaluations were found."
      columns={[
        {
          label: "Evaluation Name",
          cell: (r) => (
            <div className="cm-stack">
              <strong>{str(r.title)}</strong>
              <span className="cm-pills">
                {str(r.active) === "Inactive" ? <span className="cm-pill">Inactive</span> : null}
                {str(r.autoAssign) === "Enabled" ? <span className="cm-pill cm-pill--info">Auto-Assignment</span> : null}
                {str(r.autoRelease) === "Enabled" ? <span className="cm-pill cm-pill--info">Auto-Release</span> : null}
                <span className="cm-muted">{arr(r.items).filter((i) => (i as Data).kind === "question").length} question(s)</span>
              </span>
            </div>
          ),
        },
        { label: "Created", cell: (r) => stamp(r.createdAt, r._createdBy) },
        { label: "Modified", cell: (r) => stamp(r.updatedAt, r._updatedBy) },
      ]}
      extraActions={(r) => [
        <LinkBtn key="a" href={`${HREF.evaluations}/assign${qs({ id: r.id })}`}>
          ASSIGN
        </LinkBtn>,
      ]}
    />
  );
}

type Item = { kind: "section"; id: string; title: string } | { kind: "question"; id: string; questionId: string };

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function QuestionPicker({ meta, taken, onClose, onAdd }: { meta: Meta; taken: Set<string>; onClose: () => void; onAdd: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const all = meta.refs.questions ?? [];
  const shown = all.filter((x) => !taken.has(x.id) && x.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <SaModal
      title="Add Question(s)"
      onClose={onClose}
      wide
      footer={
        <>
          <Link className="mh-sa__btn" href={HREF.questions} target="_blank">
            Open Question Bank
          </Link>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={!picked.length} onClick={() => onAdd(picked)}>
            Add {picked.length || ""} Question{picked.length === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <label className="mh-sa__field">
        <span className="mh-sa__label">Filter</span>
        <input className="mh-sa__input" placeholder="Enter Question" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="cm-listbox" role="group" aria-label="Question Bank" style={{ maxHeight: 360, overflow: "auto", marginTop: 10 }}>
        {shown.map((x) => (
          <label key={x.id} className="cm-qitem" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input type="checkbox" checked={picked.includes(x.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, x.id] : p.filter((y) => y !== x.id)))} />
            <span style={{ flex: 1 }}>{x.label}</span>
            <span className="cm-pill">{x.tag}</span>
          </label>
        ))}
        {!shown.length ? <p className="cm-muted">{all.length ? "Every matching question is already on this evaluation." : "The Question Bank is empty. Create questions there first."}</p> : null}
      </div>
    </SaModal>
  );
}

function ItemsEditor({ meta, items, setItems }: { meta: Meta; items: Item[]; setItems: (v: Item[]) => void }) {
  const [picking, setPicking] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const qLabel = useMemo(() => new Map((meta.refs.questions ?? []).map((q) => [q.id, q])), [meta]);
  const taken = new Set(items.filter((i): i is Extract<Item, { kind: "question" }> => i.kind === "question").map((i) => i.questionId));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setItems(next);
  };
  let n = 0;
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Evaluation Questions</h2>
        <span style={{ display: "inline-flex", gap: 8 }}>
          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setItems([...items, { kind: "section", id: uid("sec"), title: "New Section" }])}>
            Add Section
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" onClick={() => setPicking(true)}>
            Add Question(s)
          </button>
        </span>
      </div>
      {!items.length ? <p className="cm-empty">No questions have been added to this evaluation.</p> : null}
      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((it, i) => {
          const q = it.kind === "question" ? qLabel.get(it.questionId) : null;
          if (it.kind === "question") n += 1;
          return (
            <li
              key={it.id}
              className={`cm-qitem${it.kind === "section" ? " cm-qitem--section" : ""}${over === i ? " is-over" : ""}`}
              draggable
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(i);
              }}
              onDragLeave={() => setOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null) move(dragFrom, i);
                setDragFrom(null);
                setOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setOver(null);
              }}
            >
              <span className="cm-handle" aria-hidden title="Drag to reorder">
                ⋮⋮
              </span>
              {it.kind === "section" ? (
                <input
                  className="mh-sa__input"
                  aria-label="Section title"
                  value={it.title}
                  onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...it, title: e.target.value } : x)))}
                  style={{ flex: 1, fontWeight: 600 }}
                />
              ) : (
                <span style={{ flex: 1 }}>
                  <strong>{n}.</strong> {q?.label ?? "Question removed from the Question Bank"}
                </span>
              )}
              {it.kind === "question" ? <span className="cm-pill">{q?.tag ?? "—"}</span> : null}
              <span className="cm-row-actions">
                <LinkBtn disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </LinkBtn>
                <LinkBtn disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                  ↓
                </LinkBtn>
                <LinkBtn danger onClick={() => setItems(items.filter((_, j) => j !== i))}>
                  DELETE
                </LinkBtn>
              </span>
            </li>
          );
        })}
      </ol>
      {picking ? (
        <QuestionPicker
          meta={meta}
          taken={taken}
          onClose={() => setPicking(false)}
          onAdd={(ids) => {
            setItems([...items, ...ids.map((questionId) => ({ kind: "question" as const, id: uid("q"), questionId }))]);
            setPicking(false);
          }}
        />
      ) : null}
    </section>
  );
}

function ItemsLoader({ record, ready, items, setItems }: { record: Data | null; ready: boolean; items: Item[] | null; setItems: (v: Item[]) => void }) {
  useEffect(() => {
    if (items === null && ready) setItems(arr(record?.items) as Item[]);
  }, [items, ready, record, setItems]);
  return null;
}

export function EvaluationForm() {
  const id = useSearchParams()?.get("id") || null;
  const [items, setItems] = useState<Item[] | null>(null);
  const title = id ? "Edit Evaluation" : "Create Evaluation";
  return (
    <EntityPage
      entity="evaluations"
      id={id}
      title={title}
      crumbs={["Manage Evaluations", title]}
      active={HREF.evaluations}
      back={HREF.evaluations}
      extra={(form) => ({ items: items ?? arr(form.record?.items) })}
    >
      {(form) => (
        <>
          <ItemsLoader record={form.record} ready={Boolean(form.values) && (!id || Boolean(form.record))} items={items} setItems={setItems} />
          {form.meta && items ? <ItemsEditor meta={form.meta} items={items} setItems={setItems} /> : null}
        </>
      )}
    </EntityPage>
  );
}

/* ------------------------------------------------------------------ */
/* Assign Evaluation to Course Sessions / Offerings                     */
/* ------------------------------------------------------------------ */

type SessionOpt = { id: string; courseCode: string; code: string; name: string; term: string; termId: string; campusId: string; status: string };

export function AssignEvaluation() {
  const router = useRouter();
  const evalId = useSearchParams()?.get("id") ?? "";
  const { meta, error: metaError } = useMeta();
  const ev = useLoad<Data>(evalId ? `/e/evaluations/${evalId}` : null, "Could not load this evaluation");
  const [v, setV] = useState({ campus: "", term: "", course: "", sectionId: "", availableFrom: "", availableTo: "" });
  const sessions = useLoad<{ items: SessionOpt[] }>(v.course ? `/courses/${v.course}/sessions` : null, "Could not load sessions");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (x: string) => setV((s) => ({ ...s, [k]: x, ...(k === "course" || k === "campus" || k === "term" ? { sectionId: "" } : {}) }));
  const opts = (v.course ? sessions.data?.items ?? [] : []).filter((s) => (!v.campus || s.campusId === v.campus) && (!v.term || s.termId === v.term));
  const submit = () => {
    setErr(null);
    const missing = [!v.sectionId && "Sessions / Offerings", !v.availableFrom && "Available From Date / Time", !v.availableTo && "Available To Date / Time"].filter(Boolean);
    if (missing.length) return setErr(`Please complete: ${missing.join(", ")}`);
    setBusy(true);
    send(`/evaluations/${evalId}/assign`, "POST", { sectionId: v.sectionId, availableFrom: v.availableFrom, availableTo: v.availableTo })
      .then((out) => router.push(`${HREF.results}${qs({ notice: out.message })}`))
      .catch((e) => setErr(errMsg(e, "Assign failed")))
      .finally(() => setBusy(false));
  };
  return (
    <Frame title="Assign Evaluation to Course Sessions / Offerings" crumbs={["Manage Evaluations", "Assign Evaluation"]} active={HREF.evaluations}>
      <p className="cm-muted" style={{ marginBottom: 10 }}>
        <Link href={HREF.evaluations}>← Manage Evaluations</Link>
      </p>
      {!meta || !ev.data ? (
        <Loading error={metaError ?? ev.error} />
      ) : (
        <form
          className="cm-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {err ? (
            <p className="cm-error" role="alert">
              {err}
            </p>
          ) : null}
          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>{str(ev.data.title)}</h2>
            </div>
            <div className="mh-sa__grid">
              <RefSelect label="Campus / Location" value={v.campus} onChange={set("campus")} options={meta.refs.campuses ?? []} all="All Campuses" />
              <RefSelect label="Term" value={v.term} onChange={set("term")} options={meta.refs.terms ?? []} all="All Terms" />
              <RefSelect label="Course" value={v.course} onChange={set("course")} options={meta.refs.courses ?? []} all="-- Select Course --" />
              <label className="mh-sa__field">
                <span className="mh-sa__label">Sessions / Offerings *</span>
                <select className="mh-sa__input" value={v.sectionId} disabled={!v.course} onChange={(e) => set("sectionId")(e.target.value)}>
                  <option value="">{!v.course ? "Choose a course first" : sessions.data ? (opts.length ? "-- Select Session / Offering --" : "No sessions match") : "Loading…"}</option>
                  {opts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.courseCode} {s.code}
                      {s.name ? ` — ${s.name}` : ""} · {s.term} ({s.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="mh-sa__field">
                <span className="mh-sa__label">Available From Date / Time *</span>
                <input className="mh-sa__input" type="datetime-local" value={v.availableFrom} onChange={(e) => set("availableFrom")(e.target.value)} />
              </label>
              <label className="mh-sa__field">
                <span className="mh-sa__label">Available To Date / Time *</span>
                <input className="mh-sa__input" type="datetime-local" min={v.availableFrom || undefined} value={v.availableTo} onChange={(e) => set("availableTo")(e.target.value)} />
              </label>
            </div>
          </section>
          <div className="lx-sticky-actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              Assign Evaluation
            </button>
          </div>
        </form>
      )}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Question Bank (course evaluations — not the LMS quiz bank)           */
/* ------------------------------------------------------------------ */

export function QuestionBank() {
  return (
    <EntityList
      entity="questions"
      label="Question"
      title="Question Bank"
      crumb="Question Bank"
      active={HREF.questions}
      createLabel="Create Question"
      filterPlaceholder="Enter Question"
      modal={{ createTitle: "Create Question", editTitle: "Edit Question", saveLabel: "Save Question" }}
      empty="No questions were found."
      columns={[
        { label: "Question", cell: (r) => str(r.question) },
        { label: "Type", cell: (r) => str(r.type) || "—", width: 160 },
        { label: "Created", cell: (r) => stamp(r.createdAt, r._createdBy), width: 200 },
      ]}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Assigned Evaluations & Results                                       */
/* ------------------------------------------------------------------ */

type Assigned = {
  id: string;
  evaluationId: string;
  evaluation: string;
  session: string;
  courseTitle: string;
  campus: string;
  availableFrom: string;
  availableTo: string;
  assignedAt: string;
  auto: boolean;
  released: boolean;
  totalEnrolled: number;
  totalParticipated: number;
};

const dt = (v: string) => (v ? fmtStamp(v.length === 16 ? `${v}:00` : v) : "—");

function EditAssignment({ row, onClose, onSaved }: { row: Assigned; onClose: () => void; onSaved: (m: string) => void }) {
  const [v, setV] = useState({ availableFrom: row.availableFrom, availableTo: row.availableTo });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <SaModal
      title="Edit Evaluation Assignment"
      onClose={onClose}
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={busy}
          onClick={() => {
            setErr(null);
            setBusy(true);
            send(`/assigned/${row.id}`, "PATCH", v)
              .then((out) => onSaved(out.message))
              .catch((e) => setErr(errMsg(e, "Save failed")))
              .finally(() => setBusy(false));
          }}
        >
          Save Evaluation Assignment
        </button>
      }
    >
      {err ? <p className="cm-error" role="alert">{err}</p> : null}
      <p className="cm-muted">
        {row.evaluation} · {row.session}
      </p>
      <div className="cm-modal-form">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Available From Date / Time</span>
          <input className="mh-sa__input" type="datetime-local" value={v.availableFrom} onChange={(e) => setV((s) => ({ ...s, availableFrom: e.target.value }))} />
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Available To Date / Time</span>
          <input className="mh-sa__input" type="datetime-local" min={v.availableFrom || undefined} value={v.availableTo} onChange={(e) => setV((s) => ({ ...s, availableTo: e.target.value }))} />
        </label>
      </div>
    </SaModal>
  );
}

export function AssignedResults() {
  const { meta } = useMeta();
  const notice = useNotice();
  const [draft, setDraft] = useState({ evaluation: "", campus: "", term: "", course: "" });
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, perPage: 25 });
  const { data, error, reload } = useLoad<Paged<Assigned>>(`/assigned${qs({ ...applied, ...paging })}`, "Could not load assigned evaluations");
  const [editing, setEditing] = useState<Assigned | null>(null);
  const [confirm, setConfirm] = useState<Assigned | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Frame title="Assigned Evaluations & Results" crumbs={["Assigned / Results"]} active={HREF.results}>
      {notice.node}
      <section className="mh-sa__card">
        <form
          className="cm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(draft);
            setPaging((p) => ({ ...p, page: 1 }));
          }}
        >
          <RefSelect label="Evaluation" value={draft.evaluation} onChange={set("evaluation")} options={meta?.refs.evaluations ?? []} all="All Evaluations" />
          <RefSelect label="Campus / Location" value={draft.campus} onChange={set("campus")} options={meta?.refs.campuses ?? []} all="All Campuses" />
          <RefSelect label="Term" value={draft.term} onChange={set("term")} options={meta?.refs.terms ?? []} all="All Terms" />
          <RefSelect label="Course" value={draft.course} onChange={set("course")} options={meta?.refs.courses ?? []} all="All Courses" />
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Find Results
            </button>
          </span>
        </form>
        {!data ? (
          <Loading error={error} />
        ) : (
          <>
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Course Session / Offering</th>
                    <th>Evaluation</th>
                    <th>Assigned</th>
                    <th>Participation</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cm-stack">
                          <strong>{r.session}</strong>
                          <span className="cm-muted">{[r.courseTitle, r.campus].filter(Boolean).join(" · ")}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cm-stack">
                          <span>{r.evaluation}</span>
                          <span className="cm-pills">
                            {r.auto ? <span className="cm-pill cm-pill--info">Auto-assigned</span> : null}
                            {r.released ? <span className="cm-pill cm-pill--on">Results released</span> : null}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="cm-stack">
                          <span>
                            {dt(r.availableFrom)} – {dt(r.availableTo)}
                          </span>
                          <span className="cm-muted">Assigned {fmtStamp(r.assignedAt)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cm-stack">
                          <span>Total Enrolled: {r.totalEnrolled}</span>
                          <span>Total Participated: {r.totalParticipated}</span>
                        </div>
                      </td>
                      <td className="lx-actions">
                        <RowActions>
                          {[
                            <LinkBtn key="r" href={`${HREF.results}/view${qs({ id: r.id })}`}>
                              RESULTS
                            </LinkBtn>,
                            <LinkBtn key="e" onClick={() => setEditing(r)}>
                              EDIT
                            </LinkBtn>,
                            <LinkBtn key="u" danger onClick={() => setConfirm(r)}>
                              UNASSIGN
                            </LinkBtn>,
                          ]}
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                  {!data.items.length ? (
                    <tr>
                      <td colSpan={5} className="mh-sa__empty-cell">
                        No assigned evaluations were found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pager data={data} onPage={(page) => setPaging((p) => ({ ...p, page }))} onPerPage={(perPage) => setPaging({ page: 1, perPage })} />
          </>
        )}
      </section>
      {editing ? (
        <EditAssignment
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title="Unassign Evaluation"
          okLabel="Unassign Evaluation"
          busy={busy}
          body={
            <p>
              Unassign <strong>{confirm.evaluation}</strong> from <strong>{confirm.session}</strong>? Students who have not responded will no longer see it. Responses already submitted are kept.
            </p>
          }
          onCancel={() => setConfirm(null)}
          onOk={() => {
            setBusy(true);
            send(`/assigned/${confirm.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Unassign failed")))
              .finally(() => {
                setBusy(false);
                setConfirm(null);
              });
          }}
        />
      ) : null}
    </Frame>
  );
}

type Results = {
  id: string;
  evaluation: string;
  session: string;
  courseTitle: string;
  instructors: string[];
  availableFrom: string;
  availableTo: string;
  totalEnrolled: number;
  totalParticipated: number;
  released: boolean;
  releasedAt: string;
  releasedBy: string;
  summary: Array<{ label: string; value: number | null }>;
  comments: string[];
};

export function EvaluationResults() {
  const id = useSearchParams()?.get("id") ?? "";
  const notice = useNotice();
  const { data, error, reload } = useLoad<Results>(id ? `/assigned/${id}/results` : null, "Could not load results");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Frame
      title={data ? data.evaluation : "Evaluation Results"}
      crumbs={["Assigned / Results", "Results"]}
      active={HREF.results}
      actions={
        data ? (
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={data.released} onClick={() => setConfirm(true)}>
            {data.released ? "Results Released" : "Release Results"}
          </button>
        ) : null
      }
    >
      {notice.node}
      <p className="cm-muted" style={{ marginBottom: 10 }}>
        <Link href={HREF.results}>← Assigned / Results</Link>
      </p>
      {!data ? (
        <Loading error={error} />
      ) : (
        <>
          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>
                {data.session}
                {data.courseTitle ? ` — ${data.courseTitle}` : ""}
              </h2>
            </div>
            <div className="cm-counters">
              <div className="cm-counter">
                <span className="mh-sa__label">Instructor(s)</span>
                <strong>{data.instructors.length ? data.instructors.join(", ") : "Not Set"}</strong>
              </div>
              <div className="cm-counter">
                <span className="mh-sa__label">Available</span>
                <strong>
                  {dt(data.availableFrom)} – {dt(data.availableTo)}
                </strong>
              </div>
              <div className="cm-counter">
                <span className="mh-sa__label">Participation</span>
                <strong>
                  {data.totalParticipated} / {data.totalEnrolled}
                </strong>
              </div>
              <div className="cm-counter">
                <span className="mh-sa__label">Results</span>
                <strong>{data.released ? `Released ${fmtStamp(data.releasedAt)}${data.releasedBy ? ` by ${data.releasedBy}` : ""}` : "Not released"}</strong>
              </div>
            </div>
          </section>
          <section className="mh-sa__card cm-results">
            {!data.totalParticipated ? (
              <p className="cm-empty">No results have been submitted.</p>
            ) : (
              <>
                <div className="mh-sa__table-wrap">
                  <table className="mh-sa__table lx-table">
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>Average (1 – 5)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.summary.map((s) => (
                        <tr key={s.label}>
                          <td>{s.label}</td>
                          <td>{s.value ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 style={{ marginTop: 16 }}>Comments</h3>
                {data.comments.length ? (
                  <ul>
                    {data.comments.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="cm-muted">No written comments were submitted.</p>
                )}
              </>
            )}
          </section>
        </>
      )}
      {confirm && data ? (
        <Confirm
          title="Release Results"
          okLabel="Confirm Release"
          danger={false}
          busy={busy}
          body={
            <p>
              Release the results of <strong>{data.evaluation}</strong> for <strong>{data.session}</strong> to {data.instructors.length ? data.instructors.join(", ") : "the instructor(s)"}?
            </p>
          }
          onCancel={() => setConfirm(false)}
          onOk={() => {
            setBusy(true);
            send(`/assigned/${id}/release`, "POST")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Release failed")))
              .finally(() => {
                setBusy(false);
                setConfirm(false);
              });
          }}
        />
      ) : null}
    </Frame>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal } from "@/components/superadmin/shared";
import { scheduleText } from "./Courses";
import { EntityPage } from "./Entities";
import { Confirm, FileField, Frame, HREF, LinkBtn, Loading, Pager, RefSelect, RowActions, errMsg, fmtStamp, qs, send, str, useLeaveGuard, useLoad, useMeta, useNotice, type Paged } from "./kit";

type RepoRow = {
  id: string;
  courseId: string;
  course: string;
  name: string;
  lms: string;
  sections: number;
  activities: number;
  status: string;
  types: string[];
  campuses: string[];
  push: number;
  pull: number;
  history: number;
};

type Target = {
  id: string;
  courseCode: string;
  code: string;
  name: string;
  term: string;
  campus: string;
  status: string;
  delivery: string;
  start: string;
  end: string;
  continuous: boolean;
  meetings: Array<{ day: string; start: string; end: string }>;
  addedTopics?: number;
  addedItems?: number;
};

/* ------------------------------------------------------------------ */
/* Course Content Repository — directory                               */
/* ------------------------------------------------------------------ */

export function RepositoryDirectory() {
  const { meta } = useMeta();
  const notice = useNotice();
  const filters = meta?.options.repositoryFilters ?? ["Master Repository", "Default Repositories"];
  const [draft, setDraft] = useState({ course: "", filter: "Master Repository", campus: "" });
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, perPage: 25 });
  const { data, error, reload } = useLoad<Paged<RepoRow>>(`/repository${qs({ ...applied, ...paging })}`, "Could not load the content repository");
  const [popup, setPopup] = useState<{ kind: "push" | "pull" | "history"; row: RepoRow } | null>(null);
  const [confirm, setConfirm] = useState<RepoRow | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Frame
      title="Course Content Repository"
      crumbs={["Course Repository"]}
      active={HREF.repository}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href={`${HREF.repository}/new`}>
          Create Content Course
        </Link>
      }
    >
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
          <label className="mh-sa__field">
            <span className="mh-sa__label">Course</span>
            <input className="mh-sa__input" placeholder="Course name or number" value={draft.course} onChange={(e) => setDraft((d) => ({ ...d, course: e.target.value }))} />
          </label>
          <RefSelect label="Repository Filter" value={draft.filter} onChange={(v) => setDraft((d) => ({ ...d, filter: v }))} options={filters} all="" />
          <RefSelect label="Campus Filter" value={draft.campus} onChange={(v) => setDraft((d) => ({ ...d, campus: v }))} options={meta?.refs.campuses ?? []} all="All Campuses" />
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Repository
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
                    <th>Course Name / Number</th>
                    <th>LMS</th>
                    <th>Status</th>
                    <th>Course Types</th>
                    <th>Campuses</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cm-stack">
                          <strong>{r.course}</strong>
                          <span className="cm-muted">
                            {r.name ? `${r.name} · ` : ""}
                            {r.sections} section(s), {r.activities} item(s)
                          </span>
                        </div>
                      </td>
                      <td>{r.lms}</td>
                      <td>
                        <span className={`cm-pill${r.status === "Default" ? " cm-pill--on" : ""}`}>{r.status}</span>
                      </td>
                      <td>{r.types.join(", ")}</td>
                      <td>{r.campuses.join(", ")}</td>
                      <td className="lx-actions">
                        <RowActions>
                          {[
                            <LinkBtn key="m" href={`${HREF.repository}/manage${qs({ id: r.id })}`}>
                              MANAGE
                            </LinkBtn>,
                            <LinkBtn key="e" href={`${HREF.repository}/edit${qs({ id: r.id })}`}>
                              EDIT
                            </LinkBtn>,
                            <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                              DELETE
                            </LinkBtn>,
                            <LinkBtn key="push" onClick={() => setPopup({ kind: "push", row: r })}>
                              PUSH({r.push})
                            </LinkBtn>,
                            <LinkBtn key="pull" onClick={() => setPopup({ kind: "pull", row: r })}>
                              PULL({r.pull})
                            </LinkBtn>,
                            r.history ? (
                              <LinkBtn key="h" onClick={() => setPopup({ kind: "history", row: r })}>
                                HISTORY({r.history})
                              </LinkBtn>
                            ) : null,
                          ]}
                        </RowActions>
                      </td>
                    </tr>
                  ))}
                  {!data.items.length ? (
                    <tr>
                      <td colSpan={6} className="mh-sa__empty-cell">
                        No content courses were found.
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
      {popup?.kind === "push" ? (
        <PushPopup
          row={popup.row}
          onClose={() => setPopup(null)}
          onDone={(m) => {
            setPopup(null);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      {popup?.kind === "pull" ? (
        <PullPopup
          row={popup.row}
          onClose={() => setPopup(null)}
          onDone={(m) => {
            setPopup(null);
            notice.ok(m);
            reload();
          }}
        />
      ) : null}
      {popup?.kind === "history" ? <HistoryPopup row={popup.row} onClose={() => setPopup(null)} /> : null}
      {confirm ? (
        <Confirm
          title="Delete Content Course"
          okLabel="Delete Content Course"
          busy={busy}
          body={
            <p>
              Delete the content course <strong>{confirm.name || confirm.course}</strong> and its push / pull history? Content already pushed into course sessions stays in those sessions.
            </p>
          }
          onCancel={() => setConfirm(null)}
          onOk={() => {
            setBusy(true);
            send(`/e/repository/${confirm.id}`, "DELETE")
              .then((out) => {
                notice.ok(out.message);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Delete failed")))
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

function TargetCells({ t }: { t: Target }) {
  const sch = scheduleText(t);
  return (
    <>
      <td>
        <div className="cm-stack">
          <strong>
            {t.courseCode} {t.code}
          </strong>
          <span className="cm-muted">
            {t.name ? `${t.name} · ` : ""}
            {t.term}
            {t.campus ? ` · ${t.campus}` : ""}
          </span>
        </div>
      </td>
      <td>{t.delivery}</td>
      <td>{sch.dates}</td>
      <td>{sch.days.length ? sch.days.map((d) => <div key={d}>{d}</div>) : <span className="cm-muted">No weekly schedule</span>}</td>
    </>
  );
}

function PushPopup({ row, onClose, onDone }: { row: RepoRow; onClose: () => void; onDone: (m: string) => void }) {
  const [method, setMethod] = useState("");
  const { data, error } = useLoad<{ course: string; name: string; methods: string[]; items: Target[] }>(`/repository/${row.id}/push${qs({ method })}`, "Could not load course sessions");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const visible = data?.items ?? [];
  const allOn = visible.length > 0 && visible.every((t) => picked.has(t.id));
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const ids = visible.filter((t) => picked.has(t.id)).map((t) => t.id);
  return (
    <SaModal
      title={`Push Content — ${row.course}`}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={busy || !ids.length}
          onClick={() => {
            setErr(null);
            setBusy(true);
            send(`/repository/${row.id}/push`, "POST", { sectionIds: ids })
              .then((out) => onDone(out.message))
              .catch((e) => setErr(errMsg(e, "Push failed")))
              .finally(() => setBusy(false));
          }}
        >
          Push Content{ids.length ? ` to ${ids.length} Session(s)` : ""}
        </button>
      }
    >
      {err ? <p className="cm-error" role="alert">{err}</p> : null}
      <p className="cm-muted">Pushing replaces any earlier copy of this content course in the selected sessions. Instructor-added content is kept, and a backup of each session is saved first (see Course Backups).</p>
      <div className="cm-filters">
        <RefSelect label="Delivery Method" value={method} onChange={setMethod} options={data?.methods ?? []} all="All Methods" />
      </div>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    aria-label="Select all sessions"
                    checked={allOn}
                    onChange={() => setPicked(allOn ? new Set() : new Set(visible.map((t) => t.id)))}
                  />
                </th>
                <th>Course Session / Offering</th>
                <th>Delivery Method</th>
                <th>Dates</th>
                <th>Schedule</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input type="checkbox" aria-label={`Select ${t.courseCode} ${t.code}`} checked={picked.has(t.id)} onChange={() => toggle(t.id)} />
                  </td>
                  <TargetCells t={t} />
                </tr>
              ))}
              {!visible.length ? (
                <tr>
                  <td colSpan={5} className="mh-sa__empty-cell">
                    No current sessions / offerings of this course are covered by this repository&apos;s campuses and course types.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </SaModal>
  );
}

function PullPopup({ row, onClose, onDone }: { row: RepoRow; onClose: () => void; onDone: (m: string) => void }) {
  const { data, error } = useLoad<{ items: Target[] }>(`/repository/${row.id}/pull`, "Could not load course sessions");
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <SaModal
      title={`Pull Content — ${row.course}`}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={busy || !picked}
          onClick={() => {
            setErr(null);
            setBusy(true);
            send(`/repository/${row.id}/pull`, "POST", { sectionId: picked })
              .then((out) => onDone(out.message))
              .catch((e) => setErr(errMsg(e, "Pull failed")))
              .finally(() => setBusy(false));
          }}
        >
          Pull Content
        </button>
      }
    >
      {err ? <p className="cm-error" role="alert">{err}</p> : null}
      <p className="cm-muted">Copies the sections and items an instructor added inside a session into this content course. The session itself is not changed.</p>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th style={{ width: 36 }} aria-label="Select" />
                <th>Course Session / Offering</th>
                <th>Delivery Method</th>
                <th>Dates</th>
                <th>Schedule</th>
                <th>Instructor Content</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <input type="radio" name="pull-source" aria-label={`Pull from ${t.courseCode} ${t.code}`} disabled={!t.addedItems && !t.addedTopics} checked={picked === t.id} onChange={() => setPicked(t.id)} />
                  </td>
                  <TargetCells t={t} />
                  <td>{t.addedTopics || t.addedItems ? `${t.addedTopics ?? 0} section(s), ${t.addedItems ?? 0} item(s)` : <span className="cm-muted">Nothing to pull</span>}</td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={6} className="mh-sa__empty-cell">
                    This course has no sessions / offerings yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </SaModal>
  );
}

function HistoryPopup({ row, onClose }: { row: RepoRow; onClose: () => void }) {
  const { data, error } = useLoad<{ items: Array<{ id: string; at: string; action: string; by: string; sections: string[]; topics: number }> }>(`/repository/${row.id}/history`, "Could not load history");
  return (
    <SaModal title={`Repository History — ${row.course}`} onClose={onClose} wide>
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>By</th>
                <th>Course Session(s) / Offering(s)</th>
                <th>Sections</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr key={h.id}>
                  <td>{fmtStamp(h.at)}</td>
                  <td>
                    <span className={`cm-pill${h.action === "Push" ? " cm-pill--info" : ""}`}>{h.action}</span>
                  </td>
                  <td>{h.by}</td>
                  <td>{h.sections.join(", ")}</td>
                  <td>{h.topics}</td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={5} className="mh-sa__empty-cell">
                    No pushes or pulls yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Create / Edit Content Course                                         */
/* ------------------------------------------------------------------ */

export function RepositoryForm() {
  const id = useSearchParams()?.get("id") || null;
  const title = id ? "Edit Content Repository" : "Create Content Course";
  return (
    <EntityPage
      entity="repository"
      id={id}
      title={title}
      crumbs={["Course Repository", title]}
      active={HREF.repository}
      back={HREF.repository}
      saveLabel={id ? "Save Content Repository" : "Create Content Course"}
      top={() => (
        <p className="cm-warn">
          Only one content course can be the <strong>Default</strong> for a course on the same campus. If another default repository already covers one of these campuses, set this one to Default: No or customise its campuses.
        </p>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Manage content (sections + items)                                    */
/* ------------------------------------------------------------------ */

type Activity = {
  id: string;
  type: string;
  name: string;
  body?: string;
  url?: string;
  fileId?: string;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
};
type Topic = { id: string; title: string; summary: string; activities: Activity[] };
type Content = { id: string; name: string; course: string; format: string; topics: Topic[]; activityTypes: string[] };

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function move<T>(list: T[], from: number, to: number) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

function ActivityModal({ types, initial, onClose, onSave }: { types: string[]; initial: Activity | null; onClose: () => void; onSave: (a: Activity) => void }) {
  const [a, setA] = useState<Activity>(initial ?? { id: uid("ra"), type: "PAGE", name: "" });
  const [err, setErr] = useState<string | null>(null);
  const linky = a.type === "URL" || a.type === "EXTERNAL TOOL";
  return (
    <SaModal
      title={initial ? "Edit Item" : "Add an activity or resource"}
      onClose={onClose}
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          onClick={() => {
            if (!a.name.trim()) return setErr("Name is required");
            if (a.url && !/^https?:\/\//i.test(a.url)) return setErr("The link must start with http:// or https://");
            if (a.type === "FILE" && !a.fileId) return setErr("Upload a file before saving this item");
            onSave({ ...a, name: a.name.trim() });
          }}
        >
          Save Item
        </button>
      }
    >
      {err ? <p className="cm-error" role="alert">{err}</p> : null}
      <div className="cm-modal-form">
        <label className="mh-sa__field">
          <span className="mh-sa__label">Type</span>
          <select
            className="mh-sa__input"
            value={a.type}
            onChange={(e) => {
              const type = e.target.value;
              setA(type === "FILE" ? { ...a, type } : { ...a, type, fileId: undefined, fileName: undefined, fileMime: undefined, fileSize: undefined });
            }}
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {a.type === "FILE" ? (
          <div className="mh-sa__field mh-sa__field--wide">
            <span className="mh-sa__label">Course file *</span>
            <FileField
              label="Course file"
              value={a.fileId ? { id: a.fileId, name: a.fileName ?? a.name, mime: a.fileMime ?? "", size: a.fileSize ?? 0 } : null}
              onChange={(file) =>
                setA({
                  ...a,
                  fileId: file?.id,
                  fileName: file?.name,
                  fileMime: file?.mime,
                  fileSize: file?.size,
                  name: a.name || file?.name || "",
                })
              }
            />
          </div>
        ) : null}
        <label className="mh-sa__field">
          <span className="mh-sa__label">Name *</span>
          <input className="mh-sa__input" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} />
        </label>
        {linky ? (
          <label className="mh-sa__field">
            <span className="mh-sa__label">Link</span>
            <input className="mh-sa__input" placeholder="https://" value={a.url ?? ""} onChange={(e) => setA({ ...a, url: e.target.value })} />
          </label>
        ) : null}
        <label className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">{a.type === "ASSIGNMENT" ? "Instructions" : "Description / Content"}</span>
          <textarea className="mh-sa__input" rows={5} value={a.body ?? ""} onChange={(e) => setA({ ...a, body: e.target.value })} />
        </label>
      </div>
    </SaModal>
  );
}

export function RepositoryManage() {
  const router = useRouter();
  const id = useSearchParams()?.get("id") ?? "";
  const notice = useNotice();
  const { data, error } = useLoad<Content>(id ? `/repository/${id}/content` : null, "Could not load this content course");
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [snap, setSnap] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ topic: number; act: number | null } | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (data && !topics) {
      setTopics(data.topics);
      setSnap(JSON.stringify(data.topics));
      setOpen(new Set(data.topics.map((t) => t.id)));
    }
  }, [data, topics]);
  const dirty = topics !== null && JSON.stringify(topics) !== snap;
  useLeaveGuard(dirty && !busy);
  const label = data?.format === "Weekly" ? "Week" : "Topic";
  const patch = (i: number, p: Partial<Topic>) => setTopics((ts) => (ts ? ts.map((t, j) => (j === i ? { ...t, ...p } : t)) : ts));
  const save = () => {
    if (!topics) return;
    setBusy(true);
    send(`/repository/${id}/content`, "PUT", { topics })
      .then((out) => {
        setSnap(JSON.stringify(topics));
        notice.ok(out.message);
      })
      .catch((e) => notice.fail(errMsg(e, "Save failed")))
      .finally(() => setBusy(false));
  };
  return (
    <Frame
      title={data ? `Manage Content — ${data.course}` : "Manage Content"}
      crumbs={["Course Repository", "Manage Content"]}
      active={HREF.repository}
      actions={
        <>
          <button type="button" className="mh-sa__btn" onClick={() => router.push(HREF.repository)}>
            Back to Repository
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={!dirty || busy} onClick={save}>
            Save Content
          </button>
        </>
      }
    >
      {notice.node}
      {!data || !topics ? (
        <Loading error={error} />
      ) : (
        <>
          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>{data.name || data.course}</h2>
              <span className="cm-row-actions">
                <LinkBtn onClick={() => setOpen(new Set(topics.map((t) => t.id)))}>Expand all</LinkBtn>
                <span className="cm-sep">|</span>
                <LinkBtn onClick={() => setOpen(new Set())}>Collapse all</LinkBtn>
              </span>
            </div>
            <p className="cm-muted">
              {data.format} format · {topics.length} section(s). Changes here only reach course sessions when you PUSH from the repository list.
            </p>
          </section>
          {topics.map((t, i) => {
            const expanded = open.has(t.id);
            return (
              <section key={t.id} className="mh-sa__card cm-topic">
                <div className="mh-sa__card-head">
                  <button
                    type="button"
                    className="cm-linkbtn"
                    aria-expanded={expanded}
                    onClick={() =>
                      setOpen((s) => {
                        const n = new Set(s);
                        if (n.has(t.id)) n.delete(t.id);
                        else n.add(t.id);
                        return n;
                      })
                    }
                  >
                    {expanded ? "▾" : "▸"}
                  </button>
                  <input className="mh-sa__input" aria-label={`${label} ${i + 1} title`} value={t.title} onChange={(e) => patch(i, { title: e.target.value })} style={{ flex: 1 }} />
                  <span className="cm-row-actions">
                    <LinkBtn disabled={i === 0} onClick={() => setTopics(move(topics, i, i - 1))}>
                      ↑
                    </LinkBtn>
                    <LinkBtn disabled={i === topics.length - 1} onClick={() => setTopics(move(topics, i, i + 1))}>
                      ↓
                    </LinkBtn>
                    <LinkBtn danger onClick={() => setTopics(topics.filter((_, j) => j !== i))}>
                      DELETE
                    </LinkBtn>
                  </span>
                </div>
                {expanded ? (
                  <>
                    <label className="mh-sa__field mh-sa__field--wide">
                      <span className="mh-sa__label">Summary</span>
                      <textarea className="mh-sa__input" rows={2} value={t.summary} onChange={(e) => patch(i, { summary: e.target.value })} />
                    </label>
                    <ul className="cm-stack" style={{ listStyle: "none", padding: 0, margin: "10px 0" }}>
                      {t.activities.map((a, k) => (
                        <li key={a.id} className="cm-activity">
                          <span className="cm-pill cm-pill--info">{a.type}</span>
                          <span style={{ flex: 1 }}>
                            {a.name}
                            {a.fileName ? <span className="cm-muted"> · {a.fileName}</span> : null}
                          </span>
                          <span className="cm-row-actions">
                            <LinkBtn disabled={k === 0} onClick={() => patch(i, { activities: move(t.activities, k, k - 1) })}>
                              ↑
                            </LinkBtn>
                            <LinkBtn disabled={k === t.activities.length - 1} onClick={() => patch(i, { activities: move(t.activities, k, k + 1) })}>
                              ↓
                            </LinkBtn>
                            <LinkBtn onClick={() => setEditing({ topic: i, act: k })}>EDIT</LinkBtn>
                            <LinkBtn danger onClick={() => patch(i, { activities: t.activities.filter((_, j) => j !== k) })}>
                              X
                            </LinkBtn>
                          </span>
                        </li>
                      ))}
                      {!t.activities.length ? <li className="cm-muted">No items in this section yet.</li> : null}
                    </ul>
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setEditing({ topic: i, act: null })}>
                      + Add an activity or resource
                    </button>
                  </>
                ) : null}
              </section>
            );
          })}
          <button
            type="button"
            className="mh-sa__btn"
            onClick={() => {
              const nt = { id: uid("t"), title: `${label} ${topics.length + 1}`, summary: "", activities: [] };
              setTopics([...topics, nt]);
              setOpen((s) => new Set(s).add(nt.id));
            }}
          >
            + Add {label}
          </button>
        </>
      )}
      {editing && topics ? (
        <ActivityModal
          types={data?.activityTypes ?? ["PAGE"]}
          initial={editing.act === null ? null : topics[editing.topic].activities[editing.act]}
          onClose={() => setEditing(null)}
          onSave={(a) => {
            const t = topics[editing.topic];
            patch(editing.topic, { activities: editing.act === null ? [...t.activities, a] : t.activities.map((x, j) => (j === editing.act ? a : x)) });
            setEditing(null);
          }}
        />
      ) : null}
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* Course Backups                                                       */
/* ------------------------------------------------------------------ */

type BackupRow = { id: string; available: boolean; course: string; courseTitle: string; term: string; instructors: string[]; backup: string; by: string; at: string };

export function BackupsScreen() {
  const { meta } = useMeta();
  const notice = useNotice();
  const statuses = meta?.options.backupStatuses ?? ["Available Backups", "All Backups"];
  const [draft, setDraft] = useState({ campus: "", course: "", term: "", status: "Available Backups" });
  const [applied, setApplied] = useState(draft);
  const [paging, setPaging] = useState({ page: 1, perPage: 25 });
  const { data, error, reload } = useLoad<Paged<BackupRow>>(`/backups${qs({ ...applied, ...paging })}`, "Could not load course backups");
  const [restoring, setRestoring] = useState<BackupRow | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  return (
    <Frame title="Course Backups" crumbs={["Course Backups"]} active={HREF.backups}>
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
          <RefSelect label="Campus" value={draft.campus} onChange={set("campus")} options={meta?.refs.campuses ?? []} all="All Campuses" />
          <RefSelect label="Course" value={draft.course} onChange={set("course")} options={meta?.refs.courses ?? []} all="All Courses" />
          <RefSelect label="Term" value={draft.term} onChange={set("term")} options={meta?.refs.terms ?? []} all="All Terms" />
          <RefSelect label="Status" value={draft.status} onChange={set("status")} options={statuses} all="" />
          <span className="cm-filters__go">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Show Backups
            </button>
          </span>
        </form>
        {!data ? (
          <Loading error={error} />
        ) : !data.items.length ? (
          <p className="cm-empty">No course backups were found.</p>
        ) : (
          <>
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Instructor(s)</th>
                    <th>Backup</th>
                    <th className="lx-actions">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="cm-stack">
                          <strong>{b.course}</strong>
                          <span className="cm-muted">{[b.courseTitle, b.term].filter(Boolean).join(" · ")}</span>
                        </div>
                      </td>
                      <td>{b.instructors.length ? b.instructors.join(", ") : <span className="cm-muted">Not Set</span>}</td>
                      <td>
                        <div className="cm-stack">
                          <span>{b.backup}</span>
                          <span className="cm-muted">
                            {fmtStamp(b.at)} · {str(b.by)}
                          </span>
                        </div>
                      </td>
                      <td className="lx-actions">
                        {b.available ? (
                          <button type="button" className="mh-sa__btn" onClick={() => setRestoring(b)}>
                            Restore
                          </button>
                        ) : (
                          <span className="cm-muted">Unavailable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager data={data} onPage={(page) => setPaging((p) => ({ ...p, page }))} onPerPage={(perPage) => setPaging({ page: 1, perPage })} />
          </>
        )}
      </section>
      {restoring ? (
        <Confirm
          title="Restore course backup?"
          body={
            <p>
              This will replace the current content for <strong>{restoring.course}</strong> with the snapshot from {fmtStamp(restoring.at)}. The current content will be saved as a new safety backup first.
            </p>
          }
          okLabel={busy ? "Restoring…" : "Restore Backup"}
          danger={false}
          busy={busy}
          onCancel={() => !busy && setRestoring(null)}
          onOk={() => {
            setBusy(true);
            send(`/backups/${encodeURIComponent(restoring.id)}/restore`, "POST")
              .then((result) => {
                notice.ok(result.message);
                setRestoring(null);
                reload();
              })
              .catch((e) => notice.fail(errMsg(e, "Could not restore this backup")))
              .finally(() => setBusy(false));
          }}
        />
      ) : null}
    </Frame>
  );
}

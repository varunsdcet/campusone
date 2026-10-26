"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Btn,
  Card,
  ConfirmModal,
  Empty,
  ErrorLine,
  F,
  FileLinks,
  Filters,
  Grid,
  LinkBtn,
  Modal,
  RichTextEditor,
  SafeHtml,
  Sel,
  SourceNotice,
  Table,
  Txt,
  fmtDate,
  fmtStamp,
  profileHref,
  qs,
  send,
  useLoad,
  useStudentsMeta,
  useSubmit,
  type FileRef,
} from "./kit";
import { statusOptions } from "./CreateStudent";
import { useProfile } from "./Profile";

const enc = encodeURIComponent;

/* ------------------------------------------------------------------ */
/* Student Overview (read-only)                                         */
/* ------------------------------------------------------------------ */

type Overview = {
  contact: Record<string, string>;
  emergency: { name: string; phone: string };
  enrolment: { campus: string; program: string; schedule: string; feedIn: string; startDate: string; endDate: string };
  declarations: { completedBy: string; acknowledgements: Array<{ label: string; accepted: boolean }> };
  language: string;
  rateCategory: string;
  residency: string;
  visa: { status: string; expiry: string };
  advisors: string[];
  agent: string;
  transcripts: FileRef[];
};

function DL({ items }: { items: Array<[string, string | undefined | null]> }) {
  return (
    <dl className="st-dl">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function RateCategoryModal({ current, onClose, onSaved }: { current: string; onClose: () => void; onSaved: () => void }) {
  const { id, notice } = useProfile();
  const { meta } = useStudentsMeta();
  const [value, setValue] = useState(current);
  const { busy, error, setError, run } = useSubmit();
  const save = async () => {
    if (!value) return setError("Select a Rate Category / Fee Status");
    if (await run(() => send(`/${enc(id)}/rate-category`, "PUT", { rateCategory: value }), "Could not save the rate category")) {
      notice.ok("Rate Category / Fee Status saved.");
      onSaved();
    }
  };
  return (
    <Modal
      title="Rate Category / Fee Status"
      onClose={onClose}
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          Save
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <F label="Rate Category / Fee Status" req>
        <Sel value={value} onChange={setValue} empty="— Select —" options={meta?.options.rateCategories ?? []} />
      </F>
    </Modal>
  );
}

export function StudentOverview() {
  const { id, notice } = useProfile();
  const router = useRouter();
  const { data, error, reload } = useLoad<Overview>(`/${enc(id)}/overview`);
  const [deleting, setDeleting] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  if (!data) return error ? <ErrorLine>{error}</ErrorLine> : <Empty>Loading…</Empty>;
  const c = data.contact;
  return (
    <>
      <Card title="Contact Information">
        <DL
          items={[
            ["Last Name", c.lastName],
            ["First Name", c.firstName],
            ["Middle Name", c.middleName],
            ["Preferred Name", c.preferredName],
            ["Date of Birth", c.dateOfBirth ? fmtDate(c.dateOfBirth) : ""],
            ["Gender", c.gender],
            ["Street Address", c.street],
            ["City", c.city],
            ["Postal/ZIP Code", c.postal],
            ["Country", c.country],
            ["Province/State", c.province],
            ["Phone Number", c.phone],
            ["E-mail Address", c.email],
          ]}
        />
      </Card>
      <Card title="Emergency Contact">
        <DL
          items={[
            ["Contact Name", data.emergency.name],
            ["Contact Phone Number", data.emergency.phone],
          ]}
        />
      </Card>
      <Card title="Enrolment Information">
        <DL
          items={[
            ["Campus", data.enrolment.campus],
            ["Program of Study", data.enrolment.program],
            ["Schedule / Intake", data.enrolment.schedule],
            ["Feed-In", data.enrolment.feedIn],
            ["Start Date", data.enrolment.startDate ? fmtDate(data.enrolment.startDate) : ""],
            ["End Date", data.enrolment.endDate ? fmtDate(data.enrolment.endDate) : ""],
            ["Domestic / International", data.residency],
            ["Visa Status", data.visa.status],
            ["Visa Expiry Date", data.visa.expiry ? fmtDate(data.visa.expiry) : ""],
            ["Advisor(s)", data.advisors.join(", ")],
            ["Agent", data.agent],
          ]}
        />
        {data.transcripts.length ? (
          <p className="pm-note">
            Transcripts: <FileLinks studentId={id} files={data.transcripts} />
          </p>
        ) : null}
      </Card>
      <Card title="Declarations">
        <DL items={[["Completed by", data.declarations.completedBy]]} />
        <ul className="pm-note" style={{ paddingLeft: 18 }}>
          {data.declarations.acknowledgements.map((a) => (
            <li key={a.label}>
              {a.accepted ? "✔" : "✗"} {a.label}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Other">
        <DL
          items={[
            ["Student Language", data.language],
            ["Rate Category / Fee Status", data.rateCategory],
          ]}
        />
        <p>
          <LinkBtn onClick={() => setEditingRate(true)}>{data.rateCategory ? "Change Rate Category / Fee Status" : "Set Rate Category / Fee Status"}</LinkBtn>
        </p>
        {editingRate ? (
          <RateCategoryModal
            current={data.rateCategory || data.residency}
            onClose={() => setEditingRate(false)}
            onSaved={() => {
              setEditingRate(false);
              reload();
            }}
          />
        ) : null}
      </Card>
      <p>
        <LinkBtn danger onClick={() => setDeleting(true)}>
          Archive Profile
        </LinkBtn>
      </p>
      {deleting ? (
        <ConfirmModal
          title="Archive Student Profile"
          body="Archive this profile? Portal login will be disabled and the student will be marked withdrawn. Academic, finance and audit history will be retained."
          ok="Archive Profile"
          onCancel={() => setDeleting(false)}
          onOk={async () => {
            try {
              await send(`/${enc(id)}`, "DELETE");
              notice.ok("Student profile archived and login disabled.");
              router.push("/admin/student-management");
            } catch (error) {
              notice.fail(error instanceof Error ? error.message : "Could not archive profile");
            }
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Flags & Holds (personal)                                             */
/* ------------------------------------------------------------------ */

type Flag = { id: string; name: string; message: string; applyHold: string; resolved: string; status: string; date: string };

function FlagModal({ flag, onClose, onSaved }: { flag: Flag | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { id } = useProfile();
  const [name, setName] = useState(flag?.name ?? "");
  const [message, setMessage] = useState(flag?.message ?? "");
  const [applyHold, setApplyHold] = useState(flag?.applyHold ?? "No");
  const { busy, error, setError, run } = useSubmit();
  const save = async () => {
    if (!name.trim()) return setError("Flag / Hold Name is required");
    const body = { name, message, applyHold };
    const ok = await run(() => (flag ? send(`/${enc(id)}/flags/${enc(flag.id)}`, "PUT", body) : send(`/${enc(id)}/flags`, "POST", body)));
    if (ok) onSaved(flag ? "Flag / hold updated." : "Flag / hold added.");
  };
  return (
    <Modal
      title={flag ? "Edit Flag / Hold" : "Add Flag / Hold"}
      onClose={onClose}
      wide
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          Save Flag / Hold
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Flag / Hold Name" req wide>
          <Txt value={name} onChange={setName} />
        </F>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Flag / Hold Message</span>
          <RichTextEditor value={message} onChange={setMessage} label="Flag / Hold Message" />
        </div>
        <F label="Apply Hold">
          <Sel value={applyHold} onChange={setApplyHold} options={["No", "Yes"]} />
        </F>
      </Grid>
    </Modal>
  );
}

export function FlagsHolds() {
  const { id, notice } = useProfile();
  const [draft, setDraft] = useState({ status: "Active", resolved: "All" });
  const [applied, setApplied] = useState(draft);
  const { data, error, reload } = useLoad<{ items: Flag[] }>(`/${enc(id)}/flags${qs(applied)}`);
  const [editing, setEditing] = useState<Flag | null | "new">(null);
  const [deleting, setDeleting] = useState<Flag | null>(null);
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" onClick={() => setEditing("new")}>
            Add Flag / Hold
          </Btn>
        }
      >
        <Filters submit="Search Flags" onSubmit={() => setApplied({ ...draft })}>
          <F label="Status">
            <Sel value={draft.status} onChange={(v) => setDraft((d) => ({ ...d, status: v }))} options={["Active", "Dismissed"]} />
          </F>
          <F label="Resolved">
            <Sel value={draft.resolved} onChange={(v) => setDraft((d) => ({ ...d, resolved: v }))} options={["All", "No", "Yes"]} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Description", "Resolved", "Applies Hold", "Date", ""]} empty={data ? "No flags or holds were found." : false}>
          {(data?.items ?? []).map((f) => (
            <tr key={f.id}>
              <td>
                <strong>{f.name}</strong>
                {f.status === "Dismissed" ? <span className="st-pill st-pill--off" style={{ marginLeft: 6 }}>Dismissed</span> : null}
              </td>
              <td>{f.resolved === "Yes" ? <span className="st-pill st-pill--ok">Resolved</span> : <span className="st-pill st-pill--warn">Unresolved</span>}</td>
              <td>{f.applyHold}</td>
              <td>{fmtStamp(f.date)}</td>
              <td className="st-right">
                <span className="st-actions">
                  <LinkBtn onClick={() => setEditing(f)}>Edit</LinkBtn>
                  <LinkBtn danger onClick={() => setDeleting(f)}>
                    Delete
                  </LinkBtn>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing ? (
        <FlagModal
          flag={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notice.ok(msg);
            reload();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Delete Flag / Hold"
          body={`Delete "${deleting.name}"? This cannot be undone.`}
          ok="Confirm Delete"
          onCancel={() => setDeleting(null)}
          onOk={async () => {
            try {
              await send(`/${enc(id)}/flags/${enc(deleting.id)}`, "DELETE");
              notice.ok("Flag / hold deleted.");
              reload();
            } catch (e) {
              notice.fail(e instanceof Error ? e.message : "Delete failed");
            }
            setDeleting(null);
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Attendance Records                                                   */
/* ------------------------------------------------------------------ */

type Attendance = { courses: Array<{ value: string; label: string }>; items: Array<{ id: string; date: string; course: string; present: boolean; late?: boolean; absent: boolean; excused: boolean; note: string }> };

export function AttendanceRecords() {
  const { id } = useProfile();
  const [draft, setDraft] = useState({ course: "", startDate: "", endDate: "" });
  const [applied, setApplied] = useState(draft);
  const { data, error } = useLoad<Attendance>(`/${enc(id)}/attendance${qs(applied)}`);
  const mark = (on: boolean) => (on ? "✔" : "");
  return (
    <>
      <Card>
        <Filters submit="FILTER ATTENDANCE" onSubmit={() => setApplied({ ...draft })}>
          <F label="Course Filter">
            {data && !data.courses.length ? (
              <Sel value="" onChange={() => undefined} options={[]} empty="No Course Records" disabled />
            ) : (
              <Sel value={draft.course} onChange={(v) => setDraft((d) => ({ ...d, course: v }))} empty="All Courses" options={data?.courses ?? []} />
            )}
          </F>
          <F label="Start Date">
            <Txt type="date" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} />
          </F>
          <F label="End Date">
            <Txt type="date" value={draft.endDate} onChange={(v) => setDraft((d) => ({ ...d, endDate: v }))} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Date", "Course", "Present", "Late", "Absent", "Excused", "Note"]} empty={data ? "No attendance records were found." : false}>
          {(data?.items ?? []).map((a) => (
            <tr key={a.id}>
              <td>{fmtDate(a.date)}</td>
              <td>{a.course}</td>
              <td>{mark(a.present)}</td>
              <td>{mark(a.late === true)}</td>
              <td>{mark(a.absent)}</td>
              <td>{mark(a.excused)}</td>
              <td>{a.note || "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* New Program Profile / Change Status                                  */
/* ------------------------------------------------------------------ */

export function NewProgramProfile() {
  const { id, meta } = useProfile();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const create = async () => {
    if (!status) return setError("New Profile Status is required");
    const out = await run(() => send<{ id: string; studentNumber: string }>(`/${enc(id)}/program-profile`, "POST", { status }), "Could not create the program profile");
    if (out) router.push(`${profileHref(out.id)}?notice=${enc(`New program profile created (${out.studentNumber}).`)}`);
  };
  return (
    <Card title="New Program Profile">
      <p className="st-warning">
        This creates an additional enrolment / program profile for the same person. Because of this, the person may appear more than once in student search results. To change the status of this existing profile, use Change Status instead.
      </p>
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="New Profile Status" req>
          <Sel value={status} onChange={setStatus} empty="— Select —" options={statusOptions(meta)} />
        </F>
      </Grid>
      <div className="st-filters__actions" style={{ marginTop: 12 }}>
        <Btn tone="primary" disabled={busy} onClick={() => void create()}>
          Create Program Profile
        </Btn>
      </div>
    </Card>
  );
}

export function ChangeStatus() {
  const { id, meta, header, reloadHeader, notice } = useProfile();
  const [open, setOpen] = useState(true);
  const [graduateOpen, setGraduateOpen] = useState(false);
  const [status, setStatus] = useState("");
  const { busy, error, setError, run } = useSubmit();
  const save = async () => {
    if (!status) return setError("New Status is required");
    const out = await run(() => send<{ status: string }>(`/${enc(id)}/status`, "POST", { status }), "Could not change status");
    if (out) {
      setOpen(false);
      setStatus("");
      notice.ok(`Student status changed to "${out.status}".`);
      reloadHeader();
    }
  };
  return (
    <>
      <Card
        title="Change Status"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small onClick={() => setGraduateOpen(true)}>Run Graduation Audit</Btn>
            <Btn small tone="primary" onClick={() => setOpen(true)}>Change Status</Btn>
          </div>
        }
      >
        <p>
          Current status: <span className="st-pill">{header.status}</span>
        </p>
        <p className="mh-sa__muted pm-note">Changes the status of this profile only. Statuses are not a fixed sequence; any configured status can be chosen, subject to validation.</p>
      </Card>
      {open ? (
        <Modal
          title="CHANGE STUDENT STATUS"
          onClose={() => setOpen(false)}
          footer={
            <Btn tone="primary" disabled={busy} onClick={() => void save()}>
              Change Status
            </Btn>
          }
        >
          <ErrorLine>{error}</ErrorLine>
          <F label="New Status" req>
            <Sel value={status} onChange={setStatus} empty="— Select —" options={statusOptions(meta).filter((o) => o.value !== header.status)} />
          </F>
        </Modal>
      ) : null}
      {graduateOpen ? (
        <ConfirmModal
          title="Graduate Student"
          body="Run the final degree, requirements, requests, holds and balance audit. Only a clear audit will mark the profile Graduated and issue the degree credential."
          ok={busy ? "Auditing…" : "Audit & Graduate"}
          danger={false}
          onCancel={() => setGraduateOpen(false)}
          onOk={() => {
            void (async () => {
              const out = await run(
                () => send<{ status: string; credentialTitle: string }>(`/${enc(id)}/graduation`, "POST", {}),
                "Graduation audit failed",
              );
              if (out) {
                setGraduateOpen(false);
                notice.ok(`${out.credentialTitle} issued; student status changed to ${out.status}.`);
                reloadHeader();
              }
            })();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Audit Trail                                                          */
/* ------------------------------------------------------------------ */

export type AuditItem = { id: string; date: string; by: string; section: string; action: string; before: unknown; after: unknown; note: string };

function kv(v: unknown): Array<[string, string]> {
  if (!v || typeof v !== "object") return [];
  return Object.entries(v as Record<string, unknown>)
    .filter(([k]) => !["id", "_order"].includes(k))
    .map(([k, x]) => [k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase()), typeof x === "object" && x !== null ? JSON.stringify(x) : String(x ?? "")]);
}

const looksHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

export function AuditDetail({ item, onClose }: { item: AuditItem; onClose: () => void }) {
  const after = kv(item.after);
  const before = kv(item.before);
  return (
    <Modal title={item.action} onClose={onClose} wide footer={<Btn onClick={onClose}>Close</Btn>}>
      <dl className="st-detail">
        <dt>Date</dt>
        <dd>{fmtStamp(item.date)}</dd>
        <dt>By</dt>
        <dd>{item.by}</dd>
        {item.section ? (
          <>
            <dt>Section</dt>
            <dd>{item.section}</dd>
          </>
        ) : null}
        {after.map(([k, v]) => (
          <FragmentRow key={`a-${k}`} k={k} v={v} />
        ))}
      </dl>
      {before.length ? (
        <>
          <h3 style={{ fontSize: 14, margin: "10px 0 6px" }}>Previous values</h3>
          <dl className="st-detail">
            {before.map(([k, v]) => (
              <FragmentRow key={`b-${k}`} k={k} v={v} />
            ))}
          </dl>
        </>
      ) : null}
      {item.note ? <p className="pm-note">{item.note}</p> : null}
    </Modal>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>{looksHtml(v) ? <SafeHtml html={v} empty="—" /> : v || "—"}</dd>
    </>
  );
}

export function AuditTrail() {
  const { id, meta } = useProfile();
  const sections = meta.options.auditSections ?? [];
  const [draft, setDraft] = useState<{ startDate: string; endDate: string; sections: string[] }>({ startDate: "", endDate: "", sections: [] });
  const [applied, setApplied] = useState(draft);
  const { data, error } = useLoad<{ items: AuditItem[] }>(`/${enc(id)}/audit${qs({ startDate: applied.startDate, endDate: applied.endDate, sections: applied.sections.join(",") })}`);
  const [open, setOpen] = useState<AuditItem | null>(null);
  return (
    <>
      <Card>
        <Filters submit="Student Search" onSubmit={() => setApplied({ ...draft })}>
          <F label="Start Datestamp">
            <Txt type="date" value={draft.startDate} onChange={(v) => setDraft((d) => ({ ...d, startDate: v }))} />
          </F>
          <F label="End Datestamp">
            <Txt type="date" value={draft.endDate} onChange={(v) => setDraft((d) => ({ ...d, endDate: v }))} />
          </F>
          <F label="Audit Sections" hint="Leave empty for all sections">
            <select className="mh-sa__input" multiple size={4} value={draft.sections} onChange={(e) => setDraft((d) => ({ ...d, sections: Array.from(e.target.selectedOptions).map((o) => o.value) }))}>
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Date", "By", "Section", "Action(s)"]} empty={data ? "No audit records were found." : false}>
          {(data?.items ?? []).map((a) => (
            <tr key={a.id}>
              <td>{fmtStamp(a.date)}</td>
              <td>{a.by}</td>
              <td>{a.section}</td>
              <td>
                <LinkBtn onClick={() => setOpen(a)}>{a.action}</LinkBtn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {open ? <AuditDetail item={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

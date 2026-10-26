"use client";

import { useMemo, useState } from "react";
import {
  Btn,
  Card,
  Check,
  ConfirmModal,
  Empty,
  ErrorLine,
  F,
  FileDrop,
  FileLinks,
  Filters,
  Grid,
  LinkBtn,
  Modal,
  PagerFor,
  RichTextEditor,
  SafeHtml,
  Sel,
  SourceNotice,
  Table,
  Txt,
  downloadBase64,
  fmtDate,
  fmtStamp,
  qs,
  send,
  uploadAll,
  useLoad,
  usePaging,
  useSubmit,
  type FileRef,
  type Paged,
  type PendingFile,
  type StudentsMeta,
} from "./kit";
import { useProfile } from "./Profile";

const enc = encodeURIComponent;

/* ------------------------------------------------------------------ */
/* Generate Document                                                    */
/* ------------------------------------------------------------------ */

export function GenerateDocument() {
  const { id, meta, notice } = useProfile();
  const [choice, setChoice] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const { busy, error, run } = useSubmit();
  const letters = meta.documentTemplates.filter((t) => t.documentType !== "Invoice / Receipt");
  const options = letters.map((t) => ({ value: t.id, label: t.name }));
  const selected = letters.find((template) => template.id === choice);
  const generate = async () => {
    const out = await run(
      () => send<{ filename: string; mime: string; base64: string }>(`/${enc(id)}/documents/generate`, "POST", { templateId: choice, inputs }),
      "Could not generate document",
    );
    if (!out) return;
    downloadBase64(out.filename, out.mime, out.base64, true);
    notice.ok("Document generated.");
  };
  return (
    <Card title="Generate Document">
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Document Type">
          <Sel value={choice} onChange={(value) => { setChoice(value); setInputs({}); }} empty="— Select Document —" options={options} />
        </F>
        {selected?.inputs.map((key) => (
          <F key={key} label={key.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())} req>
            <Txt value={inputs[key] ?? ""} onChange={(value) => setInputs((current) => ({ ...current, [key]: value }))} />
          </F>
        ))}
      </Grid>
      {!letters.length ? <p className="pm-note mh-sa__muted">No document templates are configured. Add one under System Configuration › Document Templates.</p> : null}
      <div className="st-filters__actions" style={{ marginTop: 12 }}>
        <Btn tone="primary" disabled={!choice || busy} onClick={() => void generate()}>
          {busy ? "Generating…" : "Generate PDF"}
        </Btn>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Correspondence + Send Notification                                   */
/* ------------------------------------------------------------------ */

type Corr = {
  id: string;
  title: string;
  categoryId: string;
  category: string;
  typeId: string;
  type: string;
  notes: string;
  content: string;
  files: FileRef[];
  visibility: string;
  kind: string;
  method: string;
  delivery: string;
  lastUpdated: string;
  updatedBy: string;
};

const MISC = { id: "misc", name: "Miscellaneous" };

function useCorrCatalogue(meta: StudentsMeta) {
  return useMemo(() => {
    const categories = [...meta.correspondence.categories, MISC];
    const typesFor = (categoryId: string) => meta.correspondence.types.filter((t) => (categoryId === MISC.id ? t.categories.length === 0 : t.categories.includes(categoryId)));
    return { categories, typesFor };
  }, [meta]);
}

function CorrModal({ record, onClose, onSaved }: { record: Corr | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { id, meta } = useProfile();
  const cat = useCorrCatalogue(meta);
  const [f, setF] = useState({
    categoryId: record?.categoryId ?? "",
    typeId: record?.typeId ?? "",
    title: record?.title ?? "",
    notes: record?.notes ?? "",
    content: record?.content ?? "",
    visibility: record?.visibility ?? meta.options.corrVisibility?.[0] ?? "Hidden from student",
  });
  const [kept, setKept] = useState<FileRef[]>(record?.files ?? []);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v, ...(k === "categoryId" ? { typeId: "" } : {}) }));
  const save = async () => {
    const missing = [!f.categoryId && "Category", !f.typeId && "Record Type", !f.title.trim() && "Record Title"].filter(Boolean);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    const ok = await run(async () => {
      const uploaded = await uploadAll(id, pending);
      const body = { ...f, files: [...kept, ...uploaded].map((x) => x.id) };
      return record ? send(`/${enc(id)}/correspondence/${enc(record.id)}`, "PUT", body) : send(`/${enc(id)}/correspondence`, "POST", body);
    });
    if (ok) onSaved(record ? "Correspondence record updated." : "Correspondence record added.");
  };
  return (
    <Modal
      title={record ? "Edit Correspondence Record" : "Add Correspondence Record"}
      onClose={onClose}
      wide
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          SAVE RECORD
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Category" req>
          <Sel value={f.categoryId} onChange={set("categoryId")} empty="— Select —" options={cat.categories.map((c) => ({ value: c.id, label: c.name }))} />
        </F>
        <F label="Record Type" req>
          <Sel value={f.typeId} onChange={set("typeId")} empty={f.categoryId ? "— Select —" : "Select a category first"} disabled={!f.categoryId} options={cat.typesFor(f.categoryId).map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Record Title" req wide>
          <Txt value={f.title} onChange={set("title")} />
        </F>
        <F label="Notes / Description" wide>
          <textarea className="mh-sa__input" rows={3} value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
        </F>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Correspondence</span>
          <RichTextEditor value={f.content} onChange={set("content")} label="Correspondence content" />
        </div>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Correspondence Document(s)</span>
          {kept.length ? (
            <ul className="st-files">
              {kept.map((k) => (
                <li key={k.id}>
                  {k.name}
                  <button type="button" aria-label={`Remove ${k.name}`} onClick={() => setKept((x) => x.filter((y) => y.id !== k.id))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <FileDrop files={pending} onChange={setPending} />
        </div>
        <F label="Document(s) Visibility">
          <Sel value={f.visibility} onChange={set("visibility")} options={meta.options.corrVisibility ?? []} />
        </F>
      </Grid>
    </Modal>
  );
}

function NotificationModal({ onClose, onSent }: { onClose: () => void; onSent: (msg: string) => void }) {
  const { id, meta } = useProfile();
  const cat = useCorrCatalogue(meta);
  const methods = meta.options.notificationMethods ?? ["External E-mail"];
  const [f, setF] = useState({ template: "No Template", categoryId: "", typeId: "", method: methods[0] ?? "", subject: "", body: "" });
  const [editorKey, setEditorKey] = useState(0);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v, ...(k === "categoryId" ? { typeId: "" } : {}) }));
  const pickTemplate = (v: string) => {
    const t = meta.notificationTemplates.find((x) => x.id === v);
    setF((s) => ({ ...s, template: v, ...(t?.subject ? { subject: t.subject } : {}), ...(t?.body ? { body: t.body } : {}) }));
    if (t?.body) setEditorKey((k) => k + 1);
  };
  const sendIt = async () => {
    const missing = [!f.categoryId && "Category", !f.typeId && "Record Type", !f.subject.trim() && "Subject", !f.body.replace(/<[^>]*>/g, "").trim() && "Message Body"].filter(Boolean);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    const out = await run(async () => {
      const uploaded = await uploadAll(id, files);
      return send<{ message: string; emailDelivered: boolean; delivery: string }>(`/${enc(id)}/notifications`, "POST", { ...f, attachments: uploaded.map((u) => u.id) });
    }, "Could not send notification");
    if (out) onSent(out.emailDelivered ? out.message : `${out.message}. ${out.delivery}.`);
  };
  return (
    <Modal
      title="SEND NOTIFICATION TO STUDENT"
      onClose={onClose}
      wide
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void sendIt()}>
          SEND NOTIFICATION
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Notification Template">
          <Sel value={f.template} onChange={pickTemplate} options={[{ value: "No Template", label: "No Template" }, ...meta.notificationTemplates.map((t) => ({ value: t.id, label: t.name }))]} />
        </F>
        <F label="Category" req>
          <Sel value={f.categoryId} onChange={set("categoryId")} empty="— Select —" options={cat.categories.map((c) => ({ value: c.id, label: c.name }))} />
        </F>
        <F label="Record Type" req>
          <Sel value={f.typeId} onChange={set("typeId")} empty={f.categoryId ? "— Select —" : "Select a category first"} disabled={!f.categoryId} options={cat.typesFor(f.categoryId).map((t) => ({ value: t.id, label: t.name }))} />
        </F>
        <F label="Notification Method">
          <Sel value={f.method} onChange={set("method")} options={methods} />
        </F>
        <F label="Subject" req wide>
          <Txt value={f.subject} onChange={set("subject")} />
        </F>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">
            Message Body<span className="lx-req">*</span>
          </span>
          <RichTextEditor key={editorKey} value={f.body} onChange={set("body")} label="Message Body" />
        </div>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Notification Template Attachments</span>
          <FileDrop files={files} onChange={setFiles} />
        </div>
      </Grid>
    </Modal>
  );
}

function CorrView({ record, onClose }: { record: Corr; onClose: () => void }) {
  const { id } = useProfile();
  return (
    <Modal title={record.title} onClose={onClose} wide footer={<Btn onClick={onClose}>Close</Btn>}>
      <dl className="st-detail">
        <dt>Category</dt>
        <dd>{record.category}</dd>
        <dt>Record Type</dt>
        <dd>{record.type}</dd>
        {record.kind === "notification" ? (
          <>
            <dt>Notification Method</dt>
            <dd>{record.method}</dd>
            <dt>Delivery</dt>
            <dd>{record.delivery}</dd>
          </>
        ) : null}
        <dt>Notes / Description</dt>
        <dd>{record.notes || "—"}</dd>
        <dt>Document(s) Visibility</dt>
        <dd>{record.visibility}</dd>
        <dt>Document(s)</dt>
        <dd>
          <FileLinks studentId={id} files={record.files} />
        </dd>
        <dt>Last Updated</dt>
        <dd>
          {fmtStamp(record.lastUpdated)}
          {record.updatedBy ? ` by ${record.updatedBy}` : ""}
        </dd>
      </dl>
      <SafeHtml html={record.content} empty="No correspondence content." />
    </Modal>
  );
}

export function Correspondence() {
  const { id, meta, notice } = useProfile();
  const cat = useCorrCatalogue(meta);
  const paging = usePaging(25);
  const [draft, setDraft] = useState({ categoryId: "", typeId: "", q: "" });
  const [applied, setApplied] = useState(draft);
  const { data, error, reload } = useLoad<Paged<Corr>>(`/${enc(id)}/correspondence${qs({ ...applied, page: paging.page, perPage: paging.perPage })}`);
  const [editing, setEditing] = useState<Corr | null | "new">(null);
  const [viewing, setViewing] = useState<Corr | null>(null);
  const [deleting, setDeleting] = useState<Corr | null>(null);
  const [notifying, setNotifying] = useState(false);
  return (
    <>
      <Card
        actions={
          <>
            <Btn small onClick={() => setNotifying(true)}>
              Send Notification
            </Btn>
            <Btn small tone="primary" onClick={() => setEditing("new")}>
              Add Correspondence Record
            </Btn>
          </>
        }
      >
        <Filters
          submit="SEARCH RECORDS"
          onSubmit={() => {
            setApplied({ ...draft });
            paging.reset();
          }}
        >
          <F label="Record Category">
            <Sel value={draft.categoryId} onChange={(v) => setDraft((d) => ({ ...d, categoryId: v, typeId: "" }))} empty="All Categories" options={cat.categories.map((c) => ({ value: c.id, label: c.name }))} />
          </F>
          <F label="Record Type">
            <Sel value={draft.typeId} onChange={(v) => setDraft((d) => ({ ...d, typeId: v }))} empty="All Types" disabled={!draft.categoryId} options={cat.typesFor(draft.categoryId).map((t) => ({ value: t.id, label: t.name }))} />
          </F>
          <F label="Record Name">
            <Txt value={draft.q} onChange={(v) => setDraft((d) => ({ ...d, q: v }))} placeholder="Enter Correspondence Name Here" />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <PagerFor data={data} paging={paging} />
        <Table head={["Name", "Type", "Last Updated", ""]} empty={data ? "No correspondence records were found." : false}>
          {(data?.items ?? []).map((r) => (
            <tr key={r.id}>
              <td>
                <LinkBtn onClick={() => setViewing(r)}>{r.title}</LinkBtn>
                {r.kind === "notification" ? <span className="st-pill st-pill--off" style={{ marginLeft: 6 }}>Notification</span> : null}
              </td>
              <td>
                {r.type}
                <div className="mh-sa__muted" style={{ fontSize: 12 }}>
                  {r.category}
                </div>
              </td>
              <td>
                {fmtStamp(r.lastUpdated)}
                {r.updatedBy ? <div className="mh-sa__muted" style={{ fontSize: 12 }}>{r.updatedBy}</div> : null}
              </td>
              <td className="st-right">
                <span className="st-actions">
                  <LinkBtn onClick={() => setEditing(r)}>Edit</LinkBtn>
                  <LinkBtn danger onClick={() => setDeleting(r)}>
                    Delete
                  </LinkBtn>
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {editing ? (
        <CorrModal
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            notice.ok(msg);
            reload();
          }}
        />
      ) : null}
      {viewing ? <CorrView record={viewing} onClose={() => setViewing(null)} /> : null}
      {notifying ? (
        <NotificationModal
          onClose={() => setNotifying(false)}
          onSent={(msg) => {
            setNotifying(false);
            notice.ok(msg);
            reload();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Delete Correspondence Record"
          body={`Delete "${deleting.title}"? This cannot be undone.`}
          ok="Confirm Delete"
          onCancel={() => setDeleting(null)}
          onOk={async () => {
            try {
              await send(`/${enc(id)}/correspondence/${enc(deleting.id)}`, "DELETE");
              notice.ok("Correspondence record deleted.");
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
/* Review Actions                                                       */
/* ------------------------------------------------------------------ */

export function ReviewActions() {
  const { id, meta } = useProfile();
  const [draft, setDraft] = useState("All");
  const [applied, setApplied] = useState("All");
  const { data, error } = useLoad<{ items: Array<{ id: string; name: string; type: string; status: string; date: string }> }>(`/${enc(id)}/actions${qs({ status: applied })}`);
  return (
    <>
      <Card>
        <Filters submit="Search Actions" onSubmit={() => setApplied(draft)}>
          <F label="Status">
            <Sel value={draft} onChange={setDraft} options={meta.options.actionStatuses ?? ["All"]} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        {data && !data.items.length ? (
          <Empty>No actions were found.</Empty>
        ) : (
          <Table head={["Action", "Type", "Status", "Date"]}>
            {(data?.items ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.type || "—"}</td>
                <td>{a.status}</td>
                <td>{fmtStamp(a.date)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Review Assessments (cases)                                           */
/* ------------------------------------------------------------------ */

type Case = { id: string; number: string; assessment: string; status: string; advisor: string; date: string };

function AddCaseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { id } = useProfile();
  const { data, error } = useLoad<{ items: Array<{ id: string; name: string }> }>(`/${enc(id)}/assessments/available`);
  const [pick, setPick] = useState("");
  const { busy, error: saveError, setError, run } = useSubmit();
  const none = data && !data.items.length;
  return (
    <Modal
      title="ADD ASSESSMENT CASE"
      onClose={onClose}
      footer={
        none ? (
          <Btn onClick={onClose}>Close</Btn>
        ) : (
          <Btn
            tone="primary"
            disabled={busy || !data}
            onClick={async () => {
              if (!pick) return setError("Select an assessment");
              if (await run(() => send(`/${enc(id)}/assessments`, "POST", { assessmentId: pick }))) onSaved();
            }}
          >
            Add Assessment
          </Btn>
        )
      }
    >
      <ErrorLine>{error ?? saveError}</ErrorLine>
      {!data ? (
        <Empty>Loading…</Empty>
      ) : none ? (
        <p className="st-warning">No assessments are available to add to this profile.</p>
      ) : (
        <>
          <F label="Assessment" req>
            <Sel value={pick} onChange={setPick} empty="— Select —" options={data.items.map((a) => ({ value: a.id, label: a.name }))} />
          </F>
          <p className="pm-note mh-sa__muted">Assessment questions, scoring and submission were not captured from the original system; the case is created with status &quot;Pending Assignment&quot;.</p>
        </>
      )}
    </Modal>
  );
}

export function Assessments() {
  const { id, meta, notice } = useProfile();
  const [draft, setDraft] = useState({ number: "", status: "" });
  const [applied, setApplied] = useState(draft);
  const { data, error, reload } = useLoad<{ items: Case[] }>(`/${enc(id)}/assessments${qs(applied)}`);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <Card
        title="Assessments / Cases"
        actions={
          <Btn small tone="primary" onClick={() => setAdding(true)}>
            Add Assessment
          </Btn>
        }
      >
        <Filters submit="Search Cases" onSubmit={() => setApplied({ ...draft })}>
          <F label="Assessment Filter">
            <Txt value={draft.number} onChange={(v) => setDraft((d) => ({ ...d, number: v }))} placeholder="Assessment #" />
          </F>
          <F label="Status Filter">
            <Sel value={draft.status} onChange={(v) => setDraft((d) => ({ ...d, status: v }))} empty="All Statuses" options={(meta.options.assessmentStatuses ?? []).filter((s) => s !== "All Statuses")} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <Table head={["Assessment #", "Assessment", "Status", "Date"]} empty={data ? "No assessment cases were found." : false}>
          {(data?.items ?? []).map((c) => (
            <tr key={c.id}>
              <td>{c.number}</td>
              <td>{c.assessment}</td>
              <td>{c.status}</td>
              <td>{fmtStamp(c.date)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {adding ? (
        <AddCaseModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            notice.ok("Assessment case added.");
            reload();
          }}
        />
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Review Requirements                                                  */
/* ------------------------------------------------------------------ */

type ReqRow = {
  id: string;
  name: string;
  dataType: string;
  dataCollection: string;
  summary: string;
  expiry: string;
  recurrence: string;
  documentType: string;
  documentTypeName: string;
  documentApproval: string;
  allowUpload: string;
  maxFiles: number;
  docExpiryValue: string;
  docExpiryUnit: string;
  expiryAction: string;
  requestedAt: string;
  submittedAt: string;
  status: string;
  submission: string;
  expiryDate: string;
  furtherReview: boolean;
};
type ReqDetail = ReqRow & { history: Array<{ at: string; by: string; status: string; action: string; files: FileRef[]; note: string; noteVisible: boolean; expiryDate: string }> };

function RequirementModal({ record, onClose, onSaved }: { record: ReqRow | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const { id, meta } = useProfile();
  const o = meta.options;
  const [f, setF] = useState({
    name: record?.name ?? "",
    dataType: record?.dataType ?? "",
    dataCollection: record?.dataCollection ?? "",
    summary: record?.summary ?? "",
    expiry: record?.expiry ?? "None",
    recurrence: record?.recurrence ?? "Disabled",
    documentType: record?.documentType ?? "",
    documentApproval: record?.documentApproval || o.reqDocApproval?.[0] || "",
    allowUpload: record?.allowUpload || "Yes",
    maxFiles: String(record?.maxFiles || 1),
    docExpiryValue: record?.docExpiryValue ?? "",
    docExpiryUnit: record?.docExpiryUnit || o.reqExpiryUnits?.[0] || "",
    expiryAction: record?.expiryAction || o.reqExpiryActions?.[0] || "",
  });
  const { busy, error, setError, run } = useSubmit();
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const isDoc = f.dataType === "Document Required";
  const save = async () => {
    const missing = [!f.name.trim() && "Requirement Name", !f.dataType && "Data Type", !f.dataCollection && "Data Collection", isDoc && !f.documentType && "Document Type"].filter(Boolean);
    if (missing.length) return setError(`Please complete: ${missing.join(", ")}`);
    const ok = await run(() => (record ? send(`/${enc(id)}/requirements/${enc(record.id)}`, "PUT", f) : send(`/${enc(id)}/requirements`, "POST", f)));
    if (ok) onSaved(record ? "Requirement updated." : "Requirement added successfully.");
  };
  return (
    <Modal
      title={record ? "Edit Requirement" : "Add Requirement"}
      onClose={onClose}
      wide
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void save()}>
          Save Requirement
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <Grid>
        <F label="Requirement Name" req wide>
          <Txt value={f.name} onChange={set("name")} />
        </F>
        <F label="Data Type" req>
          <Sel value={f.dataType} onChange={set("dataType")} empty="— Select —" options={o.reqDataTypes ?? []} />
        </F>
        {isDoc ? (
          <>
            <F label="Document Type" req>
              <Sel value={f.documentType} onChange={set("documentType")} empty={meta.documentTypes.length ? "— Select —" : "No document types configured"} options={meta.documentTypes.map((d) => ({ value: d.id, label: d.name }))} />
            </F>
            <F label="Document Approval">
              <Sel value={f.documentApproval} onChange={set("documentApproval")} options={o.reqDocApproval ?? []} />
            </F>
            <F label="Allow Upload">
              <Sel value={f.allowUpload} onChange={set("allowUpload")} options={["Yes", "No"]} />
            </F>
            <F label="Maximum Files">
              <Txt type="number" value={f.maxFiles} onChange={set("maxFiles")} />
            </F>
            <div className="mh-sa__field">
              <span className="mh-sa__label">Document Expiry</span>
              <div className="st-inline">
                <input className="mh-sa__input" type="number" min={1} max={100} aria-label="Document Expiry value" style={{ maxWidth: 90 }} value={f.docExpiryValue} onChange={(e) => set("docExpiryValue")(e.target.value)} />
                <Sel label="Document Expiry unit" value={f.docExpiryUnit} onChange={set("docExpiryUnit")} options={o.reqExpiryUnits ?? []} />
              </div>
            </div>
            <F label="Expiry Action">
              <Sel value={f.expiryAction} onChange={set("expiryAction")} options={o.reqExpiryActions ?? []} />
            </F>
          </>
        ) : null}
        <F label="Data Collection" req>
          <Sel value={f.dataCollection} onChange={set("dataCollection")} empty="— Select —" options={o.reqDataCollection ?? []} />
        </F>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Requirement Summary</span>
          <RichTextEditor value={f.summary} onChange={set("summary")} label="Requirement Summary" />
        </div>
        <F label="Requirement Expiry">
          <Sel value={f.expiry} onChange={set("expiry")} options={o.reqExpiry ?? []} />
        </F>
        <F label="Recurrence">
          <Sel value={f.recurrence} onChange={set("recurrence")} options={o.reqRecurrence ?? []} />
        </F>
      </Grid>
      {f.dataType && !isDoc ? <SourceNotice>Branch-specific settings for &quot;{f.dataType}&quot; were not captured from the original system; only the common requirement fields are saved.</SourceNotice> : null}
    </Modal>
  );
}

function UploadModal({ record, onClose, onSaved }: { record: ReqRow; onClose: () => void; onSaved: () => void }) {
  const { id } = useProfile();
  const [expiryDate, setExpiryDate] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const { busy, error, setError, run } = useSubmit();
  const upload = async () => {
    if (!files.length) return setError("Add at least one file");
    const ok = await run(async () => {
      const refs = await uploadAll(id, files);
      return send(`/${enc(id)}/requirements/${enc(record.id)}/upload`, "POST", { expiryDate, files: refs.map((r) => r.id) });
    }, "Upload failed");
    if (ok) onSaved();
  };
  return (
    <Modal
      title="UPLOAD REQUIRED FILE(S)"
      onClose={onClose}
      footer={
        <Btn tone="primary" disabled={busy} onClick={() => void upload()}>
          Upload Document(s)
        </Btn>
      }
    >
      <ErrorLine>{error}</ErrorLine>
      <p className="mh-sa__muted pm-note" style={{ marginTop: 0 }}>
        {record.name} — up to {record.maxFiles} file(s).
      </p>
      <Grid>
        <F label="Expiry Date">
          <Txt type="date" value={expiryDate} onChange={setExpiryDate} />
        </F>
        <div className="mh-sa__field mh-sa__field--wide">
          <span className="mh-sa__label">Upload Document(s)</span>
          <FileDrop files={files} onChange={setFiles} max={record.maxFiles || 1} />
        </div>
      </Grid>
    </Modal>
  );
}

function ReviewModal({ reqId, onClose, onSaved }: { reqId: string; onClose: () => void; onSaved: () => void }) {
  const { id, meta } = useProfile();
  const { data, error } = useLoad<ReqDetail>(`/${enc(id)}/requirements/${enc(reqId)}`);
  const [f, setF] = useState<{ expiryDate: string; status: string; furtherReview: boolean; note: string; noteVisible: boolean } | null>(null);
  const { busy, error: saveError, run } = useSubmit();
  const form = f ?? (data ? { expiryDate: data.expiryDate, status: data.status, furtherReview: data.furtherReview, note: "", noteVisible: false } : null);
  const set = <K extends keyof NonNullable<typeof form>>(k: K, v: NonNullable<typeof form>[K]) => setF({ ...form!, [k]: v });
  return (
    <Modal
      title="Review Requirement"
      onClose={onClose}
      wide
      footer={
        <Btn tone="primary" disabled={busy || !form} onClick={async () => form && (await run(() => send(`/${enc(id)}/requirements/${enc(reqId)}/review`, "POST", form))) && onSaved()}>
          Update Requirement
        </Btn>
      }
    >
      <ErrorLine>{error ?? saveError}</ErrorLine>
      {!data || !form ? (
        <Empty>Loading…</Empty>
      ) : (
        <>
          <dl className="st-detail">
            <dt>Name</dt>
            <dd>{data.name}</dd>
            <dt>Data Type</dt>
            <dd>{data.dataType}</dd>
            {data.dataType === "Document Required" ? (
              <>
                <dt>Document Type</dt>
                <dd>{data.documentTypeName || "—"}</dd>
                <dt>Document Approval</dt>
                <dd>{data.documentApproval || "—"}</dd>
                <dt>Allow Upload</dt>
                <dd>{data.allowUpload || "—"}</dd>
              </>
            ) : null}
            <dt>Data Collection</dt>
            <dd>{data.dataCollection}</dd>
            <dt>Current Status</dt>
            <dd>
              {data.status} <span className="mh-sa__muted">({data.submission})</span>
            </dd>
          </dl>
          <h3 style={{ fontSize: 14, margin: "8px 0" }}>Submission History</h3>
          <Table head={["Date/Time", "Updated By", "Status", "File(s)"]} empty="No submissions yet.">
            {data.history.map((h, i) => (
              <tr key={i}>
                <td>{fmtStamp(h.at)}</td>
                <td>{h.by}</td>
                <td>
                  {h.status}
                  <div className="mh-sa__muted" style={{ fontSize: 12 }}>
                    {h.action}
                    {h.note ? ` — ${h.note}` : ""}
                  </div>
                </td>
                <td>
                  <FileLinks studentId={id} files={h.files} />
                </td>
              </tr>
            ))}
          </Table>
          <div style={{ marginTop: 12 }}>
            <Grid>
              <F label="Expiry Date">
                <Txt type="date" value={form.expiryDate} onChange={(v) => set("expiryDate", v)} />
              </F>
              <F label="Requirement Status">
                <Sel value={form.status} onChange={(v) => set("status", v)} options={meta.options.reqStatuses ?? []} />
              </F>
            </Grid>
            <div className="lx-checks" style={{ margin: "8px 0" }}>
              <Check checked={form.furtherReview} onChange={(v) => set("furtherReview", v)}>
                Requirement received and requires further review
              </Check>
            </div>
            <F label="Note / Comments" wide>
              <textarea className="mh-sa__input" rows={3} value={form.note} onChange={(e) => set("note", e.target.value)} />
            </F>
            <div className="lx-checks" style={{ marginTop: 8 }}>
              <Check checked={form.noteVisible} onChange={(v) => set("noteVisible", v)}>
                Note/comments visible to student
              </Check>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}

export function Requirements() {
  const { id, meta, notice, reloadHeader } = useProfile();
  const paging = usePaging(25);
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState("");
  const { data, error, reload } = useLoad<Paged<ReqRow>>(`/${enc(id)}/requirements${qs({ status: applied, page: paging.page, perPage: paging.perPage })}`);
  const [editing, setEditing] = useState<ReqRow | null | "new">(null);
  const [uploading, setUploading] = useState<ReqRow | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ReqRow | null>(null);
  const done = (msg: string) => {
    notice.ok(msg);
    reload();
    reloadHeader();
  };
  return (
    <>
      <Card
        actions={
          <Btn small tone="primary" onClick={() => setEditing("new")}>
            Add Requirement
          </Btn>
        }
      >
        <Filters
          submit="SEARCH RECORDS"
          onSubmit={() => {
            setApplied(draft);
            paging.reset();
          }}
        >
          <F label="Status">
            <Sel value={draft} onChange={setDraft} empty="All Statuses" options={meta.options.reqStatuses ?? []} />
          </F>
        </Filters>
      </Card>
      <Card>
        <ErrorLine>{error}</ErrorLine>
        <PagerFor data={data} paging={paging} />
        <Table head={["Requirement", "Type", "Requested", "Submitted", "Status", ""]} empty={data ? "No requirements were found." : false}>
          {(data?.items ?? []).map((r) => {
            const canUpload = r.dataType === "Document Required" && r.allowUpload === "Yes";
            return (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  {r.furtherReview ? <span className="st-pill st-pill--warn" style={{ marginLeft: 6 }}>Further review</span> : null}
                </td>
                <td>{r.dataType}</td>
                <td>{fmtDate(r.requestedAt)}</td>
                <td>{r.submittedAt ? fmtDate(r.submittedAt) : <span className="mh-sa__muted">{r.submission}</span>}</td>
                <td>
                  <span className={`st-pill${r.status === "Approved" ? " st-pill--ok" : r.status === "Declined" ? " st-pill--off" : " st-pill--warn"}`}>{r.status}</span>
                </td>
                <td className="st-right">
                  <span className="st-actions">
                    {canUpload ? <LinkBtn onClick={() => setUploading(r)}>Upload</LinkBtn> : null}
                    <LinkBtn onClick={() => setReviewing(r.id)}>Review</LinkBtn>
                    <LinkBtn onClick={() => setEditing(r)}>Edit</LinkBtn>
                    <LinkBtn danger onClick={() => setDeleting(r)}>
                      Delete
                    </LinkBtn>
                  </span>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {editing ? (
        <RequirementModal
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            done(msg);
          }}
        />
      ) : null}
      {uploading ? (
        <UploadModal
          record={uploading}
          onClose={() => setUploading(null)}
          onSaved={() => {
            setUploading(null);
            done("Document(s) uploaded. The requirement stays in its current status until it is reviewed.");
          }}
        />
      ) : null}
      {reviewing ? (
        <ReviewModal
          reqId={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            done("Requirement updated.");
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmModal
          title="Delete Requirement"
          body={`Delete "${deleting.name}"? This cannot be undone.`}
          ok="Confirm Delete"
          onCancel={() => setDeleting(null)}
          onOk={async () => {
            try {
              await send(`/${enc(id)}/requirements/${enc(deleting.id)}`, "DELETE");
              done("Requirement deleted.");
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

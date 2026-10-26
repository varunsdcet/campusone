"use client";

import "./dashboard.css";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaField, SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { errorMessage } from "@/lib/superAdmin";
import {
  dashApi,
  plainText,
  type BlockInput,
  type DashboardBlock,
  type DashboardManage,
  type DashboardSettings,
  type PageLayout,
  type ScopeKey,
} from "@/lib/dashboard";
import { RichTextEditor } from "./RichTextEditor";

type Notice = { tone: "success" | "error"; text: string } | null;

function facultyLabel(value: string) {
  return value.replace(/\bInstructors?\b/gi, "Faculty");
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
    </svg>
  );
}

function BlockTypeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page settings                                                        */
/* ------------------------------------------------------------------ */

function PageSettingsCard({
  settings,
  layouts,
  canEdit,
  onSaved,
}: {
  settings: DashboardSettings;
  layouts: PageLayout[];
  canEdit: boolean;
  onSaved: (s: DashboardSettings, message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(settings);
    setError(null);
    setEditing(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) {
      setError("Heading / Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await dashApi<{ settings: DashboardSettings; message: string }>("/settings", { method: "PUT", body: JSON.stringify({ title: draft.title.trim(), layout: draft.layout }) });
      onSaved(res.settings, res.message);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err, "Could not save page details"));
    } finally {
      setBusy(false);
    }
  }

  const action = !canEdit ? null : editing ? (
    <button type="button" className="mh-dash-ed__icon" aria-label="Close page settings" title="Close" onClick={() => setEditing(false)}>
      ×
    </button>
  ) : (
    <button type="button" className="mh-dash-ed__icon" aria-label="Edit page settings" title="Edit" onClick={open}>
      <PencilIcon />
    </button>
  );

  return (
    <SaCard title="Page Settings" actions={action}>
      {editing ? (
        <form className="mh-sa__stack" onSubmit={save}>
          {error ? <SaNotice tone="error">{error}</SaNotice> : null}
          <div className="mh-sa__grid">
            <SaField label="Heading / Title">
              <input className="mh-sa__input" value={draft.title} maxLength={150} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
              <span className="mh-dash-ed__lang">English</span>
            </SaField>
            <SaField label="Page Layout">
              <select className="mh-sa__input" value={draft.layout} onChange={(e) => setDraft({ ...draft, layout: e.target.value as PageLayout })}>
                {layouts.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </SaField>
          </div>
          <div className="mh-sa__actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
              {busy ? "Saving…" : "Save Page Details"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="mh-dash-ed__dl">
          <dt>Heading / Title</dt>
          <dd>{settings.title}</dd>
          <dt>Page Layout</dt>
          <dd>{settings.layout}</dd>
        </dl>
      )}
    </SaCard>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit content block                                          */
/* ------------------------------------------------------------------ */

function emptyInput(): BlockInput {
  return {
    name: "",
    type: "",
    content: "",
    status: "Active",
    timeframe: "Immediately",
    startDate: "",
    endDate: "",
    access: "Everyone",
    accessLevels: [],
    studentAccess: {
      campus: { mode: "all", values: [] },
      status: { mode: "all", values: [] },
      program: { mode: "all", values: [] },
      rate: { mode: "all", values: [] },
      nationality: { mode: "all", values: [] },
      advisor: { mode: "all", values: [] },
    },
  };
}

function inputOf(b: DashboardBlock): BlockInput {
  const { id: _id, order: _order, updatedAt: _updatedAt, ...rest } = b;
  return structuredClone(rest);
}

function selected(e: { target: HTMLSelectElement }) {
  return Array.from(e.target.selectedOptions).map((o) => o.value);
}

function validate(v: BlockInput) {
  const errs: string[] = [];
  if (!v.name.trim()) errs.push("Content Reference Name is required");
  if (!v.type) errs.push("Select a Content Block Type");
  if (v.timeframe === "Define Dates") {
    if (!v.startDate) errs.push("Start Date is required when Available Timeframe is Define Dates");
    if (v.startDate && v.endDate && v.endDate < v.startDate) errs.push("End Date cannot be before Start Date");
  }
  if (v.access === "Select Access Level") {
    if (!v.accessLevels.length) errs.push("Select at least one access level");
    for (const [k, s] of Object.entries(v.studentAccess)) if (s.mode === "select" && !s.values.length) errs.push(`Choose at least one ${k === "rate" ? "rate category" : k === "program" ? "program" : k} or use the “All” option`);
  }
  return errs;
}

function BlockModal({
  block,
  options,
  onClose,
  onSaved,
}: {
  block: DashboardBlock | null;
  options: DashboardManage["options"];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [v, setV] = useState<BlockInput>(() => (block ? inputOf(block) : emptyInput()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setContent = useCallback((content: string) => setV((x) => ({ ...x, content })), []);
  const set = <K extends keyof BlockInput>(k: K, value: BlockInput[K]) => setV((x) => ({ ...x, [k]: value }));
  const setScope = (k: ScopeKey, patch: Partial<BlockInput["studentAccess"][ScopeKey]>) =>
    setV((x) => ({ ...x, studentAccess: { ...x.studentAccess, [k]: { ...x.studentAccess[k], ...patch } } }));

  async function save() {
    const errs = validate(v);
    if (errs.length) {
      setError(errs.join(". ") + ".");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = JSON.stringify({ ...v, name: v.name.trim() });
      const res = block
        ? await dashApi<{ message: string }>(`/blocks/${encodeURIComponent(block.id)}`, { method: "PATCH", body })
        : await dashApi<{ message: string }>("/blocks", { method: "POST", body });
      onSaved(res.message);
    } catch (err) {
      setError(errorMessage(err, "Could not save content"));
      setBusy(false);
    }
  }

  const title = block ? `EDIT CONTENT BLOCK: ${block.name.toUpperCase()}` : "CREATE CONTENT BLOCK";

  return (
    <SaModal
      title={title}
      onClose={onClose}
      wide
      footer={
        <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save Content"}
        </button>
      }
    >
      <div className="mh-dash-ed__modal">
        {error ? <SaNotice tone="error" onClose={() => setError(null)}>{error}</SaNotice> : null}

        <section className="mh-dash-ed__section">
          <h3>Block Settings</h3>
          <div className="mh-sa__grid">
            <SaField label="Content Reference Name">
              <input className="mh-sa__input" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} autoFocus={!block} />
            </SaField>
            <SaField label="Content Block Type">
              <select className="mh-sa__input" value={v.type} onChange={(e) => set("type", e.target.value as BlockInput["type"])}>
                <option value="">-- Select Block Type --</option>
                {options.blockTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </SaField>
          </div>
        </section>

        {v.type === "Rich Text Content" ? (
          <section className="mh-dash-ed__section">
            <h3>Rich Text Content</h3>
            <RichTextEditor value={v.content} onChange={setContent} label="Rich Text Content" />
          </section>
        ) : null}

        <section className="mh-dash-ed__section">
          <h3>Content Availability</h3>
          <div className="mh-sa__grid">
            <SaField label="Content Status">
              <select className="mh-sa__input" value={v.status} onChange={(e) => set("status", e.target.value as BlockInput["status"])}>
                {options.statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </SaField>
            <SaField label="Available Timeframe">
              <select className="mh-sa__input" value={v.timeframe} onChange={(e) => set("timeframe", e.target.value as BlockInput["timeframe"])}>
                {options.timeframes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </SaField>
            {v.timeframe === "Define Dates" ? (
              <>
                <SaField label="Start Date">
                  <input className="mh-sa__input" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </SaField>
                <SaField label="End Date" hint="Optional">
                  <input className="mh-sa__input" type="date" value={v.endDate} min={v.startDate || undefined} onChange={(e) => set("endDate", e.target.value)} />
                </SaField>
              </>
            ) : null}
          </div>
        </section>

        <section className="mh-dash-ed__section">
          <h3>Content Permissions</h3>
          <div className="mh-sa__grid">
            <SaField label="Content Access">
              <select className="mh-sa__input" value={v.access} onChange={(e) => set("access", e.target.value as BlockInput["access"])}>
                {options.access.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </SaField>
            {v.access === "Select Access Level" ? (
              <SaField label="Select Access Levels" hint="Hold CTRL (⌘ on Mac) + Click to select multiple">
                <select className="mh-sa__input mh-dash-ed__multi" multiple value={v.accessLevels} onChange={(e) => set("accessLevels", selected(e))}>
                  {options.accessLevels.map((l) => (
                    <option key={l} value={l}>{facultyLabel(l)}</option>
                  ))}
                </select>
              </SaField>
            ) : null}
          </div>

          {v.access === "Select Access Level" ? (
            <div className="mh-dash-ed__student">
              <h4>Student Access Settings</h4>
              <div className="mh-sa__grid">
                {options.studentScopes.map((s) => {
                  const scope = v.studentAccess[s.key];
                  return (
                    <SaField key={s.key} label={s.label}>
                      <select className="mh-sa__input" value={scope.mode} onChange={(e) => setScope(s.key, { mode: e.target.value as "all" | "select", values: [] })}>
                        <option value="all">{s.all}</option>
                        <option value="select">{s.select}</option>
                      </select>
                      {scope.mode === "select" ? (
                        <select
                          className="mh-sa__input mh-dash-ed__multi"
                          multiple
                          aria-label={s.select}
                          value={scope.values}
                          onChange={(e) => setScope(s.key, { values: selected(e) })}
                        >
                          {s.values.map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      ) : null}
                    </SaField>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Content blocks list                                                  */
/* ------------------------------------------------------------------ */

function BlockList({
  blocks,
  canEdit,
  onEdit,
  onDelete,
  onReorder,
}: {
  blocks: DashboardBlock[];
  canEdit: boolean;
  onEdit: (b: DashboardBlock) => void;
  onDelete: (b: DashboardBlock) => void;
  onReorder: (ids: string[]) => void;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function move(ids: string[], id: string, to: number) {
    const next = ids.filter((x) => x !== id);
    next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
    return next;
  }

  function onHandleKey(e: KeyboardEvent, id: string, index: number) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const to = e.key === "ArrowUp" ? index - 1 : index + 1;
    if (to < 0 || to >= blocks.length) return;
    onReorder(move(blocks.map((b) => b.id), id, to));
  }

  if (!blocks.length) return <p className="mh-sa__empty">No content blocks yet. Use Add Content Block to create one.</p>;

  return (
    <ul className="mh-dash-ed__list">
      {blocks.map((b, i) => {
        const preview = plainText(b.content);
        return (
          <li
            key={b.id}
            className={`mh-dash-ed__row${drag === b.id ? " is-dragging" : ""}${over === b.id && drag !== b.id ? " is-over" : ""}`}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              setOver(b.id);
            }}
            onDragLeave={() => setOver((o) => (o === b.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (drag && drag !== b.id) onReorder(move(blocks.map((x) => x.id), drag, i));
              setDrag(null);
              setOver(null);
            }}
          >
            {canEdit ? (
              <button
                type="button"
                className="mh-dash-ed__handle"
                draggable
                aria-label={`Reorder ${b.name}. Use the up and down arrow keys to move.`}
                title="Drag to reorder"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", b.id);
                  setDrag(b.id);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setOver(null);
                }}
                onKeyDown={(e) => onHandleKey(e, b.id, i)}
              >
                ⋮⋮
              </button>
            ) : null}
            <span className="mh-dash-ed__type" title={b.type}>
              <BlockTypeIcon />
            </span>
            <div className="mh-dash-ed__meta">
              <div className="mh-dash-ed__name">
                <strong>{b.name}</strong>
                <span className={`mh-sa__pill ${b.status === "Active" ? "mh-sa__pill--ok" : "mh-sa__pill--warn"}`}>{b.status}</span>
              </div>
              <p className="mh-dash-ed__preview">{preview ? (preview.length > 160 ? `${preview.slice(0, 160)}…` : preview) : "No content"}</p>
            </div>
            {canEdit ? (
              <div className="mh-dash-ed__row-actions">
                <button type="button" className="mh-dash-ed__icon" aria-label={`Edit ${b.name}`} title="Edit" onClick={() => onEdit(b)}>
                  <PencilIcon />
                </button>
                <button type="button" className="mh-dash-ed__icon mh-dash-ed__icon--danger" aria-label={`Delete ${b.name}`} title="Delete" onClick={() => onDelete(b)}>
                  <TrashIcon />
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function DashboardEditor() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<DashboardManage | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [modal, setModal] = useState<{ block: DashboardBlock | null } | null>(null);
  const [confirm, setConfirm] = useState<DashboardBlock | null>(null);
  const [deleting, setDeleting] = useState(false);
  const opened = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await dashApi<DashboardManage>("/manage");
      setData(d);
      return d;
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, "Could not load the dashboard editor") });
      return null;
    }
  }, []);

  useEffect(() => {
    void load().then((d) => {
      const want = params.get("block");
      if (!d || !want || opened.current || !d.canEdit) return;
      opened.current = true;
      if (want === "new") setModal({ block: null });
      else {
        const b = d.blocks.find((x) => x.id === want);
        if (b) setModal({ block: b });
      }
    });
  }, [load, params]);

  function closeModal() {
    setModal(null);
    if (params.get("block")) router.replace("/admin/dashboard/edit");
  }

  async function reorder(ids: string[]) {
    if (!data) return;
    const before = data.blocks;
    const byId = new Map(before.map((b) => [b.id, b]));
    setData({ ...data, blocks: ids.map((id, i) => ({ ...byId.get(id)!, order: i })) });
    try {
      const res = await dashApi<{ message: string }>("/blocks/order", { method: "PUT", body: JSON.stringify({ ids }) });
      setNotice({ tone: "success", text: res.message });
    } catch (err) {
      setData((d) => (d ? { ...d, blocks: before } : d));
      setNotice({ tone: "error", text: errorMessage(err, "Could not save the new order") });
    }
  }

  async function remove() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const res = await dashApi<{ message: string }>(`/blocks/${encodeURIComponent(confirm.id)}`, { method: "DELETE" });
      setNotice({ tone: "success", text: res.message });
      setConfirm(null);
      await load();
    } catch (err) {
      setNotice({ tone: "error", text: errorMessage(err, "Could not delete the content block") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SuperFrame breadcrumbs={["Home", "Edit Dashboard Content"]} breadcrumbHrefs={["/admin"]} activeHref="/admin" title="Edit Dashboard Page">
      {notice ? (
        <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </SaNotice>
      ) : null}
      {!data ? (
        notice ? null : <p className="mh-sa__muted">Loading…</p>
      ) : (
        <>
          {!data.canEdit ? <p className="mh-sa__muted">You can view the dashboard configuration. Your access level does not allow changes.</p> : null}
          <PageSettingsCard
            settings={data.settings}
            layouts={data.options.layouts}
            canEdit={data.canEdit}
            onSaved={(settings, message) => {
              setData({ ...data, settings });
              setNotice({ tone: "success", text: message });
            }}
          />
          <SaCard
            title="Content Blocks"
            actions={
              data.canEdit ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setModal({ block: null })}>
                  Add Content Block
                </button>
              ) : null
            }
          >
            <BlockList blocks={data.blocks} canEdit={data.canEdit} onEdit={(b) => setModal({ block: b })} onDelete={setConfirm} onReorder={reorder} />
          </SaCard>
        </>
      )}

      {modal && data ? (
        <BlockModal
          key={modal.block?.id ?? "new"}
          block={modal.block}
          options={data.options}
          onClose={closeModal}
          onSaved={(message) => {
            closeModal();
            setNotice({ tone: "success", text: message });
            void load();
          }}
        />
      ) : null}

      {confirm ? (
        <SaModal
          title="Delete Content Block"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" disabled={deleting} onClick={remove}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </>
          }
        >
          <p>
            Delete <strong>{confirm.name}</strong>? It will be removed from the dashboard.
          </p>
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

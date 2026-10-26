"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ConfirmDelete, Pager } from "../location/shared";
import {
  SysGrid,
  SysSections,
  applies,
  canEditIn,
  defaultsFromEntries,
  errMsg,
  invalidateMeta,
  json,
  sectionsOf,
  str,
  sx,
  useFlash,
  useLeaveGuard,
  useSettingsForm,
  useSysForm,
  useSysMeta,
  type Listing,
  type Meta,
  type Row,
  type SettingsForm,
  type SysForm,
} from "./kit";

export const SC = "System Configuration";

export type Ctx = { reload: () => void; ok: (t: string) => void; fail: (t: string) => void; meta: Meta | null; rows: Row[]; canEdit: boolean };
export type Column = { label: string; render: (r: Row, ctx: Ctx) => ReactNode; className?: string };
export type SelectFilter = { key: string; label: string; all: string; initial?: string; options: (rows: Row[], meta: Meta | null) => string[]; match: (r: Row, v: string) => boolean };

export type DirectoryProps = {
  entity: string;
  title?: string;
  crumbs?: string[];
  activeHref: string;
  base?: string;
  createLabel?: string;
  createMode?: "page" | "modal" | "none";
  columns: Column[];
  noun: string;
  empty: string;
  /** Captured screens show a large empty state with the create button instead of the table. */
  emptyCta?: boolean;
  filter?: { placeholder: string; label?: string; keys: string[]; submitLabel?: string; live?: boolean };
  selects?: SelectFilter[];
  sortable?: boolean;
  rowActions?: (r: Row, ctx: Ctx) => ReactNode;
  trailingActions?: (r: Row, ctx: Ctx) => ReactNode;
  canDelete?: (r: Row) => boolean;
  canEdit?: (r: Row) => boolean;
  editLabel?: string;
  deleteLabel?: string;
  confirmText?: (r: Row) => string;
  modalTitle?: (r: Row | null) => string;
  saveLabel?: string;
  embedded?: boolean;
  headerActions?: (ctx: Ctx) => ReactNode;
  parentId?: string;
  below?: (ctx: Ctx) => ReactNode;
  groups?: (rows: Row[]) => Array<{ title: string; rows: Row[]; actions?: ReactNode }>;
  initialNotice?: string | null;
  pageSize?: number;
  /** Module breadcrumb (System Configuration when omitted). */
  section?: string;
  /** Delete popup title and confirm button (e.g. "Delete Funding Source"). */
  confirmLabel?: string;
};

export function Directory(p: DirectoryProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const flash = useFlash(p.initialNotice === undefined ? sp?.get("notice") : p.initialNotice);
  const { ok, fail } = flash;
  const { meta } = useSysMeta();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const initialSel = () => Object.fromEntries((p.selects ?? []).filter((s) => s.initial).map((s) => [s.key, s.initial!]));
  const [sel, setSel] = useState<Record<string, string>>(initialSel);
  const [appliedSel, setAppliedSel] = useState<Record<string, string>>(initialSel);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [modal, setModal] = useState<{ id: string | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(p.pageSize ?? 0);
  const mode = p.createMode ?? "page";
  const base = p.base ?? p.activeHref;
  const parentQs = p.parentId ? `?parentId=${encodeURIComponent(p.parentId)}` : "";

  const load = useCallback(() => {
    sx<Listing>(`/e/${p.entity}${parentQs}`)
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, `Could not load ${p.noun}s`)));
  }, [p.entity, parentQs, p.noun, fail]);
  useEffect(load, [load]);

  const writable = canEditIn(meta, p.entity);
  const sortable = p.sortable && writable;
  const ctx: Ctx = { reload: load, ok, fail, meta, rows: rows ?? [], canEdit: writable };
  const live = p.filter?.live ?? !p.filter?.submitLabel;
  const needle = (live ? q : applied).trim().toLowerCase();
  const activeSel = live ? sel : appliedSel;
  const shown = useMemo(
    () =>
      (rows ?? []).filter(
        (r) => (!needle || (p.filter?.keys ?? []).some((k) => str(r[k]).toLowerCase().includes(needle))) && (p.selects ?? []).every((s) => !activeSel[s.key] || activeSel[s.key] === s.all || s.match(r, activeSel[s.key]!)),
      ),
    [rows, needle, activeSel, p.filter, p.selects],
  );
  const pages = perPage ? Math.max(1, Math.ceil(shown.length / perPage)) : 1;
  const current = Math.min(page, pages);
  const visible = perPage ? shown.slice((current - 1) * perPage, current * perPage) : shown;
  const filtering = Boolean(needle) || Object.entries(activeSel).some(([k, v]) => v && v !== p.selects?.find((s) => s.key === k)?.all);

  const openCreate = () => (mode === "modal" ? setModal({ id: null }) : router.push(`${base}/new${parentQs}`));
  const openEdit = (r: Row) => (mode === "modal" ? setModal({ id: r.id }) : router.push(`${base}/edit?id=${r.id}`));

  async function reorder(ids: string[]) {
    setRows((cur) => (cur ? ids.map((id) => cur.find((r) => r.id === id)!).filter(Boolean) : cur));
    try {
      const out = await sx<{ message: string }>(`/e/${p.entity}/order`, json("PUT", { ids }));
      ok(out.message);
      invalidateMeta();
    } catch (e) {
      fail(errMsg(e, "Could not save the order"));
      load();
    }
  }
  const move = (id: string, delta: number) => {
    const ids = (rows ?? []).map((r) => r.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]!);
    void reorder(ids);
  };

  const createBtn =
    writable && mode !== "none" && p.createLabel ? (
      <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={openCreate}>
        {p.createLabel}
      </button>
    ) : null;
  const isEmpty = rows !== null && rows.length === 0;
  const headActions = (
    <>
      {p.headerActions?.(ctx)}
      {isEmpty && p.emptyCta ? null : createBtn}
    </>
  );

  const table = (list: Row[]) => (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            {sortable ? <th className="sx-handle-col" aria-label="Order" /> : null}
            {p.columns.map((c) => (
              <th key={c.label} className={c.className}>
                {c.label}
              </th>
            ))}
            <th className="lx-actions" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr
              key={r.id}
              className={dragId === r.id ? "sx-dragging" : undefined}
              draggable={sortable && !filtering}
              onDragStart={() => setDragId(r.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => sortable && dragId && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!dragId || dragId === r.id) return;
                const ids = (rows ?? []).map((x) => x.id).filter((id) => id !== dragId);
                ids.splice(ids.indexOf(r.id), 0, dragId);
                setDragId(null);
                void reorder(ids);
              }}
            >
              {sortable ? (
                <td className="sx-handle-col">
                  <span className="sx-handle" title="Drag to reorder" aria-hidden>
                    ⋮⋮
                  </span>
                  <button type="button" className="sx-move" aria-label={`Move ${str(r.name)} up`} disabled={filtering} onClick={() => move(r.id, -1)}>
                    ▲
                  </button>
                  <button type="button" className="sx-move" aria-label={`Move ${str(r.name)} down`} disabled={filtering} onClick={() => move(r.id, 1)}>
                    ▼
                  </button>
                </td>
              ) : null}
              {p.columns.map((c) => (
                <td key={c.label} className={c.className}>
                  {c.render(r, ctx)}
                </td>
              ))}
              <td className="lx-actions">
                {p.rowActions?.(r, ctx)}
                {writable && (p.canEdit?.(r) ?? true) ? (
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => openEdit(r)}>
                    {p.editLabel ?? "Edit"}
                  </button>
                ) : null}
                {writable && (p.canDelete?.(r) ?? !r._protected) ? (
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                    {p.deleteLabel ?? "Delete"}
                  </button>
                ) : null}
                {p.trailingActions?.(r, ctx)}
              </td>
            </tr>
          ))}
          {list.length === 0 ? (
            <tr>
              <td colSpan={p.columns.length + (sortable ? 2 : 1)} className="mh-sa__empty-cell">
                {filtering ? `No ${p.noun}s match this filter.` : p.empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  const body = (
    <div className="lx sx">
      {flash.node}
      {p.embedded && (p.headerActions || (createBtn && !(isEmpty && p.emptyCta))) ? <div className="sx-tabhead">{headActions}</div> : null}
      <section className="mh-sa__card">
        {!rows ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : isEmpty && p.emptyCta ? (
          <div className="lx-empty">
            <p>{p.empty}</p>
            {createBtn}
          </div>
        ) : (
          <>
            {p.filter || p.selects?.length ? (
              <form
                className="lx-filter sx-filter"
                onSubmit={(e) => {
                  e.preventDefault();
                  setApplied(q);
                  setAppliedSel(sel);
                }}
              >
                {p.selects?.map((s) => (
                  <label key={s.key} className="mh-sa__field">
                    <span className="mh-sa__label">{s.label}</span>
                    <select className="mh-sa__input" value={sel[s.key] ?? s.all} onChange={(e) => setSel((x) => ({ ...x, [s.key]: e.target.value }))}>
                      {[s.all, ...s.options(rows, meta)].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                {p.filter ? (
                  <label className="mh-sa__field">
                    <span className="mh-sa__label">{p.filter.label ?? "Filter"}</span>
                    <input
                      className="mh-sa__input"
                      placeholder={p.filter.placeholder}
                      value={q}
                      onChange={(e) => {
                        setQ(e.target.value);
                        if (live) setPage(1);
                      }}
                    />
                  </label>
                ) : null}
                {p.filter?.submitLabel ? (
                  <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
                    {p.filter.submitLabel}
                  </button>
                ) : null}
              </form>
            ) : null}
            {p.groups
              ? p.groups(shown).map((g) => (
                  <div key={g.title} className="sx-group">
                    <div className="sx-group__head">
                      <h3>{g.title}</h3>
                      {g.actions}
                    </div>
                    {table(g.rows)}
                  </div>
                ))
              : table(visible)}
            {perPage ? <Pager total={shown.length} page={current} pages={pages} perPage={perPage} onPage={setPage} onPerPage={(n) => { setPerPage(n); setPage(1); }} /> : null}
            {sortable && rows.length > 1 ? <p className="lx-hint">Drag rows (or use the arrows) to change the order. The new order is saved immediately.</p> : null}
          </>
        )}
        {p.below?.(ctx)}
      </section>
      {confirm ? (
        <ConfirmDelete
          title={p.confirmLabel ?? `${p.deleteLabel ?? "Delete"} ${p.noun}`}
          body={p.confirmText?.(confirm) ?? `Delete the ${p.noun} "${str(confirm.name || confirm.question || confirm.email || confirm._userLabel)}"? This cannot be undone.`}
          okLabel={p.confirmLabel ?? p.deleteLabel ?? "Delete"}
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            sx<{ message: string }>(`/e/${p.entity}/${r.id}`, { method: "DELETE" })
              .then((out) => {
                ok(out.message);
                invalidateMeta();
                load();
              })
              .catch((e) => fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
      {modal ? (
        <EntityModal
          entity={p.entity}
          id={modal.id}
          parentId={p.parentId}
          title={p.modalTitle?.(modal.id ? (rows?.find((r) => r.id === modal.id) ?? null) : null) ?? `${modal.id ? "Edit" : "Add"} ${p.noun}`}
          saveLabel={p.saveLabel ?? "Save"}
          onClose={() => setModal(null)}
          onSaved={(m) => {
            setModal(null);
            ok(m);
            load();
          }}
        />
      ) : null}
    </div>
  );

  if (p.embedded) return body;
  return (
    <SuperFrame title={p.title} breadcrumbs={["Home", p.section ?? SC, ...(p.crumbs ?? [p.title ?? ""])]} activeHref={p.activeHref} actions={headActions}>
      {body}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Modal form                                                           */
/* ------------------------------------------------------------------ */

export function ModalFields({ form }: { form: SysForm }) {
  if (!form.meta || !form.values) return <p className="mh-sa__muted">Loading…</p>;
  const loose = form.fields.filter((f) => !f.section);
  const sections = sectionsOf(form.fields);
  return (
    <>
      {loose.length ? <SysGrid fields={loose} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} /> : null}
      {sections.map((s) =>
        s.fields.some((f) => applies(f, form.values!)) ? (
          <div key={s.name} className="sx-modal-section">
            <h3>{s.name}</h3>
            <SysGrid fields={s.fields} values={form.values!} setValue={form.setValue} meta={form.meta!} refs={form.refs} />
          </div>
        ) : null,
      )}
    </>
  );
}

export function EntityModal({
  entity,
  id,
  parentId,
  title,
  saveLabel,
  onClose,
  onSaved,
  children,
  wide,
}: {
  entity: string;
  id: string | null;
  parentId?: string;
  title: string;
  saveLabel: string;
  onClose: () => void;
  onSaved: (message: string, id: string) => void;
  children?: (form: SysForm) => ReactNode;
  wide?: boolean;
}) {
  const form = useSysForm(entity, id, { parentId });
  const [err, setErr] = useState<string | null>(null);
  const isWide = wide ?? form.fields.some((f) => ["html", "rows", "code", "dual", "refMulti", "multiList", "people"].includes(f.kind));
  const submit = () => {
    setErr(null);
    form
      .save()
      .then((out) => onSaved(out.message, out.id))
      .catch((e) => setErr(errMsg(e, "Save failed")));
  };
  return (
    <SaModal
      title={title}
      wide={isWide}
      onClose={() => {
        if (!form.dirty || window.confirm("Discard your unsaved changes?")) onClose();
      }}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values} onClick={submit}>
            {form.busy ? "Saving…" : saveLabel}
          </button>
        </>
      }
    >
      <form
        className="sx-modal"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {form.error ? <SaNotice tone="error">{form.error}</SaNotice> : null}
        {err ? <SaNotice tone="error">{err}</SaNotice> : null}
        {children ? children(form) : <ModalFields form={form} />}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Page form                                                            */
/* ------------------------------------------------------------------ */

export function EntityFormPage({
  entity,
  mode,
  base,
  activeHref,
  crumb,
  createTitle,
  editTitle,
  saveLabel,
  children,
  afterSave,
  section = SC,
}: {
  entity: string;
  mode: "create" | "edit";
  base: string;
  activeHref?: string;
  crumb: string;
  createTitle: string;
  editTitle: (r: Row | null) => string;
  saveLabel: string;
  children?: (form: SysForm) => ReactNode;
  afterSave?: (id: string) => string | null;
  section?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const parentId = sp?.get("parentId") ?? undefined;
  const flash = useFlash(null);
  const defaults = useMemo(() => defaultsFromEntries(sp?.entries() ?? []), [sp]);
  const form = useSysForm(entity, id, { parentId, defaults });
  const leaving = useRef(false);
  useLeaveGuard(form.dirty && !form.busy && !leaving.current);
  const title = mode === "create" ? createTitle : editTitle(form.record);
  const writable = canEditIn(form.meta, entity);
  return (
    <SuperFrame title={title} breadcrumbs={["Home", section, crumb, mode === "create" ? createTitle : "Edit"]} activeHref={activeHref ?? base}>
      <form
        className="lx sx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => {
              leaving.current = true;
              router.push(afterSave?.(out.id) ?? `${base}?notice=${encodeURIComponent(out.message)}`);
            })
            .catch((err) => {
              flash.fail(errMsg(err, "Save failed"));
              window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }}
      >
        {form.error ? <SaNotice tone="error">{form.error}</SaNotice> : null}
        {form.meta && !writable ? <p className="mh-sa__muted" role="status">Your access level is read-only for this area. Changes cannot be saved.</p> : null}
        {flash.node}
        {!form.values || !form.meta ? <p className="mh-sa__muted">Loading…</p> : children ? children(form) : <SysSections form={form} />}
        <div className="mh-sa__actions lx-sticky-actions">
          <Link className="mh-sa__btn" href={base}>
            {writable ? "Cancel" : "Back"}
          </Link>
          {writable ? (
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
              {form.busy ? "Saving…" : saveLabel}
            </button>
          ) : null}
        </div>
      </form>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs                                                                 */
/* ------------------------------------------------------------------ */

export function useTab<T extends string>(tabs: readonly T[], fallback: T): [T, (t: T) => void] {
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp?.get("tab") as T | null;
  const tab = raw && tabs.includes(raw) ? raw : fallback;
  return [
    tab,
    (t: T) => {
      const qs = new URLSearchParams(sp?.toString() ?? "");
      qs.set("tab", t);
      for (const k of ["notice", "logs", "popup"]) qs.delete(k);
      router.replace(`?${qs.toString()}`, { scroll: false });
    },
  ];
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ id: T; label: string }>; value: T; onChange: (t: T) => void }) {
  return (
    <div className="sx-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`sx-tabs__tab${value === t.id ? " is-on" : ""}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Settings page body: sections, save button, last-saved stamp. */
export function SettingsBody({
  settingsKey,
  embedded,
  children,
  onSaved,
  showHistory = false,
}: {
  settingsKey: string;
  embedded?: boolean;
  children?: (form: SettingsForm) => ReactNode;
  onSaved?: (msg: string) => void;
  showHistory?: boolean;
}) {
  const form = useSettingsForm(settingsKey);
  const flash = useFlash(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  useLeaveGuard(form.dirty && !form.busy);
  const label = form.meta?.settings[settingsKey]?.save ?? "Save Settings";
  const writable = canEditIn(form.meta);
  return (
    <form
      className={`lx sx${embedded ? " sx-embedded" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((m) => {
            flash.ok(m);
            onSaved?.(m);
            setHistoryRefresh((value) => value + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
          })
          .catch((err) => {
            flash.fail(errMsg(err, "Save failed"));
            window.scrollTo({ top: 0, behavior: "smooth" });
          });
      }}
    >
      {form.error ? <SaNotice tone="error">{form.error}</SaNotice> : null}
      {form.meta && !writable ? <p className="mh-sa__muted" role="status">Your access level is read-only for System Configuration. Changes cannot be saved.</p> : null}
      {flash.node}
      {!form.values || !form.meta ? <p className="mh-sa__muted">Loading…</p> : children ? children(form) : <SysSections form={form} />}
      <div className="mh-sa__actions lx-sticky-actions">
        {form.updatedAt ? <span className="mh-sa__muted sx-stamp">Last saved {new Date(form.updatedAt).toLocaleString("en-CA")}</span> : null}
        {writable ? (
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            {form.busy ? "Saving…" : label}
          </button>
        ) : null}
      </div>
      {showHistory ? <SettingsHistory settingsKey={settingsKey} refresh={historyRefresh} /> : null}
    </form>
  );
}

type SettingsHistoryItem = { id: string; action: string; actor: string; at: string };

function SettingsHistory({ settingsKey, refresh }: { settingsKey: string; refresh: number }) {
  const [items, setItems] = useState<SettingsHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    void sx<{ items: SettingsHistoryItem[] }>(`/settings/${settingsKey}/history`)
      .then((out) => setItems(out.items))
      .catch((reason) => setError(errMsg(reason, "Could not load change history")));
  }, [settingsKey, refresh]);
  return (
    <section className="mh-sa__card sx-settings-history" aria-label="Settings change history">
      <h3>Change History</h3>
      {error ? <SaNotice tone="error">{error}</SaNotice> : null}
      {!items ? (
        <p className="mh-sa__muted">Loading history…</p>
      ) : items.length ? (
        <ul className="hx-audit">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.action}</strong> · {item.actor} · {new Date(item.at).toLocaleString()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mh-sa__muted">No saved changes have been recorded yet.</p>
      )}
    </section>
  );
}

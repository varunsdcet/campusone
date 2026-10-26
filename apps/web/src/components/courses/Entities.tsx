"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Confirm, EntityModal, Frame, LinkBtn, Loading, RowActions, Sections, errMsg, qs, send, useEntityForm, useLeaveGuard, useLoad, useNotice, type EntityForm, type Row, type Saved } from "./kit";

export type Col = { label: string; cell: (r: Row) => ReactNode; width?: number | string };

const nameOf = (r: Row) => String(r.name || r.title || r.question || r._course || "this record");

/**
 * Filterable configuration list. Create / edit open either a page (`formHref`) or a popup (`modal`).
 */
export function EntityList({
  entity,
  title,
  crumb,
  active,
  label,
  filterPlaceholder = "Enter Search Filter Here",
  createLabel,
  formHref,
  modal,
  columns,
  empty,
  toolbar,
  extraActions,
  deleteTitle,
  deleteLabel,
  deleteBody,
  embedded,
}: {
  entity: string;
  title: string;
  crumb: string;
  active: string;
  label: string;
  filterPlaceholder?: string | null;
  createLabel: string;
  formHref?: string;
  modal?: { createTitle: string; editTitle: string; saveLabel?: string };
  columns: Col[];
  empty: string;
  toolbar?: ReactNode;
  extraActions?: (r: Row) => ReactNode[];
  deleteTitle?: string;
  deleteLabel?: string;
  deleteBody?: (r: Row) => ReactNode;
  embedded?: boolean;
}) {
  const notice = useNotice();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const { data, error, reload } = useLoad<{ items: Row[]; total: number }>(`/e/${entity}${qs({ q })}`, `Could not load ${label.toLowerCase()}s`);
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const createBtn = formHref ? (
    <Link className="mh-sa__btn mh-sa__btn--primary" href={`${formHref}/new`}>
      {createLabel}
    </Link>
  ) : (
    <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setEditing({ id: null })}>
      {createLabel}
    </button>
  );

  const body = (
    <section className="mh-sa__card">
      {embedded ? (
        <div className="mh-sa__card-head">
          <h2>{title}</h2>
          {createBtn}
        </div>
      ) : null}
      {filterPlaceholder !== null || toolbar ? (
        <form
          className="cm-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setQ(draft.trim());
          }}
        >
          {filterPlaceholder !== null ? (
            <label className="mh-sa__field">
              <span className="mh-sa__label">Filter</span>
              <input className="mh-sa__input" placeholder={filterPlaceholder} value={draft} onChange={(e) => setDraft(e.target.value)} />
            </label>
          ) : null}
          <span className="cm-filters__go">
            {filterPlaceholder !== null ? (
              <button type="submit" className="mh-sa__btn">
                Search
              </button>
            ) : null}
            {toolbar}
          </span>
        </form>
      ) : null}
      {!data ? (
        <Loading error={error} />
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.label} style={c.width ? { width: c.width } : undefined}>
                    {c.label}
                  </th>
                ))}
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  {columns.map((c) => (
                    <td key={c.label}>{c.cell(r)}</td>
                  ))}
                  <td className="lx-actions">
                    <RowActions>
                      {[
                        ...(extraActions?.(r) ?? []),
                        formHref ? (
                          <LinkBtn key="e" href={`${formHref}/edit${qs({ id: r.id })}`}>
                            EDIT
                          </LinkBtn>
                        ) : (
                          <LinkBtn key="e" onClick={() => setEditing({ id: r.id })}>
                            EDIT
                          </LinkBtn>
                        ),
                        <LinkBtn key="d" danger onClick={() => setConfirm(r)}>
                          DELETE
                        </LinkBtn>,
                      ]}
                    </RowActions>
                  </td>
                </tr>
              ))}
              {!data.items.length ? (
                <tr>
                  <td colSpan={columns.length + 1} className="mh-sa__empty-cell">
                    {q ? `Nothing matches "${q}".` : empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  const popups = (
    <>
      {editing && modal ? (
        <EntityModal
          entity={entity}
          id={editing.id}
          title={editing.id ? modal.editTitle : modal.createTitle}
          saveLabel={modal.saveLabel}
          onClose={() => setEditing(null)}
          onSaved={(out) => {
            setEditing(null);
            notice.ok(out.message);
            reload();
          }}
        />
      ) : null}
      {confirm ? (
        <Confirm
          title={deleteTitle ?? `Delete ${label}`}
          okLabel={deleteLabel ?? `Delete ${label}`}
          busy={busy}
          body={deleteBody ? deleteBody(confirm) : <p>Are you sure you want to delete &ldquo;{nameOf(confirm)}&rdquo;? This cannot be undone.</p>}
          onCancel={() => setConfirm(null)}
          onOk={() => {
            setBusy(true);
            send(`/e/${entity}/${confirm.id}`, "DELETE")
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
    </>
  );

  if (embedded)
    return (
      <>
        {notice.node}
        {body}
        {popups}
      </>
    );
  return (
    <Frame title={title} crumbs={[crumb]} active={active} actions={createBtn}>
      {notice.node}
      {body}
      {popups}
    </Frame>
  );
}

/** Full-page create / edit form for a configuration record. */
export function EntityPage({
  entity,
  id,
  title,
  crumbs,
  active,
  back,
  saveLabel,
  top,
  after,
  children,
  extra,
}: {
  entity: string;
  id: string | null;
  title: string;
  crumbs: string[];
  active: string;
  back: string;
  saveLabel?: string;
  top?: (form: EntityForm) => ReactNode;
  after?: (form: EntityForm) => Record<string, ReactNode>;
  children?: (form: EntityForm) => ReactNode;
  extra?: (form: EntityForm) => Record<string, unknown>;
}) {
  const router = useRouter();
  const form = useEntityForm(entity, id);
  const [err, setErr] = useState<string | null>(null);
  useLeaveGuard(form.dirty && !form.busy);
  const submit = () => {
    setErr(null);
    form
      .save(extra?.(form))
      .then((out: Saved) => router.push(`${back}${qs({ notice: out.message })}`))
      .catch((e) => setErr(errMsg(e, "Save failed")));
  };
  return (
    <Frame title={title} crumbs={crumbs} active={active}>
      <p className="cm-muted" style={{ marginBottom: 10 }}>
        <Link href={back}>← Back to list</Link>
      </p>
      {!form.values || !form.meta ? (
        <Loading error={form.error} />
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
          {top?.(form)}
          <Sections fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} after={after?.(form)} />
          {children?.(form)}
          <div className="lx-sticky-actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
              {saveLabel ?? form.meta.entities[entity]?.save ?? "Save"}
            </button>
          </div>
        </form>
      )}
    </Frame>
  );
}

export const yes = (v: unknown) => (v === true || v === "Yes" || v === "Active" || v === "Enabled" ? "Yes" : "No");
export const stamp = (iso: unknown, who: unknown) => {
  const d = new Date(String(iso));
  const when = Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="cm-stack">
      <span>{when}</span>
      {who ? <span className="cm-muted">{String(who)}</span> : null}
    </div>
  );
};

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { EntitySections, SLUG, useEntityForm, useLeaveGuard } from "./forms";
import { ConfirmDelete, FieldGrid, FilterBar, errMsg, lx, str, useNotice, type Listing, type Row } from "./shared";

type Column = { label: string; render: (r: Row) => ReactNode };

function SimpleDirectory({
  entity,
  title,
  crumb,
  base,
  createLabel,
  columns,
  noun,
  empty,
  filter = true,
}: {
  entity: string;
  title: string;
  crumb: string;
  base: string;
  createLabel: string;
  columns: Column[];
  noun: string;
  empty: string;
  filter?: boolean;
}) {
  const router = useRouter();
  const notice = useNotice();
  const { fail, ok } = notice;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    lx<Listing>(`/${SLUG[entity]}`)
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, `Could not load ${noun}s`)));
  }, [entity, noun, fail]);
  useEffect(load, [load]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !n || [r.name, r.abbreviation, r.type].some((v) => str(v).toLowerCase().includes(n)));
  }, [rows, q]);

  return (
    <SuperFrame
      title={title}
      breadcrumbs={["Home", "Location Management", crumb]}
      activeHref={base}
      actions={
        rows && rows.length === 0 && !filter ? undefined : (
          <Link className="mh-sa__btn mh-sa__btn--primary" href={`${base}/new`}>
            {createLabel}
          </Link>
        )
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : rows.length === 0 && !filter ? (
            <div className="lx-empty">
              <p>{empty}</p>
              <Link className="mh-sa__btn mh-sa__btn--primary" href={`${base}/new`}>
                {createLabel}
              </Link>
            </div>
          ) : (
            <>
              {filter ? <FilterBar value={q} onChange={setQ} /> : null}
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table lx-table">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.label}>{c.label}</th>
                      ))}
                      <th className="lx-actions" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        {columns.map((c) => (
                          <td key={c.label}>{c.render(r)}</td>
                        ))}
                        <td className="lx-actions">
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${base}/edit?id=${r.id}`)}>
                            Edit
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 1} className="mh-sa__empty-cell">
                          {q ? `No ${noun}s match this filter.` : empty}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        {confirm ? (
          <ConfirmDelete
            title={`Delete ${noun}`}
            body={`Delete the ${noun} "${str(confirm.name)}"?`}
            okLabel={`Delete ${noun.replace(/^\w/, (c) => c.toUpperCase())}`}
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              lx<{ message: string }>(`/${SLUG[entity]}/${r.id}`, { method: "DELETE" })
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

function SimpleForm({
  entity,
  mode,
  crumb,
  base,
  createTitle,
  editTitle,
  saveLabel,
  children,
}: {
  entity: string;
  mode: "create" | "edit";
  crumb: string;
  base: string;
  createTitle: string;
  editTitle: string;
  saveLabel: string;
  children?: (form: ReturnType<typeof useEntityForm>) => ReactNode;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = mode === "edit" ? (sp?.get("id") ?? "") : null;
  const notice = useNotice();
  const form = useEntityForm(entity, id);
  useLeaveGuard(form.dirty && !form.busy);
  const name = str(form.record?.name);
  const title = mode === "create" ? createTitle : `${editTitle}${name ? `: ${name}` : ""}`;
  return (
    <SuperFrame title={title} breadcrumbs={["Home", "Location Management", crumb, mode === "create" ? createTitle : editTitle]} activeHref={base}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`${base}?notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError ? <SaNotice tone="error">{form.metaError}</SaNotice> : null}
        {form.loadError ? <SaNotice tone="error">{form.loadError}</SaNotice> : null}
        {notice.node}
        {!form.values || !form.meta ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : children ? (
          children(form)
        ) : (
          <section className="mh-sa__card lx-narrow">
            <FieldGrid fields={form.fields} values={form.values} setValue={form.setValue} meta={form.meta} refs={form.refs} />
          </section>
        )}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href={base}>
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

/* Screens 10 / 11 — Regions */

const REGIONS = "/admin/location/regions";
export function ManageRegions() {
  return (
    <SimpleDirectory
      entity="regions"
      title="Manage Regions"
      crumb="Regions"
      base={REGIONS}
      createLabel="Create Region"
      noun="region"
      empty="No regions have been created yet."
      columns={[
        { label: "Region Name", render: (r) => str(r.name) },
        { label: "Abbreviation", render: (r) => str(r.abbreviation) },
      ]}
    />
  );
}
export function RegionForm({ mode }: { mode: "create" | "edit" }) {
  return <SimpleForm entity="regions" mode={mode} crumb="Regions" base={REGIONS} createTitle="Add Region" editTitle="Edit Region" saveLabel="Save Region" />;
}

/* Screens 12 / 13 — Provinces & States */

const PROVINCES = "/admin/location/provinces";
export function ManageProvinces() {
  return (
    <SimpleDirectory
      entity="provinces"
      title="Manage Provinces & States"
      crumb="Provinces & States"
      base={PROVINCES}
      createLabel="Create Province / State"
      noun="province / state"
      empty="No provinces or states have been created yet."
      columns={[
        { label: "Province / State Name", render: (r) => str(r.name) },
        { label: "Abbreviation", render: (r) => str(r.abbreviation) },
        { label: "Active", render: (r) => (r.active === "Inactive" ? "No" : "Yes") },
      ]}
    />
  );
}
export function ProvinceForm({ mode }: { mode: "create" | "edit" }) {
  return <SimpleForm entity="provinces" mode={mode} crumb="Provinces & States" base={PROVINCES} createTitle="Add Province / State" editTitle="Edit Province / State" saveLabel="Save Province / State" />;
}

/* Screens 20 / 21 — Ministries */

const MINISTRIES = "/admin/location/ministries";
export function ManageMinistries() {
  return (
    <SimpleDirectory
      entity="ministries"
      title="Manage Ministries"
      crumb="Ministries"
      base={MINISTRIES}
      createLabel="Create Ministry"
      noun="ministry"
      empty="No Ministries Found!"
      filter={false}
      columns={[
        { label: "Ministry Name", render: (r) => str(r.name) },
        { label: "Type", render: (r) => str(r.type) },
        { label: "Settings", render: (r) => str(r.settings) },
        { label: "Ministry Equivalents", render: (r) => Object.keys((r.mapping as Record<string, string>) ?? {}).length },
      ]}
    />
  );
}

export function MinistryForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <SimpleForm entity="ministries" mode={mode} crumb="Ministries" base={MINISTRIES} createTitle="Add Ministry" editTitle="Edit Ministry" saveLabel="Save Ministry">
      {(form) => <MinistryBody form={form} />}
    </SimpleForm>
  );
}

function MinistryBody({ form }: { form: ReturnType<typeof useEntityForm> }) {
  const scope = str(form.values?.settings) || "Brands";
  const [targets, setTargets] = useState<Array<{ id: string; name: string }> | null>(null);
  useEffect(() => {
    setTargets(null);
    lx<Listing>(scope === "Campuses" ? "/campuses" : "/brands")
      .then((r) => setTargets(r.items.map((i) => ({ id: i.id, name: str(scope === "Campuses" ? i._display || i.name : i.name) }))))
      .catch(() => setTargets([]));
  }, [scope]);
  const mapping = (form.values?.mapping as Record<string, string>) ?? {};
  return (
    <>
      <EntitySections form={form} only={["name", "type", "settings"]} title="Ministry Details" />
      <section className="mh-sa__card">
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>{scope === "Campuses" ? "Campus Name" : "Brand Name"}</th>
                <th>Ministry Equivalent</th>
              </tr>
            </thead>
            <tbody>
              {!targets ? (
                <tr>
                  <td colSpan={2} className="mh-sa__muted">
                    Loading…
                  </td>
                </tr>
              ) : targets.length === 0 ? (
                <tr>
                  <td colSpan={2} className="mh-sa__empty-cell">
                    No {scope.toLowerCase()} to map yet.
                  </td>
                </tr>
              ) : (
                targets.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>
                      <input
                        className="mh-sa__input"
                        aria-label={`Ministry Equivalent for ${t.name}`}
                        value={mapping[t.id] ?? ""}
                        maxLength={200}
                        onChange={(e) => form.setValue("mapping", { ...mapping, [t.id]: e.target.value })}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

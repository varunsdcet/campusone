"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { EntitySections, useEntityForm, useLeaveGuard } from "./forms";
import { ConfirmDelete, FieldControl, FieldGrid, FilterBar, errMsg, lx, sectionsOf, str, useLocationMeta, useNotice, type Data, type Listing, type Row } from "./shared";

const CRUMB = ["Home", "Location Management", "Brands"];
const ACTIVE_HREF = "/admin/location/brands";

/* ------------------------------------------------------------------ */
/* Screen 1 — Manage Brands                                             */
/* ------------------------------------------------------------------ */

export function ManageBrands() {
  const router = useRouter();
  const notice = useNotice();
  const { fail } = notice;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState("");
  const [confirm, setConfirm] = useState<Row | null>(null);

  const load = useCallback(() => {
    lx<Listing>("/brands")
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load brands")));
  }, [fail]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const n = filter.trim().toLowerCase();
    return (rows ?? []).filter((r) => !n || [r.name, r.abbreviation].some((v) => str(v).toLowerCase().includes(n)));
  }, [rows, filter]);

  return (
    <SuperFrame
      title="Manage Brands"
      breadcrumbs={CRUMB}
      activeHref={ACTIVE_HREF}
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href="/admin/location/brands/new">
          Create Brand
        </Link>
      }
    >
      <div className="lx">
        {notice.node}
        <section className="mh-sa__card">
          <FilterBar value={filter} onChange={setFilter} />
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Brand Name</th>
                    <th>Abbreviation</th>
                    <th>Active</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id}>
                      <td>{str(r.name)}</td>
                      <td>{str(r.abbreviation)}</td>
                      <td>{r.active === "Inactive" ? "No" : "Yes"}</td>
                      <td className="lx-actions">
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`/admin/location/brands/manage?id=${r.id}`)}>
                          Manage
                        </button>
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="mh-sa__empty-cell">
                        {filter ? "No brands match this filter." : "No brands have been created yet."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {confirm ? (
          <ConfirmDelete
            title="Delete brand"
            body={`Delete the brand "${str(confirm.name)}"? Its e-mail relay services and brand settings will also be removed.`}
            okLabel="Delete Brand"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const r = confirm;
              setConfirm(null);
              lx<{ message: string }>(`/brands/${r.id}`, { method: "DELETE" })
                .then((out) => {
                  notice.ok(out.message);
                  load();
                })
                .catch((e) => notice.fail(errMsg(e, "Delete failed")));
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 2 — Add Brand                                                 */
/* ------------------------------------------------------------------ */

export function AddBrand() {
  const router = useRouter();
  const notice = useNotice();
  const form = useEntityForm("brands", null);
  useLeaveGuard(form.dirty && !form.busy);
  return (
    <SuperFrame title="Add Brand" breadcrumbs={[...CRUMB, "Add Brand"]} activeHref={ACTIVE_HREF}>
      <form
        className="lx"
        onSubmit={(e) => {
          e.preventDefault();
          form
            .save()
            .then((out) => router.push(`/admin/location/brands/manage?id=${out.id}&notice=${encodeURIComponent(out.message)}`))
            .catch((err) => notice.fail(errMsg(err, "Save failed")));
        }}
      >
        {form.metaError ? <SaNotice tone="error">{form.metaError}</SaNotice> : null}
        {notice.node}
        {!form.values ? <p className="mh-sa__muted">Loading…</p> : <EntitySections form={form} />}
        <div className="mh-sa__actions">
          <Link className="mh-sa__btn" href="/admin/location/brands">
            Cancel
          </Link>
          <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
            Save Brand
          </button>
        </div>
      </form>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 3–9 — Manage Brand (six tabs)                                */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: "brand", label: "Brand Settings" },
  { key: "profile", label: "Profile Settings" },
  { key: "academic", label: "Academic Settings" },
  { key: "financial", label: "Financial Settings" },
  { key: "accessibility", label: "Accessibility Settings" },
  { key: "email", label: "E-mail Relay Settings" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function ManageBrand() {
  const router = useRouter();
  const sp = useSearchParams();
  const notice = useNotice();
  const { fail, ok, clear } = notice;
  const [brandId, setBrandId] = useState<string | null>(sp?.get("id") ?? null);
  const [brandName, setBrandName] = useState("");
  const tabParam = (sp?.get("tab") ?? "brand") as Tab;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? tabParam : "brand";
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (brandId) return;
    lx<Listing>("/brands")
      .then((r) => {
        if (r.items[0]) setBrandId(r.items[0].id);
        else fail("Create a brand first.");
      })
      .catch((e) => fail(errMsg(e, "Could not load brands")));
  }, [brandId, fail]);

  useEffect(() => {
    if (!brandId) return;
    lx<Row>(`/brands/${brandId}`)
      .then((b) => setBrandName(str(b.name)))
      .catch((e) => fail(errMsg(e, "Could not load brand")));
  }, [brandId, fail]);

  const go = (t: Tab) => {
    if (t === tab) return;
    if (dirty && !window.confirm("You have unsaved changes on this tab. Leave without saving?")) return;
    setDirty(false);
    clear();
    router.replace(`/admin/location/brands/manage?id=${brandId}&tab=${t}`);
  };

  return (
    <SuperFrame title={`Manage Brand${brandName ? `: ${brandName}` : ""}`} breadcrumbs={[...CRUMB, "Manage Brand"]} activeHref={ACTIVE_HREF}>
      <div className="lx">
        {notice.node}
        <nav className="lx-tabs" role="tablist" aria-label="Brand settings">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`lx-tab${tab === t.key ? " is-active" : ""}`} onClick={() => go(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        {!brandId ? null : tab === "brand" ? (
          <BrandSettingsTab
            key={brandId}
            id={brandId}
            onSaved={(name, msg) => {
              setBrandName(name);
              ok(msg);
            }}
            onError={fail}
            onDirty={setDirty}
          />
        ) : tab === "email" ? (
          <EmailRelayTab key={brandId} brandId={brandId} onOk={ok} onError={fail} />
        ) : (
          <SettingsTab key={`${brandId}-${tab}`} brandId={brandId} tab={tab} onOk={ok} onError={fail} onDirty={setDirty} />
        )}
        <div className="lx-back">
          <Link className="mh-sa__link" href="/admin/location/brands">
            « Back to Manage Brands
          </Link>
        </div>
      </div>
    </SuperFrame>
  );
}

function BrandSettingsTab({ id, onSaved, onError, onDirty }: { id: string; onSaved: (name: string, msg: string) => void; onError: (m: string) => void; onDirty: (d: boolean) => void }) {
  const form = useEntityForm("brands", id);
  useLeaveGuard(form.dirty);
  useEffect(() => onDirty(form.dirty), [form.dirty, onDirty]);
  if (form.loadError) return <SaNotice tone="error">{form.loadError}</SaNotice>;
  if (!form.values) return <p className="mh-sa__muted">Loading…</p>;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form
          .save()
          .then((out) => onSaved(str(form.values?.name), out.message))
          .catch((err) => onError(errMsg(err, "Save failed")));
      }}
    >
      <EntitySections form={form} title="Brand Settings" />
      <div className="mh-sa__actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy}>
          Save Brand Settings
        </button>
      </div>
    </form>
  );
}

function SettingsTab({ brandId, tab, onOk, onError, onDirty }: { brandId: string; tab: Exclude<Tab, "brand" | "email">; onOk: (m: string) => void; onError: (m: string) => void; onDirty: (d: boolean) => void }) {
  const { meta } = useLocationMeta();
  const [values, setValues] = useState<Data | null>(null);
  const [snap, setSnap] = useState("");
  const [busy, setBusy] = useState(false);
  const spec = meta?.settings[tab];

  useEffect(() => {
    lx<{ values: Data }>(`/brands/${brandId}/settings/${tab}`)
      .then((r) => {
        setValues(r.values);
        setSnap(JSON.stringify(r.values));
      })
      .catch((e) => onError(errMsg(e, "Could not load settings")));
  }, [brandId, tab, onError]);

  const dirty = values ? JSON.stringify(values) !== snap : false;
  useLeaveGuard(dirty);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);

  if (!meta || !spec || !values) return <p className="mh-sa__muted">Loading…</p>;
  const setValue = (k: string, v: unknown) => setValues((s) => (s ? { ...s, [k]: v } : s));
  const save = () => {
    setBusy(true);
    lx<{ message: string }>(`/brands/${brandId}/settings/${tab}`, { method: "PUT", body: JSON.stringify(values) })
      .then((out) => {
        setSnap(JSON.stringify(values));
        onOk(out.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch((e) => onError(errMsg(e, "Save failed")))
      .finally(() => setBusy(false));
  };
  const sections = sectionsOf(spec.fields);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {sections.map((sec) => (
        <section key={sec.name} className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>{sec.name}</h2>
          </div>
          <FieldGrid fields={sec.fields} values={values} setValue={setValue} meta={meta} />
        </section>
      ))}
      <div className="mh-sa__actions lx-sticky-actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
          {spec.save}
        </button>
      </div>
    </form>
  );
}

/* Screens 8 / 9 — E-mail Relay Settings + Add / Edit E-mail Service popup */

function EmailRelayTab({ brandId, onOk, onError }: { brandId: string; onOk: (m: string) => void; onError: (m: string) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const load = useCallback(() => {
    lx<Listing>(`/email-services?parentId=${brandId}`)
      .then((r) => setRows(r.items))
      .catch((e) => onError(errMsg(e, "Could not load e-mail services")));
  }, [brandId, onError]);
  useEffect(load, [load]);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>E-mail Relay Settings</h2>
        <button type="button" className="mh-sa__btn mh-sa__btn--primary mh-sa__btn--sm" onClick={() => setEditing("new")}>
          Add E-mail Service
        </button>
      </div>
      {!rows ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <div className="mh-sa__table-wrap">
          <table className="mh-sa__table lx-table">
            <thead>
              <tr>
                <th>E-mail Service Name</th>
                <th>Type</th>
                <th>From Name</th>
                <th>From Address</th>
                <th className="lx-actions" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{str(r.name)}</td>
                  <td>{str(r.method)}</td>
                  <td>{str(r.fromName)}</td>
                  <td>{str(r.fromAddress)}</td>
                  <td className="lx-actions">
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setEditing(r.id)}>
                      Edit
                    </button>
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="mh-sa__empty-cell">
                    No e-mail services have been added for this brand.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
      {editing ? (
        <EmailServiceModal
          brandId={brandId}
          id={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => {
            setEditing(null);
            onOk(m);
            load();
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmDelete
          title="Delete e-mail service"
          body={`Delete the e-mail service "${str(confirm.name)}"?`}
          okLabel="Delete Service"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            lx<{ message: string }>(`/email-services/${r.id}`, { method: "DELETE" })
              .then((out) => {
                onOk(out.message);
                load();
              })
              .catch((e) => onError(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </section>
  );
}

function EmailServiceModal({ brandId, id, onClose, onSaved }: { brandId: string; id: string | null; onClose: () => void; onSaved: (m: string) => void }) {
  const form = useEntityForm("emailServices", id, { parentId: brandId });
  const [error, setError] = useState<string | null>(null);
  const main = form.fields.filter((f) => f.key !== "conditions");
  const conditions = form.fields.find((f) => f.key === "conditions");
  return (
    <SaModal
      title={id ? "Edit E-mail Service" : "Add E-mail Service"}
      onClose={onClose}
      wide
      footer={
        <button
          type="button"
          className="mh-sa__btn mh-sa__btn--primary"
          disabled={form.busy || !form.values}
          onClick={() =>
            form
              .save()
              .then((out) => onSaved(out.message))
              .catch((e) => setError(errMsg(e, "Save failed")))
          }
        >
          Save E-mail Service
        </button>
      }
    >
      {error ? (
        <SaNotice tone="error" onClose={() => setError(null)}>
          {error}
        </SaNotice>
      ) : null}
      {form.loadError ? <SaNotice tone="error">{form.loadError}</SaNotice> : null}
      {!form.meta || !form.values ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <>
          <FieldGrid fields={main} values={form.values} setValue={form.setValue} meta={form.meta} />
          {conditions ? (
            <fieldset className="lx-fieldset">
              <legend>Send Email Condition</legend>
              <FieldControl field={{ ...conditions, label: "" }} value={form.values.conditions} values={form.values} onChange={(v) => form.setValue("conditions", v)} meta={form.meta} bare />
            </fieldset>
          ) : null}
        </>
      )}
    </SaModal>
  );
}

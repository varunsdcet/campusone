"use client";

import { useCallback, useEffect, useState } from "react";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ConfirmDelete } from "../location/shared";
import { Directory, ModalFields, SC, SettingsBody, Tabs, useTab, type Ctx } from "./directory";
import { errMsg, invalidateMeta, str, sx, useCanEdit, useFlash, useSysForm, type Listing, type Row } from "./kit";

const LOC = "/admin/sysconfig/localization";
const TABS = [
  { id: "general", label: "General Settings" },
  { id: "countries", label: "Countries & Regions" },
  { id: "languages", label: "Languages" },
  { id: "currencies", label: "Currencies" },
  { id: "timezones", label: "Time Zones" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const common = { embedded: true, activeHref: LOC, createMode: "modal" as const, initialNotice: null };

/* ------------------------------------------------------------------ */
/* Regions popup: list ⇄ add / edit form in one window                  */
/* ------------------------------------------------------------------ */

function RegionForm({ country, id, onBack, onSaved }: { country: Row; id: string | null; onBack: () => void; onSaved: (m: string) => void }) {
  const form = useSysForm("countryRegions", id, { parentId: country.id });
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="sx-modal"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        form
          .save()
          .then((out) => onSaved(out.message))
          .catch((x) => setErr(errMsg(x, "Save failed")));
      }}
    >
      <button type="button" className="mh-sa__link sx-back" onClick={onBack}>
        « Back to regions list
      </button>
      {err || form.error ? <SaNotice tone="error">{err ?? form.error}</SaNotice> : null}
      <ModalFields form={form} />
      <div className="sx-inline-actions">
        <button type="button" className="mh-sa__btn" onClick={onBack}>
          Cancel
        </button>
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={form.busy || !form.values}>
          {form.busy ? "Saving…" : "Save Region"}
        </button>
      </div>
    </form>
  );
}

function RegionsModal({ country, onClose }: { country: Row; onClose: () => void }) {
  const flash = useFlash(null);
  const { ok, fail } = flash;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [view, setView] = useState<{ id: string | null; name: string } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const writable = useCanEdit("countryRegions");
  const load = useCallback(() => {
    sx<Listing>(`/e/countryRegions?parentId=${country.id}`)
      .then((r) => setRows(r.items))
      .catch((e) => fail(errMsg(e, "Could not load regions")));
  }, [country.id, fail]);
  useEffect(load, [load]);
  const upper = (s: string) => s.toUpperCase();
  return (
    <SaModal
      title={view ? (view.id ? `Edit Region: ${upper(view.name)}` : `Add Region: ${upper(str(country.name))}`) : `Manage Regions: ${upper(str(country.name))}`}
      wide
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn" onClick={onClose}>
          Close
        </button>
      }
    >
      {view ? (
        <RegionForm
          country={country}
          id={view.id}
          onBack={() => setView(null)}
          onSaved={(m) => {
            setView(null);
            ok(m);
            load();
          }}
        />
      ) : (
        <div className="sx-modal">
          {flash.node}
          {writable ? (
            <div className="sx-tabhead">
              <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setView({ id: null, name: "" })}>
                Add Region
              </button>
            </div>
          ) : null}
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <table className="mh-sa__table lx-table">
              <thead>
                <tr>
                  <th>Region Name</th>
                  <th>Region Code</th>
                  <th className="lx-actions" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{str(r.name)}</td>
                    <td>{str(r.code) || <span className="mh-sa__muted">—</span>}</td>
                    <td className="lx-actions">
                      {writable ? (
                        <>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setView({ id: r.id, name: str(r.name) })}>
                            Edit
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                            Delete
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={3} className="mh-sa__empty-cell">
                      No regions have been added for {str(country.name)} yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      )}
      {confirm ? (
        <ConfirmDelete
          title="Delete region"
          body={`Delete the region "${str(confirm.name)}" from ${str(country.name)}?`}
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            sx<{ message: string }>(`/e/countryRegions/${r.id}`, { method: "DELETE" })
              .then((out) => {
                ok(out.message);
                load();
              })
              .catch((e) => fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </SaModal>
  );
}

function Countries() {
  const [regions, setRegions] = useState<{ row: Row; ctx: Ctx } | null>(null);
  return (
    <>
      <Directory
        {...common}
        entity="countries"
        noun="country"
        createLabel="Add Country"
        modalTitle={(r) => (r ? `Edit Country: ${str(r.name)}` : "Add Country")}
        saveLabel="Save Country"
        empty="No countries have been added yet."
        filter={{ placeholder: "Enter Country Name or Code", keys: ["name", "code", "iso"] }}
        pageSize={25}
        confirmText={(r) => `Delete ${str(r.name)}${Number(r._regions) ? ` and its ${str(r._regions)} region(s)` : ""}?`}
        columns={[
          { label: "Country Name", render: (r) => <strong>{str(r.name)}</strong> },
          { label: "Code", render: (r) => str(r.code) },
          { label: "ISO", render: (r) => str(r.iso) },
          { label: "Currency", render: (r) => str(r._currencyLabel) || <span className="mh-sa__muted">—</span> },
        ]}
        rowActions={(r, ctx) => (
          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setRegions({ row: r, ctx })}>
            Regions ({Number(r._regions) || 0})
          </button>
        )}
      />
      {regions ? (
        <RegionsModal
          country={regions.row}
          onClose={() => {
            regions.ctx.reload();
            setRegions(null);
          }}
        />
      ) : null}
    </>
  );
}

function TabBody({ tab }: { tab: Tab }) {
  switch (tab) {
    case "general":
      return <SettingsBody settingsKey="localization" embedded onSaved={() => invalidateMeta()} />;
    case "countries":
      return <Countries />;
    case "languages":
      return (
        <Directory
          {...common}
          entity="languages"
          noun="language"
          createLabel="Add Language"
          modalTitle={(r) => (r ? `Edit Language: ${str(r.name)}` : "Add Language")}
          saveLabel="Save Language"
          empty="No languages have been added yet."
          columns={[
            { label: "Language Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Language Code", render: (r) => <code>{str(r.code)}</code> },
            { label: "Display Name", render: (r) => str(r.displayName) },
            { label: "Status", render: (r) => <span className={`sx-badge sx-badge--${r.status === "Active" ? "green" : "grey"}`}>{str(r.status)}</span> },
          ]}
          trailingActions={(r) => (r._protected ? <span className="sx-badge sx-badge--blue" title={str(r._protected)}>Default</span> : null)}
        />
      );
    case "currencies":
      return (
        <Directory
          {...common}
          entity="currencies"
          noun="currency"
          createLabel="Add Currency"
          modalTitle={(r) => (r ? `Edit Currency: ${str(r.name)} — ${str(r.code)}` : "Add Currency")}
          saveLabel="Save Currency"
          empty="No currencies have been added yet."
          filter={{ placeholder: "Enter Currency Name or Code", keys: ["name", "code", "iso"] }}
          columns={[
            { label: "Currency", render: (r) => <strong>{`${str(r.name)} — ${str(r.code)}`}</strong> },
            { label: "ISO", render: (r) => str(r.iso) },
            { label: "Symbol", render: (r) => str(r._symbol) || <span className="mh-sa__muted">—</span> },
            { label: "Active", render: (r) => str(r.active) },
          ]}
          trailingActions={(r) => (r._protected ? <span className="sx-badge sx-badge--blue" title={str(r._protected)}>Default</span> : null)}
        />
      );
    case "timezones":
      return (
        <Directory
          {...common}
          entity="timezones"
          noun="time zone"
          createLabel="Add Time Zone"
          modalTitle={(r) => (r ? `Edit Time Zone: ${str(r.name)}` : "Add Time Zone")}
          saveLabel="Save Time Zone"
          empty="No time zones have been added yet."
          sortable
          columns={[
            { label: "Time Zone Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Time Zone", render: (r) => <code>{str(r.zone)}</code> },
          ]}
        />
      );
  }
}

export function Localization() {
  const [tab, setTab] = useTab(TABS.map((t) => t.id), "general");
  return (
    <SuperFrame title="Localization Configuration" breadcrumbs={["Home", SC, "Localization Configuration"]} activeHref={LOC}>
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      <TabBody key={tab} tab={tab} />
    </SuperFrame>
  );
}

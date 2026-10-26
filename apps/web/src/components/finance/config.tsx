"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { SaModal } from "@/components/superadmin/shared";
import { Directory, EntityFormPage, EntityModal, type DirectoryProps } from "../sysconfig/directory";
import { invalidateMeta, str, sx, SysSections, type Listing, type Row, type SysForm } from "../sysconfig/kit";
import { FIN, FM, errMsg, fmtDay, invalidateFinMeta, useFlash } from "./kit";

type ConfigDef = {
  entity: string;
  title: string;
  dir: Omit<DirectoryProps, "entity" | "activeHref" | "title" | "base" | "section">;
  form?: { createTitle: string; editTitle: (r: Row | null) => string; saveLabel: string; body?: (form: SysForm) => ReactNode };
};

const named = (prefix: string) => (r: Row | null) => `${prefix}${r?.name ? `: ${str(r.name)}` : ""}`;
const badge = (text: string, tone: "green" | "grey" | "amber" | "red" | "blue" = "grey") => <span className={`sx-badge sx-badge--${tone}`}>{text}</span>;
const sub = (text: string) => (text ? <small className="fn-sub">{text}</small> : null);
const statusBadge = (v: unknown) => badge(str(v) || "Active", ["Active", "Enabled", "Yes", "Unlocked"].includes(str(v) || "Active") ? "green" : str(v) === "Locked" ? "red" : "grey");
const PROMOTION_TYPES = ["Promotion / Discount", "Scholarship / Bursary", "Grant / Award", "Waiver Code"];

export const CONFIG: Record<string, ConfigDef> = {
  lockouts: {
    entity: "lockouts",
    title: "Period Lock-Out",
    dir: {
      noun: "lock-out period",
      createLabel: "Add Lock-Out Period",
      empty: "No lock-out periods have been added yet.",
      filter: { placeholder: "Enter Period Dates, Status or Note", keys: ["startDate", "endDate", "lockStatus", "note"] },
      confirmLabel: "Confirm Delete",
      confirmText: (r) => `Delete the lock-out period ${fmtDay(r.startDate)} – ${fmtDay(r.endDate)}? This cannot be undone.`,
      columns: [
        {
          label: "Period Dates",
          render: (r) => (
            <>
              <strong>
                {fmtDay(r.startDate)} – {fmtDay(r.endDate)}
              </strong>
              {sub(Array.isArray(r.campuses) ? (r.campuses as string[]).join(", ") : "")}
            </>
          ),
        },
        {
          label: "Status",
          render: (r) => (
            <>
              {statusBadge(r.lockStatus || "Locked")}
              {sub(str(r.note))}
            </>
          ),
        },
      ],
    },
    form: { createTitle: "Add Lock-Out Period", editTitle: () => "Edit Lock-Out Period", saveLabel: "Save Lock-Out Period" },
  },
  "payment-methods": {
    entity: "paymentMethods",
    title: "Manage Payment Methods",
    dir: {
      noun: "payment method",
      createLabel: "Add Payment Method",
      createMode: "modal",
      modalTitle: (r) => (r ? `Edit Payment Method: ${str(r.name)}` : "Add Payment Method"),
      saveLabel: "Save Payment Method",
      empty: "No payment methods have been added yet.",
      filter: { placeholder: "Enter Search Filter Here", keys: ["name"] },
      confirmLabel: "Confirm Delete",
      columns: [
        {
          label: "Payment Method Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {r.creditCard ? sub("Credit Card") : null}
            </>
          ),
        },
        { label: "Processing Fees", render: (r) => (r.excludeProcessing ? "Excluded" : "Included") },
      ],
    },
  },
  "rate-categories": {
    entity: "rateCategories",
    title: "Manage Rate Categories",
    dir: {
      noun: "rate category",
      createLabel: "Add Rate Category",
      createMode: "modal",
      modalTitle: (r) => (r ? `Edit Rate Category: ${str(r.name)}` : "Add Rate Category"),
      saveLabel: "Save Rate Category",
      empty: "No rate categories have been added yet.",
      sortable: true,
      filter: { placeholder: "Enter Rate Name", keys: ["name"] },
      confirmLabel: "Confirm Delete",
      columns: [
        {
          label: "Rate Category Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong> {r.defaultRate === "Yes" ? badge("Default", "blue") : null}
              {r.regionalize === "Yes" && Array.isArray(r.regions) ? sub(`Regional: ${(r.regions as string[]).join(", ")}`) : null}
            </>
          ),
        },
        { label: "Status", render: (r) => statusBadge(r.active === "No" ? "Inactive" : "Active") },
      ],
    },
  },
  "plan-templates": {
    entity: "planTemplates",
    title: "Manage Payment Plan Template",
    dir: {
      noun: "payment plan template",
      createLabel: "Add Payment Plan Template",
      empty: "No payment plan templates have been added yet.",
      filter: { placeholder: "Enter Template Name or Code", keys: ["name", "code", "status"] },
      confirmLabel: "Delete Payment Plan Template",
      columns: [
        {
          label: "Template Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub([str(r.code), str(r.description)].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Schedule", render: (r) => (r.scheduleType === "Manual / Advanced Instalments" ? `Manual · ${str(r.totalInstalments)} instalments` : `${str(r.totalInstalments)} × every ${str(r.frequency)}`) },
        { label: "Payment Plan Fee", render: (r) => str(r.planFee) || "No Fee" },
      ],
    },
    form: { createTitle: "Add Payment Plan Template", editTitle: named("Edit Payment Plan Template"), saveLabel: "Save Payment Plan Template" },
  },
  "tax-rates": {
    entity: "taxRates",
    title: "Manage Tax Rates",
    dir: {
      noun: "tax rate",
      createLabel: "Add Tax Rate",
      createMode: "modal",
      modalTitle: (r) => (r ? `Edit Tax Rate: ${str(r.name)}` : "Add Tax Rate"),
      saveLabel: "Save Tax Rate",
      empty: "No tax rates have been added yet.",
      filter: { placeholder: "Enter Tax Name or Rate", keys: ["name", "rate", "code"] },
      confirmLabel: "Confirm Delete",
      columns: [
        {
          label: "Tax Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub(str(r.code))}
            </>
          ),
        },
        { label: "RAX RATE", render: (r) => `${str(r.rate)}%` },
        { label: "Inclusive", render: (r) => str(r.inclusive) || "No" },
        { label: "Regionalize", render: (r) => (r.regionalize === "Yes" && Array.isArray(r.regions) ? (r.regions as string[]).join(", ") : "No") },
      ],
    },
  },
  "disbursement-types": {
    entity: "disbursementTypes",
    title: "Manage Disbursement Types",
    dir: {
      noun: "disbursement type",
      createLabel: "Add Disbursement Type",
      createMode: "modal",
      modalTitle: (r) => (r ? `Edit Disbursement Type: ${str(r.name)}` : "Add Disbursement Type"),
      saveLabel: "Save Disbursement Type",
      empty: "No disbursement types have been added yet.",
      filter: { placeholder: "Enter Search Filter Here", keys: ["name", "description"] },
      confirmLabel: "Delete Disbursement Type",
      columns: [
        {
          label: "Disbursement Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub(str(r.description))}
            </>
          ),
        },
        { label: "Disbursement Type", render: (r) => str(r.kind) },
      ],
    },
  },
  "promotion-allocations": {
    entity: "promotionAllocations",
    title: "Manage Promotion Allocations",
    dir: {
      noun: "promotion allocation",
      createLabel: "Add Promotion Allocation",
      createMode: "modal",
      modalTitle: (r) => (r ? `Edit Promotion Allocation: ${str(r.name)}` : "Add Promotion Allocation"),
      saveLabel: "Save Promotion Allocation",
      empty: "No promotion allocation options have been added yet.",
      filter: { placeholder: "Enter allocation name or description", keys: ["name", "description"] },
      confirmLabel: "Delete Promotion Allocation",
      columns: [
        {
          label: "Allocation Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub(str(r.description))}
            </>
          ),
        },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ],
    },
  },
  promotions: {
    entity: "promotions",
    title: "Manage Promotions",
    dir: {
      noun: "promotion",
      createLabel: "Create Promotion",
      empty: "No promotions have been created yet.",
      pageSize: 25,
      filter: { label: "Name Filter", placeholder: "Enter Promotion Name", keys: ["name", "description"], submitLabel: "Search Promotions" },
      selects: [
        { key: "type", label: "Type Filter", all: "All", options: () => PROMOTION_TYPES, match: (r, v) => r.type === v },
        { key: "status", label: "Status Filter", all: "All", options: () => ["Active", "Inactive"], match: (r, v) => (str(r.status) || "Active") === v },
      ],
      confirmLabel: "Delete Promotion",
      columns: [
        {
          label: "Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub([str(r.description), r.value === "Percentage" ? `${str(r.percentage)}%` : r.amount ? `$${Number(r.amount).toFixed(2)}${r.value === "Pro-Rated" ? " (pro-rated)" : ""}` : ""].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Type", render: (r) => str(r.type) },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Requirements", render: (r) => str(r._requirements) || "None" },
      ],
    },
    form: { createTitle: "Create Promotion", editTitle: named("Edit Promotion"), saveLabel: "Save Promotion" },
  },
  "funding-sources": {
    entity: "fundingSources",
    title: "Funding Sources",
    dir: {
      noun: "funding source",
      createLabel: "Create Funding Source",
      empty: "No funding sources have been created yet.",
      pageSize: 25,
      filter: { label: "Name Filter", placeholder: "Enter Funding Source Name", keys: ["name", "contactFirst", "contactLast", "email"], submitLabel: "Search Funding Sources" },
      selects: [{ key: "status", label: "Status Filter", all: "All", options: () => ["Active", "Inactive"], match: (r, v) => (str(r.status) || "Active") === v }],
      confirmLabel: "Delete Funding Source",
      columns: [
        {
          label: "Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong>
              {sub([`${str(r.contactFirst)} ${str(r.contactLast)}`.trim(), str(r.email)].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ],
    },
    form: { createTitle: "Create Funding Source", editTitle: named("Edit Funding Source"), saveLabel: "Save Funding Source" },
  },
  "collection-agencies": {
    entity: "collectionAgencies",
    title: "Manage Collection Agencies",
    dir: {
      noun: "collection agency",
      createLabel: "Add Collection Agency",
      empty: "No collection agencies have been added yet.",
      filter: { placeholder: "Enter Search Filter Here", keys: ["name", "city", "email", "phone"] },
      confirmLabel: "Delete Collection Agency",
      columns: [
        {
          label: "Agency Name",
          render: (r) => (
            <>
              <strong>{str(r.name)}</strong> {r.defaultAgency === "Enabled" ? badge("Default", "blue") : null}
              {sub([str(r.city), str(r.province), str(r.phone)].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Commission", render: (r) => (r.commissionType === "Fixed" ? `$${Number(r.commissionRate || 0).toFixed(2)} per account` : `${str(r.commissionRate) || "0"}%`) },
      ],
    },
    form: { createTitle: "Add Collection Agency", editTitle: named("Edit Collection Agency"), saveLabel: "Save Collection Agency" },
  },
  agents: {
    entity: "agents",
    title: "Manage Agents",
    dir: {
      noun: "agent",
      createLabel: "Add Agent",
      empty: "No agents have been added yet. Add an agent before creating commissions or bonuses.",
      filter: { placeholder: "Search agent number, name, company or email", keys: ["agentNumber", "firstName", "lastName", "company", "email"] },
      confirmLabel: "Delete Agent",
      columns: [
        {
          label: "Agent",
          render: (r) => (
            <>
              <strong>{`${str(r.lastName)}, ${str(r.firstName)}`.replace(/^, |, $/, "") || str(r.agentNumber)}</strong>
              {sub([str(r.agentNumber), str(r.company), str(r.email)].filter(Boolean).join(" · "))}
            </>
          ),
        },
        { label: "Commission", render: (r) => (r.commissionType === "Fixed" ? `$${Number(r.commissionRate || 0).toFixed(2)}` : `${str(r.commissionRate) || "0"}%`) },
        { label: "Status", render: (r) => statusBadge(r.status || "Active") },
      ],
    },
    form: { createTitle: "Add Agent", editTitle: () => "Edit Agent", saveLabel: "Save Agent" },
  },
};

/* ------------------------------------------------------------------ */
/* Tuition / Ledger Types (grouped by category)                         */
/* ------------------------------------------------------------------ */

function DeleteCategory({ cat, onClose, onDone }: { cat: Row; onClose: () => void; onDone: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <SaModal
      title="Delete Category"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="mh-sa__btn mh-sa__btn--danger"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              sx<{ message: string }>(`/e/ledgerCategories/${cat.id}`, { method: "DELETE" })
                .then((o) => onDone(o.message))
                .catch((e) => setErr(errMsg(e, "Delete failed")))
                .finally(() => setBusy(false));
            }}
          >
            Delete Category
          </button>
        </>
      }
    >
      {err ? <div className="mh-sa__notice mh-sa__notice--error">{err}</div> : null}
      <p>
        Delete the category <strong>{str(cat.name)}</strong>? Tuition / ledger types in this category are kept and simply lose this category.
      </p>
    </SaModal>
  );
}

function LedgerTypes() {
  const flash = useFlash();
  const { fail } = flash;
  const [cats, setCats] = useState<Row[]>([]);
  const [rev, setRev] = useState(0);
  const [catModal, setCatModal] = useState<{ id: string | null } | null>(null);
  const [catDelete, setCatDelete] = useState<Row | null>(null);
  const loadCats = useCallback(() => {
    sx<Listing>("/e/ledgerCategories")
      .then((r) => setCats(r.items))
      .catch((e) => fail(errMsg(e, "Could not load categories")));
  }, [fail]);
  useEffect(loadCats, [loadCats]);
  const refresh = (m: string) => {
    flash.ok(m);
    invalidateMeta();
    invalidateFinMeta();
    loadCats();
    setRev((n) => n + 1);
  };
  const catActions = (c: Row) => (
    <span className="lx-actions">
      <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setCatModal({ id: c.id })}>
        Edit
      </button>
      <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setCatDelete(c)}>
        Delete
      </button>
    </span>
  );
  return (
    <>
      <Directory
        key={rev}
        entity="ledgerTypes"
        title="Manage Tuition / Ledger Types"
        activeHref={`${FIN}/ledger-types`}
        section={FM}
        noun="tuition / ledger type"
        createLabel="Add Tuition / Ledger Type"
        empty="No tuition / ledger types have been added yet."
        filter={{ placeholder: "Enter Search Filter Here", keys: ["name", "code", "trigger", "_categoryNames"] }}
        confirmLabel="Confirm Delete"
        headerActions={() => (
          <button type="button" className="mh-sa__btn" onClick={() => setCatModal({ id: null })}>
            Add Category
          </button>
        )}
        below={() => flash.node}
        groups={(rows) => {
          const out = cats.map((c) => ({ title: str(c.name), rows: rows.filter((r) => Array.isArray(r.categories) && (r.categories as string[]).includes(c.id)), actions: catActions(c) }));
          const loose = rows.filter((r) => !Array.isArray(r.categories) || !(r.categories as string[]).some((id) => cats.some((c) => c.id === id)));
          if (loose.length) out.push({ title: "Uncategorized", rows: loose, actions: <span /> });
          return out;
        }}
        columns={[
          {
            label: "Type Name",
            render: (r) => (
              <>
                <strong>{str(r.name)}</strong>
                {sub([str(r.code), r.trigger && r.trigger !== "None" ? `Trigger: ${str(r.trigger)}` : ""].filter(Boolean).join(" · "))}
              </>
            ),
          },
          { label: "Editable", render: (r) => (r.overridable === "No" ? "No" : "Yes") },
          {
            label: "Default Values",
            render: (r) => (
              <span className="fn-defaults">
                <span>Domestic: ${Number(r.domestic || 0).toFixed(2)}</span>
                <span>International: ${Number(r.international || 0).toFixed(2)}</span>
              </span>
            ),
          },
          { label: "Taxes", render: (r) => (Array.isArray(r._taxNames) && r._taxNames.length ? (r._taxNames as string[]).join(", ") : "None") },
        ]}
      />
      {catModal ? (
        <EntityModal
          entity="ledgerCategories"
          id={catModal.id}
          title={catModal.id ? "Edit Category" : "Add Category"}
          saveLabel="Save Category"
          onClose={() => setCatModal(null)}
          onSaved={(m) => {
            setCatModal(null);
            refresh(m);
          }}
        />
      ) : null}
      {catDelete ? (
        <DeleteCategory
          cat={catDelete}
          onClose={() => setCatDelete(null)}
          onDone={(m) => {
            setCatDelete(null);
            refresh(m);
          }}
        />
      ) : null}
    </>
  );
}

export function ConfigList({ slug }: { slug: string }) {
  if (slug === "ledger-types") return <LedgerTypes />;
  const def = CONFIG[slug];
  if (!def) return null;
  return <Directory entity={def.entity} title={def.title} activeHref={`${FIN}/${slug}`} section={FM} {...def.dir} />;
}

const LEDGER_FORM = { entity: "ledgerTypes", title: "Manage Tuition / Ledger Types", form: { createTitle: "Add Tuition / Ledger Type", editTitle: named("Edit Tuition / Ledger Type"), saveLabel: "Save Tuition / Ledger Type" } };

export function ConfigForm({ slug, mode }: { slug: string; mode: "create" | "edit" }) {
  const def = slug === "ledger-types" ? LEDGER_FORM : CONFIG[slug];
  if (!def?.form) return null;
  return (
    <EntityFormPage
      entity={def.entity}
      mode={mode}
      base={`${FIN}/${slug}`}
      crumb={def.title}
      section={FM}
      createTitle={def.form.createTitle}
      editTitle={def.form.editTitle}
      saveLabel={def.form.saveLabel}
      children={
        slug === "plan-templates"
          ? (form) => (
              <>
                <div className="mh-sa__notice fn-info">
                  Payment Plan Fee options come from tuition / ledger types whose Fee Trigger is Payment Plan. <a href={`${FIN}/ledger-types/new?d.name=Payment%20Plan%20Fee&d.code=PLAN&d.trigger=Payment%20Plan`}>Add Payment Plan Fee</a>
                </div>
                <SysSections form={form} />
              </>
            )
          : undefined
      }
    />
  );
}

export const isConfig = (slug: string) => slug === "ledger-types" || slug in CONFIG;
export const hasConfigForm = (slug: string) => slug === "ledger-types" || Boolean(CONFIG[slug]?.form);

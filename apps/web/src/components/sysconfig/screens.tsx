"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { Directory, EntityFormPage, SC, type DirectoryProps } from "./directory";
import { Swatch, str, type Row, type SysForm } from "./kit";
import { StudentStatuses } from "./statuses";

export const BASE = "/admin/sysconfig";

type ScreenDef = {
  entity: string;
  title: string;
  dir: Omit<DirectoryProps, "entity" | "activeHref" | "title" | "base">;
  form?: { createTitle: string; editTitle: (r: Row | null) => string; saveLabel: string; body?: (form: SysForm) => ReactNode };
};

const named = (prefix: string) => (r: Row | null) => `${prefix}${r?.name ? `: ${str(r.name)}` : ""}`;
const yesNo = (v: unknown) => (v === "Yes" || v === true ? "Yes" : "No");
const badge = (text: string, tone: "green" | "grey" | "amber" | "red" | "blue" = "grey") => <span className={`sx-badge sx-badge--${tone}`}>{text}</span>;
const statusBadge = (v: unknown) => badge(str(v), ["Enabled", "Active", "Yes"].includes(str(v)) ? "green" : "grey");
const nameCol = { label: "Name", render: (r: Row) => <strong>{str(r.name)}</strong> };
const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const listOr = (v: unknown, all: string) => (Array.isArray(v) && v.length ? v.join(", ") : all);

export const SCREENS: Record<string, ScreenDef> = {
  workflows: {
    entity: "workflows",
    title: "Requirements & Workflows",
    dir: {
      noun: "requirement / workflow",
      createLabel: "Add Requirement / Workflow",
      empty: "No requirements or workflows have been created yet.",
      emptyCta: true,
      filter: { placeholder: "Enter Requirement / Workflow Name", keys: ["name", "description"] },
      columns: [
        nameCol,
        { label: "Workflow Status", render: (r) => statusBadge(r.workflowStatus) },
        { label: "Trigger Statuses", render: (r) => listOr(r.triggerStatuses, "Any status") },
        { label: "Action", render: (r) => str(r.action) },
        { label: "Steps / Items", render: (r) => `${count(r.steps)} / ${count(r.items)}` },
      ],
    },
    form: { createTitle: "Add Requirement / Workflow", editTitle: named("Edit Requirement / Workflow"), saveLabel: "Save Requirement" },
  },
  assessments: {
    entity: "assessments",
    title: "Assessments Management",
    dir: {
      noun: "assessment",
      createLabel: "Add Assessment Cases",
      empty: "No assessment cases found.",
      emptyCta: true,
      filter: { placeholder: "Enter Assessment Name", keys: ["name"] },
      columns: [
        { label: "Assessment Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Status", render: (r) => statusBadge(r.status) },
        { label: "Automated Assignment", render: (r) => str(r.automatedAssignment) },
        { label: "Review Process", render: (r) => str(r.reviewProcess) },
        { label: "Cases", render: (r) => count(r.cases) },
      ],
    },
    form: { createTitle: "Add Assessment Cases", editTitle: named("Edit Assessment Cases"), saveLabel: "Save Assessment Cases" },
  },
  "assessment-categories": {
    entity: "assessmentCategories",
    title: "Assessment Categories",
    dir: {
      noun: "category",
      createLabel: "Add Category",
      empty: "No assessment categories have been created yet.",
      emptyCta: true,
      columns: [
        {
          label: "Category Name",
          render: (r) => (
            <span className="sx-named">
              <Swatch colour={str(r.colour)} /> {str(r.name)}
            </span>
          ),
        },
        { label: "Category Access", render: (r) => str(r.access) },
      ],
    },
    form: { createTitle: "Add Category", editTitle: named("Edit Category"), saveLabel: "Save Category" },
  },
  "advisor-linking": {
    entity: "advisorLinkings",
    title: "Advisor Linking",
    dir: {
      noun: "advisor linking",
      createLabel: "Create Advisor Linking",
      empty: "No advisor linkings have been created yet.",
      emptyCta: true,
      filter: { placeholder: "Enter Linking Name", keys: ["name", "_advisorLabel"] },
      columns: [
        { label: "Linking Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Advisor", render: (r) => str(r._advisorLabel) || <span className="mh-sa__muted">(removed user)</span> },
        { label: "Campus", render: (r) => str(r.campus) },
        { label: "Status", render: (r) => str(r.status) },
        { label: "Program of Study", render: (r) => str(r.program) },
      ],
    },
    form: { createTitle: "Create Advisor Linking", editTitle: named("Edit Advisor Linking"), saveLabel: "Save Advisor Linking" },
  },
  "document-types": {
    entity: "documentTypes",
    title: "Manage Document Types",
    dir: {
      noun: "document type",
      crumbs: ["Workflow Document Types"],
      createLabel: "Add Document Type",
      empty: "No document types have been created yet.",
      sortable: true,
      columns: [
        { label: "Document Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "File Types", render: (r) => str(r.fileTypes) },
      ],
    },
    form: { createTitle: "Add Document Type", editTitle: named("Edit Document Type"), saveLabel: "Save Document Type" },
  },
  "flag-templates": {
    entity: "flagTemplates",
    title: "Flag & Hold Templates",
    dir: {
      noun: "template",
      createLabel: "Create Template",
      empty: "No flag or hold templates have been created yet.",
      filter: { placeholder: "Enter Template Name", label: "Template Name", keys: ["name", "code"], submitLabel: "Search Templates" },
      selects: [
        { key: "campus", label: "Filter Campus", all: "All Campuses", options: (_r, m) => m?.lists.campuses ?? [], match: (r, v) => r.campus === "All Campuses" || r.campus === v },
        { key: "type", label: "Flag / Hold Type", all: "All Types", options: () => ["General", "Financial", "Academic", "Attendance", "Immigration"], match: (r, v) => r.flagType === v },
      ],
      columns: [
        nameCol,
        { label: "Type", render: (r) => str(r.flagType) },
        { label: "Applies Hold", render: (r) => (r.applyHold === "Yes" ? badge("Yes", "amber") : "No") },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ],
    },
    form: { createTitle: "Create Flag & Hold Template", editTitle: named("Edit Flag & Hold Template"), saveLabel: "Save Flag & Hold Template" },
  },
  "user-agreements": {
    entity: "userAgreements",
    title: "User Agreements",
    dir: {
      noun: "user agreement",
      createLabel: "Create User Agreement",
      empty: "No user agreements have been created yet.",
      filter: { placeholder: "Enter Agreement Name", keys: ["name"] },
      columns: [
        { label: "Agreement Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Campus(es)", render: (r) => (r.applyCampuses === "Customize" ? listOr(r.campuses, "—") : "All Campuses") },
        { label: "Language", render: (r) => str(r.language) },
      ],
    },
    form: { createTitle: "Create User Agreement", editTitle: named("Edit User Agreement"), saveLabel: "Save User Agreement" },
  },
  "agent-statuses": {
    entity: "agentStatuses",
    title: "Agent Statuses",
    dir: {
      noun: "agent status",
      createLabel: "Add Agent Status",
      empty: "No agent statuses have been created yet.",
      sortable: true,
      columns: [
        {
          label: "Status Name",
          render: (r) => (
            <span className="sx-named">
              <Swatch colour={str(r.colour)} /> <strong>{str(r.name)}</strong> {r.defaultStatus === "Yes" ? badge("Default", "blue") : null}
            </span>
          ),
        },
        { label: "Status Type", render: (r) => str(r.statusType) },
        { label: "Create User Login", render: (r) => yesNo(r.createLogin) },
      ],
    },
    form: { createTitle: "Add Agent Status", editTitle: named("Edit Agent Status"), saveLabel: "Save Agent Status" },
  },
  "student-statuses": {
    entity: "studentStatuses",
    title: "Student Statuses",
    dir: { noun: "student status", createLabel: "Add Student Status", empty: "No student statuses have been created yet.", columns: [] },
    form: { createTitle: "Add Student Status", editTitle: named("Edit Student Status"), saveLabel: "Save Student Status" },
  },
  "notification-templates": {
    entity: "notificationTemplates",
    title: "Notification Templates",
    dir: {
      noun: "notification template",
      createLabel: "Create Notification Template",
      empty: "No notification templates have been created yet.",
      filter: { placeholder: "Enter Template Name", keys: ["name", "subject", "event"] },
      columns: [
        { label: "Template Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Send When", render: (r) => str(r.event) },
        { label: "Channel", render: (r) => str(r.channel) },
        { label: "Language", render: (r) => str(r.language) },
        { label: "Status", render: (r) => statusBadge(r.status) },
      ],
    },
    form: { createTitle: "Create Notification Template", editTitle: named("Edit Notification Template"), saveLabel: "Save Notification Template" },
  },
  forms: {
    entity: "forms",
    title: "Form Management",
    dir: {
      noun: "form",
      createLabel: "Add Form",
      empty: "No forms have been created yet.",
      filter: { placeholder: "Enter Form Name", keys: ["name", "formType"] },
      columns: [
        { label: "Form Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Form Type", render: (r) => str(r.formType) },
        { label: "Visibility", render: (r) => (r.visibility === "Public" ? badge("Public", "green") : "Private") },
        { label: "Fields", render: (r) => count(r.fields) },
      ],
      rowActions: (r) => (r.visibility === "Public" ? <EmbedButton row={r} /> : null),
    },
    form: { createTitle: "Add Form", editTitle: named("Edit Form"), saveLabel: "Save Form" },
  },
  "reason-codes": {
    entity: "reasonCodes",
    title: "Reason Codes",
    dir: {
      noun: "reason code",
      createLabel: "Create Reason Code",
      empty: "No reason codes have been created yet.",
      emptyCta: true,
      filter: { placeholder: "Enter Reason Name or Code", keys: ["name", "code"] },
      columns: [
        { label: "Reason Name", render: (r) => <strong>{str(r.name)}</strong> },
        { label: "Reason Code", render: (r) => <code>{str(r.code)}</code> },
        { label: "Reason Type", render: (r) => str(r.type) },
        { label: "Status", render: (r) => statusBadge(r.active) },
      ],
    },
    form: { createTitle: "Create Reason Code", editTitle: named("Edit Reason Code"), saveLabel: "Save Reason Code" },
  },
  holidays: {
    entity: "holidays",
    title: "Holidays & Closures",
    dir: {
      noun: "holiday / closure",
      createLabel: "Add Holiday / Closure",
      empty: "No holidays or closures in this period.",
      filter: { placeholder: "Enter Holiday / Closure Name", keys: ["name"] },
      selects: [
        {
          key: "year",
          label: "Filter Year",
          all: "All Years",
          initial: "This Year",
          options: (rows) => ["This Year", ...[...new Set(rows.map((r) => str(r.date).slice(0, 4)).filter(Boolean))].sort().reverse()],
          match: (r, v) => str(r.date).startsWith(v === "This Year" ? String(new Date().getFullYear()) : v) || (v === "This Year" && str(r.endDate).startsWith(String(new Date().getFullYear()))),
        },
      ],
      columns: [
        nameCol,
        {
          label: "Dates",
          render: (r) => {
            const d = (x: unknown) => new Date(`${str(x)}T12:00:00`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
            return r.singleDay || !r.endDate ? d(r.date) : `${d(r.date)} – ${d(r.endDate)}`;
          },
        },
        { label: "Type", render: (r) => `${str(r.type)}${r.scope === "Provincial" ? ` · ${str(r.province)}` : ""}` },
      ],
    },
    form: { createTitle: "Add Holiday / Closure", editTitle: named("Edit Holiday / Closure"), saveLabel: "Save Holiday / Closure" },
  },
};

function EmbedButton({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const snippet = `<div data-myheritage-form="${row.id}"></div>\n<script async src="https://myhccbc.com/forms/embed.js"></script>`;
  return (
    <>
      <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setOpen(true)}>
        Embed
      </button>
      {open ? (
        <SaModal
          title={`Embed Form: ${str(row.name)}`}
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => void navigator.clipboard?.writeText(snippet)}>
                Copy Code
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setOpen(false)}>
                Done
              </button>
            </>
          }
        >
          <p>Paste this code into a page of your public website to show the form. Submissions are created as {str(row.formType).toLowerCase()} records.</p>
          <textarea className="mh-sa__input sx-code" readOnly rows={3} value={snippet} aria-label="Embed code" />
          <p className="lx-hint">The embed script is served once the public forms domain is configured for this institution.</p>
          <h3 className="sx-subhead">Preview</h3>
          <div className="sx-embed-preview">
            <strong>{str(row.name)}</strong>
            {(Array.isArray(row.fields) ? (row.fields as Row[]) : []).length ? (
              (row.fields as Row[]).map((f) => (
                <label key={str(f.id)} className="mh-sa__field">
                  <span className="mh-sa__label">
                    {str(f.label)}
                    {f.required === "Yes" ? <span className="lx-req">*</span> : null}
                  </span>
                  <input className="mh-sa__input" disabled placeholder={str(f.type)} />
                </label>
              ))
            ) : (
              <p className="mh-sa__muted">This form has no custom fields yet — add them under Edit → Form Fields.</p>
            )}
          </div>
        </SaModal>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Generic pages                                                        */
/* ------------------------------------------------------------------ */

function useScreen() {
  const params = useParams<{ slug: string }>();
  const slug = str(params?.slug);
  return { slug, def: SCREENS[slug] };
}

function Unknown() {
  return (
    <SuperFrame title="Not found" breadcrumbs={["Home", SC]} activeHref={BASE}>
      <section className="mh-sa__card">
        <p>This System Configuration page does not exist.</p>
        <Link className="mh-sa__btn" href="/admin">
          Back to dashboard
        </Link>
      </section>
    </SuperFrame>
  );
}

export function GenericList() {
  const { slug, def } = useScreen();
  if (!def) return <Unknown />;
  if (slug === "student-statuses") return <StudentStatuses />;
  return <Directory entity={def.entity} title={def.title} activeHref={`${BASE}/${slug}`} {...def.dir} />;
}

export function GenericForm({ mode }: { mode: "create" | "edit" }) {
  const { slug, def } = useScreen();
  if (!def?.form) return <Unknown />;
  return (
    <EntityFormPage
      entity={def.entity}
      mode={mode}
      base={`${BASE}/${slug}`}
      crumb={def.title}
      createTitle={def.form.createTitle}
      editTitle={def.form.editTitle}
      saveLabel={def.form.saveLabel}
    >
      {def.form.body}
    </EntityFormPage>
  );
}


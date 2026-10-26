"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { sanitizeDashboardHtml } from "@/lib/dashboard";
import { ConfirmDelete } from "../location/shared";
import { Directory, EntityFormPage, SC, SettingsBody, type Ctx } from "./directory";
import { SysIcon, SysSections, errMsg, fmtDate, invalidateMeta, str, sx, useCanEdit, useFlash, type Listing, type Row, type SysForm } from "./kit";

const DT = "/admin/sysconfig/document-templates";

/* ------------------------------------------------------------------ */
/* Document Templates                                                   */
/* ------------------------------------------------------------------ */

type PopupKind = "modules" | "inputs" | "fonts" | "elements";
const POPUPS: Record<PopupKind, { title: string; render: () => React.ReactNode }> = {
  modules: {
    title: "Template Modules",
    render: () => (
      <Directory
        embedded
        initialNotice={null}
        entity="templateModules"
        activeHref={DT}
        noun="module"
        createLabel="New Module"
        createMode="modal"
        modalTitle={(r) => (r ? `Edit Template Module: ${str(r.name)}` : "New Template Module")}
        saveLabel="Save Module"
        empty="No template modules have been created yet."
        columns={[
          { label: "Module Name", render: (r) => <strong>{str(r.name)}</strong> },
          {
            label: "Conditions",
            render: (r) => {
              const n = Array.isArray(r.conditions) ? r.conditions.length : 0;
              return `${n} condition${n === 1 ? "" : "s"}`;
            },
          },
          { label: "Placeholder", render: (r) => <code>{`[[Module: ${str(r.name)}]]`}</code> },
        ]}
      />
    ),
  },
  inputs: {
    title: "Template Inputs",
    render: () => (
      <Directory
        embedded
        initialNotice={null}
        entity="documentInputs"
        activeHref={DT}
        noun="input"
        createLabel="Add Input"
        createMode="modal"
        modalTitle={(r) => (r ? `Edit Input: ${str(r.label)}` : "Add Input")}
        saveLabel="Save Input"
        empty="No inputs have been created yet."
        columns={[
          { label: "Label / Name", render: (r) => <span><strong>{str(r.label)}</strong> <code>{`{input:${str(r.name)}}`}</code></span> },
          { label: "Type", render: (r) => str(r.type) },
          { label: "Default", render: (r) => str(r.default) || <span className="mh-sa__muted">—</span> },
          { label: "Auto-Save", render: (r) => str(r.autoSave) },
        ]}
      />
    ),
  },
  fonts: {
    title: "Template Fonts",
    render: () => (
      <Directory
        embedded
        initialNotice={null}
        entity="documentFonts"
        activeHref={DT}
        noun="font"
        createLabel="Add Font"
        createMode="modal"
        modalTitle={(r) => (r ? `Edit Font: ${str(r.name)}` : "Add Font")}
        saveLabel="Save Font"
        canDelete={() => false}
        empty="No fonts have been added yet."
        columns={[
          { label: "Font Name", render: (r) => <span style={{ fontFamily: str(r.name) }}>{str(r.name)}</span> },
          { label: "Embedded", render: (r) => str(r.embedded) },
        ]}
      />
    ),
  },
  elements: {
    title: "Running Elements",
    render: () => (
      <Directory
        embedded
        initialNotice={null}
        entity="runningElements"
        activeHref={DT}
        noun="running element"
        createLabel="Add Running Element"
        createMode="modal"
        modalTitle={(r) => (r ? `Edit Running Element: ${str(r.name)}` : "Add Running Element")}
        saveLabel="Save Running Element"
        empty="No headers or footers have been created yet."
        columns={[
          { label: "Element Name", render: (r) => <strong>{str(r.name)}</strong> },
          { label: "Type", render: (r) => str(r.type) },
        ]}
      />
    ),
  },
};

function Popup({ kind, onClose }: { kind: PopupKind; onClose: () => void }) {
  const p = POPUPS[kind];
  return (
    <SaModal
      title={p.title}
      wide
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn" onClick={onClose}>
          Close
        </button>
      }
    >
      {p.render()}
    </SaModal>
  );
}

export function DocumentTemplates() {
  const router = useRouter();
  const sp = useSearchParams();
  const initial = sp?.get("popup") as PopupKind | null;
  const [popup, setPopup] = useState<PopupKind | null>(initial && initial in POPUPS ? initial : null);
  const copy = (r: Row, ctx: Ctx) =>
    sx<{ id: string; message: string }>(`/document-templates/${r.id}/copy`, { method: "POST" })
      .then((out) => {
        ctx.ok(out.message);
        invalidateMeta();
        ctx.reload();
      })
      .catch((e) => ctx.fail(errMsg(e, "Copy failed")));
  return (
    <>
      <Directory
        entity="documentTemplates"
        title="Document Templates"
        activeHref={DT}
        noun="document template"
        createLabel="Create Template"
        empty="No document templates have been created yet."
        filter={{ placeholder: "Enter Template Name", keys: ["name"] }}
        headerActions={() => (
          <>
            <button type="button" className="mh-sa__btn" onClick={() => setPopup("modules")}>
              Modules
            </button>
            <button type="button" className="mh-sa__btn" onClick={() => setPopup("inputs")}>
              Inputs
            </button>
            <button type="button" className="mh-sa__btn" onClick={() => setPopup("fonts")}>
              Fonts
            </button>
            <button type="button" className="mh-sa__btn" onClick={() => setPopup("elements")}>
              Running Elements
            </button>
          </>
        )}
        columns={[
          { label: "Document Template Name", render: (r) => <strong>{str(r.name)}</strong> },
          { label: "Language", render: (r) => str(r.language) },
        ]}
        rowActions={(r, ctx) =>
          ctx.canEdit ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => void copy(r, ctx)}>
              Copy
            </button>
          ) : null
        }
        trailingActions={(r) =>
          Number(r._versions) > 1 ? (
            <Link className="mh-sa__btn mh-sa__btn--sm" href={`${DT}/audit?id=${r.id}`}>
              Audit
            </Link>
          ) : null
        }
      />
      {popup ? (
        <Popup
          kind={popup}
          onClose={() => {
            setPopup(null);
            if (sp?.get("popup")) router.replace(DT, { scroll: false });
          }}
        />
      ) : null}
    </>
  );
}

function Placeholders() {
  const [mods, setMods] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Row[]>([]);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    void sx<Listing>("/e/templateModules").then((r) => setMods(r.items)).catch(() => setMods([]));
    void sx<Listing>("/e/documentInputs").then((r) => setInputs(r.items)).catch(() => setInputs([]));
  }, []);
  const token = (t: string) => (
    <button
      key={t}
      type="button"
      className={`sx-token${copied === t ? " is-copied" : ""}`}
      title="Copy placeholder"
      onClick={() => {
        void navigator.clipboard?.writeText(t);
        setCopied(t);
        setTimeout(() => setCopied(""), 1200);
      }}
    >
      {t}
    </button>
  );
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>Available Placeholders</h2>
      </div>
      <p className="lx-hint">Click a placeholder to copy it, then paste it into the template content.</p>
      <div className="sx-tokens">
        {["{student.first_name}", "{student.last_name}", "{student.number}", "{student.program}", "{student.address}", "{date}"].map(token)}
      </div>
      {mods.length ? <div className="sx-tokens">{mods.map((m) => token(`[[Module: ${str(m.name)}]]`))}</div> : null}
      {inputs.length ? <div className="sx-tokens">{inputs.map((i) => token(`{input:${str(i.name)}}`))}</div> : null}
    </section>
  );
}

const DETAIL_KEYS = ["name", "language", "documentType", "defaultType", "correspondenceCategory", "correspondenceType", "content"];

export function DocumentTemplateForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <EntityFormPage
      entity="documentTemplates"
      mode={mode}
      base={DT}
      crumb="Document Templates"
      createTitle="Create Document Template"
      editTitle={(r) => `Edit Document Template${r?.name ? `: ${str(r.name)}` : ""}`}
      saveLabel="Save Document Template"
    >
      {(form: SysForm) => (
        <>
          <SysSections form={form} only={DETAIL_KEYS} />
          <Placeholders />
          <SysSections form={form} skip={DETAIL_KEYS} />
        </>
      )}
    </EntityFormPage>
  );
}

/* ------------------------------------------------------------------ */
/* Audit history                                                        */
/* ------------------------------------------------------------------ */

type Version = { id: string; date: string; by: string; changes: string[]; current: boolean };
type VersionDetail = { id: string; date: string; by: string; name: string; content: string; snapshot: Row; labels?: Record<string, string>; currentLabels?: Record<string, string> };

export function TemplateAudit() {
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const flash = useFlash(null);
  const { ok, fail } = flash;
  const [data, setData] = useState<{ template: { id: string; name: string }; items: Version[] } | null>(null);
  const [templates, setTemplates] = useState<Row[] | null>(null);
  const [view, setView] = useState<{ mode: "review" | "history"; v: VersionDetail } | null>(null);
  const [current, setCurrent] = useState<Row | null>(null);
  const [restore, setRestore] = useState<Version | null>(null);
  const writable = useCanEdit("documentTemplates");
  const load = useCallback(() => {
    if (!id) {
      void sx<Listing>("/e/documentTemplates").then((r) => setTemplates(r.items)).catch((e) => fail(errMsg(e, "Could not load templates")));
      return;
    }
    void sx<{ template: { id: string; name: string }; items: Version[] }>(`/document-templates/${id}/history`).then(setData).catch((e) => fail(errMsg(e, "Could not load the audit history")));
    void sx<Row>(`/e/documentTemplates/${id}`).then(setCurrent).catch(() => setCurrent(null));
  }, [id, fail]);
  useEffect(load, [load]);

  const open = (v: Version, mode: "review" | "history") =>
    sx<VersionDetail>(`/document-templates/${id}/history/${v.id}`)
      .then((d) => setView({ mode, v: d }))
      .catch((e) => fail(errMsg(e, "Could not load this version")));

  const title = data ? `Audit History: ${data.template.name}` : "Audit History";
  return (
    <SuperFrame
      title={title}
      breadcrumbs={["Home", SC, "Document Templates", "Audit History"]}
      breadcrumbHrefs={[null, null, DT]}
      activeHref={DT}
      actions={
        <Link className="mh-sa__btn" href={DT}>
          Back to Document Templates
        </Link>
      }
    >
      <div className="lx sx">
        {flash.node}
        <section className="mh-sa__card">
          {!id ? (
            !templates ? (
              <p className="mh-sa__muted">Loading…</p>
            ) : (
              <>
                <p>Choose a template to see its revision history.</p>
                <ul className="sx-linklist">
                  {templates.map((t) => (
                    <li key={t.id}>
                      <Link href={`${DT}/audit?id=${t.id}`}>{str(t.name)}</Link> <span className="mh-sa__muted">· {Number(t._versions) || 0} revision(s)</span>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : !data ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table lx-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Changed By</th>
                    <th>Changes Made</th>
                    <th className="lx-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((v) => (
                    <tr key={v.id}>
                      <td>
                        {fmtDate(v.date)} {v.current ? <span className="sx-badge sx-badge--green">Current</span> : null}
                      </td>
                      <td>{v.by}</td>
                      <td>{v.changes.join("; ")}</td>
                      <td className="lx-actions">
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => void open(v, "review")}>
                          Review
                        </button>
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => void open(v, "history")}>
                          History
                        </button>
                        {!v.current && writable ? (
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" onClick={() => setRestore(v)}>
                            Restore
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!data.items.length ? (
                    <tr>
                      <td colSpan={4} className="mh-sa__empty-cell">
                        No revisions have been recorded for this template yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      {view ? (
        <SaModal
          title={`${view.mode === "review" ? "Review" : "History"}: ${view.v.name} — ${fmtDate(view.v.date)}`}
          wide
          onClose={() => setView(null)}
          footer={
            <button type="button" className="mh-sa__btn" onClick={() => setView(null)}>
              Close
            </button>
          }
        >
          {view.mode === "review" ? (
            <div className="sx-doc-preview" dangerouslySetInnerHTML={{ __html: sanitizeDashboardHtml(view.v.content) || "<p><em>No content</em></p>" }} />
          ) : (
            <VersionDiff snapshot={view.v.snapshot} current={current} labels={view.v.labels ?? {}} currentLabels={view.v.currentLabels ?? {}} />
          )}
        </SaModal>
      ) : null}
      {restore ? (
        <ConfirmDelete
          title="Restore version"
          body={`Replace the current template with the version saved ${fmtDate(restore.date)} by ${restore.by}? The current version stays in the history.`}
          okLabel="Restore"
          onCancel={() => setRestore(null)}
          onOk={() => {
            const v = restore;
            setRestore(null);
            sx<{ message: string }>(`/document-templates/${id}/restore/${v.id}`, { method: "POST" })
              .then((out) => {
                ok(out.message);
                load();
              })
              .catch((e) => fail(errMsg(e, "Restore failed")));
          }}
        />
      ) : null}
    </SuperFrame>
  );
}

const DIFF_LABELS: Record<string, string> = {
  name: "Template Name",
  language: "Language",
  documentType: "Document Type",
  defaultType: "Default Document Type",
  correspondenceCategory: "Correspondence Category",
  correspondenceType: "Correspondence Type",
  header: "Header",
  headerElement: "Header Element",
  footer: "Footer",
  footerElement: "Footer Element",
  pageSize: "Page Size",
  orientation: "Page Orientation",
  marginTop: "Top Margin",
  marginRight: "Right Margin",
  marginBottom: "Bottom Margin",
  marginLeft: "Left Margin",
  watermark: "Watermark",
  naming: "Customize Naming",
  accessLevels: "Access Levels",
  secure: "Secure / Encrypt",
  content: "Content",
};

function VersionDiff({ snapshot, current, labels, currentLabels }: { snapshot: Row; current: Row | null; labels: Record<string, string>; currentLabels: Record<string, string> }) {
  const plain = (v: unknown) => (typeof v === "string" ? v.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : v === true ? "Yes" : v === false ? "No" : str(v));
  const rows = Object.entries(DIFF_LABELS).map(([k, label]) => ({ k, label, then: labels[k] ?? plain(snapshot[k]), now: currentLabels[k] ?? plain(current?.[k]) }));
  return (
    <div className="mh-sa__table-wrap">
      <table className="mh-sa__table lx-table">
        <thead>
          <tr>
            <th>Setting</th>
            <th>This Version</th>
            <th>Current</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className={r.then !== r.now ? "sx-diff" : undefined}>
              <td>{r.label}</td>
              <td>{r.then.length > 160 ? `${r.then.slice(0, 160)}…` : r.then || "—"}</td>
              <td>{r.now.length > 160 ? `${r.now.slice(0, 160)}…` : r.now || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lx-hint">Highlighted rows differ from the current template.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Correspondence Types                                                 */
/* ------------------------------------------------------------------ */

const CORR = "/admin/sysconfig/correspondence";

export function Correspondence() {
  const router = useRouter();
  const sp = useSearchParams();
  const flash = useFlash(sp?.get("notice"));
  const { ok, fail } = flash;
  const [cats, setCats] = useState<Row[] | null>(null);
  const [types, setTypes] = useState<Row[]>([]);
  const [confirm, setConfirm] = useState<{ entity: "correspondenceCategories" | "correspondenceTypes"; row: Row } | null>(null);
  const writable = useCanEdit("correspondenceTypes");
  const load = useCallback(() => {
    void sx<Listing>("/e/correspondenceCategories")
      .then((c) => setCats(c.items))
      .catch((e) => { setCats([]); fail(errMsg(e, "Could not load correspondence categories")); });
    void sx<Listing>("/e/correspondenceTypes")
      .then((t) => setTypes(t.items))
      .catch((e) => { setTypes([]); fail(errMsg(e, "Could not load correspondence types")); });
  }, [fail]);
  useEffect(load, [load]);
  const groups = useMemo(() => {
    const out = (cats ?? []).map((c) => ({ cat: c as Row | null, title: str(c.name), rows: types.filter((t) => Array.isArray(t.categories) && t.categories.includes(c.id)) }));
    out.push({ cat: null, title: "Miscellaneous", rows: types.filter((t) => !Array.isArray(t.categories) || !t.categories.length) });
    return out;
  }, [cats, types]);
  const typeRow = (t: Row, key: string) => (
    <tr key={key}>
      <td>{str(t.name)}</td>
      <td className="lx-actions">
        {writable ? (
          <>
            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${CORR}/types/edit?id=${t.id}`)}>
              Edit
            </button>
            <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ entity: "correspondenceTypes", row: t })}>
              Delete
            </button>
          </>
        ) : null}
      </td>
    </tr>
  );
  return (
    <SuperFrame
      title="Correspondence Types"
      breadcrumbs={["Home", SC, "Correspondence Types"]}
      activeHref={CORR}
      actions={
        writable ? (
          <>
            <Link className="mh-sa__btn" href={`${CORR}/categories/new`}>
              Create Category
            </Link>
            <Link className="mh-sa__btn mh-sa__btn--primary" href={`${CORR}/types/new`}>
              Create Correspondence Type
            </Link>
          </>
        ) : null
      }
    >
      <div className="lx sx">
        {flash.node}
        {!cats ? (
          <section className="mh-sa__card">
            <p className="mh-sa__muted">Loading…</p>
          </section>
        ) : (
          groups.map((g) => (
            <section key={g.cat?.id ?? "misc"} className="mh-sa__card sx-group">
              <div className="sx-group__head">
                <h3>
                  {g.title}
                  {g.cat?.abbreviation ? <span className="mh-sa__muted"> ({str(g.cat.abbreviation)})</span> : null}
                  {g.cat?.status === "Inactive" ? <span className="sx-badge sx-badge--grey">Inactive</span> : null}
                </h3>
                {g.cat && writable ? (
                  <span className="lx-actions">
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`${CORR}/categories/edit?id=${g.cat!.id}`)}>
                      Edit
                    </button>
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ entity: "correspondenceCategories", row: g.cat! })}>
                      Delete
                    </button>
                  </span>
                ) : null}
              </div>
              <table className="mh-sa__table lx-table">
                <tbody>
                  {g.rows.map((t) => typeRow(t, `${g.cat?.id ?? "misc"}-${t.id}`))}
                  {!g.rows.length ? (
                    <tr>
                      <td colSpan={2} className="mh-sa__empty-cell">
                        No correspondence types in this category.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          ))
        )}
        <p className="lx-hint">Types not linked to any category are listed under Miscellaneous.</p>
      </div>
      {confirm ? (
        <ConfirmDelete
          title={confirm.entity === "correspondenceCategories" ? "Delete correspondence category" : "Delete correspondence type"}
          body={
            confirm.entity === "correspondenceCategories"
              ? `Delete the category "${str(confirm.row.name)}"? Its correspondence types are kept and unlinked from it.`
              : `Delete the correspondence type "${str(confirm.row.name)}"?`
          }
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const c = confirm;
            setConfirm(null);
            sx<{ message: string }>(`/e/${c.entity}/${c.row.id}`, { method: "DELETE" })
              .then((out) => {
                ok(out.message);
                load();
              })
              .catch((e) => fail(errMsg(e, "Delete failed")));
          }}
        />
      ) : null}
    </SuperFrame>
  );
}

export function CorrespondenceCategoryForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <EntityFormPage
      entity="correspondenceCategories"
      mode={mode}
      base={CORR}
      crumb="Correspondence Types"
      createTitle="Create Correspondence Category"
      editTitle={(r) => `Edit Correspondence Category${r?.name ? `: ${str(r.name)}` : ""}`}
      saveLabel="Save Correspondence Category"
    />
  );
}

export function CorrespondenceTypeForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <EntityFormPage
      entity="correspondenceTypes"
      mode={mode}
      base={CORR}
      crumb="Correspondence Types"
      createTitle="Create Correspondence Type"
      editTitle={(r) => `Edit Correspondence Type${r?.name ? `: ${str(r.name)}` : ""}`}
      saveLabel="Save Correspondence Type"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Manage Sections / Intranets                                          */
/* ------------------------------------------------------------------ */

const SEC = "/admin/sysconfig/sections";

export function Sections() {
  return (
    <Directory
      entity="sections"
      title="Manage Sections / Intranets"
      activeHref={SEC}
      noun="section / intranet"
      createLabel="Create Section / Intranet"
      empty="No sections or intranets have been created yet."
      sortable
      headerActions={() => (
        <>
          <Link className="mh-sa__btn" href={`${SEC}/dashboard`}>
            Dashboard Settings
          </Link>
          <Link className="mh-sa__btn" href={`${SEC}/login-page`}>
            Login Page
          </Link>
          <Link className="mh-sa__btn" href={`${SEC}/site-template`}>
            Site Template / Header
          </Link>
        </>
      )}
      columns={[
        {
          label: "Section / Intranet",
          render: (r) => (
            <span className="sx-named">
              <SysIcon name={r.functionType === "Defined System Function" ? "settings" : str(r.icon)} size={16} /> <strong>{str(r.name)}</strong>
            </span>
          ),
        },
        { label: "Function Type", render: (r) => str(r.functionType) },
        { label: "Access", render: (r) => (r.functionType === "Defined System Function" ? "System defaults" : str(r.defaultAccess)) },
      ]}
    />
  );
}

export function SectionForm({ mode }: { mode: "create" | "edit" }) {
  return (
    <EntityFormPage
      entity="sections"
      mode={mode}
      base={SEC}
      crumb="Manage Sections / Intranets"
      createTitle="Create Section / Intranet"
      editTitle={(r) => `Edit Section / Intranet${r?.name ? `: ${str(r.name)}` : ""}`}
      saveLabel="Save Section / Intranet"
    />
  );
}

function SettingsPage({ title, settingsKey, children }: { title: string; settingsKey: string; children?: Parameters<typeof SettingsBody>[0]["children"] }) {
  return (
    <SuperFrame
      title={title}
      breadcrumbs={["Home", SC, "Manage Sections / Intranets", title]}
      breadcrumbHrefs={[null, null, SEC]}
      activeHref={SEC}
      actions={
        <Link className="mh-sa__btn" href={SEC}>
          Back to Sections
        </Link>
      }
    >
      <SettingsBody settingsKey={settingsKey}>{children}</SettingsBody>
    </SuperFrame>
  );
}

export function DashboardSettings() {
  return <SettingsPage title="Dashboard Settings" settingsKey="dashboard" />;
}

export function LoginPageSettings() {
  return (
    <SettingsPage title="Login Page Settings" settingsKey="loginPage">
      {(form) => (
        <>
          <SysSections form={form} />
          <section className="mh-sa__card">
            <div className="mh-sa__card-head">
              <h2>Preview</h2>
            </div>
            <div className="sx-login-preview" style={{ background: str(form.values?.background) || "#1f3a5f" }}>
              <span className="sx-login-preview__tag">{str(form.values?.backgroundImagery) === "None" ? "No background imagery" : `${str(form.values?.backgroundImagery)} imagery`}</span>
              <div className="sx-login-preview__box">
                <strong>CampusOne Login</strong>
                <span className="sx-login-preview__field" />
                <span className="sx-login-preview__field" />
                <span className="sx-login-preview__btn">Sign In</span>
              </div>
              <span className="sx-login-preview__tag">{str(form.values?.actionImagery) === "None" ? "No action imagery" : str(form.values?.actionImagery)}</span>
            </div>
          </section>
        </>
      )}
    </SettingsPage>
  );
}

export function SiteTemplateSettings() {
  return <SettingsPage title="Site Template / Header Settings" settingsKey="siteTemplate" />;
}

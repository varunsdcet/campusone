"use client";

import "../superadmin/superadmin.css";
import "./heritage.css";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminSisShell } from "@/components/AdminSisShell";
import { RichTextEditor, SaField, SaModal, SaNotice, useAdminSession } from "@/components/superadmin/shared";
import { ApiError, api, loadSession } from "@/lib/api";
import { actionTarget, flowGroupFor, heritageHref } from "@/lib/heritageNav";

/* ------------------------------------------------------------------ */
/* Types mirrored from GET /admin/heritage/screens/:id                  */
/* ------------------------------------------------------------------ */

type Kind =
  | "text"
  | "textarea"
  | "number"
  | "money"
  | "percent"
  | "date"
  | "datetime"
  | "time"
  | "daterange"
  | "email"
  | "tel"
  | "url"
  | "password"
  | "select"
  | "multiselect"
  | "ref"
  | "checkbox"
  | "file"
  | "color"
  | "display"
  | "feature";
type FieldDef = { id: string; key: string; label: string; rawLabel: string; kind: Kind; required: boolean; options?: string[]; ref?: string; feature?: string; partial: boolean };
type ActionDef = { id: string; label: string; kind: string; row: boolean; status?: string };
type ColumnDef = { id: string; key: string; label: string; feature?: string };
type Schema = {
  id: string;
  module: string;
  name: string;
  screenType: string;
  status: string;
  partial: boolean;
  flow: string[];
  condition: string;
  evidence: string;
  openPoint: { gap: string; confirmation: string; status: string } | null;
  mode: "directory" | "form" | "settings" | "error" | "nav" | "gate";
  context: string | null;
  fields: FieldDef[];
  filters: FieldDef[];
  columns: ColumnDef[];
  actions: ActionDef[];
  submitLabel: string;
  dataPointCount: number;
};
type Data = Record<string, unknown>;
type Row = { id: string; origin: "record" | "domain"; status: string; data: Data; link?: { screen: string; ctx: string }; contextKey?: string; updatedAt?: string };
type View = {
  schema: Schema;
  store: string;
  dedicated: string | null;
  writeThrough: boolean;
  source: string | null;
  context: { type: string; key: string; id: string | null; label: string | null } | null;
  columns: Array<{ key: string; label: string }>;
  rows: Row[];
  total: number;
  unfilteredTotal: number;
  page: number;
  perPage: number;
  singleton: { id: string; data: Data; updatedAt: string } | null;
  summary: Data | null;
  auditCount: number;
  canEdit: boolean;
};
type AuditItem = { id: string; action: string; actor: string; at: string; note: string | null; before: Data | null; after: Data | null };
type FileValue = { name: string; size: number; type: string; dataUrl: string };

const token = () => loadSession()?.accessToken;
const hx = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage${path}`, init ?? {}, token());
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);

let refsCache: Promise<Record<string, string[]>> | null = null;
function loadRefs(force = false) {
  if (!refsCache || force) refsCache = hx<Record<string, string[]>>("/refs").catch(() => ({}));
  return refsCache;
}

const REF_SOURCE_SCREENS = new Set(["L01", "L08", "L09", "L10", "L12", "L13", "F07", "F13", "F14", "F15", "F17", "F18", "F20", "PR01", "PR04", "PR13", "C19", "C20", "C21", "C24", "C25", "C26", "SC03", "SC09", "SC10", "SC19", "SC31", "SC33", "SC34"]);

function display(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return String((v as Data).name ?? "");
  return String(v);
}

function pretty(key: string) {
  return key.replace(/^f_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Page wrapper                                                         */
/* ------------------------------------------------------------------ */

export function HeritageScreenPage({ screenId }: { screenId: string }) {
  const session = useAdminSession();
  const pathname = usePathname() ?? "";
  const sp = useSearchParams();
  const [crumbs, setCrumbs] = useState<string[]>(["Home", "CampusOne SIS", screenId.toUpperCase()]);
  if (!session) return null;
  return (
    <AdminSisShell activeHref={pathname} activeSearch={sp?.toString() ?? ""} breadcrumbs={crumbs} userName={`${session.givenName} ${session.familyName}`}>
      <HeritageScreen screenId={screenId.toUpperCase()} onCrumbs={setCrumbs} />
    </AdminSisShell>
  );
}

/* ------------------------------------------------------------------ */
/* Screen engine                                                        */
/* ------------------------------------------------------------------ */

function HeritageScreen({ screenId, onCrumbs }: { screenId: string; onCrumbs: (c: string[]) => void }) {
  const router = useRouter();
  const sp = useSearchParams();
  const spKey = sp?.toString() ?? "";
  const ctx = sp?.get("ctx") ?? "";
  const urlFilters = useMemo(() => {
    const out: Record<string, string> = {};
    new URLSearchParams(spKey).forEach((v, k) => {
      if (k.startsWith("f.")) out[k.slice(2)] = v;
    });
    return out;
  }, [spKey]);

  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refs, setRefs] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<Record<string, string>>(urlFilters);
  const [applied, setApplied] = useState<Record<string, string>>(urlFilters);
  const [q, setQ] = useState("");
  const [letter, setLetter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<{ mode: "create" | "edit"; recordId?: string; data: Data } | null>(null);
  const [inline, setInline] = useState<Data>({});
  const [detail, setDetail] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; body: string; okLabel: string; cancelLabel: string; onOk: () => Promise<void> } | null>(null);
  const [bulk, setBulk] = useState<ActionDef | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setDraft(urlFilters);
    setApplied(urlFilters);
    setPage(1);
    setLetter("");
    setSelected(new Set());
  }, [urlFilters]);

  useEffect(() => {
    void loadRefs().then(setRefs);
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (ctx) params.set("ctx", ctx);
    if (q.trim()) params.set("q", q.trim());
    if (letter) params.set("letter", letter);
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    for (const [k, v] of Object.entries(applied)) if (v) params.set(`f.${k}`, v);
    try {
      const v = await hx<View>(`/screens/${screenId}?${params.toString()}`);
      setView(v);
      setLoadError(null);
      onCrumbs(["Home", "CampusOne SIS", v.schema.module, v.schema.name]);
    } catch (e) {
      setLoadError(errMsg(e, "Could not load screen"));
    }
  }, [screenId, ctx, q, letter, page, perPage, applied, onCrumbs]);

  useEffect(() => {
    void load();
  }, [load]);

  const schema = view?.schema;

  useEffect(() => {
    if (!view) return;
    if (view.schema.mode === "settings" || view.schema.id === "S03") setInline({ ...(view.singleton?.data ?? {}) });
  }, [view]);

  const flash = (tone: "success" | "error", text: string) => setNotice({ tone, text });

  const go = useCallback(
    (target: string, ctxKey?: string) => {
      const group = flowGroupFor(target);
      const keep = ctxKey ?? (group?.context && ctx.startsWith(`${group.context}:`) ? ctx : "");
      router.push(heritageHref(target, keep ? { ctx: keep } : undefined));
    },
    [router, ctx],
  );

  async function afterWrite(message: string) {
    flash("success", message);
    if (schema && (REF_SOURCE_SCREENS.has(schema.id) || REF_SOURCE_SCREENS.has(view?.store ?? ""))) void loadRefs(true).then(setRefs);
    await load();
  }

  async function submitForm(data: Data, mode: "create" | "edit" | "singleton", recordId?: string) {
    if (!schema) return false;
    const missing = schema.fields.filter((f) => f.required && !["display", "feature"].includes(f.kind) && (data[f.key] === undefined || data[f.key] === "" || data[f.key] === null));
    if (mode !== "edit" && missing.length) {
      flash("error", `Required: ${missing.map((f) => f.label).join(", ")}`);
      return false;
    }
    setBusy(true);
    try {
      const body = JSON.stringify({ ctx: ctx || undefined, data });
      const res =
        mode === "create"
          ? await hx<{ message: string }>(`/screens/${schema.id}/records`, { method: "POST", body })
          : mode === "singleton"
            ? await hx<{ message: string }>(`/screens/${schema.id}/singleton`, { method: "PUT", body })
            : await hx<{ message: string }>(`/screens/${schema.id}/records/${encodeURIComponent(recordId ?? "")}`, { method: "PATCH", body });
      await afterWrite(res.message);
      return true;
    } catch (e) {
      flash("error", errMsg(e, "Save failed"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: ActionDef, recordIds: string[] = [], extra: { status?: string; note?: string } = {}) {
    if (!schema) return;
    setBusy(true);
    try {
      const res = await hx<{ message: string }>(`/screens/${schema.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ actionId: action.id, recordIds, ctx: ctx || undefined, ...extra }),
      });
      await afterWrite(res.message);
    } catch (e) {
      flash("error", errMsg(e, `${action.label} failed`));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    if (!schema) return;
    const params = new URLSearchParams();
    if (ctx) params.set("ctx", ctx);
    if (q.trim()) params.set("q", q.trim());
    for (const [k, v] of Object.entries(applied)) if (v) params.set(`f.${k}`, v);
    try {
      const out = await hx<{ filename: string; csv: string }>(`/screens/${schema.id}/export?${params.toString()}`);
      const url = URL.createObjectURL(new Blob([out.csv], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
      flash("success", `Exported ${out.filename}`);
    } catch (e) {
      flash("error", errMsg(e, "Export failed"));
    }
  }

  function askDelete(row: Row) {
    if (!schema) return;
    const confirmAction = schema.actions.find((a) => a.kind === "confirm");
    const cancelAction = schema.actions.find((a) => a.kind === "cancel");
    setConfirm({
      title: "Delete record",
      body: `Delete "${display(row.data[view?.columns[0]?.key ?? ""]) || row.id}"? ${row.origin === "domain" ? "The underlying record is waived / removed from this list." : "This can be reviewed later in the audit trail."}`,
      okLabel: confirmAction?.label ?? "Confirm Delete",
      cancelLabel: cancelAction?.label ?? "Cancel",
      onOk: async () => {
        try {
          const res = await hx<{ message: string }>(`/screens/${schema.id}/records/${encodeURIComponent(row.id)}`, { method: "DELETE" });
          await afterWrite(res.message);
        } catch (e) {
          flash("error", errMsg(e, "Delete failed"));
        }
      },
    });
  }

  function openRow(row: Row) {
    if (row.link && !(row.link.screen.toUpperCase() === schema?.id && row.link.ctx === ctx)) return go(row.link.screen, row.link.ctx);
    setDetail(row);
  }

  function onRowAction(action: ActionDef, row: Row) {
    if (!schema) return;
    const target = actionTarget(schema.id, action.label);
    switch (action.kind) {
      case "view":
        if (target) return go(target, row.link?.ctx);
        return openRow(row);
      case "edit":
        return setForm({ mode: "edit", recordId: row.id, data: { ...row.data } });
      case "delete":
        return askDelete(row);
      case "status": {
        const status = action.status ?? "Updated";
        return setConfirm({
          title: action.label,
          body: `Set this record to "${status}"?`,
          okLabel: action.label,
          cancelLabel: "Cancel",
          onOk: () => runAction(action, [row.id], { status }),
        });
      }
      default:
        if (target) return go(target, row.link?.ctx ?? (row.contextKey || undefined));
        return void runAction(action, [row.id]);
    }
  }

  function onToolbarAction(action: ActionDef) {
    if (!schema) return;
    const target = actionTarget(schema.id, action.label);
    if (target) return go(target);
    switch (action.kind) {
      case "create":
      case "upload":
      case "select":
        if (schema.mode === "form") {
          document.getElementById("hx-inline-form")?.scrollIntoView({ behavior: "smooth" });
          return;
        }
        return setForm({ mode: "create", data: {} });
      case "search":
        setPage(1);
        setApplied({ ...draft });
        return;
      case "export":
        return void exportCsv();
      case "bulk":
        if (/select rows|select all/i.test(action.label)) {
          setSelected(new Set(view?.rows.map((r) => r.id) ?? []));
          return;
        }
        if (!selected.size) return flash("error", "Select one or more rows first");
        return setBulk(action);
      case "edit":
        if (/edit mode/i.test(action.label)) setEditMode((v) => !v);
        return void runAction(action);
      default:
        return void runAction(action, [...selected]);
    }
  }

  if (loadError) {
    return (
      <div className="mh-sa hx">
        <SaNotice tone="error">{loadError}</SaNotice>
        <Link className="mh-sa__btn" href="/admin/heritage">
          Back to CampusOne screen index
        </Link>
      </div>
    );
  }
  if (!view || !schema) return <div className="mh-sa hx hx-loading">Loading {screenId}…</div>;

  const features = new Set([...schema.fields, ...schema.filters].filter((f) => f.kind === "feature").map((f) => f.feature));
  const hasRowSelect = schema.columns.some((c) => c.feature === "rowSelect") || schema.actions.some((a) => a.kind === "bulk") || features.has("bulk");
  const hasPhoto = schema.columns.some((c) => c.feature === "photo");
  const mutates = (a: ActionDef) => !["view", "search", "export", "cancel"].includes(a.kind);
  const rowActions = schema.actions.filter((a) => a.row && (view.canEdit || !mutates(a)));
  const toolbar = schema.actions.filter((a) => !a.row && !["submit", "confirm", "cancel"].includes(a.kind) && (view.canEdit || !mutates(a)));
  const formFields = schema.fields.filter((f) => f.kind !== "feature");
  const needsCtx = Boolean(schema.context && !ctx);
  const blockWrite = needsCtx && view.writeThrough;
  const datalistRows = view.rows;
  const statusIsColumn = view.columns.some((c) => c.key === "status" || /^status$/i.test(c.label));
  const opensFormInPlace = toolbar.some((a) => ["create", "upload", "select"].includes(a.kind) && !actionTarget(schema.id, a.label));
  const submitOpener =
    schema.mode === "directory" && !opensFormInPlace && formFields.some((f) => f.kind !== "display") && schema.actions.some((a) => a.kind === "submit") ? schema.submitLabel : null;

  return (
    <div className="mh-sa hx">
      <ScreenHeader view={view} />
      {notice ? (
        <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </SaNotice>
      ) : null}
      {schema.openPoint || schema.partial ? <OpenPointBanner schema={schema} /> : null}
      {view.dedicated ? (
        <div className="hx-banner hx-banner--info">
          <span>This screen also has a dedicated full editor built earlier.</span>
          <Link className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" href={ctx ? `${view.dedicated}${view.dedicated.includes("?") ? "&" : "?"}ctx=${encodeURIComponent(ctx)}` : view.dedicated}>
            Open dedicated screen
          </Link>
        </div>
      ) : null}
      <RelatedTabs screenId={schema.id} ctx={ctx} />
      {schema.context ? <ContextBar view={view} onPick={(key) => router.push(heritageHref(schema.id, key ? { ctx: key } : undefined))} /> : null}

      {schema.mode === "error" ? <ErrorState schema={schema} onContinue={() => go("LM17")} onLog={(a) => void runAction(a)} /> : null}
      {schema.mode === "nav" ? <NavState view={view} /> : null}
      {schema.mode === "gate" ? <GateState dedicated={view.dedicated} onVerified={(m) => flash("success", m)} /> : null}

      {schema.mode === "settings" || schema.id === "S03" ? (
        <section className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>{schema.name}</h2>
            <span className="mh-sa__muted">{view.singleton?.updatedAt ? `Last saved ${new Date(view.singleton.updatedAt).toLocaleString()}` : "Not saved yet"}</span>
          </div>
          <FieldGrid fields={formFields} data={inline} onChange={(k, v) => view.canEdit && setInline((d) => ({ ...d, [k]: v }))} refs={refs} rows={datalistRows} summary={view.summary} />
          {view.canEdit ? <div className="mh-sa__actions">
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || blockWrite} onClick={() => void submitForm(inline, "singleton")}>
              {schema.submitLabel}
            </button>
            {schema.actions
              .filter((a) => a.kind !== "submit" && !a.row)
              .map((a) => (
                <button key={a.id} type="button" className="mh-sa__btn" disabled={busy} onClick={() => onToolbarAction(a)}>
                  {a.label}
                </button>
              ))}
          </div> : null}
        </section>
      ) : null}

      {schema.mode === "form" && schema.id !== "S03" && view.canEdit ? (
        <section className="mh-sa__card" id="hx-inline-form">
          <div className="mh-sa__card-head">
            <h2>{schema.name}</h2>
            {schema.context && view.context?.label ? <span className="mh-sa__pill">{view.context.label}</span> : null}
          </div>
          {blockWrite ? <p className="mh-sa__muted">Select a {schema.context} above to save this form against their record.</p> : null}
          <FieldGrid fields={formFields} data={inline} onChange={(k, v) => setInline((d) => ({ ...d, [k]: v }))} refs={refs} rows={datalistRows} summary={view.summary} />
          <div className="mh-sa__actions">
            <button
              type="button"
              className="mh-sa__btn mh-sa__btn--primary"
              disabled={busy || blockWrite}
              onClick={async () => {
                if (await submitForm(inline, "create")) setInline({});
              }}
            >
              {schema.submitLabel}
            </button>
            {schema.actions
              .filter((a) => a.kind === "submit" && a.label !== schema.submitLabel)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="mh-sa__btn"
                  disabled={busy || blockWrite}
                  onClick={async () => {
                    if (await submitForm({ ...inline, _action: a.label }, "create")) setInline({});
                  }}
                >
                  {a.label}
                </button>
              ))}
            {schema.actions.some((a) => a.kind === "cancel") ? (
              <button type="button" className="mh-sa__btn" onClick={() => setInline({})}>
                {schema.actions.find((a) => a.kind === "cancel")?.label}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {view.summary && schema.mode !== "settings" && schema.id !== "S03" ? <SummaryTiles summary={view.summary} fields={schema.fields} /> : null}

      {schema.mode === "directory" || schema.mode === "form" || (schema.mode === "settings" && view.unfilteredTotal > 0) ? (
        <section className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>{schema.mode === "form" ? "Saved entries" : "Records"}</h2>
            <div className="mh-sa__card-actions hx-toolbar">
              {submitOpener && view.canEdit ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" disabled={busy || blockWrite} onClick={() => setForm({ mode: "create", data: {} })}>
                  {submitOpener}
                </button>
              ) : null}
              {toolbar.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`mh-sa__btn mh-sa__btn--sm${a.kind === "create" ? " mh-sa__btn--primary" : ""}${a.kind === "edit" && editMode && /edit mode/i.test(a.label) ? " is-on" : ""}`}
                  disabled={busy || (a.kind === "create" && blockWrite)}
                  onClick={() => onToolbarAction(a)}
                >
                  {a.label}
                </button>
              ))}
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => void exportCsv()} title="Download the current list as CSV">
                Export CSV
              </button>
            </div>
          </div>

          {schema.filters.filter((f) => f.kind !== "feature").length ? (
            <Filters filters={schema.filters} draft={draft} setDraft={setDraft} refs={refs} rows={datalistRows} onApply={() => {
              setPage(1);
              setApplied({ ...draft });
            }} onReset={() => {
              setDraft({});
              setApplied({});
              setPage(1);
            }} searchLabel={toolbar.find((a) => a.kind === "search")?.label} />
          ) : null}

          <div className="hx-listbar">
            <input className="mh-sa__input hx-quick" placeholder="Quick search in results…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Quick search" />
            <span className="mh-sa__muted">
              {view.total} result{view.total === 1 ? "" : "s"}
              {view.total !== view.unfilteredTotal ? ` of ${view.unfilteredTotal}` : ""}
              {view.source ? ` · Live: ${view.source}` : ""}
            </span>
            <label className="hx-perpage">
              Results per page
              <select className="mh-sa__input mh-sa__input--auto" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>

          {features.has("alphabet") ? (
            <div className="mh-sa-alpha hx-alpha" role="group" aria-label="Alphabet filter">
              {["", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((l) => (
                <button key={l || "all"} type="button" className={letter === l ? "is-active" : ""} onClick={() => { setLetter(l); setPage(1); }}>
                  {l || "All"}
                </button>
              ))}
            </div>
          ) : null}

          {hasRowSelect && selected.size ? (
            <div className="hx-bulkbar">
              <strong>{selected.size} selected</strong>
              {schema.actions
                .filter((a) => a.kind === "bulk" && !/select rows|select all/i.test(a.label))
                .map((a) => (
                  <button key={a.id} type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setBulk(a)}>
                    {a.label}
                  </button>
                ))}
              {!schema.actions.some((a) => a.kind === "bulk" && !/select rows|select all/i.test(a.label)) ? (
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setBulk({ id: "", label: "With checked", kind: "bulk", row: false })}>
                  With checked…
                </button>
              ) : null}
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
          ) : null}

          <div className="mh-sa__table-wrap">
            <table className="mh-sa__table hx-table">
              <thead>
                <tr>
                  {hasRowSelect ? (
                    <th className="hx-col-check">
                      <input
                        type="checkbox"
                        aria-label="Select all rows"
                        checked={view.rows.length > 0 && view.rows.every((r) => selected.has(r.id))}
                        onChange={(e) => setSelected(e.target.checked ? new Set(view.rows.map((r) => r.id)) : new Set())}
                      />
                    </th>
                  ) : null}
                  {hasPhoto ? <th className="hx-col-photo">Photo</th> : null}
                  {view.columns.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  {statusIsColumn ? null : <th>Status</th>}
                  <th className="mh-sa__col-action">Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.length === 0 ? (
                  <tr>
                    <td colSpan={view.columns.length + (statusIsColumn ? 1 : 2) + (hasRowSelect ? 1 : 0) + (hasPhoto ? 1 : 0)} className="mh-sa__empty-cell">
                      {needsCtx && !view.unfilteredTotal ? `Select a ${schema.context} above to see their records.` : "No records found."}
                    </td>
                  </tr>
                ) : (
                  view.rows.map((row) => (
                    <tr key={row.id}>
                      {hasRowSelect ? (
                        <td className="hx-col-check">
                          <input
                            type="checkbox"
                            aria-label="Select row"
                            checked={selected.has(row.id)}
                            onChange={(e) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                if (e.target.checked) n.add(row.id);
                                else n.delete(row.id);
                                return n;
                              })
                            }
                          />
                        </td>
                      ) : null}
                      {hasPhoto ? (
                        <td className="hx-col-photo">
                          <span className="hx-avatar">{initials(display(row.data[view.columns[0]?.key ?? ""]))}</span>
                        </td>
                      ) : null}
                      {view.columns.map((c, i) => (
                        <td key={c.key}>
                          {i === 0 ? (
                            <>
                              <button type="button" className="mh-sa__link" onClick={() => openRow(row)}>
                                {display(row.data[c.key]) || "—"}
                              </button>
                              {row.origin === "domain" ? <span className="hx-live" title="Live record from the core database">live</span> : null}
                            </>
                          ) : c.key === "status" || /^status$/i.test(c.label) ? (
                            <StatusPill status={display(row.data[c.key]) || row.status} />
                          ) : (
                            <CellValue value={row.data[c.key]} />
                          )}
                        </td>
                      ))}
                      {statusIsColumn ? null : (
                        <td>
                          <StatusPill status={row.status} />
                        </td>
                      )}
                      <td className="hx-row-actions">
                        {(rowActions.length ? rowActions : DEFAULT_ROW_ACTIONS.filter((a) => view.canEdit || !mutates(a))).map((a) => (
                          <button key={a.id + a.label} type="button" className={`mh-sa__btn mh-sa__btn--sm${a.kind === "delete" ? " mh-sa__btn--danger" : ""}`} disabled={busy} onClick={() => onRowAction(a, row)}>
                            {a.label}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager page={view.page} perPage={view.perPage} total={view.total} onPage={setPage} />
        </section>
      ) : null}

      <DataPointsPanel schema={schema} view={view} />

      {form ? (
        <SaModal
          title={`${form.mode === "create" ? "New" : "Edit"} — ${schema.name}`}
          onClose={() => setForm(null)}
          wide
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setForm(null)}>
                {schema.actions.find((a) => a.kind === "cancel")?.label ?? "Cancel"}
              </button>
              <button
                type="button"
                className="mh-sa__btn mh-sa__btn--primary"
                disabled={busy}
                onClick={async () => {
                  if (await submitForm(form.data, form.mode, form.recordId)) setForm(null);
                }}
              >
                {form.mode === "edit" ? schema.actions.find((a) => a.kind === "submit")?.label ?? "Save" : schema.submitLabel}
              </button>
            </>
          }
        >
          <FieldGrid
            fields={formFields.length ? formFields : view.columns.map((c) => ({ id: c.key, key: c.key, label: c.label, rawLabel: c.label, kind: "text" as Kind, required: false, partial: false }))}
            extraColumns={formFields.length && form.mode === "edit" ? view.columns.filter((c) => !formFields.some((f) => f.key === c.key)) : []}
            data={form.data}
            onChange={(k, v) => setForm((f) => (f ? { ...f, data: { ...f.data, [k]: v } } : f))}
            refs={refs}
            rows={datalistRows}
            summary={form.mode === "create" ? view.summary : null}
          />
        </SaModal>
      ) : null}

      {detail ? (
        <DetailModal
          schema={schema}
          view={view}
          row={detail}
          ctx={ctx}
          onClose={() => setDetail(null)}
          onEdit={view.canEdit ? () => {
            setForm({ mode: "edit", recordId: detail.id, data: { ...detail.data } });
            setDetail(null);
          } : undefined}
          onDelete={view.canEdit ? () => {
            askDelete(detail);
            setDetail(null);
          } : undefined}
        />
      ) : null}

      {bulk ? (
        <BulkModal
          action={bulk}
          count={selected.size}
          statuses={refs.statuses ?? []}
          onClose={() => setBulk(null)}
          onRun={async (status, note) => {
            const action = bulk.id ? bulk : schema.actions.find((a) => a.kind === "bulk") ?? schema.actions[0];
            await runAction({ ...action, kind: "bulk" }, [...selected], { status: status || undefined, note: note || undefined });
            setBulk(null);
            setSelected(new Set());
          }}
        />
      ) : null}

      {confirm ? (
        <SaModal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                {confirm.cancelLabel}
              </button>
              <button
                type="button"
                className="mh-sa__btn mh-sa__btn--danger"
                onClick={async () => {
                  const c = confirm;
                  setConfirm(null);
                  await c.onOk();
                }}
              >
                {confirm.okLabel}
              </button>
            </>
          }
        >
          <p>{confirm.body}</p>
        </SaModal>
      ) : null}
    </div>
  );
}

const DEFAULT_ROW_ACTIONS: ActionDef[] = [
  { id: "_view", label: "View", kind: "view", row: true },
  { id: "_edit", label: "Edit", kind: "edit", row: true },
  { id: "_delete", label: "Delete", kind: "delete", row: true },
];

function initials(name: string) {
  return (
    name
      .replace(/\(.*\)/, "")
      .split(/[\s,]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = /active|approved|paid|registered|complete|graduated/i.test(status) ? " mh-sa__pill--ok" : /pending|open|owing|review|inquiry|hold/i.test(status) ? " mh-sa__pill--warn" : "";
  return <span className={`mh-sa__pill${tone}`}>{status}</span>;
}

function CellValue({ value }: { value: unknown }) {
  if (value && typeof value === "object" && !Array.isArray(value) && "dataUrl" in (value as Data)) {
    const f = value as FileValue;
    return (
      <a className="mh-sa__link" href={f.dataUrl} download={f.name}>
        {f.name}
      </a>
    );
  }
  if (typeof value === "number") return <span className="hx-num">{value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>;
  const s = display(value);
  if (/^<[a-z]/i.test(s)) return <span>{s.replace(/<[^>]*>/g, " ").slice(0, 120)}</span>;
  return <span>{s || "—"}</span>;
}

/* ------------------------------------------------------------------ */
/* Header / banners / navigation                                        */
/* ------------------------------------------------------------------ */

function ScreenHeader({ view }: { view: View }) {
  const s = view.schema;
  return (
    <header className="hx-head">
      <div className="hx-head__top">
        <div>
          <div className="hx-head__eyebrow">
            <Link href="/admin/heritage">CampusOne SIS</Link> · {s.module} · <code>{s.id}</code>
          </div>
          <h1>{s.name}</h1>
        </div>
        <div className="hx-head__badges">
          <span className="mh-sa__pill">{s.screenType}</span>
          <span className="mh-sa__pill">{s.dataPointCount} data points</span>
          {view.source || view.writeThrough ? <span className="mh-sa__pill mh-sa__pill--ok">Live data</span> : null}
          <span className={`mh-sa__pill${s.partial ? " mh-sa__pill--warn" : " mh-sa__pill--ok"}`}>{s.status}</span>
          {view.auditCount ? <span className="mh-sa__pill">{view.auditCount} audit entries</span> : null}
        </div>
      </div>
      {s.flow.length ? (
        <ol className="hx-flow" aria-label="Captured flow">
          {s.flow.map((step, i) => (
            <li key={`${step}-${i}`}>{step}</li>
          ))}
        </ol>
      ) : null}
    </header>
  );
}

function OpenPointBanner({ schema }: { schema: Schema }) {
  return (
    <div className="hx-banner hx-banner--warn" role="note">
      <strong>{schema.openPoint?.gap ?? schema.status}</strong>
      <span>{schema.openPoint?.confirmation || schema.condition}</span>
      {schema.openPoint?.status ? <em>{schema.openPoint.status}</em> : null}
    </div>
  );
}

function RelatedTabs({ screenId, ctx }: { screenId: string; ctx: string }) {
  const group = flowGroupFor(screenId);
  if (!group) return null;
  const keep = group.context && ctx.startsWith(`${group.context}:`) ? { ctx } : undefined;
  return (
    <nav className="hx-related" aria-label={`${group.title} screens`}>
      <span className="hx-related__title">{group.title}</span>
      {group.sections.map((sec) => (
        <div key={sec.title} className="hx-related__sec">
          <span className="hx-related__label">{sec.title}</span>
          {sec.screens.map((id) => (
            <Link key={id} href={heritageHref(id, keep)} className={`hx-chip${id === screenId ? " is-active" : ""}`}>
              {id}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function ContextBar({ view, onPick }: { view: View; onPick: (key: string) => void }) {
  const type = view.schema.context ?? "";
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Array<{ key: string; label: string }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void hx<{ items: Array<{ key: string; label: string }> }>(`/context-options?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`)
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 200);
  }, [q, type]);
  return (
    <div className="hx-context">
      <span className="hx-context__label">{type.charAt(0).toUpperCase() + type.slice(1)}</span>
      {view.context?.label ? <strong>{view.context.label}</strong> : <em className="mh-sa__muted">None selected — showing all {type} records</em>}
      <input className="mh-sa__input mh-sa__input--auto" placeholder={`Search ${type}…`} value={q} onChange={(e) => setQ(e.target.value)} list="hx-ctx-options" aria-label={`Search ${type}`} />
      <select className="mh-sa__input mh-sa__input--auto" value={view.context?.key ?? ""} onChange={(e) => onPick(e.target.value)} aria-label={`Select ${type}`}>
        <option value="">— Select {type} —</option>
        {view.context?.key && !items.some((i) => i.key === view.context?.key) ? <option value={view.context.key}>{view.context.label ?? view.context.key}</option> : null}
        {items.map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
      {view.context?.key ? (
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => onPick("")}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

function SummaryTiles({ summary, fields }: { summary: Data; fields: FieldDef[] }) {
  const entries = Object.entries(summary).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  if (!entries.length) return null;
  return (
    <div className="hx-kpis">
      {entries.map(([k, v]) => {
        const f = fields.find((x) => x.key === k);
        return (
          <div key={k} className="hx-kpi">
            <span>{f?.label ?? pretty(k)}</span>
            <strong>{typeof v === "number" && (f?.kind === "money" || /owing|paid|total|balance|payments|credit|refunds/.test(k)) ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : display(v)}</strong>
          </div>
        );
      })}
    </div>
  );
}

function ErrorState({ schema, onContinue, onLog }: { schema: Schema; onContinue: () => void; onLog: (a: ActionDef) => void }) {
  const cont = schema.actions.find((a) => /continue/i.test(a.label));
  return (
    <section className="mh-sa__card hx-error-state">
      <h2>{schema.name.replace(/^.*—\s*/, "")}</h2>
      <p>{schema.condition}</p>
      <ul>
        {schema.fields.map((f) => (
          <li key={f.id}>{f.label}</li>
        ))}
      </ul>
      <button
        type="button"
        className="mh-sa__btn mh-sa__btn--primary"
        onClick={() => {
          if (cont) onLog(cont);
          onContinue();
        }}
      >
        {cont?.label ?? "Continue"}
      </button>
    </section>
  );
}

function NavState({ view }: { view: View }) {
  return (
    <section className="mh-sa__card">
      <h2>{view.schema.name}</h2>
      <p>{view.schema.condition}</p>
      {view.dedicated ? (
        <Link className="mh-sa__btn mh-sa__btn--primary" href={view.dedicated}>
          {view.schema.actions[0]?.label ?? "Open"}
        </Link>
      ) : null}
    </section>
  );
}

function GateState({ dedicated, onVerified }: { dedicated: string | null; onVerified: (m: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <section className="mh-sa__card mh-sa__form--narrow">
      <h2>Account Verification Required</h2>
      {ok ? (
        <>
          <p>Your account is verified. You can now manage your security settings.</p>
          {dedicated ? (
            <Link className="mh-sa__btn mh-sa__btn--primary" href={dedicated}>
              Open Security Settings
            </Link>
          ) : null}
        </>
      ) : (
        <form
          className="mh-sa__stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              const r = await hx<{ message: string }>("/verify-password", { method: "POST", body: JSON.stringify({ password: pw }) });
              setOk(true);
              onVerified(r.message);
            } catch (e2) {
              setErr(errMsg(e2, "Verification failed"));
            }
          }}
        >
          {err ? <SaNotice tone="error">{err}</SaNotice> : null}
          <SaField label="Current Password">
            <input className="mh-sa__input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
          </SaField>
          <div className="mh-sa__actions">
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Continue
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Filters / pager / fields                                             */
/* ------------------------------------------------------------------ */

function Filters({
  filters,
  draft,
  setDraft,
  refs,
  rows,
  onApply,
  onReset,
  searchLabel,
}: {
  filters: FieldDef[];
  draft: Record<string, string>;
  setDraft: (d: Record<string, string>) => void;
  refs: Record<string, string[]>;
  rows: Row[];
  onApply: () => void;
  onReset: () => void;
  searchLabel?: string;
}) {
  return (
    <form
      className="hx-filters"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <div className="mh-sa__grid">
        {filters
          .filter((f) => f.kind !== "feature")
          .map((f) => (
            <SaField key={f.id} label={f.label}>
              <FieldInput
                field={f.kind === "checkbox" ? { ...f, kind: "select", options: ["Yes", "No"] } : f}
                value={draft[f.key] ?? ""}
                onChange={(v) => setDraft({ ...draft, [f.key]: Array.isArray(v) ? v.join(",") : String(v ?? "") })}
                refs={refs}
                rows={rows}
                filter
              />
            </SaField>
          ))}
      </div>
      <div className="mh-sa__actions">
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
          {searchLabel ?? "Search"}
        </button>
        <button type="button" className="mh-sa__btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </form>
  );
}

function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  return (
    <div className="hx-pager">
      <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <label>
        Page{" "}
        <select className="mh-sa__input mh-sa__input--auto" value={page} onChange={(e) => onPage(Number(e.target.value))}>
          {Array.from({ length: pages }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>{" "}
        of {pages}
      </label>
      <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

function FieldGrid({
  fields,
  extraColumns = [],
  data,
  onChange,
  refs,
  rows,
  summary,
}: {
  fields: FieldDef[];
  extraColumns?: Array<{ key: string; label: string }>;
  data: Data;
  onChange: (key: string, value: unknown) => void;
  refs: Record<string, string[]>;
  rows: Row[];
  summary: Data | null;
}) {
  const all: FieldDef[] = [
    ...fields,
    ...extraColumns.map((c) => ({ id: c.key, key: c.key, label: c.label, rawLabel: c.label, kind: "text" as Kind, required: false, partial: false })),
  ];
  if (!all.length) return <p className="mh-sa__muted">This screen has no editable fields in the captured source.</p>;
  return (
    <div className="mh-sa__grid hx-fields">
      {all.map((raw) => {
        const f: FieldDef = summary && raw.key in summary ? { ...raw, kind: "display", required: false } : raw;
        const wide = ["textarea", "multiselect", "display"].includes(f.kind) || /rich text|rich content/i.test(f.rawLabel);
        if (f.kind === "checkbox") {
          return (
            <label key={f.id} className={`mh-sa__check hx-check${wide ? " mh-sa__field--wide" : ""}`} title={f.rawLabel}>
              <input type="checkbox" checked={data[f.key] === true} onChange={(e) => onChange(f.key, e.target.checked)} />
              <span>
                {f.label}
                {f.required ? " *" : ""}
              </span>
            </label>
          );
        }
        return (
          <SaField key={f.id} label={`${f.label}${f.required ? " *" : ""}`} wide={wide} hint={f.partial ? " (partial capture)" : undefined}>
            <FieldInput field={f} value={data[f.key] ?? (f.kind === "display" ? summary?.[f.key] : undefined)} onChange={(v) => onChange(f.key, v)} refs={refs} rows={rows} />
          </SaField>
        );
      })}
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  onChange,
  refs,
  rows,
  filter,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  refs: Record<string, string[]>;
  rows: Row[];
  filter?: boolean;
}) {
  const str = value === undefined || value === null ? "" : Array.isArray(value) ? value.join(", ") : typeof value === "object" ? "" : String(value);
  const options = (): string[] => {
    if (f.options?.length) return f.options;
    if (!f.ref) return [];
    if (f.ref.startsWith("options:")) return [...new Set(rows.map((r) => display(r.data[f.key])).filter(Boolean))].slice(0, 100);
    return refs[f.ref] ?? [];
  };
  switch (f.kind) {
    case "display":
      return <div className="mh-sa__readonly hx-display">{display(value) || <em className="mh-sa__muted">Shown by the system</em>}</div>;
    case "textarea":
      if (/rich text|rich content/i.test(f.rawLabel) && !filter) return <RichTextEditor value={str} onChange={onChange} label={f.label} />;
      return <textarea className="mh-sa__input" rows={3} value={str} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select className="mh-sa__input" value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{filter ? "All" : "— Select —"}</option>
          {options().map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const opts = options();
      const cur = Array.isArray(value) ? (value as string[]) : str ? str.split(",").map((s) => s.trim()) : [];
      if (filter || opts.length > 40) {
        const id = `hx-dl-${f.id}`;
        return (
          <>
            <input className="mh-sa__input" list={id} value={str} placeholder="Comma-separated" onChange={(e) => onChange(filter ? e.target.value : e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            <datalist id={id}>{opts.slice(0, 300).map((o) => <option key={o} value={o} />)}</datalist>
          </>
        );
      }
      if (!opts.length) return <input className="mh-sa__input" value={str} placeholder="Comma-separated values" onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />;
      return (
        <div className="hx-multi">
          {opts.map((o) => (
            <label key={o} className="mh-sa__check">
              <input type="checkbox" checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "ref": {
      const id = `hx-dl-${f.id}`;
      const opts = options();
      return (
        <>
          <input className="mh-sa__input" list={id} value={str} onChange={(e) => onChange(e.target.value)} placeholder={opts.length ? "Type or choose…" : ""} />
          <datalist id={id}>{opts.slice(0, 500).map((o) => <option key={o} value={o} />)}</datalist>
        </>
      );
    }
    case "checkbox":
      return <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case "file": {
      const fv = value && typeof value === "object" && "dataUrl" in (value as Data) ? (value as FileValue) : null;
      return (
        <div className="hx-file">
          <input
            type="file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 3_000_000) {
                alert("File must be under 3 MB");
                e.target.value = "";
                return;
              }
              const reader = new FileReader();
              reader.onload = () => onChange({ name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result) });
              reader.readAsDataURL(file);
            }}
          />
          {fv ? (
            <a className="mh-sa__link" href={fv.dataUrl} download={fv.name}>
              {fv.name} ({Math.round(fv.size / 1024)} KB)
            </a>
          ) : null}
        </div>
      );
    }
    case "daterange": {
      const [from = "", to = ""] = str.split("..");
      return (
        <div className="mh-sa__inline">
          <input className="mh-sa__input" type="date" value={from} onChange={(e) => onChange(`${e.target.value}..${to}`)} aria-label={`${f.label} from`} />
          <input className="mh-sa__input" type="date" value={to} onChange={(e) => onChange(`${from}..${e.target.value}`)} aria-label={`${f.label} to`} />
        </div>
      );
    }
    case "money":
      return (
        <div className="hx-money">
          <span>$</span>
          <input className="mh-sa__input" type="number" step="0.01" value={str} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "color":
      return <input className="mh-sa__input hx-color" type="color" value={str || "#2563eb"} onChange={(e) => onChange(e.target.value)} />;
    default: {
      const type =
        f.kind === "number" || f.kind === "percent"
          ? "number"
          : f.kind === "datetime"
            ? "datetime-local"
            : f.kind === "date" || f.kind === "time" || f.kind === "email" || f.kind === "tel" || f.kind === "url" || f.kind === "password"
              ? f.kind
              : "text";
      return <input className="mh-sa__input" type={type} value={str} onChange={(e) => onChange(e.target.value)} autoComplete={f.kind === "password" ? "new-password" : undefined} />;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Detail / bulk / data points                                          */
/* ------------------------------------------------------------------ */

function DetailModal({ schema, view, row, ctx, onClose, onEdit, onDelete }: { schema: Schema; view: View; row: Row; ctx: string; onClose: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const [audit, setAudit] = useState<AuditItem[] | null>(null);
  useEffect(() => {
    const params = new URLSearchParams({ recordId: row.id });
    if (ctx) params.set("ctx", ctx);
    void hx<{ items: AuditItem[] }>(`/screens/${schema.id}/audit?${params.toString()}`)
      .then((r) => setAudit(r.items))
      .catch(() => setAudit([]));
  }, [schema.id, row.id, ctx]);
  const labels = new Map<string, string>([...schema.fields.map((f) => [f.key, f.label] as const), ...view.columns.map((c) => [c.key, c.label] as const)]);
  const entries = Object.entries(row.data).filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && v !== undefined);
  return (
    <SaModal
      title={display(row.data[view.columns[0]?.key ?? ""]) || "Record"}
      onClose={onClose}
      wide
      footer={
        <>
          {onDelete ? <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={onDelete}>
            Delete
          </button> : null}
          <button type="button" className="mh-sa__btn" onClick={() => window.print()}>
            Print
          </button>
          {onEdit ? <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={onEdit}>
            Edit
          </button> : null}
        </>
      }
    >
      <dl className="mh-sa__dl hx-dl">
        <dt>Status</dt>
        <dd>{row.status}</dd>
        {entries.map(([k, v]) => (
          <div key={k} className="hx-dl__row">
            <dt>{labels.get(k) ?? pretty(k)}</dt>
            <dd>
              <CellValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="hx-subhead">Audit trail</h3>
      {!audit ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : audit.length === 0 ? (
        <p className="mh-sa__muted">No changes recorded for this record yet.</p>
      ) : (
        <ul className="hx-audit">
          {audit.map((a) => (
            <li key={a.id}>
              <strong>{a.action}</strong> · {a.actor} · {new Date(a.at).toLocaleString()}
              {a.note ? <div className="mh-sa__muted">{a.note}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </SaModal>
  );
}

function BulkModal({ action, count, statuses, onClose, onRun }: { action: ActionDef; count: number; statuses: string[]; onClose: () => void; onRun: (status: string, note: string) => Promise<void> }) {
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  return (
    <SaModal
      title={`${action.label} — ${count} selected`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => void onRun(status, note)}>
            Apply to {count} record{count === 1 ? "" : "s"}
          </button>
        </>
      }
    >
      <div className="mh-sa__stack">
        <SaField label="Set status (optional)">
          <input className="mh-sa__input" list="hx-bulk-status" value={status} onChange={(e) => setStatus(e.target.value)} />
          <datalist id="hx-bulk-status">{[...statuses, "Active", "Inactive", "Approved", "Declined"].map((s) => <option key={s} value={s} />)}</datalist>
        </SaField>
        <SaField label="Note">
          <textarea className="mh-sa__input" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </SaField>
      </div>
    </SaModal>
  );
}

function implementedAs(kind: string, extra?: string) {
  const map: Record<string, string> = {
    pagination: "Pager",
    perPage: "Results-per-page selector",
    resultsCount: "Results count",
    alphabet: "A–Z filter bar",
    bulk: "Bulk action bar",
    confirm: "Confirmation dialog",
    rowSelect: "Row checkbox",
    photo: "Photo / avatar column",
    rowAction: "Row action buttons",
  };
  return extra ? map[extra] ?? extra : kind;
}

function DataPointsPanel({ schema, view }: { schema: Schema; view: View }): ReactNode {
  const rows = [
    ...schema.fields.map((f) => ({ id: f.id, type: "Field", label: f.rawLabel, as: f.kind === "feature" ? implementedAs(f.kind, f.feature) : `${f.kind}${f.ref ? ` → ${f.ref.replace(/^options:.*/, "suggested values")}` : ""}${f.options ? ` [${f.options.length} options]` : ""}` })),
    ...schema.filters.map((f) => ({ id: f.id, type: "Filter", label: f.rawLabel, as: f.kind === "feature" ? implementedAs(f.kind, f.feature) : `filter · ${f.kind}` })),
    ...schema.columns.map((c) => ({ id: c.id, type: "Column", label: c.label, as: c.feature ? implementedAs("column", c.feature) : `column · ${view.columns.some((x) => x.key === c.key) ? "shown" : c.key}` })),
    ...schema.actions.map((a) => ({ id: a.id, type: "Action", label: a.label, as: `${a.kind}${a.row ? " (row)" : ""}${actionTarget(schema.id, a.label) ? ` → ${actionTarget(schema.id, a.label)}` : ""}` })),
  ].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return (
    <details className="mh-sa__card hx-dp">
      <summary>
        Data points from the master sheet — {rows.length} of {schema.dataPointCount} implemented
        <span className="mh-sa__muted"> · Evidence {schema.evidence}</span>
      </summary>
      <div className="mh-sa__table-wrap">
        <table className="mh-sa__table">
          <thead>
            <tr>
              <th>Entry ID</th>
              <th>Type</th>
              <th>UI label / data point</th>
              <th>Implemented as</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <code>{r.id}</code>
                </td>
                <td>{r.type}</td>
                <td>{r.label}</td>
                <td>{r.as}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

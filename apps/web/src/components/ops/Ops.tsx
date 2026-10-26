"use client";

import "../superadmin/superadmin.css";
import "../location/location.css";
import "../programs/programs.css";
import "./ops.css";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SaModal, SuperFrame } from "@/components/superadmin/shared";
import { ConfirmDelete, FilterBar, errMsg, str, useNotice } from "@/components/location/shared";
import { api, loadSession } from "@/lib/api";
import { interviewStartUrl } from "@/lib/admissionsInterview";

/* ------------------------------------------------------------------ */
/* Types + API                                                          */
/* ------------------------------------------------------------------ */

type Data = Record<string, unknown>;
type Field = {
  key: string;
  label: string;
  kind: string;
  required?: boolean;
  options?: string[];
  ref?: string;
  /** Ref whose stored value is the option label rather than its id. */
  byLabel?: boolean;
  long?: boolean;
  createOnly?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  dflt?: unknown;
  hint?: string;
  readOnly?: boolean;
  editOnly?: boolean;
};
type Action = { key: string; label: string; set?: Data; run?: boolean; when?: Record<string, Array<string | boolean>>; tone?: "primary" | "danger" };
type Entity = { key: string; slug: string; module: string; label: string; plural: string; fields: Field[]; columns: Array<{ key: string; label: string }>; filters?: string[]; actions?: Action[]; create: boolean; edit: boolean; remove: boolean; hint?: string };
type Module = { label: string; dashboard: boolean; entities: Entity[]; links?: Array<{ label: string; href: string }> };
type Meta = { modules: Record<string, Module> };
type Row = Data & { id: string; _ref?: Record<string, string> };
type Opt = { id: string; label: string };
type Saved = { ok: boolean; id?: string; message: string };
type Kpi = { label: string; value: string | number; hint?: string; tone?: "danger" | "warn" | "ok"; slug?: string };
type Panel = { title: string; slug?: string; kind: "table"; columns: string[]; rows: string[][]; empty: string } | { title: string; slug?: string; kind: "bars"; bars: Array<{ label: string; value: number; note?: string }> };

const ops = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/ops${path}`, init ?? {}, loadSession()?.accessToken);
const send = <T = Saved,>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => ops<T>(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

export const OPS_BASE = "/admin/ops";

let metaCache: Promise<Meta> | null = null;
function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    metaCache ??= ops<Meta>("/meta");
    metaCache
      .then((m) => live && setMeta(m))
      .catch((e) => {
        metaCache = null;
        if (live) setError(errMsg(e, "Could not load this module"));
      });
    return () => {
      live = false;
    };
  }, []);
  return { meta, error };
}

/** Which ref list points at records of a given entity (for "related records" on the detail view). */
const REF_OF: Record<string, string> = {
  employers: "employers",
  placements: "placements",
  cases: "cases",
  equipment: "equipment",
  safetyRules: "safetyRules",
  environments: "environments",
  campaigns: "campaigns",
  events: "events",
  applications: "applications",
  retention: "retentionPolicies",
};

const PILL_OK = /^(active|approved|approved_application|accepted|available|cleared|completed|done|ok|good|open registration|running|confirmed|resolved|reviewed|enrolled|admitted|filled|offered|cloa|published|fulfilled|released|implemented|processed|sent|read|none|admit)$/i;
const PILL_BAD = /^(critical|high|urgent|rejected|withdrawn|terminated|revoked|expired|retired|cancelled|lost|no_show|no-show|suspended|probation|alert|low stock|low|open|declined|decline|refused|refused_visa|failed|discarded|overdue|missing|active hold|dismissed)$/i;
const PILL_WARN = /^(pending|due|warning|maintenance|investigating|in_progress|in progress|requested|draft|watch|medium|monitoring|submitted|scheduled|planned|new|contacted|qualified|applied|under_review|under review|in review|interview|waitlisted|waitlist|waitlist only|unread|waiting|needed|proposed|paused|uploaded|received|follow_up|prospective|new_inquiry|restricted|queued)$/i;
const PILL_KEYS = new Set(["_stock", "_state", "_due", "_hold"]);

function pill(v: string) {
  if (!v) return null;
  const tone = PILL_OK.test(v) ? " mh-sa__pill--ok" : PILL_BAD.test(v) ? " ops-pill--bad" : PILL_WARN.test(v) ? " mh-sa__pill--warn" : "";
  return <span className={`mh-sa__pill${tone}`}>{v.replace(/_/g, " ")}</span>;
}

function safeExternalUrl(value: unknown) {
  const raw = str(value).trim();
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function interviewMeetingUrl(e: Entity, row: Row) {
  return e.key === "interviews" ? interviewStartUrl(row) : null;
}

function display(e: Entity, row: Row, key: string): ReactNode {
  const f = e.fields.find((x) => x.key === key);
  const v = row[key];
  if (f?.kind === "ref") return row._ref?.[key] || str(v) || "—";
  if (f?.kind === "bool") return v ? "Yes" : "No";
  if (f?.kind === "list") return Array.isArray(v) && v.length ? v.join(", ") : "—";
  if (f?.kind === "datetime") return str(v) ? str(v).replace("T", " ") : "—";
  if (e.key === "interviews" && key === "location") {
    const href = safeExternalUrl(v);
    if (href) return <a className="ops-link" href={href} target="_blank" rel="noopener noreferrer">Open meeting link</a>;
  }
  if (f?.kind === "number" && key.toLowerCase().includes("budget") && v !== null && v !== undefined && v !== "") return `$${Number(v).toLocaleString("en-CA")}`;
  if (((f?.kind === "select" || f?.readOnly) && /status|stage|level|severity|standing|priority/i.test(key)) || PILL_KEYS.has(key)) return pill(str(v)) ?? "—";
  const out = str(v);
  return out === "" ? "—" : out.length > 90 ? `${out.slice(0, 90)}…` : out;
}

const CRUMB = (m: Module) => ["Home", m.label];

/* ------------------------------------------------------------------ */
/* Router                                                               */
/* ------------------------------------------------------------------ */

export function OpsApp() {
  const params = useParams<{ slug?: string[] }>();
  const router = useRouter();
  const { meta, error } = useMeta();
  const [moduleKey = "", entitySlug = ""] = params?.slug ?? [];
  const mod = meta?.modules[moduleKey];
  const entity = mod?.entities.find((x) => x.slug === entitySlug);
  const bad = Boolean(meta && (!mod || (entitySlug && !entity) || (!entitySlug && !mod.dashboard)));
  useEffect(() => {
    if (!meta || !bad) return;
    if (mod && !entitySlug) router.replace(`${OPS_BASE}/${moduleKey}/${mod.entities[0]!.slug}`);
    else if (mod) router.replace(`${OPS_BASE}/${moduleKey}`);
    else router.replace("/admin");
  }, [meta, bad, mod, moduleKey, entitySlug, router]);
  if (error) return <p className="mh-sa__muted">{error}</p>;
  if (!meta || !mod || bad) return null;
  return entity ? <EntityList key={entity.key} mod={mod} moduleKey={moduleKey} entity={entity} /> : <Dashboard key={moduleKey} mod={mod} moduleKey={moduleKey} />;
}

function ModuleTabs({ mod, moduleKey, active }: { mod: Module; moduleKey: string; active: string }) {
  const tabs: Array<[string, string]> = [...(mod.dashboard ? ([["", "Dashboard"]] as Array<[string, string]>) : []), ...mod.entities.map((e) => [e.slug, e.plural] as [string, string])];
  return (
    <nav className="lx-tabs ops-tabs" aria-label={`${mod.label} screens`}>
      {tabs.map(([slug, label]) => (
        <Link key={slug || "dash"} href={`${OPS_BASE}/${moduleKey}${slug ? `/${slug}` : ""}`} className={`lx-tab${active === slug ? " is-active" : ""}`} aria-current={active === slug ? "page" : undefined}>
          {label}
        </Link>
      ))}
      {(mod.links ?? []).map((l) => (
        <Link key={l.href} href={l.href} className="lx-tab">
          {l.label} ↗
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */

function Dashboard({ mod, moduleKey }: { mod: Module; moduleKey: string }) {
  const [data, setData] = useState<{ kpis: Kpi[]; panels: Panel[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ops<{ kpis: Kpi[]; panels: Panel[] }>(`/dash/${moduleKey}`)
      .then(setData)
      .catch((e) => setError(errMsg(e, "Could not load the dashboard")));
  }, [moduleKey]);
  const href = (slug?: string) => (slug ? `${OPS_BASE}/${moduleKey}/${slug}` : undefined);
  const path = `${OPS_BASE}/${moduleKey}`;
  return (
    <SuperFrame title={`${mod.label} Dashboard`} breadcrumbs={[...CRUMB(mod), "Dashboard"]} activeHref={path}>
      <div className="lx">
        <ModuleTabs mod={mod} moduleKey={moduleKey} active="" />
        {error ? <p className="mh-sa__muted">{error}</p> : null}
        {!data ? (
          error ? null : <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            <div className="ops-kpis">
              {data.kpis.map((k) => {
                const body = (
                  <>
                    <strong>{k.value}</strong>
                    <span>{k.label}</span>
                    {k.hint ? <em>{k.hint}</em> : null}
                  </>
                );
                const cls = `ops-kpi${k.tone ? ` ops-kpi--${k.tone}` : ""}`;
                return k.slug ? (
                  <Link key={k.label} href={href(k.slug)!} className={`${cls} ops-kpi--link`}>
                    {body}
                  </Link>
                ) : (
                  <div key={k.label} className={cls}>
                    {body}
                  </div>
                );
              })}
            </div>
            <div className="ops-panels">
              {data.panels.map((p) => (
                <section key={p.title} className="mh-sa__card ops-panel">
                  <div className="mh-sa__card-head">
                    <h2>{p.title}</h2>
                    {p.slug ? (
                      <Link className="mh-sa__btn mh-sa__btn--sm" href={href(p.slug)!}>
                        Open
                      </Link>
                    ) : null}
                  </div>
                  {p.kind === "bars" ? (
                    <Bars bars={p.bars} />
                  ) : p.rows.length ? (
                    <div className="mh-sa__table-wrap">
                      <table className="mh-sa__table lx-table">
                        <thead>
                          <tr>
                            {p.columns.map((c) => (
                              <th key={c}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.rows.map((r, i) => (
                            <tr key={i}>
                              {r.map((c, j) => (
                                <td key={j}>{c || "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="pm-empty">{p.empty}</p>
                  )}
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </SuperFrame>
  );
}

function Bars({ bars }: { bars: Array<{ label: string; value: number; note?: string }> }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="ops-bars">
      {bars.map((b) => (
        <li key={b.label}>
          <span className="ops-bars__label">{b.label.replace(/_/g, " ")}</span>
          <span className="ops-bars__track">
            <span className="ops-bars__fill" style={{ width: `${(b.value / max) * 100}%` }} />
          </span>
          <span className="ops-bars__value">
            {b.value}
            {b.note ? <em> {b.note}</em> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* List                                                                 */
/* ------------------------------------------------------------------ */

function EntityList({ mod, moduleKey, entity: e }: { mod: Module; moduleKey: string; entity: Entity }) {
  const router = useRouter();
  const sp = useSearchParams();
  const notice = useNotice();
  const { ok, fail } = notice;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{ row: Row | null; intent?: "complete-interview" } | null>(null);
  const [confirm, setConfirm] = useState<Row | null>(null);
  const path = `${OPS_BASE}/${moduleKey}/${e.slug}`;
  const viewId = sp?.get("id") ?? null;

  const load = useCallback(() => {
    ops<{ items: Row[] }>(`/e/${e.key}`)
      .then((r) => setRows(r.items))
      .catch((err) => fail(errMsg(err, `Could not load ${e.plural.toLowerCase()}`)));
  }, [e.key, e.plural, fail]);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) => Object.entries(filters).every(([k, v]) => !v || str(r[k]) === v) && (!needle || JSON.stringify([r, r._ref]).toLowerCase().includes(needle)),
    );
  }, [rows, q, filters]);

  const filterFields = useMemo(
    () =>
      (e.filters ?? []).map((k) => {
        const f = e.fields.find((x) => x.key === k);
        const label = f?.label ?? e.columns.find((c) => c.key === k)?.label ?? k;
        if (f?.options) return { key: k, label, options: f.options.map((o) => ({ value: o, label: o.replace(/_/g, " ") })) };
        const seen = new Map<string, string>();
        for (const r of rows ?? []) {
          const v = str(r[k]);
          if (v && !seen.has(v)) seen.set(v, (f?.kind === "ref" && r._ref?.[k]) || v.replace(/_/g, " "));
        }
        return { key: k, label, options: [...seen].map(([value, l]) => ({ value, label: l })).sort((a, b) => a.label.localeCompare(b.label)) };
      }),
    [e, rows],
  );
  const open = (id: string | null) => router.replace(id ? `${path}?id=${id}` : path, { scroll: false });
  const viewing = viewId ? (rows ?? []).find((r) => r.id === viewId) : undefined;

  const runAction = async (row: Row, a: Action) => {
    if (e.key === "interviews" && a.key === "complete") {
      setForm({ row, intent: "complete-interview" });
      return;
    }
    if (a.tone === "danger" && !window.confirm(`${a.label}: are you sure?`)) return;
    try {
      const out = await send(`/e/${e.key}/${row.id}/actions/${a.key}`, "POST");
      ok(out.message);
      load();
    } catch (err) {
      fail(errMsg(err, `Could not ${a.label.toLowerCase()}`));
    }
  };

  return (
    <SuperFrame
      title={e.plural}
      breadcrumbs={[...CRUMB(mod), e.plural]}
      activeHref={path}
      actions={
        e.create ? (
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setForm({ row: null })}>
            Add {e.label}
          </button>
        ) : undefined
      }
    >
      <div className="lx">
        <ModuleTabs mod={mod} moduleKey={moduleKey} active={e.slug} />
        {notice.node}
        {e.hint ? <p className="ops-hint">{e.hint}</p> : null}
        <section className="mh-sa__card">
          <div className="ops-filters">
            <FilterBar value={q} onChange={setQ} placeholder={`Search ${e.plural.toLowerCase()}`} />
            {filterFields.map((f) => (
              <label key={f.key} className="mh-sa__field">
                <span className="mh-sa__label">{f.label}</span>
                <select className="mh-sa__input" value={filters[f.key] ?? ""} onChange={(ev) => setFilters((x) => ({ ...x, [f.key]: ev.target.value }))}>
                  <option value="">All</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {!rows ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : (
            <>
              <p className="ops-count">
                Results: <strong>{shown.length}</strong>
                {shown.length !== rows.length ? ` of ${rows.length}` : ""}
              </p>
              <div className="mh-sa__table-wrap">
                <table className="mh-sa__table lx-table">
                  <thead>
                    <tr>
                      {e.columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                      <th className="lx-actions" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        {e.columns.map((c, i) => (
                          <td key={c.key}>
                            {i === 0 ? (
                              <button type="button" className="ops-link" onClick={() => open(r.id)}>
                                {display(e, r, c.key)}
                              </button>
                            ) : (
                              display(e, r, c.key)
                            )}
                          </td>
                        ))}
                        <td className="lx-actions">
                          <span className="pm-row-actions">
                            {interviewMeetingUrl(e, r) ? (
                              <a className="mh-sa__btn mh-sa__btn--sm ops-interview-start" href={interviewMeetingUrl(e, r)!} target="_blank" rel="noopener noreferrer" aria-label="Start interview in a new tab" title="Start interview in a new tab">Start</a>
                            ) : null}
                            {(e.actions ?? [])
                              .filter((a) => actionAllowed(a, r))
                              .slice(0, 2)
                              .map((a) => (
                                <button key={a.key} type="button" className={`mh-sa__btn mh-sa__btn--sm${a.tone ? ` mh-sa__btn--${a.tone}` : ""}`} onClick={() => runAction(r, a)}>
                                  {a.label}
                                </button>
                              ))}
                            {e.edit ? (
                              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setForm({ row: r })}>
                                Edit
                              </button>
                            ) : (
                              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => open(r.id)}>
                                View
                              </button>
                            )}
                            {e.remove ? (
                              <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                                Delete
                              </button>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 ? (
                      <tr>
                        <td colSpan={e.columns.length + 1}>
                          <p className="pm-empty">{rows.length ? "No records match the filter." : e.create ? `No ${e.plural.toLowerCase()} yet. Use “Add ${e.label}” to create the first one.` : `No ${e.plural.toLowerCase()} yet.`}</p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
      {viewing ? (
        <DetailModal
          moduleKey={moduleKey}
          mod={mod}
          entity={e}
          row={viewing}
          onClose={() => open(null)}
          onEdit={() => setForm({ row: viewing })}
          onDelete={() => setConfirm(viewing)}
          onAction={(a) => runAction(viewing, a)}
        />
      ) : null}
      {form ? (
        <FormModal
          entity={e}
          row={form.row}
          intent={form.intent}
          onClose={() => setForm(null)}
          onSaved={(out) => {
            setForm(null);
            ok(out.message);
            load();
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmDelete
          title={`Delete ${e.label}`}
          body={
            <>
              <p>Delete this {e.label.toLowerCase()}? This cannot be undone.</p>
              {e.hint && /delet/i.test(e.hint) ? <p className="ops-hint">{e.hint}</p> : null}
            </>
          }
          onCancel={() => setConfirm(null)}
          onOk={async () => {
            const target = confirm;
            setConfirm(null);
            try {
              const out = await send(`/e/${e.key}/${target.id}`, "DELETE");
              if (viewId === target.id) open(null);
              ok(out.message);
              load();
            } catch (err) {
              fail(errMsg(err, "Could not delete"));
            }
          }}
        />
      ) : null}
    </SuperFrame>
  );
}

const actionAllowed = (a: Action, r: Row) => Object.entries(a.when ?? {}).every(([k, vals]) => vals.includes(r[k] as string | boolean));

/* ------------------------------------------------------------------ */
/* Detail                                                               */
/* ------------------------------------------------------------------ */

function DetailModal({ moduleKey, mod, entity: e, row, onClose, onEdit, onDelete, onAction }: { moduleKey: string; mod: Module; entity: Entity; row: Row; onClose: () => void; onEdit: () => void; onDelete: () => void; onAction: (a: Action) => void }) {
  const refName = REF_OF[e.key];
  const related = useMemo(() => (refName ? mod.entities.flatMap((x) => x.fields.filter((f) => f.kind === "ref" && f.ref === refName).map((f) => ({ entity: x, field: f }))) : []), [mod, refName]);
  const [lists, setLists] = useState<Record<string, Row[]>>({});
  useEffect(() => {
    let live = true;
    for (const { entity } of related)
      ops<{ items: Row[] }>(`/e/${entity.key}`)
        .then((r) => live && setLists((x) => ({ ...x, [entity.key]: r.items })))
        .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [related]);
  const actions = (e.actions ?? []).filter((a) => actionAllowed(a, row));
  return (
    <SaModal
      title={`${e.label}: ${row._ref?.[e.columns[0]!.key] || str(row[e.columns[0]!.key]) || "Details"}`}
      onClose={onClose}
      wide
      footer={
        <>
          {interviewMeetingUrl(e, row) ? (
            <a className="mh-sa__btn ops-interview-start" href={interviewMeetingUrl(e, row)!} target="_blank" rel="noopener noreferrer">Start Interview</a>
          ) : null}
          {actions.map((a) => (
            <button key={a.key} type="button" className={`mh-sa__btn${a.tone ? ` mh-sa__btn--${a.tone}` : ""}`} onClick={() => onAction(a)}>
              {a.label}
            </button>
          ))}
          {e.remove ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
          {e.edit ? (
            <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={onEdit}>
              Edit
            </button>
          ) : null}
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <dl className="ops-detail">
        {e.fields
          .filter((f) => !(e.key === "standing" && f.key === "reason"))
          .map((f) => (
            <div key={f.key} className={f.kind === "textarea" ? "ops-detail--wide" : undefined}>
              <dt>{f.label}</dt>
              <dd className={f.kind === "textarea" ? "ops-pre" : undefined}>{f.kind === "textarea" ? str(row[f.key]) || "—" : display(e, row, f.key)}</dd>
            </div>
          ))}
        {e.columns
          .filter((c) => c.key.startsWith("_") && c.key !== "_name")
          .map((c) => (
            <div key={c.key}>
              <dt>{c.label}</dt>
              <dd>{display(e, row, c.key)}</dd>
            </div>
          ))}
      </dl>
      {related.map(({ entity: x, field }) => {
        const items = (lists[x.key] ?? []).filter((r) => r[field.key] === row.id);
        return (
          <div key={`${x.key}.${field.key}`} className="pm-modal-section">
            <h3>
              {x.plural} <span className="mh-sa__muted">({lists[x.key] ? items.length : "…"})</span>{" "}
              <Link className="mh-sa__btn mh-sa__btn--sm" href={`${OPS_BASE}/${moduleKey}/${x.slug}`}>
                Open {x.plural}
              </Link>
            </h3>
            {items.length ? (
              <table className="mh-sa__table lx-table">
                <tbody>
                  {items.slice(0, 8).map((r) => (
                    <tr key={r.id}>
                      {x.columns
                        .filter((c) => c.key !== field.key)
                        .slice(0, 4)
                        .map((c) => (
                          <td key={c.key}>{display(x, r, c.key)}</td>
                        ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : lists[x.key] ? (
              <p className="pm-empty">None linked yet.</p>
            ) : null}
          </div>
        );
      })}
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Create / edit form                                                   */
/* ------------------------------------------------------------------ */

const pad = (x: number) => String(x).padStart(2, "0");
function initial(f: Field): unknown {
  const d = new Date();
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (f.dflt === "$today") return day;
  if (f.dflt === "$now") return `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return f.dflt ?? (f.kind === "bool" ? false : f.kind === "list" ? [] : "");
}

function FormModal({ entity: e, row, intent, onClose, onSaved }: { entity: Entity; row: Row | null; intent?: "complete-interview"; onClose: () => void; onSaved: (out: Saved) => void }) {
  const completingInterview = intent === "complete-interview";
  const editable = e.fields.filter((f) => {
    if (completingInterview) return ["score", "recommendation", "notes"].includes(f.key);
    if (e.key === "interviews" && row && ["score", "recommendation", "notes"].includes(f.key)) return false;
    return !f.readOnly && !(row && f.createOnly) && !(!row && f.editOnly);
  });
  const fixed = row ? e.fields.filter((f) => f.readOnly || f.createOnly) : [];
  const [values, setValues] = useState<Data>(() => ({
    ...Object.fromEntries(editable.map((f) => [f.key, row ? row[f.key] : initial(f)])),
    ...(completingInterview ? { status: "Completed" } : {}),
  }));
  const [refs, setRefs] = useState<Record<string, Opt[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!editable.some((f) => f.kind === "ref")) return setRefs({});
    ops<Record<string, Opt[]>>(`/e/${e.key}/refs`)
      .then(setRefs)
      .catch((err) => setError(errMsg(err, "Could not load the options")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e.key]);
  const set = (k: string, v: unknown) => setValues((x) => ({ ...x, [k]: v }));
  const missing = editable.filter((f) => (f.required || (completingInterview && ["score", "recommendation"].includes(f.key))) && (values[f.key] === "" || values[f.key] === null || values[f.key] === undefined || (Array.isArray(values[f.key]) && !(values[f.key] as unknown[]).length)));

  const save = async () => {
    if (missing.length) return setError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
    setBusy(true);
    setError(null);
    try {
      const out = row ? await send(`/e/${e.key}/${row.id}`, "PATCH", values) : await send(`/e/${e.key}`, "POST", values);
      onSaved(out);
    } catch (err) {
      setError(errMsg(err, "Could not save"));
      setBusy(false);
    }
  };

  return (
    <SaModal
      title={completingInterview ? "Complete Interview" : `${row ? "Edit" : "Add"} ${e.label}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy || !refs} onClick={save}>
            {busy ? "Saving…" : completingInterview ? "Complete Interview" : "Save"}
          </button>
        </>
      }
    >
      {error ? <p className="ops-error" role="alert">{error}</p> : null}
      {completingInterview ? <p className="ops-hint">Enter the result after the interview. Score and recommendation are required before completion.</p> : null}
      {fixed.length ? (
        <dl className="ops-detail">
          {fixed.map((f) => (
            <div key={f.key}>
              <dt>{f.label}</dt>
              <dd>{display(e, row!, f.key)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!refs ? (
        <p className="mh-sa__muted">Loading…</p>
      ) : (
        <div className="mh-sa__grid lx-grid">
          {editable.map((f) => (
            <Control key={f.key} field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} options={f.ref ? (refs[f.ref] ?? []) : []} />
          ))}
        </div>
      )}
    </SaModal>
  );
}

function Control({ field: f, value, onChange, options }: { field: Field; value: unknown; onChange: (v: unknown) => void; options: Opt[] }) {
  const id = `ops-${f.key}`;
  let control: ReactNode;
  switch (f.kind) {
    case "textarea":
      control = <textarea id={id} className="mh-sa__input" rows={f.long ? 14 : 4} value={str(value)} onChange={(ev) => onChange(ev.target.value)} />;
      break;
    case "number":
      control = <input id={id} className="mh-sa__input" type="number" step={f.integer ? 1 : "any"} min={f.min} max={f.max} value={value === null || value === undefined ? "" : String(value)} onChange={(ev) => onChange(ev.target.value === "" ? null : ev.target.value)} />;
      break;
    case "date":
    case "time":
      control = <input id={id} className="mh-sa__input" type={f.kind} value={str(value)} onChange={(ev) => onChange(ev.target.value)} />;
      break;
    case "datetime":
      control = <input id={id} className="mh-sa__input" type="datetime-local" value={str(value).slice(0, 16)} onChange={(ev) => onChange(ev.target.value)} />;
      break;
    case "email":
    case "url":
      control = <input id={id} className="mh-sa__input" type={f.kind} value={str(value)} onChange={(ev) => onChange(ev.target.value)} />;
      break;
    case "select": {
      const v = str(value);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(ev) => onChange(ev.target.value)}>
          {!f.required || !v ? <option value="">{f.required ? "— Select —" : "— None —"}</option> : null}
          {v && !f.options?.includes(v) ? <option value={v}>{v}</option> : null}
          {(f.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "ref": {
      const v = str(value);
      const valueOf = (o: Opt) => (f.byLabel ? o.label : o.id);
      control = (
        <select id={id} className="mh-sa__input" value={v} onChange={(ev) => onChange(ev.target.value)}>
          <option value="">{f.required ? "— Select —" : "— None —"}</option>
          {v && !options.some((o) => valueOf(o) === v) ? <option value={v}>{f.byLabel ? v : "(no longer available)"}</option> : null}
          {options.map((o) => (
            <option key={o.id} value={valueOf(o)}>
              {o.label}
            </option>
          ))}
        </select>
      );
      if (!options.length) control = <>{control}<span className="lx-hint">No options yet — create them first.</span></>;
      break;
    }
    case "bool":
      return (
        <div className="mh-sa__field mh-sa__field--wide">
          <label className="mh-sa__check">
            <input id={id} type="checkbox" checked={Boolean(value)} onChange={(ev) => onChange(ev.target.checked)} /> {f.label}
          </label>
        </div>
      );
    case "list":
      control = <input id={id} className="mh-sa__input" value={Array.isArray(value) ? value.join(", ") : str(value)} onChange={(ev) => onChange(ev.target.value.split(",").map((x) => x.trimStart()))} />;
      break;
    default:
      control = <input id={id} className="mh-sa__input" type="text" value={str(value)} onChange={(ev) => onChange(ev.target.value)} />;
  }
  return (
    <div className={`mh-sa__field${f.kind === "textarea" ? " mh-sa__field--wide" : ""}`}>
      <label className="mh-sa__label" htmlFor={id}>
        {f.label}
        {f.required ? <span className="lx-req">*</span> : null}
      </label>
      {control}
      {f.hint ? <span className="lx-hint">{f.hint}</span> : null}
    </div>
  );
}

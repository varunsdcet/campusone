"use client";

import "../superadmin/superadmin.css";
import "./reporting.css";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaField, SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ApiError, api, loadSession } from "@/lib/api";

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

type Col = { key: string; label: string; numeric?: boolean };
type Meta = {
  groups: string[];
  exportTypes: string[];
  separateBy: string[];
  availableTo: string[];
  languages: string[];
  graphTypes: string[];
  datePresets: string[];
  frequencies: string[];
  weekdays: string[];
  filters: Array<{ key: string; label: string; all: string; option?: string }>;
  sources: Array<{ key: string; label: string; groups: string[]; filters: string[]; conditionsTitle: string; columns: Col[] }>;
  mail: boolean;
};
type Options = Record<string, string[]>;
type CatalogTemplate = { id: string; name: string; description: string; active: string; reportGroup: string; availableTo: string };
type Catalog = { categories: Array<{ id: string; name: string; system: boolean; templates: CatalogTemplate[] }> };
type Template = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  active: "Yes" | "No";
  separateWorkbooksBy: string;
  availableTo: string;
  language: string;
  reportGroup: string;
  exportType: string;
  source: string;
  conditionsTitle: string;
  filters: string[];
  showTotalsDefault: "Yes" | "No";
  columns: string[];
  graph: { type: string; groupBy: string; measure: string };
  lastConditions?: Record<string, string>;
};
type Cell = string | number;
type Graph = { type: string; label: string; points: Array<{ label: string; value: number }> };
type Run = {
  runId: string;
  templateId: string;
  templateName: string;
  columns: Col[];
  rows: Cell[][];
  totals: Cell[] | null;
  graph: Graph | null;
  count: number;
  shownRows: number;
  truncated: boolean;
  conditions: Record<string, string>;
  range: { from: string; to: string } | null;
  exportType: string;
  createdAt: string;
  message?: string;
};
type RunSummary = { id: string; templateId: string; templateName: string; templateExists: boolean; trigger: string; scheduleId?: string; count: number; actorName: string; range: Run["range"]; createdAt: string };
type Schedule = {
  id: string;
  templateId: string;
  templateName: string;
  conditions: Record<string, string>;
  datePreset: string;
  frequency: string;
  weekday: number;
  monthDay: number;
  time: string;
  timezone: string;
  recipients: string;
  format: string;
  startDate: string;
  endDate: string;
  active: boolean;
  nextRunAt: string | null;
  lastRunAt?: string;
  lastRunId?: string;
  lastStatus?: string;
  description: string;
  createdBy?: string;
};
type ScheduleForm = Pick<Schedule, "frequency" | "weekday" | "monthDay" | "time" | "recipients" | "format" | "startDate" | "endDate" | "datePreset">;

const rp = <T,>(path: string, init?: RequestInit) => api<T>(`/admin/heritage/reports${path}`, init ?? {}, loadSession()?.accessToken);
const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError || e instanceof Error ? e.message : fallback);
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

let metaCache: Promise<Meta> | null = null;
function useMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    metaCache ??= rp<Meta>("/meta");
    metaCache.then(setMeta).catch((e) => {
      metaCache = null;
      setError(errMsg(e, "Could not load reporting settings"));
    });
  }, []);
  return { meta, error };
}

function useOptions() {
  const [options, setOptions] = useState<Options>({});
  useEffect(() => {
    void rp<Options>("/options")
      .then(setOptions)
      .catch(() => setOptions({}));
  }, []);
  return options;
}

async function download(runId: string, format: string) {
  const out = await rp<{ filename: string; mime: string; base64: string }>(`/runs/${runId}/export?format=${encodeURIComponent(format)}`);
  const bytes = Uint8Array.from(atob(out.base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: out.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = out.filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useNotice() {
  const sp = useSearchParams();
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(sp?.get("notice") ? { tone: "success", text: sp.get("notice")! } : null);
  const node = notice ? (
    <SaNotice tone={notice.tone} onClose={() => setNotice(null)}>
      {notice.text}
    </SaNotice>
  ) : null;
  return { node, ok: (text: string) => setNotice({ tone: "success", text }), fail: (text: string) => setNotice({ tone: "error", text }) };
}

function ConfirmModal({ title, body, okLabel, onCancel, onOk }: { title: string; body: ReactNode; okLabel: string; onCancel: () => void; onOk: () => void }) {
  return (
    <SaModal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="mh-sa__btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={onOk}>
            {okLabel}
          </button>
        </>
      }
    >
      <p>{body}</p>
    </SaModal>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 1 — Run Report: reports list                                  */
/* ------------------------------------------------------------------ */

export function RunReportsList() {
  const [data, setData] = useState<Catalog | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const notice = useNotice();
  const loadRuns = () =>
    rp<{ items: RunSummary[] }>("/runs?limit=10")
      .then((r) => setRuns(r.items))
      .catch(() => setRuns([]));
  useEffect(() => {
    void rp<Catalog>("/catalog?runnable=1")
      .then(setData)
      .catch((e) => notice.fail(errMsg(e, "Could not load reports")));
    void loadRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <SuperFrame title="Run Report" breadcrumbs={["Home", "Reporting", "Run Reports"]} activeHref="/admin/reporting/run">
      <div className="rp">
        {notice.node}
        <section className="mh-sa__card">
          {!data ? (
            <p className="mh-sa__muted">Loading reports…</p>
          ) : (
            <table className="mh-sa__table rp-list">
              <thead>
                <tr>
                  <th>Report Name</th>
                  <th className="rp-list__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="rp-list__cat">
                      <td colSpan={2}>{c.name}</td>
                    </tr>
                    {c.templates.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="mh-sa__muted rp-list__empty">
                          No active reports in this category.
                        </td>
                      </tr>
                    ) : (
                      c.templates.map((t) => (
                        <tr key={t.id}>
                          <td className="rp-list__name">
                            <Link className="mh-sa__link" href={`/admin/reporting/run/${t.id}`}>
                              {t.name}
                            </Link>
                            {t.description ? <div className="mh-sa__muted rp-list__desc">{t.description}</div> : null}
                          </td>
                          <td className="rp-list__actions">
                            <Link className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary rp-run-button" href={`/admin/reporting/run/${t.id}`}>
                              Run
                            </Link>
                            <Link className="mh-sa__btn mh-sa__btn--sm" href={`/admin/reporting/run/${t.id}?schedule=1`}>
                              Schedule
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {runs.length ? (
          <RunHistory
            title="Recent runs"
            runs={runs}
            onError={notice.fail}
            onChanged={(m) => {
              notice.ok(m);
              void loadRuns();
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

function RunHistory({
  title,
  runs,
  onError,
  onChanged,
  highlight,
}: {
  title: string;
  runs: RunSummary[];
  onError: (m: string) => void;
  onChanged: (message: string) => void;
  highlight?: string | null;
}) {
  const [confirm, setConfirm] = useState<RunSummary | null>(null);
  return (
    <section className="mh-sa__card">
      <div className="mh-sa__card-head">
        <h2>{title}</h2>
      </div>
      <div className="mh-sa__table-wrap">
        <table className="mh-sa__table">
          <thead>
            <tr>
              <th>Run On</th>
              <th>Report</th>
              <th>Trigger</th>
              <th>Dates</th>
              <th>Rows</th>
              <th>Run By</th>
              <th className="mh-sa__col-action">Download</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={highlight === r.id ? "rp-row--hl" : undefined}>
                <td>{when(r.createdAt)}</td>
                <td>
                  {r.templateExists ? (
                    <Link className="mh-sa__link" href={`/admin/reporting/run/${r.templateId}?run=${r.id}`}>
                      {r.templateName}
                    </Link>
                  ) : (
                    <span title="This report template has been deleted">{r.templateName} (deleted)</span>
                  )}
                </td>
                <td>{r.trigger === "schedule" ? "Scheduled" : "Manual"}</td>
                <td>{r.range ? `${r.range.from} → ${r.range.to}` : "All dates"}</td>
                <td>{r.count}</td>
                <td>{r.actorName}</td>
                <td className="rp-nowrap">
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => download(r.id, "Excel").catch((e) => onError(errMsg(e, "Download failed")))}>
                    Excel
                  </button>{" "}
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => download(r.id, "CSV").catch((e) => onError(errMsg(e, "Download failed")))}>
                    CSV
                  </button>{" "}
                  <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm(r)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {runs.length === 0 ? (
              <tr>
                <td colSpan={7} className="mh-sa__empty-cell">
                  No runs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {confirm ? (
        <ConfirmModal
          title="Remove report run"
          body={`Remove the ${confirm.templateName} run from ${when(confirm.createdAt)} from the history? Its export will no longer be downloadable.`}
          okLabel="Remove Run"
          onCancel={() => setConfirm(null)}
          onOk={() => {
            const r = confirm;
            setConfirm(null);
            rp<{ message: string }>(`/runs/${r.id}`, { method: "DELETE" })
              .then((out) => onChanged(out.message))
              .catch((e) => onError(errMsg(e, "Remove failed")));
          }}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 2 / 3 — Run Report: conditions + global settings + output    */
/* ------------------------------------------------------------------ */

function ConditionFields({ meta, filters, values, options, onChange }: { meta: Meta; filters: string[]; values: Record<string, string>; options: Options; onChange: (key: string, v: string) => void }) {
  const ordered = meta.filters.filter((f) => filters.includes(f.key));
  if (!ordered.length) return <p className="mh-sa__muted">This report has no conditions.</p>;
  return (
    <div className="rp-conditions">
      {ordered.map((f) => (
        <label key={f.key} className="rp-condition">
          <span className="rp-condition__label">{f.label}</span>
          <select className="mh-sa__input" value={values[f.key] ?? f.all} onChange={(e) => onChange(f.key, e.target.value)}>
            {f.key === "showTotals" ? (
              <>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </>
            ) : (
              <>
                <option value={f.all}>{f.all}</option>
                {(options[f.option ?? ""] ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
                {values[f.key] && values[f.key] !== f.all && !(options[f.option ?? ""] ?? []).includes(values[f.key]!) ? <option value={values[f.key]}>{values[f.key]}</option> : null}
              </>
            )}
          </select>
        </label>
      ))}
    </div>
  );
}

const emptySchedule = (): ScheduleForm => ({ frequency: "Weekly", weekday: 1, monthDay: 1, time: "08:00", recipients: "", format: "Excel", startDate: "", endDate: "", datePreset: "None" });

function ScheduleFields({ meta, value, onChange, showPreset }: { meta: Meta; value: ScheduleForm; onChange: (v: ScheduleForm) => void; showPreset: boolean }) {
  const set = <K extends keyof ScheduleForm>(k: K, v: ScheduleForm[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="mh-sa__grid rp-schedule">
      <SaField label="Frequency">
        <select className="mh-sa__input" value={value.frequency} onChange={(e) => set("frequency", e.target.value)}>
          {meta.frequencies.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </SaField>
      {value.frequency === "Weekly" ? (
        <SaField label="Day of Week">
          <select className="mh-sa__input" value={value.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
            {meta.weekdays.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </SaField>
      ) : null}
      {value.frequency === "Monthly" ? (
        <SaField label="Day of Month">
          <select className="mh-sa__input" value={value.monthDay} onChange={(e) => set("monthDay", Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </SaField>
      ) : null}
      <SaField label="Run Time">
        <input className="mh-sa__input" type="time" value={value.time} onChange={(e) => set("time", e.target.value)} />
      </SaField>
      <SaField label="Export Format">
        <select className="mh-sa__input" value={value.format} onChange={(e) => set("format", e.target.value)}>
          {meta.exportTypes.map((f) => (
            <option key={f}>{f}</option>
          ))}
        </select>
      </SaField>
      {showPreset ? (
        <SaField label="Report Dates on Each Run">
          <select className="mh-sa__input" value={value.datePreset} onChange={(e) => set("datePreset", e.target.value)}>
            <option value="None">All dates</option>
            {meta.datePresets
              .filter((p) => p !== "Custom")
              .map((p) => (
                <option key={p}>{p}</option>
              ))}
          </select>
        </SaField>
      ) : null}
      <SaField label="Start Date">
        <input className="mh-sa__input" type="date" value={value.startDate} onChange={(e) => set("startDate", e.target.value)} />
      </SaField>
      <SaField label="End Date (optional)">
        <input className="mh-sa__input" type="date" value={value.endDate} onChange={(e) => set("endDate", e.target.value)} />
      </SaField>
      <SaField label="E-mail Recipients" wide hint={meta.mail ? " (comma-separated)" : " (mail is not configured; runs are kept in Scheduled Reports)"}>
        <input className="mh-sa__input" value={value.recipients} placeholder="registrar@heritage.edu, finance@heritage.edu" onChange={(e) => set("recipients", e.target.value)} />
      </SaField>
    </div>
  );
}

export function RunReportScreen({ templateId }: { templateId: string }) {
  const sp = useSearchParams();
  const { meta, error: metaError } = useMeta();
  const options = useOptions();
  const notice = useNotice();
  const [template, setTemplate] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [datesOn, setDatesOn] = useState(false);
  const [dates, setDates] = useState({ preset: "This Month", from: "", to: "" });
  const [scheduleOn, setScheduleOn] = useState(sp?.get("schedule") === "1");
  const [schedule, setSchedule] = useState<ScheduleForm>(emptySchedule);
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void rp<Template>(`/templates/${templateId}`)
      .then((t) => {
        setTemplate(t);
        const init: Record<string, string> = {};
        for (const f of t.filters) init[f] = t.lastConditions?.[f] ?? (f === "showTotals" ? t.showTotalsDefault : "");
        setValues(init);
      })
      .catch((e) => notice.fail(errMsg(e, "Could not load report")));
    const runId = sp?.get("run");
    if (runId)
      void rp<Run>(`/runs/${runId}`)
        .then(setRun)
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  async function submit() {
    if (!template) return;
    setBusy(true);
    try {
      const conditions: Record<string, string> = {};
      for (const f of meta?.filters ?? []) if (template.filters.includes(f.key)) conditions[f.key] = values[f.key] || f.all;
      const out = await rp<Run>(`/templates/${template.id}/run`, {
        method: "POST",
        body: JSON.stringify({
          conditions,
          save: true,
          dates: { enabled: datesOn, ...dates },
          schedule: { enabled: scheduleOn, ...schedule },
        }),
      });
      setRun(out);
      notice.ok(out.message ?? "Report generated");
      if (scheduleOn) setScheduleOn(false);
      setTimeout(() => document.getElementById("rp-output")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      notice.fail(errMsg(e, "Report failed"));
    } finally {
      setBusy(false);
    }
  }

  const title = template ? `Run Report — ${template.name}` : "Run Report";
  return (
    <SuperFrame title={title} breadcrumbs={["Home", "Reporting", "Run Reports", template?.name ?? "Report"]} activeHref="/admin/reporting/run">
      <div className="rp">
        {metaError ? <SaNotice tone="error">{metaError}</SaNotice> : null}
        {notice.node}
        {!template || !meta ? (
          <p className="mh-sa__muted">Loading report…</p>
        ) : (
          <>
            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Report Conditions: {template.conditionsTitle}</h2>
                <Link className="mh-sa__link" href="/admin/reporting/run">
                  Back to reports
                </Link>
              </div>
              {template.description ? <p className="mh-sa__muted">{template.description}</p> : null}
              <ConditionFields meta={meta} filters={template.filters} values={values} options={options} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} />
            </section>

            <section className="mh-sa__card">
              <div className="mh-sa__card-head">
                <h2>Global Report Settings</h2>
              </div>
              <label className="mh-sa__check">
                <input type="checkbox" checked={datesOn} onChange={(e) => setDatesOn(e.target.checked)} /> Specify Dates for this Report
              </label>
              {datesOn ? (
                <div className="mh-sa__grid rp-indent">
                  <SaField label="Date Range">
                    <select className="mh-sa__input" value={dates.preset} onChange={(e) => setDates((d) => ({ ...d, preset: e.target.value }))}>
                      {meta.datePresets.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </SaField>
                  {dates.preset === "Custom" ? (
                    <>
                      <SaField label="From">
                        <input className="mh-sa__input" type="date" value={dates.from} onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))} />
                      </SaField>
                      <SaField label="To">
                        <input className="mh-sa__input" type="date" value={dates.to} onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))} />
                      </SaField>
                    </>
                  ) : null}
                </div>
              ) : null}
              <label className="mh-sa__check">
                <input type="checkbox" checked={scheduleOn} onChange={(e) => setScheduleOn(e.target.checked)} /> Create a Schedule for this Report
              </label>
              {scheduleOn ? (
                <div className="rp-indent">
                  <ScheduleFields meta={meta} value={schedule} onChange={setSchedule} showPreset={!datesOn || dates.preset === "Custom"} />
                </div>
              ) : null}
              <div className="mh-sa__actions">
                <button type="button" className="mh-sa__btn mh-sa__btn--primary rp-run-button rp-upper" disabled={busy} onClick={() => void submit()}>
                  {busy ? "Running…" : "Save / Run Report"}
                </button>
              </div>
            </section>

            {run ? <RunOutput run={run} onError={notice.fail} /> : null}
          </>
        )}
      </div>
    </SuperFrame>
  );
}

function RunOutput({ run, onError }: { run: Run; onError: (m: string) => void }) {
  return (
    <section className="mh-sa__card" id="rp-output">
      <div className="mh-sa__card-head">
        <div>
          <h2>{run.templateName}</h2>
          <span className="mh-sa__muted">
            {run.count} row{run.count === 1 ? "" : "s"} · generated {when(run.createdAt)}
            {run.range ? ` · ${run.range.from} → ${run.range.to}` : ""}
          </span>
        </div>
        <div className="mh-sa__card-actions">
          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" onClick={() => download(run.runId, "Excel").catch((e) => onError(errMsg(e, "Download failed")))}>
            Export Excel
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => download(run.runId, "CSV").catch((e) => onError(errMsg(e, "Download failed")))}>
            Export CSV
          </button>
        </div>
      </div>
      <div className="rp-applied">
        {Object.entries(run.conditions).map(([k, v]) => (
          <span key={k} className="mh-sa__pill">
            {k === "showTotals" ? `Totals: ${v}` : v}
          </span>
        ))}
      </div>
      {run.graph && run.graph.points.length ? <ReportGraph graph={run.graph} /> : null}
      {run.shownRows < run.count || run.truncated ? (
        <p className="mh-sa__muted">
          Showing the first {run.shownRows} of {run.count} rows. {run.truncated ? "The export contains the first 5,000 rows." : "Export to see every row."}
        </p>
      ) : null}
      <div className="mh-sa__table-wrap rp-output">
        <table className="mh-sa__table">
          <thead>
            <tr>
              {run.columns.map((c) => (
                <th key={c.key} className={c.numeric ? "rp-num" : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {run.rows.length === 0 ? (
              <tr>
                <td colSpan={run.columns.length} className="mh-sa__empty-cell">
                  No records match these conditions.
                </td>
              </tr>
            ) : (
              run.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={run.columns[j]?.numeric ? "rp-num" : undefined}>
                      {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v || "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {run.totals ? (
            <tfoot>
              <tr className="rp-total">
                {run.totals.map((v, j) => (
                  <td key={j} className={run.columns[j]?.numeric ? "rp-num" : undefined}>
                    {typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </section>
  );
}

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#475569"];

function ReportGraph({ graph }: { graph: Graph }) {
  const max = Math.max(...graph.points.map((p) => p.value), 1);
  const total = graph.points.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <figure className="rp-graph" aria-label={graph.label}>
      <figcaption>{graph.label}</figcaption>
      {graph.type === "Pie" ? (
        <div className="rp-pie">
          <svg viewBox="-1 -1 2 2" width="180" height="180" role="img">
            {(() => {
              let angle = -Math.PI / 2;
              return graph.points.map((p, i) => {
                const slice = (p.value / total) * Math.PI * 2;
                const x1 = Math.cos(angle);
                const y1 = Math.sin(angle);
                angle += slice;
                const x2 = Math.cos(angle);
                const y2 = Math.sin(angle);
                if (graph.points.length === 1) return <circle key={p.label} r="1" fill={PALETTE[0]} />;
                return <path key={p.label} d={`M0 0 L${x1} ${y1} A1 1 0 ${slice > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`} fill={PALETTE[i % PALETTE.length]} />;
              });
            })()}
          </svg>
          <ul className="rp-legend">
            {graph.points.map((p, i) => (
              <li key={p.label}>
                <i style={{ background: PALETTE[i % PALETTE.length] }} />
                {p.label} — {p.value.toLocaleString()} ({Math.round((p.value / total) * 100)}%)
              </li>
            ))}
          </ul>
        </div>
      ) : graph.type === "Line" ? (
        <svg className="rp-line" viewBox={`0 0 ${Math.max(graph.points.length - 1, 1) * 80 + 40} 160`} role="img">
          <polyline
            fill="none"
            stroke={PALETTE[0]}
            strokeWidth="2.5"
            points={graph.points.map((p, i) => `${20 + i * 80},${140 - (p.value / max) * 120}`).join(" ")}
          />
          {graph.points.map((p, i) => (
            <g key={p.label}>
              <circle cx={20 + i * 80} cy={140 - (p.value / max) * 120} r="3.5" fill={PALETTE[0]} />
              <text x={20 + i * 80} y={155} fontSize="9" textAnchor="middle">
                {p.label.slice(0, 14)}
              </text>
              <text x={20 + i * 80} y={132 - (p.value / max) * 120} fontSize="9" textAnchor="middle">
                {p.value}
              </text>
            </g>
          ))}
        </svg>
      ) : (
        <div className="rp-bars">
          {graph.points.map((p, i) => (
            <div key={p.label} className="rp-bar">
              <span className="rp-bar__label" title={p.label}>
                {p.label}
              </span>
              <span className="rp-bar__track">
                <span className="rp-bar__fill" style={{ width: `${(p.value / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
              </span>
              <span className="rp-bar__value">{p.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Scheduled Reports                                                    */
/* ------------------------------------------------------------------ */

export function ScheduledReports() {
  const sp = useSearchParams();
  const highlight = sp?.get("run") ?? null;
  const { meta } = useMeta();
  const options = useOptions();
  const notice = useNotice();
  const [items, setItems] = useState<Schedule[] | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [editing, setEditing] = useState<{ schedule: Schedule; form: ScheduleForm; conditions: Record<string, string>; filters: string[] } | null>(null);
  const [confirm, setConfirm] = useState<Schedule | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([rp<{ items: Schedule[] }>("/schedules"), rp<{ items: RunSummary[] }>("/runs?limit=50")]);
      setItems(s.items);
      setRuns(r.items.filter((x) => x.trigger === "schedule" || x.id === highlight));
    } catch (e) {
      notice.fail(errMsg(e, "Could not load scheduled reports"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight]);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<{ message: string }>) {
    setBusy(true);
    try {
      const r = await fn();
      notice.ok(r.message);
      await load();
    } catch (e) {
      notice.fail(errMsg(e, "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  async function openEdit(s: Schedule) {
    try {
      const t = await rp<Template>(`/templates/${s.templateId}`);
      setEditing({
        schedule: s,
        form: { frequency: s.frequency, weekday: s.weekday, monthDay: s.monthDay, time: s.time, recipients: s.recipients, format: s.format, startDate: s.startDate, endDate: s.endDate, datePreset: s.datePreset },
        conditions: { ...s.conditions },
        filters: t.filters,
      });
    } catch (e) {
      notice.fail(errMsg(e, "Could not open schedule"));
    }
  }

  return (
    <SuperFrame title="Scheduled Reports" breadcrumbs={["Home", "Reporting", "Scheduled Reports"]} activeHref="/admin/reporting/scheduled">
      <div className="rp">
        {notice.node}
        <section className="mh-sa__card">
          <div className="mh-sa__card-head">
            <h2>Schedules</h2>
            <Link className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary" href="/admin/reporting/run">
              Schedule a report
            </Link>
          </div>
          {!items ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mh-sa__muted">
              No scheduled reports yet. Open <Link href="/admin/reporting/run">Run Reports</Link>, choose a report and tick <em>Create a Schedule for this Report</em>.
            </p>
          ) : (
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Report</th>
                    <th>Schedule</th>
                    <th>Next Run</th>
                    <th>Last Run</th>
                    <th>Recipients</th>
                    <th>Format</th>
                    <th>Status</th>
                    <th className="mh-sa__col-action">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link className="mh-sa__link" href={`/admin/reporting/run/${s.templateId}`}>
                          {s.templateName}
                        </Link>
                        {s.createdBy ? <div className="mh-sa__muted rp-list__desc">by {s.createdBy}</div> : null}
                      </td>
                      <td>
                        {s.description}
                        {s.datePreset !== "None" ? <div className="mh-sa__muted rp-list__desc">Dates: {s.datePreset}</div> : null}
                      </td>
                      <td>{s.active ? when(s.nextRunAt) : "—"}</td>
                      <td>
                        {when(s.lastRunAt)}
                        {s.lastStatus ? <div className="mh-sa__muted rp-list__desc">{s.lastStatus}</div> : null}
                      </td>
                      <td className="rp-wrap">{s.recipients || "—"}</td>
                      <td>{s.format}</td>
                      <td>
                        <span className={`mh-sa__pill${s.active ? " mh-sa__pill--ok" : ""}`}>{s.active ? "Active" : "Paused"}</span>
                      </td>
                      <td className="rp-nowrap">
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm rp-run-button" disabled={busy} onClick={() => void act(() => rp(`/schedules/${s.id}/run-now`, { method: "POST" }))}>
                          Run Now
                        </button>{" "}
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={busy} onClick={() => void openEdit(s)}>
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="mh-sa__btn mh-sa__btn--sm"
                          disabled={busy}
                          onClick={() => void act(() => rp(`/schedules/${s.id}`, { method: "PATCH", body: JSON.stringify({ active: !s.active }) }))}
                        >
                          {s.active ? "Pause" : "Resume"}
                        </button>{" "}
                        <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" disabled={busy} onClick={() => setConfirm(s)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <RunHistory
          title="Scheduled run history"
          runs={runs}
          onError={notice.fail}
          onChanged={(m) => {
            notice.ok(m);
            void load();
          }}
          highlight={highlight}
        />

        {editing && meta ? (
          <SaModal
            title={`Edit Schedule — ${editing.schedule.templateName}`}
            onClose={() => setEditing(null)}
            wide
            footer={
              <>
                <button type="button" className="mh-sa__btn" onClick={() => setEditing(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="mh-sa__btn mh-sa__btn--primary"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      const r = await rp<{ message: string }>(`/schedules/${editing.schedule.id}`, { method: "PATCH", body: JSON.stringify({ ...editing.form, conditions: editing.conditions }) });
                      setEditing(null);
                      return r;
                    })
                  }
                >
                  Save Schedule
                </button>
              </>
            }
          >
            <h3 className="rp-subhead">Report Conditions</h3>
            <ConditionFields meta={meta} filters={editing.filters} values={editing.conditions} options={options} onChange={(k, v) => setEditing((e) => (e ? { ...e, conditions: { ...e.conditions, [k]: v } } : e))} />
            <h3 className="rp-subhead">Schedule</h3>
            <ScheduleFields meta={meta} value={editing.form} onChange={(form) => setEditing((e) => (e ? { ...e, form } : e))} showPreset />
          </SaModal>
        ) : null}
        {confirm ? (
          <ConfirmModal
            title="Delete schedule"
            body={`Delete the schedule for "${confirm.templateName}"? Past runs stay in the history.`}
            okLabel="Delete Schedule"
            onCancel={() => setConfirm(null)}
            onOk={() => {
              const s = confirm;
              setConfirm(null);
              void act(() => rp(`/schedules/${s.id}`, { method: "DELETE" }));
            }}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 4 — Manage Report Templates                                   */
/* ------------------------------------------------------------------ */

export function ManageReportTemplates() {
  const router = useRouter();
  const notice = useNotice();
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [data, setData] = useState<Catalog | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "category" | "template"; id: string; name: string; count?: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await rp<Catalog>(`/catalog${applied ? `?q=${encodeURIComponent(applied)}` : ""}`));
    } catch (e) {
      notice.fail(errMsg(e, "Could not load report templates"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied]);
  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    try {
      const r = await rp<{ message: string }>(`/${c.kind === "category" ? "categories" : "templates"}/${c.id}`, { method: "DELETE" });
      notice.ok(r.message);
      await load();
    } catch (e) {
      notice.fail(errMsg(e, "Delete failed"));
    }
  }

  return (
    <SuperFrame
      title="Manage Report Templates"
      breadcrumbs={["Home", "Reporting", "Report Templates"]}
      activeHref="/admin/reporting/templates"
      actions={
        <>
          <Link className="mh-sa__btn" href="/admin/reporting/templates/categories/new">
            Create Report Category
          </Link>
          <Link className="mh-sa__btn mh-sa__btn--primary" href="/admin/reporting/templates/new">
            Create Report Template
          </Link>
        </>
      }
    >
      <div className="rp">
        {notice.node}
        <section className="mh-sa__card">
          <form
            className="rp-search"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(q.trim());
            }}
          >
            <SaField label="Report Name">
              <input className="mh-sa__input" placeholder="Enter Report Name" value={q} onChange={(e) => setQ(e.target.value)} />
            </SaField>
            <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
              Search Templates
            </button>
            {applied ? (
              <button
                type="button"
                className="mh-sa__btn"
                onClick={() => {
                  setQ("");
                  setApplied("");
                }}
              >
                Clear
              </button>
            ) : null}
          </form>
        </section>
        <section className="mh-sa__card">
          {!data ? (
            <p className="mh-sa__muted">Loading…</p>
          ) : data.categories.length === 0 ? (
            <p className="mh-sa__muted">No report templates match “{applied}”.</p>
          ) : (
            <table className="mh-sa__table rp-list">
              <thead>
                <tr>
                  <th>Report Template Name</th>
                  <th className="rp-list__actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <Fragment key={c.id}>
                    <tr className="rp-list__cat">
                      <td>{c.name}</td>
                      <td className="rp-list__actions">
                        {c.system ? null : (
                          <>
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`/admin/reporting/templates/categories/edit?id=${c.id}`)}>
                              Edit
                            </button>
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ kind: "category", id: c.id, name: c.name, count: c.templates.length })}>
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {c.templates.map((t) => (
                      <tr key={t.id}>
                        <td className="rp-list__name">
                          {t.name}
                          {t.active === "No" ? <span className="mh-sa__pill rp-inactive">Inactive</span> : null}
                        </td>
                        <td className="rp-list__actions">
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--primary rp-run-button" disabled={t.active === "No"} onClick={() => router.push(`/admin/reporting/run/${t.id}`)}>
                            Run
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => router.push(`/admin/reporting/templates/edit?id=${t.id}`)}>
                            Edit
                          </button>
                          <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ kind: "template", id: t.id, name: t.name })}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>
        {confirm ? (
          <ConfirmModal
            title={confirm.kind === "category" ? "Delete report category" : "Delete report template"}
            body={
              confirm.kind === "category"
                ? `Delete the category "${confirm.name}"?${confirm.count ? ` Its ${confirm.count} report(s) will move to Miscellaneous.` : ""}`
                : `Delete the report "${confirm.name}"? Any schedules for it are removed; past runs stay in the history.`
            }
            okLabel={confirm.kind === "category" ? "Delete Category" : "Delete Report"}
            onCancel={() => setConfirm(null)}
            onOk={() => void remove()}
          />
        ) : null}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 5 / 6 — Create / Edit Report Category                        */
/* ------------------------------------------------------------------ */

export function ReportCategoryForm({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const notice = useNotice();
  const [name, setName] = useState("");
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(mode === "create");

  useEffect(() => {
    if (mode !== "edit" || !id) return;
    void rp<{ name: string; system: boolean }>(`/categories/${id}`)
      .then((c) => {
        setName(c.name);
        setOriginal(c.name);
        setLoaded(true);
        if (c.system) notice.fail(`"${c.name}" is the default category and cannot be renamed.`);
      })
      .catch((e) => notice.fail(errMsg(e, "Could not load category")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return notice.fail("Category Name is required");
    setBusy(true);
    try {
      const r = await rp<{ message: string }>(mode === "create" ? "/categories" : `/categories/${id}`, { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify({ name }) });
      router.push(`/admin/reporting/templates?notice=${encodeURIComponent(r.message)}`);
    } catch (err) {
      notice.fail(errMsg(err, "Save failed"));
      setBusy(false);
    }
  }

  const title = mode === "create" ? "Create Report Category" : `EDIT REPORT CATEGORY: ${original.toUpperCase()}`;
  return (
    <SuperFrame title={title} breadcrumbs={["Home", "Reporting", "Report Templates", mode === "create" ? "Create Report Category" : "Edit Report Category"]} activeHref="/admin/reporting/templates">
      <div className="rp">
        {notice.node}
        {!loaded ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <form className="mh-sa__card mh-sa__form--narrow" onSubmit={(e) => void save(e)}>
            <div className="mh-sa__card-head">
              <h2>Category Details</h2>
            </div>
            <label className="mh-sa__field">
              <span className="mh-sa__label">Category Name</span>
              <input className="mh-sa__input" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus />
              <span className="rp-lang">English</span>
            </label>
            <div className="mh-sa__actions">
              <Link className="mh-sa__btn" href="/admin/reporting/templates">
                Cancel
              </Link>
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                Save Category
              </button>
            </div>
          </form>
        )}
      </div>
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screens 7 / 8 — Create / Edit Report Template (5-step builder)       */
/* ------------------------------------------------------------------ */

type Draft = Omit<Template, "id" | "categoryName" | "lastConditions">;
type Step = "category" | "filters" | "data" | "graphs" | "settings";

function defaultsFor(meta: Meta, group: string, sourceKey?: string): Pick<Draft, "reportGroup" | "source" | "filters" | "columns" | "conditionsTitle" | "graph"> {
  const source = meta.sources.find((s) => s.key === sourceKey && s.groups.includes(group)) ?? meta.sources.find((s) => s.groups.includes(group))!;
  return {
    reportGroup: group,
    source: source.key,
    filters: source.filters,
    columns: source.columns.map((c) => c.key),
    conditionsTitle: source.conditionsTitle,
    graph: { type: "None", groupBy: "", measure: "" },
  };
}

export function ReportTemplateEditor({ mode }: { mode: "create" | "edit" }) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = sp?.get("id") ?? "";
  const { meta, error: metaError } = useMeta();
  const notice = useNotice();
  const [cats, setCats] = useState<Catalog["categories"]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState("");
  const [open, setOpen] = useState<Set<Step>>(new Set([mode === "create" ? "category" : "settings"]));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void rp<Catalog>("/catalog")
      .then((c) => setCats(c.categories))
      .catch(() => setCats([]));
  }, []);

  useEffect(() => {
    if (!meta) return;
    if (mode === "edit") {
      if (!id) return;
      void rp<Template>(`/templates/${id}`)
        .then((t) => {
          const { id: _id, categoryName: _c, lastConditions: _l, ...rest } = t;
          void _id;
          void _c;
          void _l;
          setDraft(rest);
          setOriginal(t.name);
        })
        .catch((e) => notice.fail(errMsg(e, "Could not load template")));
    } else {
      setDraft({
        name: "",
        description: "",
        categoryId: "",
        active: "Yes",
        separateWorkbooksBy: "Report Type",
        availableTo: "All Staff",
        language: "English",
        exportType: "Excel",
        showTotalsDefault: "No",
        ...defaultsFor(meta, meta.groups[0]!),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, mode, id]);

  useEffect(() => {
    if (draft && !draft.categoryId && cats.length) setDraft((d) => (d ? { ...d, categoryId: cats.find((c) => c.system)?.id ?? cats[0]!.id } : d));
  }, [cats, draft]);

  const source = useMemo(() => meta?.sources.find((s) => s.key === draft?.source), [meta, draft?.source]);
  const toggle = (s: Step) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) {
      setOpen((o) => new Set([...o, "settings"]));
      return notice.fail("Report Name is required (Settings)");
    }
    if (!draft.columns.length) {
      setOpen((o) => new Set([...o, "data"]));
      return notice.fail("Select at least one column in the Data step");
    }
    setBusy(true);
    try {
      const r = await rp<{ message: string }>(mode === "create" ? "/templates" : `/templates/${id}`, { method: mode === "create" ? "POST" : "PATCH", body: JSON.stringify(draft) });
      router.push(`/admin/reporting/templates?notice=${encodeURIComponent(r.message)}`);
    } catch (e) {
      notice.fail(errMsg(e, "Save failed"));
      setBusy(false);
    }
  }

  const title = mode === "create" ? "Create Report Template" : `EDIT REPORT TEMPLATE: ${original.toUpperCase()}`;
  const section = (step: Step, heading: string, body: ReactNode, summary: string) => (
    <section className={`mh-sa__card rp-step${open.has(step) ? " is-open" : ""}`}>
      <div className="rp-step__head">
        <h2>{heading}</h2>
        {!open.has(step) ? <span className="mh-sa__muted rp-step__summary">{summary}</span> : null}
        <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => toggle(step)} aria-expanded={open.has(step)}>
          {open.has(step) ? "Done" : "Edit"}
        </button>
      </div>
      {open.has(step) ? <div className="rp-step__body">{body}</div> : null}
    </section>
  );

  return (
    <SuperFrame title={title} breadcrumbs={["Home", "Reporting", "Report Templates", mode === "create" ? "Create Report Template" : "Edit Report Template"]} activeHref="/admin/reporting/templates">
      <div className="rp">
        {metaError ? <SaNotice tone="error">{metaError}</SaNotice> : null}
        {notice.node}
        {!meta || !draft || !source ? (
          <p className="mh-sa__muted">Loading…</p>
        ) : (
          <>
            {section(
              "category",
              "Category",
              <>
                <div className="rp-groups" role="group" aria-label="Report category">
                  {meta.groups.map((g) => (
                    <button key={g} type="button" className={`rp-group${draft.reportGroup === g ? " is-active" : ""}`} onClick={() => setDraft((d) => (d ? { ...d, ...defaultsFor(meta, g) } : d))}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="mh-sa__grid">
                  <SaField label="Report Data">
                    <select className="mh-sa__input" value={draft.source} onChange={(e) => setDraft((d) => (d ? { ...d, ...defaultsFor(meta, d.reportGroup, e.target.value) } : d))}>
                      {meta.sources
                        .filter((s) => s.groups.includes(draft.reportGroup))
                        .map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                    </select>
                  </SaField>
                  <SaField label="Export Type">
                    <select className="mh-sa__input" value={draft.exportType} onChange={(e) => set("exportType", e.target.value)}>
                      {meta.exportTypes.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </SaField>
                </div>
              </>,
              `${draft.reportGroup} · ${source.label} · ${draft.exportType}`,
            )}
            {section(
              "filters",
              "Filters",
              <>
                <div className="mh-sa__grid">
                  <SaField label="Report Conditions Heading">
                    <input className="mh-sa__input" value={draft.conditionsTitle} onChange={(e) => set("conditionsTitle", e.target.value)} />
                  </SaField>
                  <SaField label="Show Totals (default)">
                    <select className="mh-sa__input" value={draft.showTotalsDefault} onChange={(e) => set("showTotalsDefault", e.target.value as "Yes" | "No")}>
                      <option>No</option>
                      <option>Yes</option>
                    </select>
                  </SaField>
                </div>
                <p className="mh-sa__muted">Conditions shown on the Run Report screen:</p>
                <div className="rp-checks">
                  {meta.filters
                    .filter((f) => source.filters.includes(f.key))
                    .map((f) => (
                      <label key={f.key} className="mh-sa__check">
                        <input
                          type="checkbox"
                          checked={draft.filters.includes(f.key)}
                          onChange={(e) => set("filters", e.target.checked ? [...draft.filters, f.key] : draft.filters.filter((x) => x !== f.key))}
                        />
                        {f.label}
                      </label>
                    ))}
                </div>
              </>,
              `${draft.filters.length} condition(s)`,
            )}
            {section(
              "data",
              "Data",
              <DataStep columns={source.columns} selected={draft.columns} onChange={(cols) => set("columns", cols)} />,
              `${draft.columns.length} of ${source.columns.length} column(s)`,
            )}
            {section(
              "graphs",
              "Graphs: Visual output of your report",
              <div className="mh-sa__grid">
                <SaField label="Graph Type">
                  <select
                    className="mh-sa__input"
                    value={draft.graph.type}
                    onChange={(e) => set("graph", { ...draft.graph, type: e.target.value, groupBy: e.target.value === "None" ? "" : draft.graph.groupBy || draft.columns[0] || "" })}
                  >
                    {meta.graphTypes.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </SaField>
                {draft.graph.type !== "None" ? (
                  <>
                    <SaField label="Group By">
                      <select className="mh-sa__input" value={draft.graph.groupBy} onChange={(e) => set("graph", { ...draft.graph, groupBy: e.target.value })}>
                        {source.columns
                          .filter((c) => !c.numeric)
                          .map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                      </select>
                    </SaField>
                    <SaField label="Measure">
                      <select className="mh-sa__input" value={draft.graph.measure} onChange={(e) => set("graph", { ...draft.graph, measure: e.target.value })}>
                        <option value="">Count of rows</option>
                        {source.columns
                          .filter((c) => c.numeric)
                          .map((c) => (
                            <option key={c.key} value={c.key}>
                              Sum of {c.label}
                            </option>
                          ))}
                      </select>
                    </SaField>
                  </>
                ) : null}
              </div>,
              draft.graph.type === "None" ? "No graph" : `${draft.graph.type} by ${source.columns.find((c) => c.key === draft.graph.groupBy)?.label ?? "—"}`,
            )}
            {section(
              "settings",
              `Settings: ${draft.name.trim() || "New Report"}`,
              <div className="mh-sa__grid">
                <SaField label="Report Name" wide>
                  <input className="mh-sa__input" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={120} />
                </SaField>
                <SaField label="Report Description" wide>
                  <textarea className="mh-sa__input" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} />
                </SaField>
                <SaField label="Report Category">
                  <select className="mh-sa__input" value={draft.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </SaField>
                <SaField label="Report Active">
                  <select className="mh-sa__input" value={draft.active} onChange={(e) => set("active", e.target.value as "Yes" | "No")}>
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </SaField>
                <SaField label="Separate Workbooks By">
                  <select className="mh-sa__input" value={draft.separateWorkbooksBy} onChange={(e) => set("separateWorkbooksBy", e.target.value)}>
                    {meta.separateBy.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </SaField>
                <SaField label="Report Available To">
                  <select className="mh-sa__input" value={draft.availableTo} onChange={(e) => set("availableTo", e.target.value)}>
                    {meta.availableTo.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </SaField>
                <SaField label="Report Language">
                  <select className="mh-sa__input" value={draft.language} onChange={(e) => set("language", e.target.value)}>
                    {meta.languages.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </SaField>
              </div>,
              `${draft.name || "Unnamed"} · ${cats.find((c) => c.id === draft.categoryId)?.name ?? ""}`,
            )}
            <div className="mh-sa__actions">
              <Link className="mh-sa__btn" href="/admin/reporting/templates">
                Cancel
              </Link>
              <button type="button" className="mh-sa__btn mh-sa__btn--primary" disabled={busy} onClick={() => void save()}>
                Save Report Template
              </button>
            </div>
          </>
        )}
      </div>
    </SuperFrame>
  );
}

function DataStep({ columns, selected, onChange }: { columns: Col[]; selected: string[]; onChange: (cols: string[]) => void }) {
  const move = (key: string, dir: -1 | 1) => {
    const i = selected.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const unselected = columns.filter((c) => !selected.includes(c.key));
  return (
    <div className="rp-data">
      <div>
        <h3 className="rp-subhead">Columns in the report (in order)</h3>
        {selected.length === 0 ? <p className="mh-sa__muted">No columns selected.</p> : null}
        <ol className="rp-cols">
          {selected.map((key, i) => {
            const col = columns.find((c) => c.key === key);
            if (!col) return null;
            return (
              <li key={key}>
                <span>{col.label}</span>
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={i === 0} onClick={() => move(key, -1)} aria-label={`Move ${col.label} up`}>
                  ↑
                </button>
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" disabled={i === selected.length - 1} onClick={() => move(key, 1)} aria-label={`Move ${col.label} down`}>
                  ↓
                </button>
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => onChange(selected.filter((k) => k !== key))}>
                  Remove
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <div>
        <h3 className="rp-subhead">Available columns</h3>
        {unselected.length === 0 ? <p className="mh-sa__muted">All columns are in the report.</p> : null}
        <ul className="rp-cols">
          {unselected.map((c) => (
            <li key={c.key}>
              <span>{c.label}</span>
              <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => onChange([...selected, c.key])}>
                Add
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { TeacherScreenConfig } from "@/lib/teacherCatalog";
import { useOptionalTeacherLive } from "@/lib/useTeacherSisLive";

const TABS = [
  "Program Settings",
  "Program Pathway",
  "Fees & Tuition Price List",
  "Deadlines & Penalties",
  "Commission Rates",
  "Audit Changes",
] as const;

type Field = {
  label: string;
  value: string;
  type?: string;
  options?: Array<{ label: string; value: string }>;
  unitValue?: string;
  unitOptions?: Array<{ label: string; value: string }>;
  language?: string;
  hint?: string;
  visibleWhen?: string;
  visibleValue?: string;
  prefix?: string;
};

function Crumb({ items }: { items: string[] }) {
  return (
    <p className="mh-hcc-profile__crumb">
      {items.map((c, i) => (
        <span key={c}>
          {i > 0 ? <span> › </span> : null}
          {c}
        </span>
      ))}
    </p>
  );
}

function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mh-teacher-modal mh-hcc-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mh-teacher-modal__backdrop" aria-label="Close" onClick={onClose} />
      <div className="mh-teacher-modal__panel">
        <div className="mh-teacher-modal__head">
          <h2>{title}</h2>
          <button type="button" className="mh-teacher-btn mh-teacher-btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mh-teacher-modal__body">{children}</div>
        {footer ? <div className="mh-teacher-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: Field[];
  values: Record<string, string>;
  onChange: (label: string, value: string) => void;
}) {
  return (
    <div className="mh-teacher-fields">
      {fields
        .filter((field) => {
          if (!field.visibleWhen) return true;
          const v = (values[field.visibleWhen] || "").trim();
          if (field.visibleValue) return v === field.visibleValue;
          return Boolean(v);
        })
        .map((field) => {
          const options = field.options ?? [];
          const isCheck = field.type === "checkbox";
          const isArea = field.type === "textarea";
          const isPair = field.type === "pair";
          const isSelect = field.type === "select" || (options.length > 0 && !isCheck && !isPair);
          return (
            <label key={field.label} className={isCheck || isArea || isPair ? "mh-teacher-field--block" : undefined}>
              {isCheck ? null : (
                <span>
                  {field.label}
                  {field.hint ? <em className="mh-teacher-sublabel"> · {field.hint}</em> : null}
                </span>
              )}
              {isCheck ? (
                <span className="mh-teacher-check">
                  <input
                    type="checkbox"
                    checked={(values[field.label] ?? "") === "true"}
                    onChange={(e) => onChange(field.label, e.target.checked ? "true" : "false")}
                  />
                  <em>{field.label}</em>
                </span>
              ) : isArea ? (
                <textarea
                  className="mh-teacher-field mh-teacher-field--tall"
                  rows={4}
                  value={values[field.label] ?? ""}
                  onChange={(e) => onChange(field.label, e.target.value)}
                />
              ) : isPair ? (
                <div className="mh-teacher-pair">
                  {field.prefix ? <span className="mh-hcc-prefix">{field.prefix}</span> : null}
                  <select
                    className="mh-teacher-field"
                    value={values[field.label] ?? ""}
                    onChange={(e) => onChange(field.label, e.target.value)}
                  >
                    {options.map((o) => (
                      <option key={`${o.value}-${o.label}`} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="mh-teacher-field"
                    value={values[`${field.label} Unit`] ?? field.unitValue ?? ""}
                    onChange={(e) => onChange(`${field.label} Unit`, e.target.value)}
                  >
                    {(field.unitOptions ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : isSelect ? (
                <select
                  className="mh-teacher-field"
                  value={values[field.label] ?? ""}
                  onChange={(e) => onChange(field.label, e.target.value)}
                >
                  {options.map((o) => (
                    <option key={`${o.value}-${o.label}`} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={field.prefix ? "mh-hcc-money" : undefined}>
                  {field.prefix ? <em>{field.prefix}</em> : null}
                  <input
                    className="mh-teacher-field"
                    value={values[field.label] ?? ""}
                    onChange={(e) => onChange(field.label, e.target.value)}
                  />
                </span>
              )}
              {field.language ? <em className="mh-teacher-field-lang">{field.language}</em> : null}
            </label>
          );
        })}
    </div>
  );
}

export function HccBadgesView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const d = config.hccBadges;
  const [user, setUser] = useState(d?.userFilter || search.get("user") || "");
  const [badge, setBadge] = useState(d?.badgeFilter || "All Badges");
  const [status, setStatus] = useState(d?.statusFilter || "Pending");

  function searchBadges() {
    const qs = new URLSearchParams();
    if (user.trim()) qs.set("user", user.trim());
    if (badge) qs.set("badge", badge);
    if (status) qs.set("status", status);
    router.push(`/instructor/f/t82-badges-accomplishments${qs.toString() ? `?${qs}` : ""}`);
  }

  const rows = (d?.rows || []).filter((r) => {
    if (badge && badge !== "All Badges" && r.badge !== badge) return false;
    if (status && status !== "All" && r.status !== status) return false;
    if (user.trim()) {
      const q = user.trim().toLowerCase();
      if (!r.student.toLowerCase().includes(q) && !r.badge.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="mh-hcc-page">
      <Crumb items={["Home", "Badges / Accomplishments"]} />
      <div className="mh-hcc-profile__card-head">
        <h1>BADGES / ACCOMPLISHMENTS</h1>
        <button
          type="button"
          className="mh-hcc-btn"
          onClick={() => router.push(config.primaryActionHref || "/instructor/f/t70-add-badge")}
        >
          {config.primaryAction || "Add Badge / Accomplishment"}
        </button>
      </div>
      <div className="mh-hcc-filters">
        <label>
          <span>USER FILTER</span>
          <input
            placeholder="Student #, login or last name"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                searchBadges();
              }
            }}
          />
        </label>
        <label>
          <span>BADGE FILTER</span>
          <select value={badge} onChange={(e) => setBadge(e.target.value)}>
            {(d?.badgeOptions || ["All Badges"]).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          <span>STATUS FILTER</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {(d?.statusOptions || ["Pending", "Awarded", "Denied", "All"]).map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <button type="button" className="mh-hcc-btn" onClick={searchBadges}>
          Search Badges
        </button>
      </div>
      {(d?.definitions?.length ?? 0) > 0 ? (
        <section className="mh-hcc-profile__card" style={{ marginBottom: 16 }}>
          <div className="mh-hcc-profile__card-head">
            <h2>BADGE BASES</h2>
          </div>
          <ul className="mh-hcc-accomplish__list">
            {d!.definitions!.map((def) => (
              <li key={def.id}>
                <div>
                  <strong>{def.name}</strong>
                  {def.description ? <p>{def.description}</p> : null}
                  <p className="mh-teacher-muted">
                    {def.badgeType} · {def.approvalMode}
                  </p>
                </div>
                <span className="mh-teacher-badge mh-teacher-badge--info">{def.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {rows.length === 0 ? (
        <p className="mh-teacher-muted">{d?.empty || "No badges / accomplishments were found."}</p>
      ) : (
        <div className="mh-teacher-table-wrap">
          <table className="mh-teacher-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Badge</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.student}</td>
                  <td>{r.badge}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ProgramSettingsView({ config }: { config: TeacherScreenConfig }) {
  const router = useRouter();
  const search = useSearchParams();
  const live = useOptionalTeacherLive();
  const d = config.programSettings;
  const tabParam = search.get("tab") || "Program Settings";
  const modal = search.get("modal") || d?.modal || "";
  const programId = d?.programId || search.get("programId") || "";

  const initValues = useMemo(() => {
    const init: Record<string, string> = { programId };
    for (const g of d?.groups ?? []) {
      for (const field of g.fields) {
        init[field.label] = field.value;
        if (field.type === "pair") init[`${field.label} Unit`] = field.unitValue ?? field.unitOptions?.[0]?.value ?? "";
      }
    }
    return init;
  }, [d, programId]);

  const [values, setValues] = useState(initValues);
  const [modalValues, setModalValues] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [availablePick, setAvailablePick] = useState<string[]>([]);

  useEffect(() => {
    setValues(initValues);
  }, [initValues]);

  useEffect(() => {
    const spec =
      modal === "add-term"
        ? d?.modalData?.addTerm
        : modal === "add-ledger" || modal === "edit-ledger"
          ? d?.modalData?.addLedger
          : modal === "add-deadline"
            ? d?.modalData?.addDeadline
            : modal === "add-commission"
              ? d?.modalData?.addCommission
              : modal === "create-pathway" || modal === "edit-pathway" || modal === "copy-pathway"
                ? d?.modalData?.createPathway
                : modal === "create-tier"
                  ? d?.modalData?.createTier
                  : modal === "create-elective-group"
                    ? d?.modalData?.createElectiveGroup
                    : null;
    const init: Record<string, string> = { programId };
    if (modal === "edit-pathway" || modal === "copy-pathway") {
      const edit = d?.pathway?.edit;
      if (edit) {
        init.Type = edit.type;
        init.Name = edit.name;
        init.Abbreviation = edit.abbreviation;
        init["Default outline"] = edit.defaultOutline ? "true" : "false";
        init.Status = edit.status;
        init["Enable effective dating"] = edit.effectiveDating ? "true" : "false";
        init["Tier Settings"] = edit.tierSettings;
        init["Course Settings"] = edit.courseSettings;
      }
    } else if (spec) {
      for (const f of spec.fields) init[f.label] = f.value;
      if (modal === "edit-ledger") init.ledgerId = d?.modalData?.addLedger?.ledgerId || "";
    }
    setModalValues(init);
    setPicked([]);
    setAvailablePick([]);
  }, [modal, d, programId]);

  function go(next: Record<string, string | null>) {
    const qs = new URLSearchParams(search.toString());
    qs.set("programId", programId);
    for (const [k, v] of Object.entries(next)) {
      if (!v) qs.delete(k);
      else qs.set(k, v);
    }
    router.push(`/instructor/f/t83-program-settings?${qs.toString()}`);
  }

  function closeModal() {
    go({ modal: null, ledgerId: null, auditId: null });
  }

  async function run(action: string, payload?: Record<string, string>) {
    const ok = await live?.runAction?.(action, JSON.stringify({ programId, ...(payload || {}) }));
    if (ok) {
      closeModal();
      await live?.refresh?.();
    }
    return ok;
  }

  const pathway = d?.pathway;
  const courses = pathway?.courses ?? [];

  return (
    <div className="mh-hcc-page mh-hcc-progset">
      <Crumb items={["Home", "Faculties & Programs", "Program Settings"]} />
      <h1>{config.title || `PROGRAM SETTINGS: ${(d?.programName || "").toUpperCase()}`}</h1>
      <div className="mh-hcc-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={tabParam === t ? "is-active" : ""}
            onClick={() => go({ tab: t === "Program Settings" ? null : t, modal: null })}
          >
            {t}
          </button>
        ))}
      </div>

      {tabParam === "Program Settings" ? (
        <form
          className="mh-teacher-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            await live?.runAction?.("Save Program Settings", JSON.stringify(values));
            await live?.refresh?.();
          }}
        >
          {(d?.groups || []).map((g) => (
            <section key={g.title} className="mh-teacher-card">
              <h2>{g.title.toUpperCase()}</h2>
              <FieldGrid
                fields={g.fields}
                values={values}
                onChange={(label, value) => setValues((prev) => ({ ...prev, [label]: value }))}
              />
            </section>
          ))}
          <div className="mh-hcc-progset__actions">
            <button type="submit" className="mh-hcc-btn">
              Save Program
            </button>
          </div>
        </form>
      ) : null}

      {tabParam === "Program Pathway" ? (
        <section className="mh-teacher-card">
          <div className="mh-hcc-pathway-head">
            <div>
              <strong>{pathway?.identity}</strong>
              <span className="mh-hcc-pill">{pathway?.status || "ACTIVE"}</span>
            </div>
            <div className="mh-hcc-pathway-tools">
              <label>
                PATHWAYS
                <select defaultValue={pathway?.selected || "Default"}>
                  {(pathway?.pathways || ["Default"]).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="mh-hcc-btn" onClick={() => go({ tab: "Program Pathway", modal: "create-pathway" })}>
                New Pathway
              </button>
              <button type="button" className="mh-hcc-iconbtn" title="Add Courses" onClick={() => go({ tab: "Program Pathway", modal: "add-courses" })}>
                +
              </button>
              <button type="button" className="mh-hcc-iconbtn" title="Create Tier" onClick={() => go({ tab: "Program Pathway", modal: "create-tier" })}>
                ☰
              </button>
              <button type="button" className="mh-hcc-iconbtn" title="Edit Pathway" onClick={() => go({ tab: "Program Pathway", modal: "edit-pathway" })}>
                ✎
              </button>
              <button type="button" className="mh-hcc-iconbtn" title="Copy Pathway" onClick={() => go({ tab: "Program Pathway", modal: "copy-pathway" })}>
                ⧉
              </button>
              <button type="button" className="mh-hcc-iconbtn" title="Delete Pathway">
                🗑
              </button>
            </div>
          </div>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>COURSE</th>
                <th>{pathway?.columnMode === "hours" ? "HOURS" : "CREDITS"}</th>
                <th>{pathway?.columnMode === "hours" ? "SCHEDULE" : "PREREQUISITES"}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {courses.length === 0 ? (
                <tr>
                  <td colSpan={4}>No courses in this pathway.</td>
                </tr>
              ) : (
                courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>
                        {c.code}
                        {c.name && c.name !== c.code ? ` — ${c.name}` : ""}
                      </strong>
                    </td>
                    <td>{pathway?.columnMode === "hours" ? c.hours : c.credits}</td>
                    <td className="mh-hcc-pre">{pathway?.columnMode === "hours" ? c.schedule : c.prerequisites || ""}</td>
                    <td>
                      <button type="button" className="mh-hcc-link">
                        EDIT
                      </button>{" "}
                      <button
                        type="button"
                        className="mh-hcc-link"
                        onClick={() => void run("Delete Pathway Course", { courseId: c.id })}
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {pathway?.columnMode === "credits" ? (
            <div className="mh-hcc-electives">
              <div className="mh-hcc-progset__actions">
                <button type="button" className="mh-hcc-btn ghost" onClick={() => go({ tab: "Program Pathway", modal: "create-elective-group" })}>
                  Create Elective Group
                </button>
                <button type="button" className="mh-hcc-btn ghost" onClick={() => go({ tab: "Program Pathway", modal: "add-electives" })}>
                  Add Electives
                </button>
              </div>
              <table className="mh-hcc-table">
                <thead>
                  <tr>
                    <th>ELECTIVE COURSE</th>
                    <th>PREREQUISITES</th>
                  </tr>
                </thead>
                <tbody>
                  {(pathway.electives || []).length === 0 ? (
                    <tr>
                      <td colSpan={2}>{pathway.electiveEmpty}</td>
                    </tr>
                  ) : (
                    (pathway.electives || []).map((e) => (
                      <tr key={e.id}>
                        <td>{e.course}</td>
                        <td>{e.prerequisites}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tabParam === "Fees & Tuition Price List" ? (
        <section className="mh-teacher-card">
          <div className="mh-hcc-progset__actions">
            <button type="button" className="mh-hcc-btn" onClick={() => go({ tab: tabParam, modal: "add-term" })}>
              Add Term
            </button>
            <button type="button" className="mh-hcc-btn" onClick={() => go({ tab: tabParam, modal: "add-ledger" })}>
              Add Ledger / Tuition Type
            </button>
          </div>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th />
                <th>LEDGER / TUITION TYPE</th>
                <th>DEFAULT FEES</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(d?.fees || []).length === 0 ? (
                <tr>
                  <td colSpan={4}>{d?.feesEmpty}</td>
                </tr>
              ) : (
                (d?.fees || []).map((f) => (
                  <tr key={f.id}>
                    <td className="mh-hcc-drag">⋮⋮</td>
                    <td>{f.type}</td>
                    <td>
                      Domestic: ${f.domestic}
                      <br />
                      International: ${f.international}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mh-hcc-link"
                        onClick={() => go({ tab: tabParam, modal: "edit-ledger", ledgerId: f.id })}
                      >
                        EDIT
                      </button>{" "}
                      <button type="button" className="mh-hcc-link" onClick={() => void run("Delete Ledger", { ledgerId: f.id })}>
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tabParam === "Deadlines & Penalties" ? (
        <section className="mh-teacher-card">
          <div className="mh-hcc-progset__actions">
            <button type="button" className="mh-hcc-btn" onClick={() => go({ tab: tabParam, modal: "add-deadline" })}>
              Add Deadline
            </button>
          </div>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>CONDITION</th>
                <th>TYPE</th>
                <th>PENALTY</th>
              </tr>
            </thead>
            <tbody>
              {(d?.deadlines || []).length === 0 ? (
                <tr>
                  <td colSpan={3}>{d?.deadlinesEmpty}</td>
                </tr>
              ) : (
                (d?.deadlines || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.condition}</td>
                    <td>{row.type}</td>
                    <td>{row.penalty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tabParam === "Commission Rates" ? (
        <section className="mh-teacher-card">
          <div className="mh-hcc-progset__actions">
            <button type="button" className="mh-hcc-btn" onClick={() => go({ tab: tabParam, modal: "add-commission" })}>
              Create Commission Rate
            </button>
          </div>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>CALCULATION</th>
                <th>CONDITION</th>
                <th>RATES</th>
              </tr>
            </thead>
            <tbody>
              {(d?.commissions || []).length === 0 ? (
                <tr>
                  <td colSpan={3}>{d?.commissionsEmpty}</td>
                </tr>
              ) : (
                (d?.commissions || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.calculation}</td>
                    <td>{row.condition}</td>
                    <td>{row.rates}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {tabParam === "Audit Changes" ? (
        <section className="mh-teacher-card">
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>DATE</th>
                <th>CHANGED BY</th>
                <th>CHANGES MADE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(d?.audits || []).map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.date}
                    {a.current ? " (Current)" : ""}
                  </td>
                  <td>{a.changedBy}</td>
                  <td>{a.changes}</td>
                  <td>
                    <button
                      type="button"
                      className="mh-hcc-link"
                      onClick={() => go({ tab: "Audit Changes", modal: "audit-review", auditId: a.id })}
                    >
                      REVIEW
                    </button>{" "}
                    <button
                      type="button"
                      className="mh-hcc-link"
                      onClick={() => go({ tab: "Audit Changes", modal: "assigned-records", auditId: a.id })}
                    >
                      RECORDS
                    </button>
                    {a.canRestore ? (
                      <>
                        {" "}
                        <button type="button" className="mh-hcc-link" onClick={() => void run("Restore Audit", { auditId: a.id })}>
                          RESTORE
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {modal === "add-term" && d?.modalData?.addTerm ? (
        <Modal
          title={d.modalData.addTerm.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Term", modalValues)}>
              {d.modalData.addTerm.submit}
            </button>
          }
        >
          <h3>TERM SETTINGS</h3>
          <FieldGrid fields={d.modalData.addTerm.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {(modal === "add-ledger" || modal === "edit-ledger") && d?.modalData?.addLedger ? (
        <Modal
          title={d.modalData.addLedger.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Ledger / Tuition Type", modalValues)}>
              {d.modalData.addLedger.submit}
            </button>
          }
        >
          <h3>LEDGER / TUITION TYPE SETTINGS</h3>
          <FieldGrid fields={d.modalData.addLedger.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {modal === "add-deadline" && d?.modalData?.addDeadline ? (
        <Modal
          title={d.modalData.addDeadline.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Deadline", modalValues)}>
              {d.modalData.addDeadline.submit}
            </button>
          }
        >
          <h3>PROGRAM DEADLINE DETAILS</h3>
          <FieldGrid fields={d.modalData.addDeadline.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {modal === "add-commission" && d?.modalData?.addCommission ? (
        <Modal
          title={d.modalData.addCommission.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Commission Rate", modalValues)}>
              {d.modalData.addCommission.submit}
            </button>
          }
        >
          <h3>DEFAULT COMMISSION RATE DETAILS</h3>
          <FieldGrid fields={d.modalData.addCommission.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {(modal === "create-pathway" || modal === "edit-pathway" || modal === "copy-pathway") && d?.modalData?.createPathway ? (
        <Modal
          title={
            modal === "copy-pathway"
              ? `COPY PROGRAM PATHWAY: ${pathway?.edit?.name || "DEFAULT"}`
              : modal === "edit-pathway"
                ? `EDIT PROGRAM PATHWAY: ${pathway?.edit?.name || "DEFAULT"}`
                : d.modalData.createPathway.title
          }
          onClose={closeModal}
          footer={
            <button
              type="button"
              className="mh-hcc-btn"
              onClick={() => void run(modal === "copy-pathway" ? "Copy Program Pathway" : "Save Program Pathway", modalValues)}
            >
              {modal === "copy-pathway" ? "Copy Program Pathway" : "Save Program Pathway"}
            </button>
          }
        >
          <h3>PATHWAY DETAILS</h3>
          <FieldGrid
            fields={
              modal === "copy-pathway"
                ? [
                    ...d.modalData.createPathway.fields,
                    { label: "Copy electives", value: "true", type: "checkbox" },
                  ]
                : d.modalData.createPathway.fields
            }
            values={modalValues}
            onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))}
          />
        </Modal>
      ) : null}

      {modal === "create-tier" && d?.modalData?.createTier ? (
        <Modal
          title={d.modalData.createTier.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Tier", modalValues)}>
              {d.modalData.createTier.submit}
            </button>
          }
        >
          <h3>TIER DETAILS</h3>
          <FieldGrid fields={d.modalData.createTier.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {modal === "create-elective-group" && d?.modalData?.createElectiveGroup ? (
        <Modal
          title={d.modalData.createElectiveGroup.title}
          onClose={closeModal}
          footer={
            <button type="button" className="mh-hcc-btn" onClick={() => void run("Save Elective Group", modalValues)}>
              {d.modalData.createElectiveGroup.submit}
            </button>
          }
        >
          <h3>ELECTIVE GROUP DETAILS</h3>
          <FieldGrid fields={d.modalData.createElectiveGroup.fields} values={modalValues} onChange={(l, v) => setModalValues((p) => ({ ...p, [l]: v }))} />
        </Modal>
      ) : null}

      {modal === "add-courses" ? (
        <Modal
          title="ADD COURSES TO PROGRAM PATHWAY"
          onClose={closeModal}
          footer={
            <button
              type="button"
              className="mh-hcc-btn"
              onClick={() => void run("Save Courses", { selectedCourses: picked.join("|"), programId })}
            >
              Save Courses
            </button>
          }
        >
          <h3>SELECT COURSES</h3>
          <label>
            FILTER
            <input className="mh-teacher-field" placeholder="Enter Course Name / Num" />
          </label>
          <div className="mh-hcc-dual">
            <select
              multiple
              size={12}
              value={availablePick}
              onChange={(e) => setAvailablePick(Array.from(e.target.selectedOptions).map((o) => o.value))}
            >
              {(pathway?.availableCourses || []).map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mh-hcc-dual__btns">
              <button
                type="button"
                className="mh-hcc-btn ghost"
                onClick={() => {
                  setPicked((prev) => [...prev, ...availablePick.filter((x) => !prev.includes(x))]);
                  setAvailablePick([]);
                }}
              >
                Add
              </button>
              <button type="button" className="mh-hcc-btn ghost" onClick={() => setPicked([])}>
                Remove
              </button>
            </div>
            <select multiple size={12} value={picked} onChange={(e) => setPicked(Array.from(e.target.selectedOptions).map((o) => o.value))}>
              {picked.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <label className="mh-teacher-check">
            <input type="checkbox" />
            <em>Create or add the above courses in a new or existing group.</em>
          </label>
        </Modal>
      ) : null}

      {modal === "add-electives" ? (
        <Modal
          title="ADD ELECTIVES"
          onClose={closeModal}
          footer={
            <button
              type="button"
              className="mh-hcc-btn"
              onClick={() => void run("Save Electives", { selectedCourses: picked.join("|"), programId })}
            >
              Save Electives
            </button>
          }
        >
          <h3>ELECTIVE DETAILS</h3>
          <p className="mh-teacher-muted">CTRL + CLICK to select multiple courses.</p>
          <select
            multiple
            size={14}
            className="mh-hcc-multiselect"
            value={picked}
            onChange={(e) => setPicked(Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {(pathway?.availableCourses || []).map((c) => (
              <option key={c.id} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </Modal>
      ) : null}

      {modal === "audit-review" && d?.modalData?.auditReview ? (
        <Modal title="AUDIT REVIEW" onClose={closeModal}>
          <p className="mh-hcc-audit-when">
            {d.modalData.auditReview.when}
            <br />
            BY: {d.modalData.auditReview.by.toUpperCase()}
          </p>
          <table className="mh-hcc-table">
            <thead>
              <tr>
                <th>FORMER VALUES</th>
                <th>UPDATED VALUES</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>{d.modalData.auditReview.field}</strong>
                  <div>{d.modalData.auditReview.former}</div>
                </td>
                <td>
                  <strong>{d.modalData.auditReview.field}</strong>
                  <div>{d.modalData.auditReview.updated}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </Modal>
      ) : null}

      {modal === "assigned-records" && d?.modalData?.assignedRecords ? (
        <Modal title="ASSIGNED RECORDS" onClose={closeModal}>
          <p className="mh-hcc-banner-alert">Click the statistics below to manage records.</p>
          <div className="mh-hcc-stats">
            <button type="button">STUDENT RECORDS: {d.modalData.assignedRecords.studentRecords}</button>
            <button type="button">SCHEDULE RECORDS: {d.modalData.assignedRecords.scheduleRecords}</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

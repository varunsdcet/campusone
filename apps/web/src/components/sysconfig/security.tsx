"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SaModal, SaNotice, SuperFrame } from "@/components/superadmin/shared";
import { ConfirmDelete } from "../location/shared";
import { Directory, EntityModal, SC, SettingsBody, Tabs, useTab } from "./directory";
import { OutcomeBadge, errMsg, fmtDate, str, sx, useCanEdit, useFlash, useSysMeta, type Listing, type Row } from "./kit";

const SEC = "/admin/sysconfig/security";
const TABS = [
  { id: "session", label: "Login Session" },
  { id: "password", label: "Password Policies & Recovery" },
  { id: "mfa", label: "Multi-Factor Authentication" },
  { id: "questions", label: "Security Questions" },
  { id: "access", label: "Campus / Building Access" },
  { id: "service", label: "Service Accounts" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/* Security questions grouped by category                               */
/* ------------------------------------------------------------------ */

function SecurityQuestions() {
  const flash = useFlash(null);
  const { ok, fail } = flash;
  const [cats, setCats] = useState<Row[] | null>(null);
  const [questions, setQuestions] = useState<Row[]>([]);
  const [modal, setModal] = useState<{ entity: "securityQuestions" | "securityCategories"; id: string | null } | null>(null);
  const [confirm, setConfirm] = useState<{ entity: "securityQuestions" | "securityCategories"; row: Row } | null>(null);
  const writable = useCanEdit("securityQuestions");
  const load = useCallback(() => {
    void sx<Listing>("/e/securityCategories")
      .then((c) => setCats(c.items))
      .catch((e) => { setCats([]); fail(errMsg(e, "Could not load security question categories")); });
    void sx<Listing>("/e/securityQuestions")
      .then((q) => setQuestions(q.items))
      .catch((e) => { setQuestions([]); fail(errMsg(e, "Could not load security questions")); });
  }, [fail]);
  useEffect(load, [load]);
  return (
    <div className="lx sx">
      {flash.node}
      {writable ? (
        <div className="sx-tabhead">
          <button type="button" className="mh-sa__btn" onClick={() => setModal({ entity: "securityCategories", id: null })}>
            Add Category
          </button>
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => setModal({ entity: "securityQuestions", id: null })} disabled={!cats?.length}>
            Add Question
          </button>
        </div>
      ) : null}
      {!cats ? (
        <section className="mh-sa__card">
          <p className="mh-sa__muted">Loading…</p>
        </section>
      ) : !cats.length ? (
        <section className="mh-sa__card lx-empty">
          <p>No question categories yet. Add a category first, then add questions to it.</p>
        </section>
      ) : (
        cats.map((c) => {
          const list = questions.filter((q) => q.category === c.id);
          return (
            <section key={c.id} className="mh-sa__card sx-group">
              <div className="sx-group__head">
                <h3>{str(c.name)}</h3>
                {writable ? (
                  <span className="lx-actions">
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setModal({ entity: "securityCategories", id: c.id })}>
                      Edit
                    </button>
                    <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ entity: "securityCategories", row: c })}>
                      Delete
                    </button>
                  </span>
                ) : null}
              </div>
              <table className="mh-sa__table lx-table">
                <tbody>
                  {list.map((q) => (
                    <tr key={q.id}>
                      <td>{str(q.question)}</td>
                      <td className="lx-actions">
                        {writable ? (
                          <>
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setModal({ entity: "securityQuestions", id: q.id })}>
                              Edit
                            </button>
                            <button type="button" className="mh-sa__btn mh-sa__btn--sm mh-sa__btn--danger" onClick={() => setConfirm({ entity: "securityQuestions", row: q })}>
                              Delete
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!list.length ? (
                    <tr>
                      <td colSpan={2} className="mh-sa__empty-cell">
                        No questions in this category.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          );
        })
      )}
      <p className="lx-hint">Users pick one question from each category when they set up their security questions under My Account.</p>
      {modal ? (
        <EntityModal
          entity={modal.entity}
          id={modal.id}
          title={modal.entity === "securityQuestions" ? (modal.id ? "Edit Security Question" : "Add Security Question") : modal.id ? "Edit Question Category" : "Add Question Category"}
          saveLabel={modal.entity === "securityQuestions" ? "Save Question" : "Save Category"}
          onClose={() => setModal(null)}
          onSaved={(m) => {
            setModal(null);
            ok(m);
            load();
          }}
        />
      ) : null}
      {confirm ? (
        <ConfirmDelete
          title={confirm.entity === "securityQuestions" ? "Delete security question" : "Delete question category"}
          body={
            confirm.entity === "securityQuestions"
              ? `Delete "${str(confirm.row.question)}"? Users who already chose it keep their saved answer until they change it.`
              : `Delete the category "${str(confirm.row.name)}"? Categories that still contain questions cannot be deleted.`
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campus access logs                                                   */
/* ------------------------------------------------------------------ */

function AccessLogs({ onClose }: { onClose: () => void }) {
  const { meta } = useSysMeta();
  const [f, setF] = useState({ from: "", to: "", campus: "", user: "", outcome: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const search = useCallback(() => {
    setErr(null);
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    sx<Listing>(`/access-logs?${qs.toString()}`)
      .then((r) => setRows(r.items))
      .catch((e) => setErr(errMsg(e, "Search failed")));
  }, [f]);
  useEffect(() => {
    search();
    // Load the latest log immediately; filter changes are applied by Search Logs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <SaModal
      title="Campus Access Logs"
      wide
      onClose={onClose}
      footer={
        <button type="button" className="mh-sa__btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <form
        className="lx-filter sx-filter"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label className="mh-sa__field">
          <span className="mh-sa__label">Start Datestamp</span>
          <input type="date" className="mh-sa__input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">End Datestamp</span>
          <input type="date" className="mh-sa__input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Campus / Building</span>
          <select className="mh-sa__input" value={f.campus} onChange={(e) => setF({ ...f, campus: e.target.value })}>
            <option value="">All Campuses</option>
            {(meta?.lists.campuses ?? []).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">Outcome</span>
          <select className="mh-sa__input" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}>
            <option value="">All Outcomes</option>
            {["Access Granted", "Access Denied", "Warning", "Requires Review"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label className="mh-sa__field">
          <span className="mh-sa__label">User</span>
          <input className="mh-sa__input" placeholder="Name or student number" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} />
        </label>
        <button type="submit" className="mh-sa__btn mh-sa__btn--primary">
          Search Logs
        </button>
      </form>
      {err ? <SaNotice tone="error">{err}</SaNotice> : null}
      {rows ? (
        <table className="mh-sa__table lx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Campus / Building</th>
              <th>User</th>
              <th>Outcome</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(str(r.date))}</td>
                <td>{str(r.location)}</td>
                <td>{str(r.user)}</td>
                <td>{str(r.outcome)}</td>
                <td>{str(r.source)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="mh-sa__empty-cell">
                  No access logs found for this search. Logs appear here once card readers or kiosks start reporting scans.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      ) : (
        <p className="mh-sa__muted">Set the filters and choose Search Logs.</p>
      )}
    </SaModal>
  );
}

function AccessOutcomes() {
  const sp = useSearchParams();
  const [logs, setLogs] = useState(sp?.get("logs") === "1");
  return (
    <>
      <Directory
        embedded
        initialNotice={null}
        entity="accessOutcomes"
        activeHref={SEC}
        noun="access outcome"
        createLabel="New Access Outcome"
        createMode="modal"
        modalTitle={(r) => (r ? `Edit Access Outcome: ${str(r.campus)} — ${str(r.outcomeType)}` : "New Access Outcome")}
        saveLabel="Save Access Outcome"
        empty="No campus or building access outcomes have been configured yet."
        headerActions={() => (
          <button type="button" className="mh-sa__btn" onClick={() => setLogs(true)}>
            Access Logs
          </button>
        )}
        confirmText={(r) => `Delete the ${str(r.outcomeType)} outcome for ${str(r.campus)}?`}
        columns={[
          { label: "Campus / Building", render: (r) => <strong>{str(r.campus)}</strong> },
          {
            label: "Outcome",
            render: (r) => (
              <span className="sx-named">
                <OutcomeBadge icon={str(r.icon)} /> {str(r.outcomeType)}
              </span>
            ),
          },
          {
            label: "Filters",
            render: (r) =>
              [r.program, r.status, r.accessLevel, r.flags, r.dailyActivity, r.instructorStatus, r.hasPhoto !== "Any" ? `Has Photo: ${str(r.hasPhoto)}` : ""]
                .map(str)
                .filter((x) => x && !/^(All |Any)/.test(x))
                .join(" · ") || <span className="mh-sa__muted">Everyone</span>,
          },
        ]}
      />
      {logs ? <AccessLogs onClose={() => setLogs(false)} /> : null}
    </>
  );
}

function TabBody({ tab }: { tab: Tab }) {
  switch (tab) {
    case "session":
      return (
        <>
          <SettingsBody settingsKey="session" embedded />
          <p className="lx-hint sx-note">IP authentication settings are stored for the security team&apos;s review; they are not yet enforced at sign-in, so a mistyped address cannot lock anyone out.</p>
        </>
      );
    case "password":
      return <SettingsBody settingsKey="password" embedded />;
    case "mfa":
      return <SettingsBody settingsKey="mfa" embedded showHistory />;
    case "questions":
      return <SecurityQuestions />;
    case "access":
      return <AccessOutcomes />;
    case "service":
      return (
        <Directory
          embedded
          initialNotice={null}
          entity="serviceAccounts"
          activeHref={SEC}
          noun="service account"
          createLabel="Create Service Account"
          createMode="modal"
          modalTitle={(r) => (r ? `Edit Service Account: ${str(r.name)}` : "Create Service Account")}
          saveLabel="Save Service Account"
          empty="No service accounts have been created yet."
          columns={[
            { label: "Account Name", render: (r) => <strong>{str(r.name)}</strong> },
            { label: "Account Login", render: (r) => <code>{str(r.login)}</code> },
            { label: "Service Type", render: (r) => str(r.serviceType) },
            { label: "Time Zone", render: (r) => str(r.timezone) },
          ]}
        />
      );
  }
}

export function SecurityManagement() {
  const [tab, setTab] = useTab(TABS.map((t) => t.id), "session");
  return (
    <SuperFrame title="Security Management" breadcrumbs={["Home", SC, "Security Management"]} activeHref={SEC}>
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      <TabBody key={tab} tab={tab} />
    </SuperFrame>
  );
}

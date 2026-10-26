"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SaCard, SaModal, SuperFrame } from "@/components/superadmin/shared";
import { Notices, Req, StatusPill, errMsg, invalidateMeta, json, useMeta, ws } from "./common";

type Outcome = { value: string; grantsCompletion: "Yes" | "No" };
type Role = { id: string; name: string; status: string; outcomes: Outcome[]; competencies: string[]; updatedAt: string };

/* ------------------------------------------------------------------ */
/* Manage Workshop Roles                                                */
/* ------------------------------------------------------------------ */

export function WorkshopRolesList() {
  const sp = useSearchParams();
  const [items, setItems] = useState<Role[] | null>(null);
  const [notice, setNotice] = useState<string | null>(sp?.get("notice") ?? null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Role | null>(null);

  const load = useCallback(() => {
    ws<{ items: Role[] }>("/roles")
      .then((r) => setItems(r.items))
      .catch((e) => setError(errMsg(e, "Could not load workshop roles")));
  }, []);
  useEffect(load, [load]);

  async function remove(r: Role) {
    setConfirm(null);
    try {
      const res = await ws<{ message: string }>(`/roles/${r.id}`, { method: "DELETE" });
      invalidateMeta();
      setNotice(res.message);
      load();
    } catch (e) {
      setError(errMsg(e, "Could not delete the workshop role"));
    }
  }

  return (
    <SuperFrame
      title="MANAGE WORKSHOP ROLES"
      breadcrumbs={["Home", "Manage Workshop Roles"]}
      breadcrumbHrefs={["/admin"]}
      activeHref="/admin/workshop-roles"
      actions={
        <Link className="mh-sa__btn mh-sa__btn--primary" href="/admin/workshop-roles/new">
          Create Workshop Role
        </Link>
      }
    >
      <div className="ur">
        <Notices notice={notice} error={error} onNotice={() => setNotice(null)} onError={() => setError(null)} />
        {!items ? (
          error ? null : <p className="mh-sa__muted">Loading workshop roles…</p>
        ) : !items.length ? (
          <section className="mh-sa__card">
            <p className="mh-sa__empty">No workshop roles were found.</p>
          </section>
        ) : (
          <section className="mh-sa__card">
            <div className="mh-sa__table-wrap">
              <table className="mh-sa__table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Outcomes</th>
                    <th>Competencies</th>
                    <th className="ur-col-actions" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id}>
                      <td className="ur-name">{r.name}</td>
                      <td>
                        <StatusPill status={r.status} />
                      </td>
                      <td>
                        {r.outcomes.map((o, i) => (
                          <div key={i} className="wk-outcome-line">
                            {o.value}
                            {o.grantsCompletion === "Yes" ? <span className="ur-code">Grants completion</span> : null}
                          </div>
                        ))}
                      </td>
                      <td>{r.competencies.join(", ") || "—"}</td>
                      <td className="ur-col-actions">
                        <span className="ur-actions">
                          <Link href={`/admin/workshop-roles/${r.id}`}>EDIT</Link>
                          <span aria-hidden>|</span>
                          <button type="button" className="ur-delete" onClick={() => setConfirm(r)}>
                            DELETE
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
      {confirm ? (
        <SaModal
          title="Delete Workshop Role"
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button type="button" className="mh-sa__btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="mh-sa__btn mh-sa__btn--danger" onClick={() => void remove(confirm)}>
                Delete
              </button>
            </>
          }
        >
          <p>
            Delete the workshop role <strong>{confirm.name}</strong>? Roles already used by workshops or enrolments cannot be deleted; set them to Inactive instead.
          </p>
        </SaModal>
      ) : null}
    </SuperFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Screen 12 — CREATE WORKSHOP ROLE                                     */
/* ------------------------------------------------------------------ */

export function WorkshopRoleForm({ id }: { id?: string }) {
  const router = useRouter();
  const meta = useMeta();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("Active");
  const [outcomes, setOutcomes] = useState<Outcome[]>([{ value: "", grantsCompletion: "Yes" }]);
  const [competencies, setCompetencies] = useState<string[]>([]);
  const [competency, setCompetency] = useState("");
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    ws<Role>(`/roles/${id}`)
      .then((r) => {
        setName(r.name);
        setStatus(r.status);
        setOutcomes(r.outcomes.length ? r.outcomes : [{ value: "", grantsCompletion: "Yes" }]);
        setCompetencies(r.competencies);
        setLoaded(true);
      })
      .catch((e) => setError(errMsg(e, "Could not load the workshop role")));
  }, [id]);

  const setOutcome = (i: number, patch: Partial<Outcome>) => setOutcomes((list) => list.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  function addCompetency() {
    const v = competency.trim();
    if (v && !competencies.includes(v)) setCompetencies([...competencies, v]);
    setCompetency("");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const pending = competency.trim();
    const body = { name, status, outcomes, competencies: pending && !competencies.includes(pending) ? [...competencies, pending] : competencies };
    try {
      const r = id ? await ws<{ message: string }>(`/roles/${id}`, json("PUT", body)) : await ws<{ message: string }>("/roles", json("POST", body));
      invalidateMeta();
      router.push(`/admin/workshop-roles?notice=${encodeURIComponent(r.message)}`);
    } catch (err) {
      setError(errMsg(err, "Could not save the workshop role"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperFrame
      title={id ? "EDIT WORKSHOP ROLE" : "CREATE WORKSHOP ROLE"}
      breadcrumbs={["Home", "Manage Workshop Roles", id ? "Edit Workshop Role" : "Create Workshop Roles"]}
      breadcrumbHrefs={["/admin", "/admin/workshop-roles"]}
      activeHref="/admin/workshop-roles"
    >
      <div className="ur">
        <Notices notice={null} error={error} onNotice={() => undefined} onError={() => setError(null)} />
        {!loaded ? (
          error ? null : <p className="mh-sa__muted">Loading workshop role…</p>
        ) : (
          <form className="ur-fieldset" onSubmit={(e) => void save(e)}>
            <SaCard title="Workshop Role Details">
              <div className="mh-sa__grid">
                <label className="mh-sa__field">
                  <span className="mh-sa__label">
                    <Req label="Name" />
                  </span>
                  <input className="mh-sa__input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="mh-sa__field">
                  <span className="mh-sa__label">Status</span>
                  <select className="mh-sa__input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </label>
              </div>
            </SaCard>

            <SaCard title="Role Outcomes">
              <div className="wk-outcomes">
                {outcomes.map((o, i) => (
                  <div key={i} className="wk-outcome">
                    <label className="mh-sa__field">
                      <span className="mh-sa__label">
                        <Req label={`Outcome${outcomes.length > 1 ? ` ${i + 1}` : ""}`} />
                      </span>
                      <textarea className="mh-sa__input" rows={2} maxLength={2000} placeholder="Outcome Value" value={o.value} onChange={(e) => setOutcome(i, { value: e.target.value })} />
                    </label>
                    <label className="mh-sa__field">
                      <span className="mh-sa__label">Grants Completion</span>
                      <select className="mh-sa__input" value={o.grantsCompletion} onChange={(e) => setOutcome(i, { grantsCompletion: e.target.value as Outcome["grantsCompletion"] })}>
                        <option>Yes</option>
                        <option>No</option>
                      </select>
                    </label>
                    {outcomes.length > 1 ? (
                      <button type="button" className="ur-delete wk-outcome-x" onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <div>
                <button type="button" className="mh-sa__btn mh-sa__btn--sm" onClick={() => setOutcomes([...outcomes, { value: "", grantsCompletion: "Yes" }])}>
                  + Add Outcome
                </button>
              </div>
            </SaCard>

            <SaCard title="Role Competencies">
              {competencies.length ? (
                <div className="wk-chips">
                  {competencies.map((c) => (
                    <span key={c} className="wk-chip">
                      {c}
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => setCompetencies(competencies.filter((x) => x !== c))}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mh-sa__inline">
                <input
                  className="mh-sa__input"
                  list="wk-competencies"
                  placeholder="Competency"
                  maxLength={200}
                  value={competency}
                  onChange={(e) => setCompetency(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCompetency();
                    }
                  }}
                />
                <button type="button" className="mh-sa__btn" onClick={addCompetency} disabled={!competency.trim()}>
                  Add
                </button>
                <datalist id="wk-competencies">
                  {(meta?.competencies ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </SaCard>

            <div className="mh-sa__actions">
              <Link className="mh-sa__btn" href="/admin/workshop-roles">
                Cancel
              </Link>
              <button type="submit" className="mh-sa__btn mh-sa__btn--primary" disabled={busy}>
                {busy ? "Saving…" : "Save Workshop Role"}
              </button>
            </div>
          </form>
        )}
      </div>
    </SuperFrame>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button } from "@myheritage/ui";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { api, loadSession } from "@/lib/api";
import "../student-success/studentSuccess.css";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string;
  programName: string;
  source: string;
  campaignName: string;
  eventName: string;
  stage: string;
  nextFollowUp: string | null;
  notes: string;
  updatedAt: string;
};

const ACTIONS: Record<string, Array<{ label: string; stage: string }>> = {
  New: [{ label: "Mark contacted", stage: "Contacted" }, { label: "Qualify", stage: "Qualified" }, { label: "Mark lost", stage: "Lost" }],
  Contacted: [{ label: "Qualify", stage: "Qualified" }, { label: "Mark lost", stage: "Lost" }],
  Qualified: [{ label: "Mark applied", stage: "Applied" }, { label: "Mark lost", stage: "Lost" }],
  Lost: [{ label: "Reopen as contacted", stage: "Contacted" }],
};

function dateLabel(value: string | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

export function InstructorCrmWorkspace() {
  const router = useRouter();
  const [items, setItems] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const session = loadSession();
    if (!session) return router.replace("/login");
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ items: Lead[] }>("/instructor/crm/leads", {}, session.accessToken);
      setItems(result.items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load assigned CRM leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function changeStage(id: string, stage: string) {
    const session = loadSession();
    if (!session) return;
    setBusy(id);
    setError(null);
    try {
      await api(`/instructor/crm/leads/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) }, session.accessToken);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update lead");
    } finally {
      setBusy(null);
    }
  }

  const stats = useMemo(() => [
    { label: "Assigned leads", value: items.length },
    { label: "Follow-ups due", value: items.filter((item) => item.nextFollowUp && item.nextFollowUp <= new Date().toISOString().slice(0, 10) && !["Enrolled", "Lost"].includes(item.stage)).length },
    { label: "Qualified / applied", value: items.filter((item) => ["Qualified", "Applied", "Admitted", "Enrolled"].includes(item.stage)).length },
  ], [items]);

  return (
    <TeacherSisShell title="CRM Counselling" subtitle="Prospective students assigned to you by the admissions team" activeHref="/instructor/crm/leads">
      <div className="mh-success-page">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <section className="mh-success-summary">
          {stats.map((stat) => <article className="mh-success-metric" key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}
        </section>
        {loading ? <div className="mh-success-empty">Loading assigned leads…</div> : null}
        {!loading && items.length === 0 ? <div className="mh-success-empty">No CRM leads are assigned to your teacher account.</div> : null}
        {!loading ? <section className="mh-success-list">
          {items.map((item) => <article className="mh-success-card" key={item.id}>
            <div className="mh-success-card__top">
              <div><h2>{item.name}</h2><div className="mh-success-card__person">{item.email || "No email"}{item.phone ? ` · ${item.phone}` : ""}</div></div>
              <span className="mh-success-chip">{item.stage}</span>
            </div>
            <div className="mh-success-lead-grid">
              <div><span>Programme of interest</span><strong>{item.programName}</strong></div>
              <div><span>Source</span><strong>{item.source}</strong></div>
              <div><span>Next follow-up</span><strong>{dateLabel(item.nextFollowUp)}</strong></div>
              <div><span>Campaign / event</span><strong>{[item.campaignName, item.eventName].filter(Boolean).join(" · ") || "Not linked"}</strong></div>
            </div>
            {item.notes ? <p className="mh-success-card__body"><strong>Admin notes:</strong> {item.notes}</p> : null}
            <div className="mh-success-actions">
              {(ACTIONS[item.stage] ?? []).map((action) => <Button key={action.stage} disabled={busy === item.id} onClick={() => void changeStage(item.id, action.stage)}>{busy === item.id ? "Saving…" : action.label}</Button>)}
            </div>
          </article>)}
        </section> : null}
      </div>
    </TeacherSisShell>
  );
}

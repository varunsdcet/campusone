"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button } from "@myheritage/ui";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { api, loadSession } from "@/lib/api";
import "@/components/student-success/studentSuccess.css";

type WorkItem = {
  id: string; kind: string; category: string; title: string; subtitle: string; status: string;
  when: string | null; location: string | null; actionUrl: string | null;
  details: Array<{ label: string; value: string }>;
  availableActions: Array<{ key: string; label: string; tone?: "primary" | "danger" }>;
};

function whenLabel(value: string) {
  if (value.includes("–")) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export function AssignedWorkWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<WorkItem[]>([]);
  const requestedCategory = searchParams.get("category") || "All";
  const [category, setCategory] = useState(requestedCategory);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = () => {
    const session = loadSession();
    if (!session) return Promise.reject(new Error("Session expired"));
    return api<{ items: WorkItem[] }>("/instructor/assigned-work", {}, session.accessToken).then((result) => setItems(result.items));
  };
  useEffect(() => {
    const session = loadSession();
    if (!session) return router.replace("/login");
    load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load assigned work"))
      .finally(() => setLoading(false));
  }, [router]);
  useEffect(() => setCategory(requestedCategory), [requestedCategory]);
  async function act(item: WorkItem, status: string) {
    const session = loadSession();
    if (!session) return router.replace("/login");
    setBusyId(item.id);
    setError(null);
    try {
      if (item.kind === "practicum_placement") {
        const [action, id] = status.split(":", 2);
        if (action === "submit_evaluation") {
          const rawScore = window.prompt("Evaluation score (1–5)", "4");
          if (rawScore === null) return;
          const score = Number(rawScore);
          const notes = window.prompt("Evaluation notes", "Meets practicum expectations")?.trim() ?? "";
          if (!Number.isInteger(score) || score < 1 || score > 5 || notes.length < 3) throw new Error("Enter a score from 1 to 5 and evaluation notes");
          await api(`/instructor/practicum/evaluations/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({ score, notes }) }, session.accessToken);
        } else {
          await api(`/instructor/practicum/hours/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: action === "approve_hours" ? "approved" : "rejected" }) }, session.accessToken);
        }
      } else {
        await api(`/instructor/labs/${encodeURIComponent(item.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, session.accessToken);
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update assigned work");
    } finally {
      setBusyId(null);
    }
  }
  const categories = useMemo(() => {
    const values = [...new Set(items.map((item) => item.category))];
    return ["All", ...(values.some((value) => value === "Labs" || value === "Practicum") ? ["Labs & Practicum"] : []), ...values];
  }, [items]);
  const visible = items.filter((item) => category === "All" || (category === "Labs & Practicum" ? ["Labs", "Practicum"].includes(item.category) : item.category === category));
  return <TeacherSisShell title="My Assigned Work" subtitle="One queue for records explicitly assigned to your staff profile" activeHref="/instructor/assigned-work">
    <div className="mh-success-page">
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <div className="mh-success-tabs">{categories.map((value) => <Button key={value} variant={category === value ? "primary" : "secondary"} onClick={() => setCategory(value)}>{value}</Button>)}</div>
      {loading ? <div className="mh-success-empty">Loading your assignments…</div> : null}
      {!loading && !visible.length ? <div className="mh-success-empty">No {category === "All" ? "" : `${category} `}records are assigned to you.</div> : null}
      <section className="mh-success-list">{visible.map((item) => <article className="mh-success-card" key={`${item.kind}-${item.id}`}>
        <div className="mh-success-card__top"><div><div className="mh-success-card__person">{item.category}</div><h2>{item.title}</h2></div><span className="mh-success-chip">{item.status}</span></div>
        <p className="mh-success-card__body">{item.subtitle}</p>
        <div className="mh-success-lead-grid">
          {item.when ? <div><span>When</span><strong>{whenLabel(item.when)}</strong></div> : null}
          {item.location ? <div><span>Location</span><strong>{item.location}</strong></div> : null}
          {item.details.map((detail) => <div key={detail.label}><span>{detail.label}</span><strong>{detail.value}</strong></div>)}
        </div>
        {item.actionUrl || item.availableActions?.length ? <div className="mh-success-actions">
          {item.actionUrl ? <Button onClick={() => window.open(item.actionUrl!, "_blank", "noopener,noreferrer")}>Start Interview</Button> : null}
          {item.availableActions?.map((action) => <Button key={action.key} variant={action.tone === "danger" ? "secondary" : action.tone === "primary" ? "primary" : "secondary"} disabled={busyId === item.id} onClick={() => void act(item, action.key)}>{busyId === item.id ? "Saving…" : action.label}</Button>)}
        </div> : null}
      </article>)}</section>
    </div>
  </TeacherSisShell>;
}

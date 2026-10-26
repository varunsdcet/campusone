"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiGovernanceSnapshot } from "@myheritage/contracts";
import { Banner, Button, StatusPill } from "@myheritage/ui";
import { api, loadSession } from "@/lib/api";
import { ScreenScaffold } from "@/components/ScreenScaffold";

export default function AdminAiGovernancePage() {
  const router = useRouter();
  const [data, setData] = useState<AiGovernanceSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function savePolicies() {
    const session = loadSession();
    if (!session || !data) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api("/ai/governance", {
        method: "PUT",
        body: JSON.stringify({
          studentAiAllowed: data.policies.studentAiAllowed,
          instructorAiAllowed: data.policies.instructorAiAllowed,
          adminAiAllowed: data.policies.adminAiAllowed,
          gradingAssistanceAllowed: data.policies.gradingAssistanceAllowed,
          maxRequestsPerHour: data.policies.maxRequestsPerHour,
        }),
      }, session.accessToken);
      setNotice("AI governance policy saved and enforced.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save AI governance");
    } finally {
      setSaving(false);
    }
  }

  function setPolicy<K extends keyof AiGovernanceSnapshot["policies"]>(key: K, value: AiGovernanceSnapshot["policies"][K]) {
    setData((current) => current ? { ...current, policies: { ...current.policies, [key]: value } } : current);
  }

  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!session.roles.includes("admin") && !session.roles.includes("registrar")) {
      router.replace("/");
      return;
    }
    api<AiGovernanceSnapshot>("/ai/governance", {}, session.accessToken)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load AI governance"));
  }, [router]);

  return (
    <ScreenScaffold
      role="admin"
      title="AI governance"
      subtitle="Models, tools, policies, and knowledge sources"
      breadcrumb={["Admin", "AI governance"]}
      active="/admin/ai/governance"
    >
      <div className="mh-student-stack">
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {notice ? <Banner tone="success">{notice}</Banner> : null}
        {!data ? (
          <p>Loading AI governance…</p>
        ) : (
          <>
            <section className="mh-sis-dash__card">
              <h2>Models</h2>
              <ul>
                {data.models.map((model) => (
                  <li key={model.id}>
                    <strong>{model.id}</strong> — {model.purpose}{" "}
                    <StatusPill tone={model.enabled ? "success" : "neutral"}>
                      {model.enabled ? "enabled" : "disabled"}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </section>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Allowlisted tools ({data.tools.length})</h2>
              <ul>
                {data.tools.map((tool) => (
                  <li key={tool.name}>
                    <strong>{tool.name}</strong> · class {tool.actionClass} · {tool.permissionKey}
                    {tool.consequential ? " · consequential" : " · read-only"}
                  </li>
                ))}
              </ul>
            </section>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Policies</h2>
              <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                {([
                  ["studentAiAllowed", "Student AI"],
                  ["instructorAiAllowed", "Instructor AI"],
                  ["adminAiAllowed", "Admin AI"],
                  ["gradingAssistanceAllowed", "Grading assistance"],
                ] as const).map(([key, label]) => (
                  <label key={key}><input type="checkbox" checked={data.policies[key]} onChange={(e) => setPolicy(key, e.target.checked)} /> {label}</label>
                ))}
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Maximum requests per user / hour</span>
                  <input type="number" min={1} max={10000} value={data.policies.maxRequestsPerHour} onChange={(e) => setPolicy("maxRequestsPerHour", Number(e.target.value))} />
                </label>
                <p style={{ margin: 0 }}>
                  Study mode default: {data.policies.mode} (full answers:{" "}
                  {data.policies.fullAnswerGenerationAllowed ? "yes" : "no"})
                </p>
                <Button type="button" disabled={saving} onClick={() => void savePolicies()}>{saving ? "Saving…" : "Save governance"}</Button>
              </div>
            </section>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Usage (last 24h)</h2>
              {data.usage ? (
                <ul>
                  <li>Requests: {data.usage.requestsLast24h}</li>
                  <li>Estimated tokens: {data.usage.estimatedTokensLast24h}</li>
                  <li>Avg latency: {data.usage.avgLatencyMsLast24h} ms</li>
                  <li>Failures: {data.usage.failureCountLast24h}</li>
                </ul>
              ) : (
                <p>Usage telemetry not yet available.</p>
              )}
            </section>
            <section className="mh-sis-dash__card" style={{ marginTop: 20 }}>
              <h2>Knowledge sources</h2>
              <ul>
                {data.knowledgeSources.map((source) => (
                  <li key={source.docType}>
                    {source.docType}: {source.status} — {source.note}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </ScreenScaffold>
  );
}

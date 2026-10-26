"use client";

import { FormEvent, useState } from "react";
import { BrandLockup, Button, Input, Panel, StatusPill } from "@myheritage/ui";
import { api } from "@/lib/api";

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [result, setResult] = useState<"idle" | "match" | "none" | "error">("idle");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim() || !familyName.trim()) return;
    setLoading(true);
    setResult("idle");
    try {
      const res = await api<{ match: boolean }>(
        `/public/verify?studentNumber=${encodeURIComponent(query.trim())}&familyName=${encodeURIComponent(familyName.trim())}`,
      );
      setResult(res.match ? "match" : "none");
    } catch {
      setResult("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem", background: "var(--mh-bg)" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: "1rem" }}>
          <BrandLockup />
          <p style={{ margin: "8px 0 0", color: "var(--mh-text-muted)", fontSize: 13 }}>Public credential verify</p>
        </div>
        <Panel title="Credential verification">
          <p style={{ marginTop: 0, color: "var(--mh-text-muted)", fontSize: 14 }}>
            Enter the student number and family name exactly as they appear on the credential. Returns a match or no
            match only. No government ID numbers are collected or displayed.
          </p>
          <form onSubmit={onSubmit} style={{ display: "grid", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Student number</span>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ST-2024-001" required />
            </label>
            <label style={{ display: "grid", gap: "0.35rem" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Family name</span>
              <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} autoComplete="off" required />
            </label>
            <Button type="submit" disabled={loading || !query.trim() || !familyName.trim()}>
              {loading ? "Checking…" : "Verify"}
            </Button>
          </form>
          {result === "match" ? <div style={{ marginTop: 12 }}><StatusPill tone="success">Match found</StatusPill></div> : null}
          {result === "none" ? <div style={{ marginTop: 12 }}><StatusPill tone="warning">No match</StatusPill></div> : null}
          {result === "error" ? <div style={{ marginTop: 12 }}><StatusPill tone="danger">Verification unavailable</StatusPill></div> : null}
        </Panel>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Panel, StatusPill } from "@myheritage/ui";
import { ScreenScaffold, ListPanel } from "@/components/ScreenScaffold";
import { api, loadSession } from "@/lib/api";

type PortalView = {
  sections: Array<{ title: string; rows: Array<{ primary: string; secondary?: string; meta?: string }> }>;
};

export default function ArchivePage() {
  const [rows, setRows] = useState<Array<{ primary: string; secondary?: string; meta?: string }>>([]);

  useEffect(() => {
    const s = loadSession();
    if (!s) return;
    api<PortalView>(`/portal/view?path=${encodeURIComponent("/admin/audit")}`, {}, s.accessToken)
      .then((v) => setRows(v.sections.flatMap((sec) => sec.rows)))
      .catch(() => setRows([]));
  }, []);

  return (
    <ScreenScaffold
      role="admin"
      title="Archive & consolidate"
      subtitle="Retired surfaces and consolidation notes"
      breadcrumb={["Shared", "Archive"]}
      requireAuth={false}
      guestName="Archivist"
    >
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        <StatusPill tone="warning">Do not revive without a contract ticket</StatusPill>
        <Link href="/design-system">
          <Button variant="secondary" type="button">
            Open component library
          </Button>
        </Link>
      </div>
      <ListPanel
        title="Live audit / consolidation feed"
        rows={
          rows.length
            ? rows
            : [
                {
                  primary: "Sign in as admin to load live audit records",
                  secondary: "Archive notes come from portal/audit data",
                  meta: "Auth",
                },
              ]
        }
      />
      <Panel title="Consolidation rule">
        <p style={{ margin: 0, color: "var(--mh-text-muted)", fontSize: "var(--mh-body-compact)" }}>
          Prefer one route per register ID. Shared chrome always comes from AppShell. Every screen loads from
          `/portal/view` or a dedicated domain API — no client fixture tables.
        </p>
      </Panel>
    </ScreenScaffold>
  );
}

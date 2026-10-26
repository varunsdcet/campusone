"use client";

import Link from "next/link";
import { Button, Panel } from "@myheritage/ui";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <Panel>
        <h1 style={{ fontFamily: "var(--mh-font-display)", marginTop: 0 }}>Offline</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>CampusOne cannot reach the server. Check your connection; unsaved form changes may still be open in the previous tab.</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="button" onClick={() => window.location.reload()}>Try again</Button>
          <Link href="/login"><Button type="button" variant="secondary">Sign in again</Button></Link>
          <Link href="/role-select"><Button type="button" variant="secondary">Workspaces</Button></Link>
        </div>
      </Panel>
    </div>
  );
}

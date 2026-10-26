"use client";

import Link from "next/link";
import { Button, Panel } from "@myheritage/ui";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <Panel>
        <h1 style={{ fontFamily: "var(--mh-font-display)", marginTop: 0 }}>Permission denied</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>Your signed-in account does not have permission to open this page. Ask an administrator for the required access level if this is part of your work.</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button type="button" onClick={() => window.history.back()}>Go back</Button>
          <Link href="/login"><Button type="button" variant="secondary">Use another account</Button></Link>
          <Link href="/role-select"><Button type="button" variant="secondary">Workspaces</Button></Link>
        </div>
      </Panel>
    </div>
  );
}

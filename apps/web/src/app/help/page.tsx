"use client";

import Link from "next/link";
import { Button, Panel } from "@myheritage/ui";

export default function Page() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1.5rem" }}>
      <Panel>
        <h1 style={{ fontFamily: "var(--mh-font-display)", marginTop: 0 }}>Help</h1>
        <p style={{ color: "var(--mh-text-muted)" }}>Find the right place for account, course, finance, and technical support.</p>
        <ul>
          <li>Account access: use Forgot password on the sign-in page.</li>
          <li>Academic records or fees: contact your registrar from Messages.</li>
          <li>Technical issue: include the page address, time, and what you expected to happen.</li>
        </ul>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href="/login"><Button type="button">Sign in</Button></Link>
          <Link href="/role-select"><Button type="button" variant="secondary">Workspaces</Button></Link>
          <Link href="/accessibility"><Button type="button" variant="secondary">Accessibility</Button></Link>
        </div>
      </Panel>
    </div>
  );
}

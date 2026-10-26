"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Panel } from "@myheritage/ui";
import { MobileChrome } from "@/components/ScreenScaffold";
import { API_URL } from "@/lib/api";

type Status = "checking" | "online" | "offline" | "server";

export default function Page() {
  const [status, setStatus] = useState<Status>("checking");
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setStatus("checking");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("offline");
      setCheckedAt(new Date());
      return;
    }
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, "")}/health`, { cache: "no-store" });
      setStatus(res.ok ? "online" : "server");
    } catch {
      setStatus(navigator.onLine ? "server" : "offline");
    }
    setCheckedAt(new Date());
  }, []);

  useEffect(() => {
    void check();
    const onChange = () => void check();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, [check]);

  const copy: Record<Status, { title: string; body: string }> = {
    checking: { title: "Checking your connection…", body: "This only takes a moment." },
    online: { title: "You're online", body: "Your courses, schedule and messages are loading live from CampusOne." },
    offline: {
      title: "You're offline",
      body: "Your device has no internet connection. Reconnect to Wi-Fi or mobile data; this page will update on its own when you're back online.",
    },
    server: {
      title: "CampusOne can't be reached",
      body: "Your device is online but the CampusOne service did not respond. Try again in a few minutes.",
    },
  };

  return (
    <MobileChrome title="CampusOne">
      <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Connection</h1>
      <p style={{ margin: "0 0 16px", color: "var(--mh-text-muted)", fontSize: 13 }}>
        {checkedAt ? `Last checked ${checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : "Checking…"}
      </p>
      <Panel title={copy[status].title}>
        <p role="status" aria-live="polite" style={{ margin: "0 0 12px" }}>
          {copy[status].body}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button type="button" onClick={() => void check()} disabled={status === "checking"}>
            {status === "checking" ? "Checking…" : "Try again"}
          </Button>
          {status === "online" ? (
            <Link href="/m/student" style={{ alignSelf: "center" }}>
              Go to mobile home
            </Link>
          ) : null}
        </div>
      </Panel>
    </MobileChrome>
  );
}

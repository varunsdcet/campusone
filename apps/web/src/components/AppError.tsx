"use client";

import { useEffect } from "react";

const RELOAD_KEY = "mh:chunk-reload";

/** A tab opened before a deploy requests JS chunks that no longer exist; a fresh load picks up the new build. */
function isStaleBuild(error: Error) {
  return error.name === "ChunkLoadError" || /Loading (CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message);
}

export function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const stale = isStaleBuild(error);

  useEffect(() => {
    console.error(error);
    if (!stale) return;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  }, [error, stale]);

  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "var(--font-sans, system-ui, sans-serif)" }}>
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>{stale ? "CampusOne was updated" : "Something went wrong"}</h1>
        <p style={{ color: "#5b6472", margin: "0 0 18px", lineHeight: 1.5 }}>
          {stale ? "A newer version is available. Reload the page to continue." : "This page hit an unexpected error. Try again, or reload the page."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {!stale ? (
            <button type="button" className="mh-sa__btn" onClick={reset}>
              Try again
            </button>
          ) : null}
          <button type="button" className="mh-sa__btn mh-sa__btn--primary" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
        {error.digest ? <p style={{ color: "#8a93a1", fontSize: 12, marginTop: 16 }}>Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}

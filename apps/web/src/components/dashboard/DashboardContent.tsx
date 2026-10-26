"use client";

import "./dashboard.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { dashApi, sanitizeDashboardHtml, type DashboardView } from "@/lib/dashboard";

export function DashboardHtml({ html }: { html: string }) {
  const [clean, setClean] = useState("");
  useEffect(() => setClean(sanitizeDashboardHtml(html)), [html]);
  return <div className="mh-dash__rich" dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** Configured dashboard page: heading, layout and the content blocks visible to the signed-in user. */
export function DashboardContent() {
  const [view, setView] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashApi<DashboardView>("")
      .then(setView)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load dashboard content"));
  }, []);

  if (error) return <p className="mh-dash__error">{error}</p>;
  if (!view) return <div className="mh-dash__loading" aria-busy="true" />;

  const twoColumns = view.settings.layout === "Two Columns";
  return (
    <section className="mh-dash" aria-labelledby="mh-dash-title">
      <header className="mh-dash__head">
        <h1 id="mh-dash-title">{view.settings.title}</h1>
        {view.canEdit ? (
          <Link href="/admin/dashboard/edit" className="mh-dash__edit">
            Edit Page
          </Link>
        ) : null}
      </header>
      {view.blocks.length ? (
        <div className={`mh-dash__blocks${twoColumns ? " mh-dash__blocks--two" : ""}`} data-layout={view.settings.layout}>
          {view.blocks.map((b) => (
            <article key={b.id} className="mh-dash__block" aria-label={b.name}>
              <DashboardHtml html={b.content} />
            </article>
          ))}
        </div>
      ) : (
        <p className="mh-dash__empty">No dashboard content is available right now.</p>
      )}
    </section>
  );
}

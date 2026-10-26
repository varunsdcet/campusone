"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ConfigForm, ConfigList, hasConfigForm, isConfig } from "./config";
import { FIN, FinFrame, str } from "./kit";
import { RECORDS } from "./records";

function Unknown() {
  return (
    <FinFrame title="Not found" href={FIN}>
      <section className="mh-sa__card">
        <p>This Financial Management page does not exist.</p>
        <Link className="mh-sa__btn" href="/admin">
          Back to dashboard
        </Link>
      </section>
    </FinFrame>
  );
}

const useSlug = () => str(useParams<{ slug: string }>()?.slug);

export function FinanceScreen() {
  const slug = useSlug();
  const Records = RECORDS[slug];
  if (Records) return <Records />;
  if (isConfig(slug)) return <ConfigList slug={slug} />;
  return <Unknown />;
}

export function FinanceConfigForm({ mode }: { mode: "create" | "edit" }) {
  const slug = useSlug();
  if (!hasConfigForm(slug)) return <Unknown />;
  return <ConfigForm slug={slug} mode={mode} />;
}

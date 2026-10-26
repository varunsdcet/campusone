"use client";

import { useRouter } from "next/navigation";
import { useSisLive } from "@/lib/useAdminSisLive";

/** Shared CTA — navigates when href is set, otherwise POSTs /admin/sis/action so no button is a no-op. */
export function SisActionBtn({
  label,
  href,
  tone = "primary",
  rowKey,
  className,
  danger,
}: {
  label: string;
  href?: string;
  tone?: "primary" | "secondary" | "danger";
  rowKey?: string;
  className?: string;
  danger?: boolean;
}) {
  const router = useRouter();
  const live = useSisLive();
  const resolvedTone = tone === "danger" || danger ? "primary" : tone;
  const isDanger = tone === "danger" || danger;
  return (
    <button
      type="button"
      className={
        className ||
        `mh-sis-dash__btn mh-sis-dash__btn--${resolvedTone}${isDanger ? " mh-sis-cp-btn--danger" : ""}`
      }
      disabled={live.busy}
      onClick={() => {
        if (href) {
          router.push(href);
          return;
        }
        void live.runAction(label, rowKey);
      }}
    >
      {label}
    </button>
  );
}

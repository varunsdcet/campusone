"use client";

import { Suspense } from "react";
import { TemplateAudit } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TemplateAudit />
    </Suspense>
  );
}

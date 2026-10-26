"use client";

import { Suspense } from "react";
import { SiteTemplateSettings } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SiteTemplateSettings />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { DashboardSettings } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardSettings />
    </Suspense>
  );
}

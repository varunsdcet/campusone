"use client";

import { Suspense } from "react";
import { DashboardEditor } from "@/components/dashboard/DashboardEditor";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardEditor />
    </Suspense>
  );
}

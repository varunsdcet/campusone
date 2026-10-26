"use client";

import { Suspense } from "react";
import { RunReportsList } from "@/components/reporting/Reporting";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RunReportsList />
    </Suspense>
  );
}

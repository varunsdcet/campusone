"use client";

import { Suspense } from "react";
import { ScheduledReports } from "@/components/reporting/Reporting";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ScheduledReports />
    </Suspense>
  );
}

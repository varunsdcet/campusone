"use client";

import { Suspense } from "react";
import { ManageReportTemplates } from "@/components/reporting/Reporting";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageReportTemplates />
    </Suspense>
  );
}

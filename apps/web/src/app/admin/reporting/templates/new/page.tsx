"use client";

import { Suspense } from "react";
import { ReportTemplateEditor } from "@/components/reporting/Reporting";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportTemplateEditor mode="create" />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { ReportCategoryForm } from "@/components/reporting/Reporting";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReportCategoryForm mode="edit" />
    </Suspense>
  );
}

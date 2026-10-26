"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { RunReportScreen } from "@/components/reporting/Reporting";

function Screen() {
  const params = useParams<{ id: string }>();
  return <RunReportScreen key={params.id} templateId={params.id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { StudentFeesView } from "@/components/StudentFinanceViews";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentFeesView />
    </Suspense>
  );
}

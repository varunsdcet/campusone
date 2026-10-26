"use client";

import { Suspense } from "react";
import { StudentTransactionHistoryView } from "@/components/StudentFinanceViews";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentTransactionHistoryView />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { StudentFinance } from "@/components/finance/student";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StudentFinance />
    </Suspense>
  );
}

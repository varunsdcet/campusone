"use client";

import { Suspense } from "react";
import { FinanceScreen } from "@/components/finance/screens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinanceScreen />
    </Suspense>
  );
}

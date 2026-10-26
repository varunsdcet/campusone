"use client";

import { Suspense } from "react";
import { FinanceConfigForm } from "@/components/finance/screens";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FinanceConfigForm mode="edit" />
    </Suspense>
  );
}

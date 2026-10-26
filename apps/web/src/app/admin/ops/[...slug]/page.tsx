"use client";

import { Suspense } from "react";
import { OpsApp } from "@/components/ops/Ops";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OpsApp />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { SecurityManagement } from "@/components/sysconfig/security";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SecurityManagement />
    </Suspense>
  );
}

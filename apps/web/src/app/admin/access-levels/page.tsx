"use client";

import { Suspense } from "react";
import { SuperAccessLevels } from "@/components/superadmin/UserManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperAccessLevels />
    </Suspense>
  );
}

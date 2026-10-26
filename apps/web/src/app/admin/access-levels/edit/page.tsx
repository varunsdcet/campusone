"use client";

import { Suspense } from "react";
import { SuperAccessLevelForm } from "@/components/superadmin/UserManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperAccessLevelForm />
    </Suspense>
  );
}

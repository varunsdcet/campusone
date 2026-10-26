"use client";

import { Suspense } from "react";
import { SuperUserDirectory } from "@/components/superadmin/UserManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperUserDirectory />
    </Suspense>
  );
}

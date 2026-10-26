"use client";

import { Suspense } from "react";
import { SuperSecuritySettings } from "@/components/superadmin/AccountSettings";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperSecuritySettings />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { SuperTimeZone } from "@/components/superadmin/AccountSettings";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperTimeZone />
    </Suspense>
  );
}

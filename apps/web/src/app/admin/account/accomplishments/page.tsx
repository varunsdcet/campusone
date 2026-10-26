"use client";

import { Suspense } from "react";
import { SuperAccomplishments } from "@/components/superadmin/AccountSettings";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperAccomplishments />
    </Suspense>
  );
}

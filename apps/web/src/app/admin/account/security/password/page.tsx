"use client";

import { Suspense } from "react";
import { SuperChangePassword } from "@/components/superadmin/AccountSettings";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperChangePassword />
    </Suspense>
  );
}

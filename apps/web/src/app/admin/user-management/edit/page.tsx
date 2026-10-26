"use client";

import { Suspense } from "react";
import { SuperUserForm } from "@/components/superadmin/UserManagement";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperUserForm />
    </Suspense>
  );
}

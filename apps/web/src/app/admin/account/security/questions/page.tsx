"use client";

import { Suspense } from "react";
import { SuperSecurityQuestions } from "@/components/superadmin/AccountSettings";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SuperSecurityQuestions />
    </Suspense>
  );
}

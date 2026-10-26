"use client";

import { Suspense } from "react";
import { LoginPageSettings } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPageSettings />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { EmailSystem } from "@/components/sysconfig/email";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <EmailSystem />
    </Suspense>
  );
}

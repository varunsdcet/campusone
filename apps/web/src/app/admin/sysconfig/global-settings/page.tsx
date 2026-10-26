"use client";

import { Suspense } from "react";
import { GlobalSettings } from "@/components/sysconfig/global";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GlobalSettings />
    </Suspense>
  );
}

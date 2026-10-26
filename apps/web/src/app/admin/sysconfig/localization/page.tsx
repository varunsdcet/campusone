"use client";

import { Suspense } from "react";
import { Localization } from "@/components/sysconfig/localization";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Localization />
    </Suspense>
  );
}

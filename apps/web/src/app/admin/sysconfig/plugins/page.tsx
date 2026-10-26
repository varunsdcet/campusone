"use client";

import { Suspense } from "react";
import { Plugins } from "@/components/sysconfig/global";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Plugins />
    </Suspense>
  );
}

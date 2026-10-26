"use client";

import { Suspense } from "react";
import { Correspondence } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Correspondence />
    </Suspense>
  );
}

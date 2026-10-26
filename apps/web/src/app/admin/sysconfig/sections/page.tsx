"use client";

import { Suspense } from "react";
import { Sections } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Sections />
    </Suspense>
  );
}

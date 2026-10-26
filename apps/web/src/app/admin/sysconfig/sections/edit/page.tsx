"use client";

import { Suspense } from "react";
import { SectionForm } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SectionForm mode="edit" />
    </Suspense>
  );
}

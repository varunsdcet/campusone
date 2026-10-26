"use client";

import { Suspense } from "react";
import { DocumentTemplates } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentTemplates />
    </Suspense>
  );
}

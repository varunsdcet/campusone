"use client";

import { Suspense } from "react";
import { DocumentTemplateForm } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentTemplateForm mode="edit" />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { CorrespondenceCategoryForm } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CorrespondenceCategoryForm mode="edit" />
    </Suspense>
  );
}

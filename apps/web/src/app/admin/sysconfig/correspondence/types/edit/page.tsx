"use client";

import { Suspense } from "react";
import { CorrespondenceTypeForm } from "@/components/sysconfig/content";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CorrespondenceTypeForm mode="edit" />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { ManageInstitutions } from "@/components/location/Institutions";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageInstitutions />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { ManageInstitution } from "@/components/location/Institutions";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageInstitution />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { AddInstitution } from "@/components/location/Institutions";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AddInstitution />
    </Suspense>
  );
}

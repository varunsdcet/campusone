"use client";

import { Suspense } from "react";
import { ManageProvinces } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageProvinces />
    </Suspense>
  );
}

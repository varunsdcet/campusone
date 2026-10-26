"use client";

import { Suspense } from "react";
import { RegionForm } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <RegionForm mode="edit" />
    </Suspense>
  );
}

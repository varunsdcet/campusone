"use client";

import { Suspense } from "react";
import { ManageBrands } from "@/components/location/Brands";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageBrands />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { ManageBrand } from "@/components/location/Brands";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageBrand />
    </Suspense>
  );
}

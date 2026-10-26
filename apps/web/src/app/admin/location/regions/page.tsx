"use client";

import { Suspense } from "react";
import { ManageRegions } from "@/components/location/Places";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageRegions />
    </Suspense>
  );
}

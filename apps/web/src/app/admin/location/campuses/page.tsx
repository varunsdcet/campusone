"use client";

import { Suspense } from "react";
import { ManageCampuses } from "@/components/location/Campuses";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ManageCampuses />
    </Suspense>
  );
}

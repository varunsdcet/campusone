"use client";

import { Suspense } from "react";
import { CampusForm } from "@/components/location/Campuses";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CampusForm mode="create" />
    </Suspense>
  );
}

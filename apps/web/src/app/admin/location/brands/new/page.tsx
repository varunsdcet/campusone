"use client";

import { Suspense } from "react";
import { AddBrand } from "@/components/location/Brands";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AddBrand />
    </Suspense>
  );
}

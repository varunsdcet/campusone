"use client";

import { Suspense } from "react";
import { MyWorkshops } from "@/components/workshops/WorkshopLists";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MyWorkshops />
    </Suspense>
  );
}

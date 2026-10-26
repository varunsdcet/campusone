"use client";

import { Suspense } from "react";
import { WorkshopRolesList } from "@/components/workshops/WorkshopRoles";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkshopRolesList />
    </Suspense>
  );
}

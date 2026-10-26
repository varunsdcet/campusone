"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { WorkshopCategoryForm } from "@/components/workshops/WorkshopManage";

function Screen() {
  const params = useParams<{ id: string }>();
  return <WorkshopCategoryForm key={params.id} id={params.id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  );
}

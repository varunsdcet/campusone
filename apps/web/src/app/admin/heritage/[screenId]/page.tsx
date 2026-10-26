"use client";

import { Suspense, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeritageScreenPage } from "@/components/heritage/HeritageScreen";
import { COURSE_MANAGEMENT_ROUTES } from "@/lib/heritageNav";

export default function Page({ params }: { params: Promise<{ screenId: string }> }) {
  const { screenId } = use(params);
  const router = useRouter();
  const moved = COURSE_MANAGEMENT_ROUTES[screenId.toUpperCase()];
  useEffect(() => {
    if (moved) router.replace(moved);
  }, [moved, router]);
  if (moved) return null;
  return (
    <Suspense fallback={null}>
      <HeritageScreenPage key={screenId} screenId={screenId} />
    </Suspense>
  );
}

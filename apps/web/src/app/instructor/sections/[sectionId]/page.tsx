"use client";

import { LiveScreen } from "@/components/LiveScreen";
import { useParams } from "next/navigation";

export default function Page() {
  const params = useParams<{ sectionId: string }>();
  const sectionId = params?.sectionId ?? "demo";
  return <LiveScreen path={`/instructor/sections/${sectionId}`} />;
}

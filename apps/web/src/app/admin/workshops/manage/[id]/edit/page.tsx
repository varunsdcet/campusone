"use client";

import { useParams } from "next/navigation";
import { WorkshopForm } from "@/components/workshops/WorkshopForm";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <WorkshopForm key={params.id} id={params.id} />;
}

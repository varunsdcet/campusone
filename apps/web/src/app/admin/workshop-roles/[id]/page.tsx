"use client";

import { useParams } from "next/navigation";
import { WorkshopRoleForm } from "@/components/workshops/WorkshopRoles";

export default function Page() {
  const params = useParams<{ id: string }>();
  return <WorkshopRoleForm key={params.id} id={params.id} />;
}

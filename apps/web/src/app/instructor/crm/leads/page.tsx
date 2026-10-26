import { Suspense } from "react";
import { InstructorCrmWorkspace } from "@/components/crm/InstructorCrmWorkspace";

export default function InstructorCrmLeadsPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading assigned leads…</div>}><InstructorCrmWorkspace /></Suspense>;
}

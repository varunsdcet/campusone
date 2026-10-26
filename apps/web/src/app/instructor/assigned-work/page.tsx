import { Suspense } from "react";
import { AssignedWorkWorkspace } from "@/components/instructor/AssignedWorkWorkspace";

export default function InstructorAssignedWorkPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading assigned work…</div>}><AssignedWorkWorkspace /></Suspense>;
}

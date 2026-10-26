import { Suspense } from "react";
import { InstructorSuccessWorkspace } from "@/components/student-success/InstructorSuccessWorkspace";

export default function InstructorSuccessCasesPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading assigned cases…</div>}><InstructorSuccessWorkspace view="cases" /></Suspense>;
}

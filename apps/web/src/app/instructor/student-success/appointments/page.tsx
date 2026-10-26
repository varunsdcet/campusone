import { Suspense } from "react";
import { InstructorSuccessWorkspace } from "@/components/student-success/InstructorSuccessWorkspace";

export default function InstructorSuccessAppointmentsPage() {
  return <Suspense fallback={<div style={{ padding: 24 }}>Loading appointments…</div>}><InstructorSuccessWorkspace view="appointments" /></Suspense>;
}

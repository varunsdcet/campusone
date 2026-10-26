"use client";

import { Suspense } from "react";
import { StudentSisShell } from "@/components/StudentSisShell";
import { TaxDocumentsFormsView } from "@/components/TaxDocumentsFormsView";

export default function TaxDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <TaxDocumentsFormsView
        role="student"
        apiPath="/student/tax-documents"
        activeHref="/student/f/st-26-tax-documents"
        shell={({ children, userName }) => (
          <StudentSisShell title="" activeHref="/student/f/st-26-tax-documents" userName={userName}>
            {children}
          </StudentSisShell>
        )}
      />
    </Suspense>
  );
}

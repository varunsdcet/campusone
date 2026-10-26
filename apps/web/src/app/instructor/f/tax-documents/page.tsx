"use client";

import { Suspense } from "react";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import { TaxDocumentsFormsView } from "@/components/TaxDocumentsFormsView";

export default function InstructorTaxDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <TaxDocumentsFormsView
        role="instructor"
        apiPath="/instructor/tax-documents"
        activeHref="/instructor/f/tax-documents"
        shell={({ children, userName }) => (
          <TeacherSisShell title="" activeHref="/instructor/f/tax-documents" userName={userName}>
            {children}
          </TeacherSisShell>
        )}
      />
    </Suspense>
  );
}

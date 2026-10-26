"use client";

import { Suspense } from "react";
import ResetPasswordInner from "./ResetPasswordInner";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading…</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

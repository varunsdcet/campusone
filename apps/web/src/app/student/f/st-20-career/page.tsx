"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/student/career");
  }, [router]);
  return <p style={{ color: "var(--mh-text-muted)", padding: 24 }}>Opening career opportunities…</p>;
}

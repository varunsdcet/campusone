"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadSession } from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    const session = loadSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.roles.includes("instructor")) router.replace("/instructor");
    else if (session.roles.includes("admin") || session.roles.includes("registrar"))
      router.replace("/admin");
    else router.replace("/student");
  }, [router]);
  return <p style={{ padding: "2rem" }}>Opening CampusOne…</p>;
}

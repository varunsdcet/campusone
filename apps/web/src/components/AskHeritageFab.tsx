"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ASK_HREF: Record<string, string> = {
  instructor: "/instructor/ask",
  student: "/student/ask",
  admin: "/admin/ai/ask",
  applicant: "/applicant/ask",
  employer: "/employer/ask",
};

/** Fixed bottom-right Ask CampusOne launcher — same on every shell screen. */
export function AskHeritageFab({
  role,
}: {
  role: "instructor" | "student" | "admin" | "applicant" | "employer";
}) {
  const pathname = usePathname() || "";
  const href = ASK_HREF[role] || `/${role}/ask`;
  const onAskPage =
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    /\/ask(\/|$)/.test(pathname);
  // The composer's Send button sits bottom-right, exactly where the launcher floats.
  const onMessages = /^\/[^/]+\/messages(\/|$)/.test(pathname);

  if (onAskPage || onMessages) return null;

  return (
    <Link
      href={href}
      className="mh-ask-fab"
      aria-label="Ask CampusOne"
      title="Ask CampusOne"
    >
      <img src="/brand/icons/sparkle.svg" alt="" width={18} height={18} />
      <span className="mh-ask-fab__label">Ask CampusOne</span>
    </Link>
  );
}

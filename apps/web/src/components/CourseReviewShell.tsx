"use client";

import type { ReactNode } from "react";
import { AdminSisShell } from "@/components/AdminSisShell";
import { TeacherSisShell } from "@/components/TeacherSisShell";
import type { Session } from "@/lib/api";
import { courseReviewPortal } from "@/lib/courseReviewPortal";

export function CourseReviewShell({
  session,
  title,
  subtitle,
  children,
}: {
  session: Session;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const userName = `${session.givenName} ${session.familyName}`.trim() || "User";

  if (courseReviewPortal(session.roles) === "admin") {
    return (
      <AdminSisShell
        activeHref="/admin/course-management/courses/active"
        navigationPath="/admin/course-management/courses/active"
        breadcrumbs={["Home", "Course Management", title]}
        breadcrumbHrefs={["/admin", "/admin/course-management/courses/active"]}
        userName={userName}
        userRole={session.roles.includes("admin") ? "Administrator" : "Registrar"}
      >
        <div className="mh-teacher-page-head" style={{ marginBottom: 16 }}>
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
        </div>
        {children}
      </AdminSisShell>
    );
  }

  return (
    <TeacherSisShell
      title={title}
      subtitle={subtitle}
      activeHref="/instructor/gradebook"
      userName={userName}
      userRole="INSTRUCTOR"
    >
      {children}
    </TeacherSisShell>
  );
}

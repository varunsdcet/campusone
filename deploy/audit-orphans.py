#!/usr/bin/env python3
"""Local orphan / wiring audit for admin+teacher+student."""
from __future__ import annotations

import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / "apps/web/src/app"
screens_txt = (root / "apps/web/src/lib/screens.ts").read_text()
catalog = set(re.findall(r'path:\s*"([^"]+)"', screens_txt))

missing_from_catalog: list[str] = []
for role in ("admin", "instructor", "student"):
    for page in (app / role).rglob("page.tsx"):
        rel = "/" + str(page.relative_to(app).parent).replace("\\", "/")
        if "[" in rel:
            continue
        if rel not in catalog:
            missing_from_catalog.append(rel)

missing_pages: list[str] = []
for path in sorted(catalog):
    if "[" in path:
        continue
    parts = path.strip("/").split("/")
    if not parts or parts[0] not in {"admin", "instructor", "student"}:
        continue
    candidate = app.joinpath(*parts, "page.tsx")
    if not candidate.exists():
        missing_pages.append(path)

print(f"ORPHAN_PAGES_NOT_IN_SCREENS={len(missing_from_catalog)}")
for m in sorted(missing_from_catalog)[:30]:
    print(f"  {m}")
if len(missing_from_catalog) > 30:
    print(f"  ... +{len(missing_from_catalog) - 30} more")

print(f"CATALOG_WITHOUT_PAGE={len(missing_pages)}")
for m in missing_pages[:20]:
    print(f"  {m}")

sf = (root / "apps/web/src/components/StudentFunctionalViews.tsx").read_text()
for name in (
    "StudentCoursesView",
    "StudentAssignmentsView",
    "StudentAssignmentDetailView",
    "StudentCalendarView",
    "StudentNotificationsView",
    "StudentProfileView",
    "StudentSearchView",
):
    print(f"VIEW {name}={'OK' if f'export function {name}' in sf else 'MISSING'}")

print(f"STUDENT_ROUTER={'OK' if (root / 'apps/api/src/modules/student/student.router.ts').exists() else 'MISSING'}")
print(f"INSTRUCTOR_ROUTER={'OK' if (root / 'apps/api/src/modules/instructor/instructor.router.ts').exists() else 'MISSING'}")
print(f"ADMIN_ROUTER={'OK' if (root / 'apps/api/src/modules/admin/admin.router.ts').exists() else 'MISSING'}")

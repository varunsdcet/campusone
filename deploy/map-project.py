#!/usr/bin/env python3
"""Full project mapping dump for MyHeritage."""
from __future__ import annotations

import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
app = root / "apps/web/src/app"
api = root / "apps/api/src"

pages: dict[str, list[str]] = {}
for p in sorted(app.rglob("page.tsx")):
    rel = "/" + str(p.relative_to(app).parent).replace("\\", "/")
    if rel.endswith("/."):
        rel = "/"
    top = rel.strip("/").split("/")[0] if rel.strip("/") else "root"
    pages.setdefault(top, []).append(rel)

screens = set(re.findall(r'path:\s*"([^"]+)"', (root / "apps/web/src/lib/screens.ts").read_text()))
admin_cat = set(re.findall(r'"(/admin[^"]+)":\s*\{', (root / "apps/web/src/lib/adminSisCatalog.ts").read_text()))
teacher = set(re.findall(r'TEACHER_SCREENS\["([^"]+)"\]', (root / "apps/web/src/lib/teacherCatalog.ts").read_text()))
teacher |= set(re.findall(r'"(/instructor/[^"]+)":\s*\{', (root / "apps/web/src/lib/teacherCatalog.ts").read_text()))

main = (api / "main.ts").read_text()
mounts = re.findall(r'app\.use\("([^"]+)"', main)

routes: list[tuple[str, str, str]] = []
seen: set[tuple[str, str]] = set()
for f in api.rglob("*.ts"):
    txt = f.read_text(errors="ignore")
    for m in re.finditer(r'(?:app|\w+Router)\.(get|post|put|patch|delete)\(\s*[`"\']([^`"\']+)[`"\']', txt):
        key = (m.group(1).upper(), m.group(2))
        if key in seen:
            continue
        seen.add(key)
        routes.append((m.group(1).upper(), m.group(2), str(f.relative_to(api))))

orphans = []
for role in ("admin", "instructor", "student"):
    for rel in pages.get(role, []):
        if "[" in rel:
            continue
        if rel not in screens:
            orphans.append(rel)

missing_pages = []
for path in sorted(screens):
    if "[" in path:
        continue
    parts = path.strip("/").split("/")
    if not parts or parts[0] not in {"admin", "instructor", "student", "m"}:
        continue
    if not (app.joinpath(*parts, "page.tsx")).exists():
        missing_pages.append(path)

print("## COUNTS")
for k in sorted(pages):
    print(f"pages.{k}={len(pages[k])}")
print(f"screens.ts={len(screens)}")
print(f"adminSisCatalog={len(admin_cat)}")
print(f"teacherCatalog={len(teacher)}")
print(f"api.mounts={','.join(mounts)}")
print(f"api.routes={len(routes)}")
print(f"orphans_not_in_screens={len(orphans)}")
print(f"screens_without_page={len(missing_pages)}")

print("\n## API_ROUTES")
for method, path, file in sorted(routes, key=lambda x: (x[1], x[0])):
    print(f"{method}\t{path}\t{file}")

print("\n## ORPHANS")
for o in orphans:
    print(o)

print("\n## SCREENS_WITHOUT_PAGE")
for m in missing_pages:
    print(m)

print("\n## KEY_FLOWS")
flows = [
    "auth.login -> role home",
    "auth.forgot-password -> Humanitix mail -> auth.reset-password",
    "admin.users.create -> welcome mail + notification",
    "admin.sections + enrolments -> teacher bootstrap + student courses",
    "admin.sis programs/schedule/finance/ai/audit/student-360",
    "instructor.attendance/announcements/assessments/gradebook/profile/bio",
    "student.assignments/grades/fees/calendar/profile/ask/search",
    "GET /search global",
    "POST /ai/ask Ask Heritage",
]
for f in flows:
    print(f"- {f}")

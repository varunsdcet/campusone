#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
screens_path = root / "apps/web/src/lib/screens.ts"
txt = screens_path.read_text()
catalog = set(re.findall(r'path:\s*"([^"]+)"', txt))
app = root / "apps/web/src/app"

title_map = {
    "/admin/admissions": "Admissions hub",
    "/admin/ai": "AI hub",
    "/admin/compliance": "Compliance hub",
    "/admin/courses": "Courses hub",
    "/admin/crm": "CRM hub",
    "/admin/files": "Files hub",
    "/admin/finance": "Finance hub",
    "/admin/flags": "Flags hub",
    "/admin/forms": "Forms hub",
    "/admin/integrations": "Integrations hub",
    "/admin/labs": "Labs hub",
    "/admin/payments": "Payments hub",
    "/admin/permissions": "Permissions hub",
    "/admin/platform": "Platform hub",
    "/admin/practicum": "Practicum hub",
    "/admin/programs": "Programs hub",
    "/admin/records": "Records hub",
    "/admin/refunds": "Refunds hub",
    "/admin/rules": "Rules hub",
    "/admin/schedule": "Schedule hub",
    "/admin/sections": "Sections hub",
    "/admin/students": "Students hub",
    "/admin/success": "Success hub",
    "/admin/templates": "Templates hub",
    "/admin/terms": "Terms hub",
    "/admin/transcripts": "Transcripts hub",
    "/admin/workflows": "Workflows hub",
    "/instructor/announcements": "Announcements",
    "/instructor/assessments": "Assessments",
    "/instructor/gradebook": "Live gradebook",
    "/instructor/labs": "Labs",
    "/instructor/lectures": "Lectures",
    "/instructor/messages": "Messages",
    "/instructor/modules": "Modules",
    "/instructor/profile": "Profile",
    "/instructor/roster": "Roster",
    "/instructor/sections/demo": "Section detail demo",
    "/instructor/studio": "AI course studio",
    "/instructor/submissions": "Submissions",
}

orphans: list[str] = []
for role in ("admin", "instructor", "student"):
    for page in sorted((app / role).rglob("page.tsx")):
        rel = "/" + str(page.relative_to(app).parent).replace("\\", "/")
        if "[" in rel or rel in catalog:
            continue
        orphans.append(rel)

entries: list[str] = []
for i, path in enumerate(sorted(orphans), 1):
    role = (
        "admin"
        if path.startswith("/admin")
        else "instructor"
        if path.startswith("/instructor")
        else "student"
    )
    group = {"admin": "Admin", "instructor": "Instructor", "student": "Student"}[role]
    title = title_map.get(path) or path.rsplit("/", 1)[-1].replace("-", " ").title()
    sid = f"HUB-{role[:2].upper()}-{i:02d}"
    entries.append(
        f'  {{ id: "{sid}", role: "{role}", path: "{path}", title: "{title}", group: "{group}" }},'
    )

needle = '  { id: "AD-SET", role: "admin", path: "/admin/settings", title: "Settings", group: "Admin" },\n];'
if needle not in txt:
    raise SystemExit("needle not found")

replacement = (
    '  { id: "AD-SET", role: "admin", path: "/admin/settings", title: "Settings", group: "Admin" },\n'
    + "\n".join(entries)
    + "\n];"
)
txt2 = txt.replace(needle, replacement, 1)

new_count = len(set(re.findall(r'path:\s*"([^"]+)"', txt2)))
txt2 = re.sub(r"catalogPaths:\s*\d+", f"catalogPaths: {new_count}", txt2)
admin_n = sum(1 for p in re.findall(r'path:\s*"([^"]+)"', txt2) if p.startswith("/admin"))
inst_n = sum(1 for p in re.findall(r'path:\s*"([^"]+)"', txt2) if p.startswith("/instructor"))
stu_n = sum(1 for p in re.findall(r'path:\s*"([^"]+)"', txt2) if p.startswith("/student"))
txt2 = re.sub(r"adminUnique:\s*\d+", f"adminUnique: {admin_n}", txt2)
txt2 = re.sub(r"teacherUnique:\s*\d+", f"teacherUnique: {inst_n}", txt2)
txt2 = re.sub(r"studentUnique:\s*\d+", f"studentUnique: {stu_n}", txt2)

screens_path.write_text(txt2)
print(f"added={len(entries)} catalogPaths={new_count} admin={admin_n} teacher={inst_n} student={stu_n}")

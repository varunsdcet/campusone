#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
app = root / "apps/web/src/app"
catalog = set(re.findall(r'path:\s*"([^"]+)"', (root / "apps/web/src/lib/screens.ts").read_text()))
orphans = []
for role in ("admin", "instructor", "student"):
    for page in sorted((app / role).rglob("page.tsx")):
        rel = "/" + str(page.relative_to(app).parent).replace("\\", "/")
        if "[" in rel or rel in catalog:
            continue
        txt = page.read_text(errors="ignore")
        if "redirect(" in txt or "permanentRedirect" in txt:
            kind = "redirect"
        elif "LiveScreen" in txt or "AdminSis" in txt or "TeacherSis" in txt or "Student" in txt:
            kind = "screen"
        else:
            kind = "other"
        orphans.append((kind, rel))
for kind, rel in orphans:
    print(f"{kind}\t{rel}")
print(f"TOTAL\t{len(orphans)}")

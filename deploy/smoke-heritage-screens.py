#!/usr/bin/env python3
"""Smoke test for the Heritage SIS screen engine (/admin/heritage).

Loads every registry screen, then exercises create / edit / delete / action /
export / audit on a config screen, a per-student screen and a write-through screen.

Usage: API_URL=http://host:4000 ADMIN_EMAIL=... ADMIN_PASSWORD=... deploy/smoke-heritage-screens.py
"""
import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get("API_URL", "http://46.202.163.202:4000").rstrip("/")
EMAIL = os.environ.get("ADMIN_EMAIL", "admin@heritage.edu")
PASSWORD = os.environ.get("ADMIN_PASSWORD", "Heritage!2026")
failures = []


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(API + path, data=data, method=method)
    r.add_header("content-type", "application/json")
    if token:
        r.add_header("authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}


def check(label, ok, detail=""):
    print(("OK   " if ok else "FAIL ") + label + (f"  {detail}" if detail else ""))
    if not ok:
        failures.append(label)


code, login = req("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD, "deviceFingerprint": "heritage-smoke-device-01"})
if "accessToken" not in login:
    sys.exit(f"login failed: HTTP {code} {login.get('error') or login.get('message')}")
T = login["accessToken"]

code, reg = req("GET", "/admin/heritage/registry", token=T)
check("registry", code == 200, json.dumps(reg.get("counts")))
ids = [s["id"] for m in reg["modules"] for s in m["screens"]]
bad, live = [], 0
for sid in ids:
    c, v = req("GET", f"/admin/heritage/screens/{sid}?perPage=5", token=T)
    if c != 200:
        bad.append(f"{sid}:{c}:{v.get('error') or v.get('message')}")
    elif v.get("source"):
        live += 1
check(f"all screens load ({len(ids) - len(bad)}/{len(ids)}, {live} with live data)", not bad, "; ".join(bad[:20]))

c, refs = req("GET", "/admin/heritage/refs", token=T)
check("refs", c == 200 and len(refs) > 10, f"{len(refs)} lists")
c, opts = req("GET", "/admin/heritage/context-options?type=student&q=", token=T)
students = opts.get("items", [])
check("student context options", c == 200 and len(students) > 0, f"{len(students)} students")

# Config screen: create -> edit -> action -> export -> audit -> delete
c, r = req("POST", "/admin/heritage/screens/F07/records", {"data": {"name": "Smoke Method", "create_agent_bonus_agent": "50"}}, T)
check("F07 create", c in (200, 201), str(r.get("message") or r.get("error")))
rid = r.get("id")
if rid:
    c, r = req("PATCH", f"/admin/heritage/screens/F07/records/{rid}", {"data": {"name": "Smoke Method 2"}}, T)
    check("F07 edit", c == 200, str(r.get("message") or r.get("error")))
    c, v = req("GET", "/admin/heritage/screens/F07?q=Smoke%20Method%202", token=T)
    check("F07 edit visible", c == 200 and v.get("total", 0) >= 1)
    c, ex = req("GET", "/admin/heritage/screens/F07/export", token=T)
    check("F07 export", c == 200 and "Smoke Method 2" in ex.get("csv", ""))
    c, au = req("GET", f"/admin/heritage/screens/F07/audit?recordId={rid}", token=T)
    check("F07 audit", c == 200 and len(au.get("items", [])) >= 2, f"{len(au.get('items', []))} entries")
    c, r = req("DELETE", f"/admin/heritage/screens/F07/records/{rid}", token=T)
    check("F07 delete", c == 200, str(r.get("message") or r.get("error")))

# Settings singleton
c, r = req("PUT", "/admin/heritage/screens/SC01/singleton", {"data": {"smoke": "yes"}}, T)
check("SC01 singleton save", c == 200, str(r.get("message") or r.get("error")))

# Per-student screen + write-through ledger charge
if students:
    ctx = students[0]["key"]
    c, v = req("GET", f"/admin/heritage/screens/S03?ctx={ctx}", token=T)
    check("S03 student profile", c == 200 and (v.get("context") or {}).get("label"), (v.get("context") or {}).get("label", ""))
    c, v = req("GET", f"/admin/heritage/screens/SF01?ctx={ctx}", token=T)
    before = v.get("total", 0)
    check("SF01 student ledger", c == 200, f"{before} rows")
    c, r = req("POST", "/admin/heritage/screens/SF02/records", {"ctx": ctx, "data": {"fee_amount": ""}}, T)
    check("SF02 rejects zero fee with 400", c == 400, str(r.get("error") or r.get("message")))
    c, r = req("POST", "/admin/heritage/screens/SF02/records", {"ctx": ctx, "data": {"tuition_ledger_type": "Heritage smoke fee", "fee_amount": "1.00", "fee_note_comment": "Heritage smoke fee"}}, T)
    check("SF02 write-through charge", c in (200, 201), str(r.get("message") or r.get("error")))
    c, v = req("GET", f"/admin/heritage/screens/SF01?ctx={ctx}", token=T)
    check("SF01 shows new charge", c == 200 and v.get("total", 0) > before, f"{before} -> {v.get('total')}")
    smoke = [row for row in v.get("rows", []) if "Heritage smoke fee" in json.dumps(row.get("data"))]
    if smoke:
        c, r = req("DELETE", f"/admin/heritage/screens/SF01/records/{smoke[0]['id']}", token=T)
        check("SF01 waive smoke charge", c == 200, str(r.get("message") or r.get("error")))
        c, au = req("GET", f"/admin/heritage/screens/SF01/audit?ctx={ctx}&recordId={smoke[0]['id']}", token=T)
        check("ledger row audit trail (create on SF02 + waive on SF01)", c == 200 and len(au.get("items", [])) >= 2, f"{len(au.get('items', []))} entries")

c, r = req("POST", "/admin/heritage/verify-password", {"password": "wrong-password"}, T)
check("P11 gate rejects wrong password with 400", c == 400)

# Reporting module (RP01-RP04)
R = "/admin/heritage/reports"
smoke_runs = []
c, meta = req("GET", f"{R}/meta", token=T)
check("reporting meta", c == 200 and len(meta.get("sources", [])) >= 10, f"{len(meta.get('sources', []))} sources")
c, ro = req("GET", f"{R}/options", token=T)
check("reporting options", c == 200 and "programs" in ro, ", ".join(f"{k}:{len(v)}" for k, v in ro.items()))
c, cat = req("GET", f"{R}/catalog?runnable=1", token=T)
cats = {x["name"]: x for x in cat.get("categories", [])}
misc = [t["name"] for t in cats.get("Miscellaneous", {}).get("templates", [])]
expected_misc = ["Attendance Report", "Attendance Report- New", "Audit Report", "Enrolment Report", "Final Marks", "Financial Flags", "HCC Email", "New Report", "Student Balance Statements", "Student Profiles", "User Activity Report"]
check("RP01 AGENT REPORT > Agents onboard", any(t["name"] == "Agents onboard" for t in cats.get("AGENT REPORT", {}).get("templates", [])))
check("RP01 Miscellaneous reports", all(n in misc for n in expected_misc), f"missing: {[n for n in expected_misc if n not in misc]}")
tid = {t["name"]: t["id"] for x in cat.get("categories", []) for t in x["templates"]}
c, att = req("GET", f"{R}/templates/{tid.get('Attendance Report')}", token=T)
check("Attendance Report conditions", c == 200 and att.get("filters") == ["showTotals", "programs", "pathways", "campus", "term", "course", "status", "country", "rateCategories"] and att.get("conditionsTitle") == "Student Attendance", str(att.get("filters")))
c, hcc = req("GET", f"{R}/templates/{tid.get('HCC Email')}", token=T)
check("HCC Email conditions", c == 200 and hcc.get("filters") == ["showTotals", "programs", "schedules", "term", "status", "country", "rateCategories"] and hcc.get("showTotalsDefault") == "Yes" and hcc.get("conditionsTitle") == "Student Profiles", str(hcc.get("filters")))
bad = []
for name, i in tid.items():
    c, r = req("POST", f"{R}/templates/{i}/run", {"conditions": {}, "save": False}, T)
    smoke_runs.append(r.get("runId"))
    if c != 200:
        bad.append(f"{name}:{c}:{r.get('error') or r.get('message')}")
check(f"every report runs ({len(tid) - len(bad)}/{len(tid)})", not bad, "; ".join(bad))
c, run = req("POST", f"{R}/templates/{tid.get('Attendance Report')}/run", {"conditions": {"showTotals": "Yes"}, "save": False, "dates": {"enabled": True, "preset": "This Year"}}, T)
smoke_runs.append(run.get("runId"))
check("Attendance Report with totals + dates", c == 200 and run.get("totals") is not None and run.get("range"), f"{run.get('count')} rows, range {run.get('range')}")
if run.get("runId"):
    import base64
    c, x = req("GET", f"{R}/runs/{run['runId']}/export?format=Excel", token=T)
    check("export Excel (.xlsx)", c == 200 and base64.b64decode(x.get("base64", ""))[:2] == b"PK" and x.get("filename", "").endswith(".xlsx"), x.get("filename", ""))
    c, x = req("GET", f"{R}/runs/{run['runId']}/export?format=CSV", token=T)
    check("export CSV", c == 200 and b"Student" in base64.b64decode(x.get("base64", "")), x.get("filename", ""))

c, r = req("POST", f"{R}/categories", {"name": ""}, T)
check("RP03 empty category name rejected (400)", c == 400)
c, r = req("POST", f"{R}/categories", {"name": "Smoke Category"}, T)
check("RP03 create category", c == 201, str(r.get("message") or r.get("error")))
cid = r.get("id")
c, r = req("POST", f"{R}/categories", {"name": "smoke category"}, T)
check("RP03 duplicate category rejected (409)", c == 409)
misc_id = cats.get("Miscellaneous", {}).get("id")
c, r = req("DELETE", f"{R}/categories/{misc_id}", token=T)
check("Miscellaneous cannot be deleted", c == 400)
if cid:
    c, r = req("PATCH", f"{R}/categories/{cid}", {"name": "Smoke Category 2"}, T)
    check("RP03 edit category", c == 200)
    tpl = {"name": "Smoke Template", "description": "smoke", "categoryId": cid, "reportGroup": "Student / User Reports", "source": "students", "filters": ["showTotals", "programs", "status"], "columns": ["studentNumber", "studentName", "status", "program"], "graph": {"type": "Bar", "groupBy": "status", "measure": ""}}
    c, r = req("POST", f"{R}/templates", tpl, T)
    check("RP02 create template", c == 201, str(r.get("message") or r.get("error")))
    sid = r.get("id")
    if sid:
        c, r = req("PATCH", f"{R}/templates/{sid}", {"name": "Smoke Template 2", "separateWorkbooksBy": "Program"}, T)
        check("RP02 edit template", c == 200)
        c, r = req("POST", f"{R}/templates/{sid}/run", {"conditions": {}, "schedule": {"enabled": True, "frequency": "Daily", "time": "06:30", "recipients": ""}}, T)
        smoke_runs.append(r.get("runId"))
        check("custom template runs with graph + schedule", c == 200 and r.get("graph") and [col["key"] for col in r.get("columns", [])] == tpl["columns"], str(r.get("message") or r.get("error")))
        c, sl = req("GET", f"{R}/schedules", token=T)
        mine = [s for s in sl.get("items", []) if s.get("templateId") == sid]
        check("RP04 schedule listed", c == 200 and len(mine) == 1 and mine[0].get("nextRunAt"), mine[0].get("description", "") if mine else "")
        if mine:
            sch = mine[0]["id"]
            c, r = req("PATCH", f"{R}/schedules/{sch}", {"recipients": "not-an-email"}, T)
            check("RP04 bad recipient rejected (400)", c == 400)
            c, r = req("PATCH", f"{R}/schedules/{sch}", {"active": False}, T)
            check("RP04 pause schedule", c == 200 and r.get("message") == "Schedule paused")
            c, r = req("POST", f"{R}/schedules/{sch}/run-now", token=T)
            smoke_runs.append(r.get("runId"))
            check("RP04 run now", c == 200 and r.get("runId"), str(r.get("message") or r.get("error")))
            c, rl = req("GET", f"{R}/runs?scheduleId={sch}", token=T)
            check("RP04 run history for schedule", c == 200 and len(rl.get("items", [])) >= 1)
        c, r = req("DELETE", f"{R}/categories/{cid}", token=T)
        check("RP03 delete category moves reports to Miscellaneous", c == 200 and "moved" in r.get("message", ""), r.get("message", ""))
        c, t2 = req("GET", f"{R}/templates/{sid}", token=T)
        check("template now in Miscellaneous", c == 200 and t2.get("categoryName") == "Miscellaneous")
        c, r = req("DELETE", f"{R}/templates/{sid}", token=T)
        check("RP02 delete template (+ its schedule)", c == 200 and "schedule" in r.get("message", ""), r.get("message", ""))
        c, sl = req("GET", f"{R}/schedules", token=T)
        check("schedule removed with template", not [s for s in sl.get("items", []) if s.get("templateId") == sid])

smoke_runs = [x for x in smoke_runs if x]
removed = sum(1 for x in smoke_runs if req("DELETE", f"{R}/runs/{x}", token=T)[0] == 200)
check(f"smoke report runs removed ({removed}/{len(smoke_runs)})", removed == len(smoke_runs))
c, rl = req("GET", f"{R}/runs?limit=200", token=T)
check("removed runs gone from history", c == 200 and not set(smoke_runs) & {x["id"] for x in rl.get("items", [])})

# Location Management (L01-L19)
import base64
import time

L = "/admin/heritage/location"
tag = str(int(time.time()))[-6:]
made = []  # (slug, id) in creation order; deleted in reverse


def mk(slug, body, label):
    c, r = req("POST", f"{L}/{slug}", body, T)
    check(label, c == 201 and r.get("id"), r.get("message") or str(r.get("error")))
    if r.get("id"):
        made.append((slug, r["id"]))
    return r.get("id")


def items(path):
    c, r = req("GET", f"{L}{path}", token=T)
    return r.get("items", []) if c == 200 else []


c, lm = req("GET", f"{L}/meta", token=T)
check("location meta", c == 200 and len(lm.get("entities", {})) == 12 and len(lm.get("settings", {})) == 4, f"{len(lm.get('entities', {}))} entities, {len(lm.get('settings', {}))} settings tabs")
brands = items("/brands")
hcc = next((b for b in brands if b.get("abbreviation") == "HCC"), None)
check("L01 seeded brand Heritage College / HCC", bool(hcc) and hcc.get("domain") == "myhccbc.com", str(hcc and hcc.get("login")))
if hcc:
    svc = items(f"/email-services?parentId={hcc['id']}")
    check("L07 seeded e-mail services", {"Forwarder", "General E-mail", "Services"} <= {s.get("name") for s in svc} and all("smtpPassword" not in s for s in svc), ", ".join(s.get("name", "") for s in svc))
    c, ps = req("GET", f"{L}/brands/{hcc['id']}/settings/profile", token=T)
    check("L02 captured profile settings", c == 200 and ps["values"].get("studentNumbering") == "Year & Incremental", str(ps.get("values", {}).get("studentNumbering")))
check("L08 seeded region Canada / CA", any(r.get("abbreviation") == "CA" for r in items("/regions")))
check("L09 seeded province British Columbia / BC", any(p.get("abbreviation") == "BC" for p in items("/provinces")))
c, cd = req("GET", f"{L}/campus-directory", token=T)
names = [x["display"] for x in cd.get("campuses", [])]
surrey = next((x for x in cd.get("campuses", []) if x["display"].startswith("#110")), None)
check("L10 campus directory (3 seeded campuses)", c == 200 and len(names) >= 3 and bool(surrey), "; ".join(names))
check("L10 Surrey classroom 1 (15 seats)", bool(surrey) and any(r["name"] == "1" and str(r["seats"]) == "15" for r in surrey["classrooms"]))
insts = items("/institutions")
sean = next((i for i in insts if i.get("name") == "SeanCo Development"), None)
check("L15 seeded institutions", bool(sean) and any(i.get("name") == "Heritage Community College" for i in insts) and sean.get("_coursesCount") == 2, f"SeanCo courses={sean and sean.get('_coursesCount')}")

# Validation
c, r = req("POST", f"{L}/brands", {"name": "", "abbreviation": ""}, T)
check("brand validation (400)", c == 400, r.get("error", {}).get("message", "") if isinstance(r.get("error"), dict) else str(r.get("message")))
c, r = req("POST", f"{L}/brands", {"name": f"Smoke Brand {tag}", "abbreviation": f"SB{tag}", "login": "Unique Domain Name", "domain": ""}, T)
check("brand domain required for unique login (400)", c == 400)
if hcc:
    c, r = req("POST", f"{L}/brands", {"name": "heritage college", "abbreviation": f"X{tag}"}, T)
    check("brand name unique (409)", c == 409)

# Brands + settings + e-mail relay
b = mk("brands", {"name": f"Smoke Brand {tag}", "abbreviation": f"SB{tag}", "active": "Active", "interface": "Default Interface", "login": "Use Generic Login Page"}, "L01 create brand")
if b:
    c, r = req("PATCH", f"{L}/brands/{b}", {"login": "Unique Domain Name", "domain": f"smoke{tag}.example.com"}, T)
    check("L01 edit brand settings tab", c == 200)
    for tab, vals in {"profile": {"emailServices": "Enabled"}, "financial": {"transactionLockout": 5}, "accessibility": {"statement": "<p>Hi<script>x</script></p>"}}.items():
        c, r = req("PUT", f"{L}/brands/{b}/settings/{tab}", vals, T)
        check(f"save {tab} settings", c == 200, r.get("message") or str(r.get("error")))
    c, r = req("GET", f"{L}/brands/{b}/settings/accessibility", token=T)
    check("accessibility statement sanitised", c == 200 and r["values"].get("statement") == "<p>Hi</p>", str(r.get("values", {}).get("statement"))[:60])
    c, r = req("PUT", f"{L}/brands/{b}/settings/academic", {"weightFrom": 80, "weightTo": 20}, T)
    check("academic From% > To% rejected (400)", c == 400)
    c, r = req("PUT", f"{L}/brands/{b}/settings/academic", {"weightFrom": 20, "weightTo": 80, "backDating": 7}, T)
    check("save academic settings", c == 200, r.get("message") or str(r.get("error")))
    e = mk("email-services", {"parentId": b, "name": "Smoke Relay", "method": "SMTP", "fromName": "Smoke", "fromAddress": "smoke@example.com", "smtpHost": "smtp.example.com", "smtpPort": 587, "smtpSecurity": "TLS / STARTTLS", "smtpUsername": "u", "smtpPassword": "secret-pass", "conditions": ["Applications", "Reporting"]}, "L07/L09 add e-mail service")
    if e:
        c, r = req("GET", f"{L}/email-services/{e}", token=T)
        check("SMTP password hidden", c == 200 and "smtpPassword" not in r and r.get("hasPassword") is True)
        c, r = req("PATCH", f"{L}/email-services/{e}", {"fromName": "Smoke 2", "smtpPassword": ""}, T)
        c2, r2 = req("GET", f"{L}/email-services/{e}", token=T)
        check("blank password keeps the saved one", c == 200 and r2.get("hasPassword") is True and r2.get("fromName") == "Smoke 2")
        made.remove(("email-services", e))  # removed by the brand cascade

# Regions / provinces / classroom types / campus / classroom
rg = mk("regions", {"name": f"Smoke Region {tag}", "abbreviation": f"R{tag}"}, "L08 create region")
pv = mk("provinces", {"name": f"Smoke Province {tag}", "abbreviation": f"P{tag}", "active": "Active"}, "L09 create province")
ct = mk("classroom-types", {"name": f"Smoke Lab {tag}", "abbreviation": f"L{tag}"}, "L13 create classroom type")
png = base64.b64encode(bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000")).decode()
c, logo = req("POST", f"{L}/files", {"name": "logo.png", "mime": "image/png", "base64": png}, T)
check("file upload", c == 201 and logo.get("id"), str(logo.get("size")))
c, r = req("POST", f"{L}/files", {"name": "x.exe", "mime": "application/x-msdownload", "base64": png}, T)
check("file type rejected (400)", c == 400)
cp = mk("campuses", {"brand": b, "region": rg, "province": pv, "primaryLanguage": "English", "name": f"Smoke Campus {tag}", "legalName": "Smoke Legal", "code": f"9{tag}", "address": "1 Test St", "city": "Surrey", "country": "Canada", "postalCode": "V3T 0A1", "openDays": ["Monday", "Tuesday"], "logo": logo if logo.get("id") else None}, "L11 create campus")
if cp:
    c, r = req("GET", f"{L}/campus-directory?brand={b}&region={rg}", token=T)
    check("campus directory brand+region filter", c == 200 and [x["id"] for x in r.get("campuses", [])] == [cp])
    c, r = req("DELETE", f"{L}/regions/{rg}", token=T)
    check("region in use cannot be deleted (409)", c == 409)
    c, r = req("DELETE", f"{L}/brands/{b}", token=T)
    check("brand in use cannot be deleted (409)", c == 409)
    cr = mk("classrooms", {"campus": cp, "name": "S1", "type": ct, "size": 30, "notes": "Projector", "active": "Active"}, "L12 create classroom")
    c, r = req("POST", f"{L}/classrooms", {"campus": cp, "name": "s1", "size": 10}, T)
    check("classroom name unique per campus (409)", c == 409)
    c, r = req("POST", f"{L}/classrooms", {"campus": cp, "name": "S2", "size": -1}, T)
    check("classroom size validated (400)", c == 400)
    if cr:
        c, r = req("PATCH", f"{L}/classrooms/{cr}", {"size": 32}, T)
        check("L12 edit classroom", c == 200)
        c, r = req("DELETE", f"{L}/classroom-types/{ct}", token=T)
        check("classroom type in use cannot be deleted (409)", c == 409)
        made.remove(("classrooms", cr))  # removed by the campus cascade
    c, r = req("PATCH", f"{L}/campuses/{cp}", {"name": f"Smoke Campus {tag} R"}, T)
    check("L11 edit campus", c == 200)
    c, r = req("DELETE", f"{L}/campuses/{cp}", token=T)
    check("delete campus cascades classrooms", c == 200 and "classroom" in r.get("message", ""), r.get("message", ""))
    made.remove(("campuses", cp))
    c, r = req("GET", f"{L}/campus-directory", token=T)
    check("deleted campus gone", cp not in [x["id"] for x in r.get("campuses", [])])

# Ministries
mn = mk("ministries", {"name": f"Smoke Ministry {tag}", "type": "PTIB", "settings": "Brands", "mapping": {hcc["id"]: "HCC-PTIB"} if hcc else {}}, "L14 create ministry")
if mn:
    c, r = req("GET", f"{L}/ministries/{mn}", token=T)
    check("ministry mapping saved", c == 200 and hcc and r.get("mapping", {}).get(hcc["id"]) == "HCC-PTIB")

# Institutions + agreements + bridge + transfer courses
c, r = req("POST", f"{L}/institutions", {"name": f"Smoke Inst {tag}"}, T)
check("institution required fields (400)", c == 400)
it = mk("institutions", {"name": f"Smoke Inst {tag}", "address": "2 Uni Rd", "city": "Vancouver", "stateProvince": "BC", "country": "Canada", "postalCode": "V5K 0A1", "phone": "604-555-0100", "email": "registrar@example.com", "active": "Active"}, "L15 add institution")
if it:
    c, r = req("GET", f"{L}/institutions?q=smoke%20inst%20{tag}&perPage=10", token=T)
    check("institution name filter + paging", c == 200 and r.get("total") == 1 and r.get("perPage") == 10)
    c, r = req("POST", f"{L}/agreements", {"parentId": it, "startDate": "2026-09-01", "endDate": "2026-01-01"}, T)
    check("agreement end before start (400)", c == 400)
    ag = mk("agreements", {"parentId": it, "startDate": "2026-09-01", "openEnded": True, "status": "Active", "gradePointExchange": "Inactive", "note": "Smoke", "documents": [logo] if logo.get("id") else []}, "L16 new agreement (open-ended)")
    if ag:
        c, r = req("GET", f"{L}/agreements/{ag}", token=T)
        check("open-ended agreement has no end date", c == 200 and not r.get("endDate"))
    prog = (lm.get("lists", {}).get("programs") or [""])[0]
    br = mk("bridge-programs", {"parentId": it, "name": f"Smoke Bridge {tag}", "description": "d", "credits": 6, "equivalentProgram": prog, "status": "Active"}, "L17 new bridge program")
    course = (lm.get("courses") or [{}])[0].get("id")
    tc = mk("transfer-courses", {"parentId": it, "equivalentCourse": course, "name": "Smoke Transfer", "number": f"ST-{tag}", "credits": 3.5, "lengthValue": 10, "lengthUnit": "weeks", "countCredits": "Normal", "countGradePoints": "No"}, "L19 add transfer course")
    c, r = req("POST", f"{L}/transfer-courses", {"parentId": it, "equivalentCourse": course, "name": "Dup", "number": f"st-{tag}", "lengthUnit": "days", "countCredits": "Normal", "countGradePoints": "No"}, T)
    check("transfer course number unique (409)", c == 409)
    c, r = req("GET", f"{L}/institutions?q=smoke%20inst%20{tag}", token=T)
    check("courses count on institution", c == 200 and r["items"] and r["items"][0].get("_coursesCount") == 1)
    c, r = req("GET", f"{L}/transfer-courses?parentId={it}", token=T)
    check("L18 courses equivalencies list", c == 200 and r.get("total") == 1 and "—" in r["items"][0].get("_equivalentLabel", ""))
    c, r = req("DELETE", f"{L}/institutions/{it}", token=T)
    check("delete institution cascades", c == 200 and "3 agreement" in r.get("message", ""), r.get("message", ""))
    made[:] = [m for m in made if m[1] not in {it, ag, br, tc}]

removed = 0
for slug, mid in reversed(made):
    c, r = req("DELETE", f"{L}/{slug}/{mid}", token=T)
    removed += c == 200
    if c != 200:
        print(f"     cleanup {slug}/{mid}: {c} {r.get('error') or r.get('message')}")
check(f"location smoke records removed ({removed}/{len(made)})", removed == len(made))
check("smoke brand gone", not any(x.get("name") == f"Smoke Brand {tag}" for x in items("/brands")))

# System Configuration (SC01-SC36)
S = "/admin/heritage/sysconfig"
smade = []  # (entity, id); deleted in reverse


def smk(entity, body, label, expect=201):
    c, r = req("POST", f"{S}/e/{entity}", body, T)
    check(label, c == expect and (expect != 201 or r.get("id")), r.get("message") or str(r.get("error")))
    if c == 201 and r.get("id"):
        smade.append((entity, r["id"]))
    return r.get("id") if c == 201 else None


def sitems(entity, qs=""):
    c, r = req("GET", f"{S}/e/{entity}{qs}", token=T)
    return r.get("items", []) if c == 200 else []


def by(rows, key, val):
    return next((x for x in rows if x.get(key) == val), None)


def forget(*ids):
    smade[:] = [m for m in smade if m[1] not in ids]


c, sm = req("GET", f"{S}/meta", token=T)
fin_entities = {"lockouts", "ledgerCategories", "ledgerTypes", "paymentMethods", "rateCategories", "planTemplates", "taxRates", "disbursementTypes", "promotions", "fundingSources", "collectionAgencies"}
check("sysconfig meta", c == 200 and len(set(sm.get("entities", {})) - fin_entities - {"agents"}) == 39 and fin_entities <= set(sm.get("entities", {})) and len(sm.get("settings", {})) == 9, f"{len(sm.get('entities', {}))} entities, {len(sm.get('settings', {}))} settings")
users = sm.get("users", [])

# Captured seeds
ss = sitems("studentStatuses")
pre = by(ss, "name", "Pre-enrolment Application")
check("SC09 status hierarchy seeded", bool(pre) and len([s for s in ss if s.get("parent") == (pre or {}).get("id")]) == 6 and by(ss, "name", "New Inquiry").get("defaultStatus") == "Yes", f"{len(ss)} statuses")
ag = sitems("agentStatuses")
check("SC08 agent statuses (Inactive default)", [a["name"] for a in ag] == ["Current", "Awaiting Contract", "Terminated", "Inactive"] and by(ag, "name", "Inactive").get("defaultStatus") == "Yes")
check("SC05 document types", [d["name"] for d in sitems("documentTypes")] == ["Fees Due notice", "New Application"])
late = by(sitems("flagTemplates"), "name", "Late Tuition")
check("SC06 Late Tuition template", bool(late) and late.get("financialType") == "Late Tuition: Program Deadlines" and late.get("applyHold") == "Yes" and late.get("balance") == "Any Owing Balance")
ua = sitems("userAgreements")
check("SC07 user agreements (4)", {"Media Release Agreement", "Studen Handbook Receipt", "Student Enrolment Contract", "Student Statement of Rights"} <= {u["name"] for u in ua})
dts = sitems("documentTemplates")
hra = next((d for d in dts if d["name"].startswith("Conditional Letter of Acceptance")), None)
check("SC10 document templates + audit history", bool(hra) and hra.get("_versions", 0) >= 2, f"{len(dts)} templates")
if hra:
    c, h = req("GET", f"{S}/document-templates/{hra['id']}/history", token=T)
    hi = h.get("items", []) if c == 200 else []
    check("SC12 newest version is current, created is oldest", len(hi) >= 2 and hi[0]["current"] and hi[-1]["changes"][0] == "Template created")
    if len(hi) >= 2:
        c, v = req("GET", f"{S}/document-templates/{hra['id']}/history/{hi[-1]['id']}", token=T)
        check("SC12 original version differs + element labels", c == 200 and v["snapshot"].get("header") == "None" and bool(v.get("currentLabels", {}).get("headerElement")))
check("SC11 inputs / elements / fonts", len(sitems("documentInputs")) >= 10 and len(sitems("runningElements")) >= 6 and len(sitems("documentFonts")) >= 4)
check("SC13 correspondence categories", {"Admissions Documents", "TRANSCRIPT RECORD"} <= {x["name"] for x in sitems("correspondenceCategories")})
forms = sitems("forms")
check("SC14 forms (11)", len(forms) >= 11 and by(forms, "name", "General Inquiry Form").get("visibility") == "Public")
check("SC15 sections (15)", len(sitems("sections")) >= 15)
plugins = sitems("plugins")
check("SC18 plug-ins (Moodle enabled)", by(plugins, "name", "Moodle").get("status") == "Enabled" and all(p["status"] == "Disabled" for p in plugins if p["name"] != "Moodle"), f"{len(plugins)} plug-ins")
check("SC20 holidays seeded", any(h["name"] == "Canada Day" for h in sitems("holidays")))
check("SC23 SMS providers + bounces", by(sitems("smsProviders"), "name", "Bell").get("domain") == "txt.bell.ca" and len(sitems("bounces")) >= 3)
check("SC27 security questions (12 in 3 categories)", len(sitems("securityQuestions")) >= 12 and len(sitems("securityCategories")) >= 3)
countries = sitems("countries")
afg = by(countries, "name", "Afghanistan")
check("SC32 Afghanistan regions", bool(afg) and any(r["name"] == "Badakhshan" for r in sitems("countryRegions", f"?parentId={afg['id'] if afg else ''}")))
langs, curs = sitems("languages"), sitems("currencies")
eng, cad = by(langs, "name", "English"), by(curs, "code", "CAD")
check("SC31/33 English + CAD protected defaults", bool(eng and eng.get("_protected")) and bool(cad and cad.get("_protected")) and cad.get("_symbol") == "$")
check("SC34 time zones (Midway first)", (sitems("timezones") or [{}])[0].get("zone") == "Pacific/Midway")
c, loc = req("GET", f"{S}/settings/localization", token=T)
check("SC31 default language / currency", c == 200 and loc["values"].get("defaultLanguage") == (eng or {}).get("id") and loc["values"].get("defaultCurrency") == (cad or {}).get("id"))
c, refs2 = req("GET", "/admin/heritage/refs", token=T)
check("shared refs use managed statuses / zones", "CLOA" in refs2.get("statuses", []) and "Pacific/Midway" in refs2.get("timezones", []))
c, sq = req("GET", "/admin/super/me/security-questions", token=T)
check("account questions come from the bank", c == 200 and "What is your favourite movie?" in sq.get("options", []))

# Protection rules
for ent, row, label in [("languages", eng, "English"), ("currencies", cad, "CAD"), ("plugins", by(plugins, "name", "Moodle"), "Moodle")]:
    if row:
        c, r = req("DELETE", f"{S}/e/{ent}/{row['id']}", token=T)
        check(f"{label} cannot be deleted (409)", c == 409)
media = by(forms, "name", "Media Release Form")
if media:
    c, r = req("DELETE", f"{S}/e/forms/{media['id']}", token=T)
    check("agreement form in use cannot be deleted (409)", c == 409)
smk("plugins", {"name": "X"}, "plug-ins cannot be created (400)", 400)

# SC01 workflow with steps / items + validation
dtype = sitems("documentTypes")[0]["id"]
smk("workflows", {"name": f"Smoke WF {tag}", "action": "Change Student Status"}, "workflow action needs a status (400)", 400)
smk("workflows", {"name": f"Smoke WF {tag}", "triggerStatuses": ["Not A Status"]}, "workflow unknown status (400)", 400)
wf = smk("workflows", {"name": f"Smoke WF {tag}", "workflowStatus": "Enabled", "triggerStatuses": ["New Inquiry"], "action": "Change Student Status", "actionStatus": "Approved Application",
                      "steps": [{"name": "Collect documents", "assignedTo": "Admissions", "dueDays": 7}],
                      "items": [{"name": "Passport", "conditions": "International Students Only", "dataCollection": "Document Upload", "documentType": dtype}]}, "SC01 create workflow with step + item")
if wf:
    c, r = req("GET", f"{S}/e/workflows/{wf}", token=T)
    check("workflow rows saved with ids", c == 200 and r["steps"][0].get("id") and r["items"][0].get("documentType") == dtype)
    c, r = req("DELETE", f"{S}/e/documentTypes/{dtype}", token=T)
    check("document type used by workflow (409)", c == 409)
    c, r = req("PATCH", f"{S}/e/workflows/{wf}", {"items": [{"name": "", "dataCollection": "Acknowledgement"}]}, T)
    check("requirement item validated (400)", c == 400 and "Requirement Item 1" in json.dumps(r))

# SC02 / SC03 assessment + category in use
cat = smk("assessmentCategories", {"name": f"Smoke Cat {tag}", "colour": "#123abc", "access": "Staff Only"}, "SC03 create category (custom colour)")
smk("assessmentCategories", {"name": f"Smoke Cat2 {tag}", "colour": "blue"}, "category colour validated (400)", 400)
if cat:
    asm = smk("assessments", {"name": f"Smoke Assessment {tag}", "cases": [{"name": "Case A", "category": cat, "outcome": "Pass"}], "summary": "<p>ok<img src=x onerror=alert(1)></p>"}, "SC02 create assessment with case")
    if asm:
        c, r = req("GET", f"{S}/e/assessments/{asm}", token=T)
        check("assessment summary sanitised", c == 200 and "onerror" not in r.get("summary", ""))
        c, r = req("DELETE", f"{S}/e/assessmentCategories/{cat}", token=T)
        check("category used by assessment (409)", c == 409)

# SC04 advisor linking (person picker)
if users:
    smk("advisorLinkings", {"name": f"Smoke Link {tag}", "advisor": "nope"}, "advisor must be a real user (400)", 400)
    smk("advisorLinkings", {"name": f"Smoke Link {tag}", "advisor": users[0]["id"], "campus": "All Campuses"}, "SC04 create advisor linking")

# SC08 single default agent status
inactive = by(ag, "name", "Inactive")
a1 = smk("agentStatuses", {"name": f"Smoke Agent {tag}", "colour": "#2e7d32", "defaultStatus": "Yes"}, "SC08 create default agent status")
if a1 and inactive:
    check("previous default cleared", by(sitems("agentStatuses"), "name", "Inactive").get("defaultStatus") == "No")
    c, r = req("PATCH", f"{S}/e/agentStatuses/{inactive['id']}", {"defaultStatus": "Yes"}, T)
    check("Inactive restored as default", c == 200 and by(sitems("agentStatuses"), "id", a1).get("defaultStatus") == "No")

# SC09 hierarchy rules + rename cascade
p1 = smk("studentStatuses", {"name": f"Smoke Status {tag}", "colour": "#1565c0"}, "SC09 create status")
if p1:
    ch = smk("studentStatuses", {"name": f"Smoke Child {tag}", "colour": "#1565c0", "parent": p1}, "SC09 create sub-status")
    if ch:
        smk("studentStatuses", {"name": f"Smoke Grandchild {tag}", "colour": "#1565c0", "parent": ch}, "sub-status cannot have children (400)", 400)
        c, r = req("DELETE", f"{S}/e/studentStatuses/{p1}", token=T)
        check("status with sub-statuses (409)", c == 409)
    c, r = req("PATCH", f"{S}/e/studentStatuses/{p1}", {"name": f"Smoke Renamed {tag}"}, T)
    c2, refs3 = req("GET", "/admin/heritage/refs", token=T)
    check("renamed status flows to refs", c == 200 and f"Smoke Renamed {tag}" in refs3.get("statuses", []) and f"Smoke Status {tag}" not in refs3.get("statuses", []))
    if ch:
        c, r = req("PUT", f"{S}/e/studentStatuses/order", {"ids": [p1, ch]}, T)
        check("reorder only within one parent (400)", c == 400)
        c, r = req("PUT", f"{S}/e/studentStatuses/order", {"ids": [ch]}, T)
        check("reorder sub-statuses", c == 200)

# SC10 document template versions / copy / restore
els = sitems("runningElements")
hdr = next((e["id"] for e in els if e.get("type") == "Header"), None)
smk("documentTemplates", {"name": f"Smoke Tpl {tag}", "header": "Select Element"}, "header element required (400)", 400)
tpl = smk("documentTemplates", {"name": f"Smoke Tpl {tag}", "header": "Select Element", "headerElement": hdr, "content": "<p>v1</p>", "marginTop": 15}, "SC10 create document template")
if tpl:
    req("PATCH", f"{S}/e/documentTemplates/{tpl}", {"content": "<p>v2</p>", "watermark": "Draft"}, T)
    c, h = req("GET", f"{S}/document-templates/{tpl}/history", token=T)
    check("SC12 audit history (2 versions)", c == 200 and len(h.get("items", [])) == 2 and h["items"][0]["current"] and "Watermark" in h["items"][0]["changes"][0])
    if c == 200 and len(h.get("items", [])) == 2:
        old = h["items"][1]["id"]
        c, v = req("GET", f"{S}/document-templates/{tpl}/history/{old}", token=T)
        check("REVIEW version content", c == 200 and v.get("content") == "<p>v1</p>")
        c, r = req("POST", f"{S}/document-templates/{tpl}/restore/{h['items'][0]['id']}", token=T)
        check("cannot restore current version (400)", c == 400)
        c, r = req("POST", f"{S}/document-templates/{tpl}/restore/{old}", token=T)
        c2, t2 = req("GET", f"{S}/e/documentTemplates/{tpl}", token=T)
        check("RESTORE older version", c == 200 and t2.get("content") == "<p>v1</p>" and t2.get("_versions") == 3)
    c, r = req("POST", f"{S}/document-templates/{tpl}/copy", token=T)
    check("COPY template", c == 201 and r.get("id"), r.get("message", ""))
    if r.get("id"):
        smade.append(("documentTemplates", r["id"]))
    if hdr:
        c, r = req("DELETE", f"{S}/e/runningElements/{hdr}", token=T)
        check("running element in use (409)", c == 409)

# SC13 correspondence unlink on category delete
cc = smk("correspondenceCategories", {"name": f"Smoke Corr {tag}", "recordTypes": ["Applications"]}, "SC13 create category")
if cc:
    smk("correspondenceCategories", {"name": f"Smoke Corr2 {tag}", "recordTypes": ["Spaceships"]}, "record type validated (400)", 400)
    ctp = smk("correspondenceTypes", {"name": f"Smoke CType {tag}", "categories": [cc]}, "SC13 create correspondence type")
    c, r = req("DELETE", f"{S}/e/correspondenceCategories/{cc}", token=T)
    check("category delete unlinks types", c == 200 and "unlinked" in r.get("message", ""), r.get("message", ""))
    forget(cc)
    if ctp:
        c, r = req("GET", f"{S}/e/correspondenceTypes/{ctp}", token=T)
        check("type now Miscellaneous", c == 200 and r.get("categories") == [])

# SC14 form with fields, SC15 section, SC36 notification
smk("forms", {"name": f"Smoke Form {tag}", "formType": "Request Form", "payments": "Enabled"}, "form fee required when payments on (400)", 400)
smk("forms", {"name": f"Smoke Form {tag}", "formType": "Request Form", "fields": [{"label": "Reason", "type": "Dropdown", "choices": "A\nB", "required": "Yes"}]}, "SC14 add form with field")
smk("sections", {"functionType": "External Link", "name": f"Smoke Link {tag}", "url": "javascript:alert(1)", "icon": "globe"}, "section URL validated (400)", 400)
smk("sections", {"functionType": "Managed Intranet", "name": f"Smoke Intranet {tag}", "icon": "book", "defaultAccess": "Students"}, "SC15 create section / intranet")
smk("notificationTemplates", {"name": f"Smoke Notice {tag}", "channel": "SMS", "sms": "Hi {student.first_name}"}, "SC36 create notification template")

# SC18 plug-in settings (secret hidden) + custom endpoint
hub = by(plugins, "name", "Hubspot")
if hub:
    c, r = req("PATCH", f"{S}/e/plugins/{hub['id']}", {"status": "Enabled"}, T)
    check("enabled plug-in needs URL (400)", c == 400)
    c, r = req("PATCH", f"{S}/e/plugins/{hub['id']}", {"status": "Enabled", "environment": "Production", "endpoint": "https://api.hubapi.com", "apiKey": "smoke-key", "name": "Renamed"}, T)
    c2, r2 = req("GET", f"{S}/e/plugins/{hub['id']}", token=T)
    check("plug-in settings saved, key hidden, name read-only", c == 200 and r2.get("_has_apiKey") is True and "apiKey" not in r2 and r2.get("name") == "Hubspot")
    req("PATCH", f"{S}/e/plugins/{hub['id']}", {"status": "Disabled", "notes": ""}, T)
    c2, r2 = req("GET", f"{S}/e/plugins/{hub['id']}", token=T)
    check("disabled plug-in keeps its default environment", r2.get("status") == "Disabled" and r2.get("environment") == "Production")
smk("customEndpoints", {"name": f"Smoke Hook {tag}", "url": "https://example.com/hook", "authType": "Bearer Token", "credential": "t"}, "SC18 create custom endpoint")

# SC19 / SC20
rc = smk("reasonCodes", {"name": f"Smoke Reason {tag}", "code": f"SR{tag}", "type": "Refund"}, "SC19 create reason code")
if rc:
    smk("reasonCodes", {"name": f"Other {tag}", "code": f"sr{tag}", "type": "Refund"}, "reason code unique (409)", 409)
smk("holidays", {"name": f"Smoke Break {tag}", "date": "2026-12-28", "singleDay": False, "endDate": "2026-12-20"}, "holiday end before start (400)", 400)
smk("holidays", {"name": f"Smoke Break {tag}", "type": "Break", "date": "2026-12-21", "singleDay": False, "endDate": "2026-12-31"}, "SC20 add date-range closure")

# SC22 / SC23 e-mail
dep = smk("emailDepartments", {"name": f"Smoke Dept {tag}", "users": [users[0]["id"]] if users else []}, "SC22 create department")
smk("emailFilters", {"name": f"Smoke Filter {tag}", "type": "Forward To Address", "content": "*@spam.test"}, "forward filter needs address (400)", 400)
if dep:
    flt = smk("emailFilters", {"name": f"Smoke Filter {tag}", "type": "Deliver To Department", "content": "admissions@*", "department": dep}, "SC22 create filter to department")
    c, r = req("DELETE", f"{S}/e/emailDepartments/{dep}", token=T)
    check("department used by filter (409)", c == 409)
smk("mailMergeTemplates", {"name": f"Smoke Merge {tag}", "content": "<p>Dear {first_name}</p>"}, "SC22 create mail merge template")
smk("smsProviders", {"name": f"Smoke SMS {tag}", "domain": "not a domain"}, "SMS domain validated (400)", 400)
smk("whitelist", {"email": f"smoke{tag}@example.com"}, "SC23 whitelist address")
if users:
    smk("blockedUsers", {"user": users[-1]["id"]}, "SC23 block user")
smk("bounces", {"email": "x@y.z"}, "bounces are reported, not created (400)", 400)

# SC24-SC30 security
c, g = req("GET", f"{S}/settings/session", token=T)
c, r = req("PUT", f"{S}/settings/session", {**g["values"], "ipAuthentication": "Enabled", "allowedIps": "10.0.0.0/33"}, T)
check("bad IP range rejected (400)", c == 400)
c, pw = req("GET", f"{S}/settings/password", token=T)
c, r = req("PUT", f"{S}/settings/password", pw["values"], T)
check("SC25 save password policy (unchanged)", c == 200)
c, gl = req("GET", f"{S}/settings/global", token=T)
c, r = req("PUT", f"{S}/settings/global", {**gl["values"], "morningBoundary": "18:00"}, T)
check("global boundary order validated (400)", c == 400)
c, r = req("PUT", f"{S}/settings/global", {**gl["values"], "taskFlags": "25:00"}, T)
check("time validated (400)", c == 400)
c, r = req("PUT", f"{S}/settings/global", gl["values"], T)
check("SC17 save global settings (unchanged)", c == 200)
smk("securityQuestions", {"question": "What is your favourite movie?", "category": sitems("securityCategories")[0]["id"]}, "question unique (409)", 409)
smk("accessOutcomes", {"campus": (sm["lists"].get("campuses") or ["?"])[0], "outcomeType": "Access Granted", "icon": "Custom"}, "custom outcome icon needs a file (400)", 400)
smk("accessOutcomes", {"campus": (sm["lists"].get("campuses") or ["?"])[0], "outcomeType": "Access Denied", "icon": "Red Minus", "flags": "Has Active Holds"}, "SC28 new access outcome")
c, r = req("GET", f"{S}/access-logs?from=2026-10-05&to=2026-10-01", token=T)
check("access log date range validated (400)", c == 400)
c, r = req("GET", f"{S}/access-logs?from=2026-10-01&to=2026-10-05", token=T)
check("SC29 access log search", c == 200 and "items" in r)
smk("serviceAccounts", {"name": f"Smoke Svc {tag}", "login": f"svc{tag}", "password": "short", "passwordConfirm": "short"}, "weak service password (400)", 400)
smk("serviceAccounts", {"name": f"Smoke Svc {tag}", "login": f"svc{tag}", "password": "LongEnough123", "passwordConfirm": "Different123"}, "password confirm mismatch (400)", 400)
svc = smk("serviceAccounts", {"name": f"Smoke Svc {tag}", "login": f"svc{tag}", "password": "LongEnough123", "passwordConfirm": "LongEnough123"}, "SC30 create service account")
if svc:
    c, r = req("PATCH", f"{S}/e/serviceAccounts/{svc}", {"serviceType": "Reporting Export", "password": ""}, T)
    c2, r2 = req("GET", f"{S}/e/serviceAccounts/{svc}", token=T)
    check("service password hashed + kept on blank", c == 200 and "password" not in r2 and r2.get("_has_password") is True)

# SC31-SC34 localization
co = smk("countries", {"name": f"Smokeland {tag}", "code": "zz", "iso": "zzz", "currency": cad["id"] if cad else ""}, "SC32 add country")
if co:
    smk("countryRegions", {"parentId": co, "name": "North", "code": "N"}, "SC32 add region")
    smk("countryRegions", {"parentId": co, "name": "north"}, "region unique per country (409)", 409)
    if cad:
        c, r = req("DELETE", f"{S}/e/currencies/{cad['id']}", token=T)
        check("currency used by country (409)", c == 409)
    c, r = req("DELETE", f"{S}/e/countries/{co}", token=T)
    check("country delete cascades regions", c == 200 and "1 region" in r.get("message", ""), r.get("message", ""))
    smade[:] = [m for m in smade if m[0] != "countryRegions" and m[1] != co]
smk("timezones", {"name": f"Smoke Zone {tag}", "zone": "Mars/Olympus"}, "invalid IANA zone (400)", 400)
smk("currencies", {"name": f"Smoke Coin {tag}", "code": "zzq", "iso": "12"}, "currency ISO validated (400)", 400)
smk("languages", {"name": f"Smokish {tag}", "code": "zz-ZZ", "displayName": "Smokish"}, "SC31 add language")

# Files
c, ttf = req("POST", f"{S}/files", {"name": "smoke.ttf", "mime": "", "base64": base64.b64encode(b"\x00\x01\x00\x00smoke").decode()}, T)
check("font file upload", c == 201 and ttf.get("mime") == "font/ttf", str(ttf.get("mime")))
smk("documentFonts", {"name": f"Smoke Font {tag}", "embedded": "Yes"}, "embedded font needs a file (400)", 400)
if ttf.get("id"):
    smk("documentFonts", {"name": f"Smoke Font {tag}", "embedded": "Yes", "fontFile": ttf}, "SC11 add embedded font")

sremoved = 0
for ent, sid in reversed(smade):
    c, r = req("DELETE", f"{S}/e/{ent}/{sid}", token=T)
    sremoved += c == 200
    if c != 200:
        print(f"     cleanup {ent}/{sid}: {c} {r.get('error') or r.get('message')}")
check(f"sysconfig smoke records removed ({sremoved}/{len(smade)})", sremoved == len(smade))
check("default agent status intact", by(sitems("agentStatuses"), "name", "Inactive").get("defaultStatus") == "Yes")

# Financial Management (F01-F21 + student profile Finance). Every write is tagged "Heritage smoke"
# and reversed here; deploy/cleanup-finance-smoke.sql removes the reversed rows afterwards.
F = "/admin/heritage/financial"
SMOKE = f"Heritage smoke {tag}"


def raw(method, path, body=None):
    r = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method)
    r.add_header("content-type", "application/json")
    r.add_header("authorization", f"Bearer {T}")
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, resp.headers.get("content-type", ""), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", ""), e.read()


def fin(method, path, body=None, expect=200):
    c, r = req(method, F + path, body, T)
    return c == expect, r


def msg(r):
    e = r.get("error")
    return str(r.get("message") or (e.get("message") if isinstance(e, dict) else e) or "")


c, fm = req("GET", f"{F}/meta", token=T)
check("finance meta", c == 200 and bool(fm.get("ledgerTypes")) and bool(fm.get("paymentMethods")) and fm.get("perms", {}).get("edit") is True, f"{len(fm.get('ledgerTypes', []))} ledger types, {len(fm.get('paymentMethods', []))} methods, {len(fm.get('terms', []))} terms")
for slug in ["transactions", "fees", "invoices", "disbursements", "awards", "adjustments", "commissions", "plans", "funds", "alerts"]:
    ok, r = fin("GET", f"/{slug}?perPage=5")
    check(f"finance list {slug}", ok and "items" in r and "pages" in r, f"{r.get('total')} rows" if ok else msg(r))
ok, r = fin("GET", "/alerts?perPage=5&status=__none__")
check("finance alerts empty filter", ok and r.get("total") == 0)

method = (fm.get("paymentMethods") or [{}])[0].get("id", "")
lt = next((t for t in fm.get("ledgerTypes", []) if t["overridable"] and not t["trigger"]), None) or next((t for t in fm.get("ledgerTypes", []) if t["overridable"]), {})
dtype = next((d for d in fm.get("disbursementTypes", []) if "advance" not in d["name"].lower()), {})
agent = (fm.get("agents") or [{}])[0].get("id", "")
fsid = students[0]["key"].split(":", 1)[-1] if students else ""

if fsid and method and lt:
    ok, hd = fin("GET", f"/student/{fsid}")
    check("student finance header", ok and bool(hd.get("name")) and "applicationNumber" in hd and "cgpa" in hd and bool(hd.get("initials")), f"{hd.get('name')} #{hd.get('applicationNumber')}")
    for tab in ["overview", "transactions", "invoices", "disbursements", "awards", "plans", "audit"]:
        ok, r = fin("GET", f"/student/{fsid}/{tab}")
        check(f"student finance tab {tab}", ok, msg(r))

    def balance():
        return fin("GET", f"/student/{fsid}/overview")[1].get("summary", {}).get("balance", 0)

    bal0 = balance()
    ok, r = fin("POST", f"/student/{fsid}/fees", {"ledgerTypeId": lt["id"], "amount": 1, "quantity": 1, "paymentStatus": "Pending / Not Paid", "note": SMOKE}, 201)
    check("add fee", ok and r.get("message") == "Fee added successfully", msg(r))
    fee = r.get("id")
    check("fee raises balance", abs(balance() - bal0 - 1) < 0.01)
    if fee:
        ok, r = fin("PATCH", f"/fees/{fee}", {"amount": 2})
        check("edit fee", ok and r.get("message") == "Fee updated successfully", msg(r))
        ok, r = fin("GET", f"/fees?perPage=50&student={hd.get('applicationNumber', '')}")
        check("fee in Tuition & Fees list", ok and any(x.get("id") == fee for x in r.get("items", [])), f"{r.get('total')} rows")
    ok, r = fin("POST", f"/student/{fsid}/payments", {"amount": 0, "method": method}, 400)
    check("zero payment rejected (400)", ok, msg(r))
    ok, r = fin("POST", f"/student/{fsid}/payments", {"amount": 2, "method": method, "note": SMOKE, "autoApply": False}, 201)
    check("apply payment", ok and r.get("message") == "Payment applied successfully", msg(r))
    pay = r.get("id")
    if pay:
        ok, r = fin("POST", f"/transactions/{pay}/receipt")
        check("generate receipt", ok and "generated" in msg(r), msg(r))
        c, ct, body = raw("GET", f"{F}/transactions/{pay}/receipt.pdf")
        check("receipt pdf", c == 200 and "pdf" in ct and body[:4] == b"%PDF", f"{c} {ct} {len(body)} bytes")
        ok, r = fin("POST", f"/transactions/{pay}/refund", {"refundType": "Cash Back", "method": method, "amount": 3, "note": SMOKE}, 400)
        check("over-refund rejected (400)", ok, msg(r))
        ok, r = fin("POST", f"/transactions/{pay}/refund", {"refundType": "Cash Back", "method": method, "amount": 2, "note": SMOKE})
        check("refund payment", ok and r.get("message") == "Transaction information updated successfully", msg(r))
    if fee:
        ok, r = fin("DELETE", f"/fees/{fee}")
        check("remove fee", ok, msg(r))
    check("balance restored after fee/payment/refund", abs(balance() - bal0) < 0.01)

    if dtype:
        ok, r = fin("POST", f"/student/{fsid}/disbursements", {"typeId": dtype["id"], "amount": 1, "note": SMOKE, "allocate": False}, 201)
        check("create disbursement", ok, msg(r))
        if r.get("id"):
            ok, r = fin("DELETE", f"/disbursements/{r['id']}")
            check("remove disbursement", ok, msg(r))

    ok, r = fin("POST", f"/student/{fsid}/plans", {"startDate": time.strftime("%Y-%m-%d"), "syncBalance": "Disabled", "debt": 3, "scheduleType": "Fixed Instalment Frequency", "frequency": "1 month", "instalmentAmount": 1, "notes": SMOKE}, 201)
    check("create payment plan", ok, msg(r))
    if r.get("id"):
        pid = r["id"]
        ok, r = fin("GET", f"/student/{fsid}/plans")
        plan = by(r.get("items", []), "id", pid) or {}
        check("plan has 3 instalments", len(plan.get("instalments", [])) == 3, str(len(plan.get("instalments", []))))
        ok, r = fin("DELETE", f"/plans/{pid}")
        check("delete payment plan", ok, msg(r))
    ok, r = fin("POST", f"/student/{fsid}/plans", {"startDate": time.strftime("%Y-%m-%d"), "syncBalance": "Disabled", "debt": 3, "scheduleType": "Manual / Advanced Instalments", "instalments": [{"date": time.strftime("%Y-%m-%d"), "amount": 1}]}, 400)
    check("manual instalments must add up (400)", ok, msg(r))

    ok, r = fin("POST", "/invoices", {"type": "Student", "studentId": fsid, "dueDate": time.strftime("%Y-%m-%d"), "items": [{"kind": "other", "description": SMOKE, "fee": 1}]}, 400)
    check("student invoice needs a term (400)", ok and msg(r) == "Please select a student and term to continue", msg(r))
    if agent:
        ok, r = fin("POST", "/invoices", {"type": "Agent", "agentId": agent, "dueDate": time.strftime("%Y-%m-%d"), "items": [{"kind": "other", "description": SMOKE, "quantity": 2, "fee": 1.5}], "note": SMOKE}, 201)
        check("create agent invoice", ok and r.get("message") == "Invoice saved successfully", msg(r))
        if r.get("id"):
            iid = r["id"]
            ok, inv = fin("GET", f"/invoices/{iid}")
            check("invoice totals", ok and abs(inv.get("subtotal", 0) - 3) < 0.01, str(inv.get("subtotal")))
            c, ct, body = raw("GET", f"{F}/invoices/{iid}/pdf")
            check("invoice pdf", c == 200 and body[:4] == b"%PDF", f"{c} {len(body)} bytes")
            ok, r = fin("DELETE", f"/invoices/{iid}")
            check("delete invoice", ok, msg(r))
        ok, r = fin("POST", "/commissions/bonus", {"agentId": agent, "studentId": fsid, "amount": 1, "note": SMOKE}, 201)
        check("create agent bonus", ok, msg(r))
        if r.get("id"):
            ok, r = fin("DELETE", f"/commissions/bonus/{r['id']}")
            check("delete agent bonus", ok, msg(r))

    ok, r = fin("POST", "/adjustments", {"studentId": fsid, "direction": "Increase balance (debit)", "amount": 1, "reason": SMOKE}, 201)
    check("request adjustment", ok, msg(r))
    if r.get("id"):
        ok, r = fin("POST", f"/adjustments/{r['id']}/review", {"decision": "Declined", "note": SMOKE})
        check("decline adjustment", ok and r.get("message") == "Financial adjustment declined", msg(r))

    ok, r = fin("POST", "/funds", {"amount": 5, "receivedDate": time.strftime("%Y-%m-%d"), "methodId": method, "receipt": f"SMK{tag}", "note": SMOKE}, 201)
    check("record unallocated fund", ok, msg(r))
    if r.get("id"):
        fid = r["id"]
        if dtype:
            ok, r = fin("POST", f"/funds/{fid}/allocate", {"rows": [{"studentId": fsid, "amount": 6, "typeId": dtype["id"]}]}, 400)
            check("over-allocation rejected (400)", ok, msg(r))
            ok, r = fin("POST", f"/funds/{fid}/allocate", {"rows": [{"studentId": fsid, "amount": 2, "typeId": dtype["id"]}]})
            check("allocate fund", ok, msg(r))
            ok, r = fin("DELETE", f"/funds/{fid}", expect=400)
            check("fund with allocations cannot be deleted (400)", ok, msg(r))
            ok, r = fin("GET", f"/funds?perPage=50&keyword=SMK{tag}")
            fund = by(r.get("items", []), "id", fid) or {}
            for a in fund.get("allocations", []):
                ok, r = fin("DELETE", f"/funds/{fid}/allocations/{a['id']}")
                check("remove fund allocation", ok, msg(r))
        ok, r = fin("DELETE", f"/funds/{fid}")
        check("delete fund", ok, msg(r))
    check("balance unchanged after finance smoke", abs(balance() - bal0) < 0.01)

    c, ct, body = raw("POST", f"{F}/documents", {"document": "statement", "studentId": fsid})
    check("financial statement pdf", c == 200 and body[:4] == b"%PDF", f"{c} {len(body)} bytes")
    ok, r = fin("POST", "/documents", {"document": "statement"}, 400)
    check("statement needs a student (400)", ok, msg(r))
    ok, au = fin("GET", f"/student/{fsid}/audit")
    check("finance audit trail records smoke actions", ok and {"Payment recorded", "Payment refunded", "Payment plan created"} <= set(au.get("actions", [])), ", ".join(au.get("actions", [])[:8]))

# Finance configuration (F12-F21) on the System Configuration engine
fmade = []
for ent, body, label in [
    ("paymentMethods", {"name": f"Smoke Pay {tag}"}, "F14 add payment method"),
    ("taxRates", {"name": f"Smoke Tax {tag}", "rate": 5, "code": "SMK"}, "F17 add tax rate"),
    ("ledgerCategories", {"name": f"Smoke Category {tag}"}, "F13 add ledger category"),
    ("fundingSources", {"name": f"Smoke Source {tag}"}, "F20 add funding source"),
    ("collectionAgencies", {"name": f"Smoke Agency {tag}", "commissionRate": 10}, "F21 add collection agency"),
]:
    c, r = req("POST", f"{S}/e/{ent}", body, T)
    check(label, c == 201 and bool(r.get("id")), msg(r))
    if c == 201 and r.get("id"):
        fmade.append((ent, r["id"]))
camp = (fm.get("campuses") or [""])[0]
c, r = req("POST", f"{S}/e/lockouts", {"campuses": [camp.get("id") if isinstance(camp, dict) else camp], "startDate": "2026-02-01", "endDate": "2026-01-01"}, T)
check("F12 lock-out end before start (400)", c == 400 and "End Date" in msg(r), msg(r))
used = next((t for t in sitems("ledgerTypes") if t.get("taxes")), None)
if used:
    c, r = req("DELETE", f"{S}/e/taxRates/{used['taxes'][0]}", token=T)
    check("tax rate used by a ledger type cannot be deleted (409)", c == 409, msg(r))
fremoved = 0
for ent, fid in reversed(fmade):
    c, r = req("DELETE", f"{S}/e/{ent}/{fid}", token=T)
    fremoved += c == 200
check(f"finance config smoke records removed ({fremoved}/{len(fmade)})", fremoved == len(fmade))

print("\nHeritage screen smoke " + ("PASSED" if not failures else f"FAILED: {', '.join(failures)}"))
sys.exit(1 if failures else 0)

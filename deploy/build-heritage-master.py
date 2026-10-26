#!/usr/bin/env python3
"""Build the runtime Heritage screen registry from the approved Excel master."""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path
from zipfile import ZipFile

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def cell_value(cell: ET.Element) -> str:
    parts: list[str] = []
    for tag in ("f", "v", "is"):
        node = cell.find(f"./x:{tag}", NS)
        if node is not None:
            parts.extend(node.itertext())
    return "".join(parts).strip()


def read_sheet(archive: ZipFile, number: int) -> list[list[str]]:
    root = ET.fromstring(archive.read(f"xl/worksheets/sheet{number}.xml"))
    rows: list[list[str]] = []
    for row in root.findall(".//x:sheetData/x:row", NS):
        values: dict[int, str] = {}
        for cell in row.findall("./x:c", NS):
            ref = cell.attrib.get("r", "A1")
            letters = re.match(r"[A-Z]+", ref)
            if not letters:
                continue
            index = 0
            for char in letters.group(0):
                index = index * 26 + ord(char) - 64
            values[index - 1] = cell_value(cell)
        width = max(values, default=-1) + 1
        rows.append([values.get(index, "") for index in range(width)])
    return rows


def as_records(rows: list[list[str]]) -> list[dict[str, str]]:
    headers = rows[0]
    return [
        {header: row[index] if index < len(row) else "" for index, header in enumerate(headers)}
        for row in rows[1:]
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    with ZipFile(args.workbook) as archive:
        screens = as_records(read_sheet(archive, 2))
        data_points = as_records(read_sheet(archive, 3))
        flows = as_records(read_sheet(archive, 4))
        sidebar = as_records(read_sheet(archive, 5))
        open_points = as_records(read_sheet(archive, 7))

    points_by_screen: dict[str, list[dict[str, str]]] = defaultdict(list)
    for point in data_points:
        points_by_screen[point["Screen ID"]].append(
            {
                "id": point["Entry ID"],
                "type": point["Entry type"],
                "label": point["UI label / data point"],
                "status": point["Family extraction status"],
                "evidence": point["Evidence IDs"],
            }
        )

    flow_by_screen = {row["Screen ID"]: row for row in flows}
    gaps_by_screen = {row["Screen ID"]: row for row in open_points}
    runtime_screens = []
    for screen in screens:
        screen_id = screen["Screen ID"]
        flow = flow_by_screen.get(screen_id, {})
        gap = gaps_by_screen.get(screen_id)
        runtime_screens.append(
            {
                "id": screen_id,
                "module": screen["Module / context"],
                "name": screen["Screen / form family"],
                "screenType": screen["Screen type"],
                "status": screen["Extraction status"],
                "route": f"/admin/heritage/{screen_id.lower()}",
                "flow": flow.get("Visible action-flow", screen["Visible action-flow"]),
                "condition": flow.get("Limit / condition", screen["Source scope / caveat"]),
                "evidence": screen["Evidence IDs"],
                "dataPoints": points_by_screen.get(screen_id, []),
                "openPoint": (
                    {
                        "gap": gap["Coverage gap"],
                        "confirmation": gap["What requires confirmation"],
                        "status": gap["Review status"],
                    }
                    if gap
                    else None
                ),
            }
        )

    modules: dict[str, dict[str, object]] = {}
    for screen in runtime_screens:
        module = str(screen["module"])
        entry = modules.setdefault(module, {"name": module, "screens": [], "dataPointCount": 0})
        entry["screens"].append(
            {"id": screen["id"], "name": screen["name"], "route": screen["route"]}
        )
        entry["dataPointCount"] = int(entry["dataPointCount"]) + len(screen["dataPoints"])

    payload = {
        "source": args.workbook.name,
        "generatedFrom": "Screens, Data Points, Flows, Sidebar and Open Points worksheets",
        "counts": {
            "screens": len(runtime_screens),
            "dataPoints": len(data_points),
            "flows": len(flows),
            "sidebarEntries": len(sidebar),
            "modules": len(modules),
            "openPoints": len(open_points),
        },
        "modules": list(modules.values()),
        "sidebar": [
            {
                "root": row["Root module"],
                "level": row["Level"],
                "section": row["Section / parent"],
                "label": row["Navigation label"],
                "evidence": row["Evidence IDs"],
            }
            for row in sidebar
        ],
        "screens": runtime_screens,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps(payload["counts"], indent=2))


if __name__ == "__main__":
    main()

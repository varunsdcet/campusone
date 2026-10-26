#!/bin/bash
# open.sh <name> <yaml-steps-file> : runs steps (appId header added) then screenshots docs/qa/screenshots/<name>.png
cd "$(dirname "$0")/.."; source e2e/helpers.sh
name="$1"; steps="$2"
{ echo "appId: org.reactjs.native.example.HeritageMobile"; echo "---"; cat "$steps"; } > e2e/_open.yaml
maestro --device "$SIM_UDID" test e2e/_open.yaml > "/tmp/hm-open-$name.log" 2>&1 && echo "OK   $name" || { echo "FAIL $name"; grep -E "FAILED" "/tmp/hm-open-$name.log" | head -2; }
sleep 1; shot "$name"

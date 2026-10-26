#!/bin/bash
# Runs every e2e flow against the installed app on the simulator and writes a summary.
# Usage: bash e2e/run-all.sh [udid]
cd "$(dirname "$0")/.." || exit 1
source e2e/helpers.sh
export SIM_UDID="${1:-$SIM_UDID}"
OUT="docs/qa/e2e-results.txt"
echo "e2e run $(date) on $SIM_UDID" > "$OUT"
for f in login instructor-login student-learning student-checkout student-assignment instructor-attendance-grades workshop-approval persistence-restart forbidden-and-api; do
  if maestro --device "$SIM_UDID" test "e2e/$f.yaml" > "docs/qa/e2e-$f.log" 2>&1; then echo "PASS  $f" | tee -a "$OUT"; else echo "FAIL  $f (see docs/qa/e2e-$f.log)" | tee -a "$OUT"; fi
done
cat "$OUT"

#!/bin/bash
# Shared e2e helper: sets up Maestro + a project-local JRE (no system changes).
export JAVA_HOME="${JAVA_HOME:-/Users/akshat/.claude/jobs/5dff785a/tmp/tools/jre/jdk-21.0.12.1+1-jre/Contents/Home}"
export PATH="$JAVA_HOME/bin:/Users/akshat/.claude/jobs/5dff785a/tmp/tools/maestro/bin:$PATH"
export SIM_UDID="${SIM_UDID:-384B0841-A9EA-4273-9388-FAB511EF8B3B}"
shot() { xcrun simctl io "$SIM_UDID" screenshot "docs/qa/screenshots/$1.png" >/dev/null 2>&1; }
